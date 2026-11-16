import User from "../../models/userModel.js";
import Product from "../../models/productModel.js";
import Cart from "../../models/cartModel.js";
import checkoutService from "../../services/user/checkoutService.js";
import addressService from "../../services/user/addressService.js";
import couponService from "../../services/user/couponService.js";
import { getRazorpayClient, getRazorpayKeyId, verifyRazorpaySignature } from "../../config/razorpay.js";
import { HTTP_STATUS, RESPONSE_MESSAGES } from "../../constants/index.js";
import { getAuthenticatedUserId, handleBlockedUser } from "../../utils/authSession.js";

/**
 * Initiate Buy Now direct checkout (stores item in session and redirects to checkout)
 */
export const postBuyNow = async (req, res, next) => {
    const isAjax = Boolean(
        req.xhr || req.headers.accept?.includes("application/json") || req.body.format === "json"
    );
    try {
        const userId = getAuthenticatedUserId(req);
        const { productId, quantity = 1 } = req.body;

        if (!userId) {
            const redirectUrl = `/user/login?redirect=/products/${productId}`;
            if (isAjax) {
                return res.status(HTTP_STATUS.OK).json({ success: false, redirect: redirectUrl });
            }
            return res.redirect(redirectUrl);
        }

        const user = await User.findById(userId);
        if (!user || user.isBlocked) {
            return handleBlockedUser(req, res);
        }

        const product = await Product.findOne({ _id: productId, isDeleted: false, isListed: true });
        if (!product || product.stock < 1) {
            const message = "This creation is currently unavailable.";
            if (isAjax) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message });
            }
            return res.redirect(`/products/${productId}?error=` + encodeURIComponent(message));
        }

        const qty = Math.max(1, Math.min(parseInt(quantity, 10) || 1, product.stock, 5));
        req.session.buyNow = { productId, quantity: qty };

        const checkoutUrl = "/checkout?buyNow=1";
        if (isAjax) {
            return res.status(HTTP_STATUS.OK).json({ success: true, redirect: checkoutUrl });
        }
        return res.redirect(checkoutUrl);
    } catch (err) {
        console.error("checkoutController postBuyNow error:", err);
        if (isAjax) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: err.message });
        }
        return next(err);
    }
};

/**
 * Render the Bespoke Checkout Page (b.i, b.ii, b.iii)
 */
export const getCheckoutPage = async (req, res, next) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
            return res.redirect(
                "/user/login?redirect=/checkout&error=" +
                    encodeURIComponent(RESPONSE_MESSAGES.CHECKOUT.AUTH_REQUIRED)
            );
        }

        const user = await User.findById(userId);
        if (!user || user.isBlocked) {
            return handleBlockedUser(req, res);
        }

        const isBuyNow = (req.query.buyNow === "true" || req.query.buyNow === "1") && Boolean(req.session?.buyNow);
        if (!isBuyNow && req.session?.buyNow && !req.query.buyNow) {
            req.session.buyNow = null;
        }

        let checkoutData;
        const appliedCoupon = req.session?.appliedCoupon || null;
        if (isBuyNow) {
            const { productId, quantity } = req.session.buyNow;
            checkoutData = await checkoutService.getBuyNowCheckoutDetails(userId, productId, quantity, appliedCoupon);
        } else {
            checkoutData = await checkoutService.getCheckoutDetails(userId, appliedCoupon);
        }

        if (checkoutData.isEmpty) {
            return res.redirect(
                isBuyNow
                    ? "/shop?error=" + encodeURIComponent("Selected product is sold out.")
                    : "/cart?error=" + encodeURIComponent(RESPONSE_MESSAGES.CHECKOUT.EMPTY_BAG)
            );
        }

        if (checkoutData.hasBlockingIssues) {
            const firstReason =
                checkoutData.blockingReasons?.[0] || RESPONSE_MESSAGES.CHECKOUT.ITEMS_BLOCKED;
            return res.redirect((isBuyNow ? "/shop" : "/cart") + "?error=" + encodeURIComponent(firstReason));
        }

        const availableCoupons = await couponService.getAvailableCoupons(userId);

        res.set({
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
            "Surrogate-Control": "no-store"
        });

        return res.status(HTTP_STATUS.OK).render("checkout", {
            pageTitle: isBuyNow ? "Instant Acquisition — ROYAL IGNITE" : "Atelier Checkout — ROYAL IGNITE",
            isUserLoggedIn: true,
            isBuyNow,
            userId,
            user,
            cart: checkoutData.cart,
            items: checkoutData.items,
            addresses: checkoutData.addresses,
            selectedAddress: checkoutData.selectedAddress,
            financials: checkoutData.financials,
            appliedCoupon,
            availableCoupons,
            walletBalance: checkoutData.walletBalance || 0,
            razorpayKeyId: getRazorpayKeyId(),
            error: req.query.error || null,
            success: req.query.success || null
        });
    } catch (err) {
        console.error("checkoutController getCheckoutPage error:", err);
        return next(err);
    }
};

/**
 * Place Order with Cash on Delivery (b.iii)
 */
export const postPlaceOrder = async (req, res, next) => {
    const isAjax = Boolean(
        req.xhr || req.headers.accept?.includes("application/json") || req.body.format === "json"
    );
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
            if (isAjax) {
                return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                    success: false,
                    redirect: "/user/login?redirect=/checkout",
                    message: RESPONSE_MESSAGES.CHECKOUT.AUTH_REQUIRED
                });
            }
            return res.redirect("/user/login?redirect=/checkout");
        }

        const user = await User.findById(userId);
        if (!user || user.isBlocked) {
            return handleBlockedUser(req, res);
        }

        const { addressId, paymentMethod = "COD" } = req.body;
        const isBuyNow = Boolean(req.session?.buyNow);
        const appliedCoupon = req.session?.appliedCoupon || null;

        let order;
        if (isBuyNow) {
            const { productId, quantity } = req.session.buyNow;
            order = await checkoutService.placeBuyNowOrder({
                userId,
                addressId,
                productId,
                quantity,
                paymentMethod,
                appliedCoupon
            });
            req.session.buyNow = null;
        } else {
            order = await checkoutService.placeOrder({
                userId,
                addressId,
                paymentMethod,
                appliedCoupon
            });
        }

        req.session.appliedCoupon = null;

        const successRedirect = `/checkout/success/${order.orderId}`;

        if (isAjax) {
            return res.status(HTTP_STATUS.OK).json({
                success: true,
                orderId: order.orderId,
                redirect: successRedirect,
                message: RESPONSE_MESSAGES.ORDER.PLACED_SUCCESS
            });
        }

        return res.redirect(HTTP_STATUS.SEE_OTHER, successRedirect);
    } catch (err) {
        console.error("checkoutController postPlaceOrder error:", err);
        const errorMessage = err.message || RESPONSE_MESSAGES.COMMON.SOMETHING_WENT_WRONG;

        if (isAjax) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: errorMessage
            });
        }

        return res.redirect("/checkout?error=" + encodeURIComponent(errorMessage));
    }
};

/**
 * Render the Order Success Page (b.iv)
 */
export const getOrderSuccessPage = async (req, res, next) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
            return res.redirect("/user/login");
        }

        const user = await User.findById(userId);
        if (!user || user.isBlocked) {
            return handleBlockedUser(req, res);
        }

        const { orderId } = req.params;
        const order = await checkoutService.getOrderByIdentifier(orderId, userId);

        if (!order) {
            return res.redirect("/products?error=" + encodeURIComponent(RESPONSE_MESSAGES.ORDER.NOT_FOUND));
        }

        res.set({
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
            "Surrogate-Control": "no-store"
        });

        return res.status(HTTP_STATUS.OK).render("orderSuccess", {
            pageTitle: "Acquisition Confirmed — ROYAL IGNITE",
            isUserLoggedIn: true,
            userId,
            user,
            order
        });
    } catch (err) {
        console.error("checkoutController getOrderSuccessPage error:", err);
        return next(err);
    }
};

/**
 * Asynchronous add address endpoint for checkout modal (b.i)
 */
export const postAddAddressCheckout = async (req, res, next) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                message: RESPONSE_MESSAGES.AUTH.UNAUTHORIZED
            });
        }

        const {
            fullName,
            phone,
            addressLine,
            city,
            state,
            pincode,
            country = "India",
            addressType = "Home",
            isDefault = false
        } = req.body;

        if (!fullName || !phone || !addressLine || !city || !state || !pincode) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: "All address fields marked with * are required."
            });
        }

        const newAddress = await addressService.createAddress({
            userId,
            fullName,
            phone,
            addressLine,
            city,
            state,
            pincode,
            country,
            addressType,
            isDefault: isDefault === "true" || isDefault === true
        });

        return res.status(HTTP_STATUS.CREATED).json({
            success: true,
            address: newAddress,
            message: RESPONSE_MESSAGES.ADDRESS.ADDED_SUCCESS
        });
    } catch (err) {
        console.error("checkoutController postAddAddressCheckout error:", err);
        return res.status(err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: err.message || RESPONSE_MESSAGES.COMMON.SOMETHING_WENT_WRONG
        });
    }
};

/**
 * Asynchronous edit address endpoint for checkout modal (b.i)
 */
export const postEditAddressCheckout = async (req, res, next) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                message: RESPONSE_MESSAGES.AUTH.UNAUTHORIZED
            });
        }

        const { addressId } = req.params;
        const {
            fullName,
            phone,
            addressLine,
            city,
            state,
            pincode,
            country = "India",
            addressType = "Home",
            isDefault = false
        } = req.body;

        const updatedAddress = await addressService.updateAddress(addressId, userId, {
            fullName,
            phone,
            addressLine,
            city,
            state,
            pincode,
            country,
            addressType,
            isDefault: isDefault === "true" || isDefault === true
        });

        if (!updatedAddress) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                message: RESPONSE_MESSAGES.ADDRESS.NOT_FOUND
            });
        }

        return res.status(HTTP_STATUS.OK).json({
            success: true,
            address: updatedAddress,
            message: RESPONSE_MESSAGES.ADDRESS.UPDATED_SUCCESS
        });
    } catch (err) {
        console.error("checkoutController postEditAddressCheckout error:", err);
        return res.status(err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: err.message || RESPONSE_MESSAGES.COMMON.SOMETHING_WENT_WRONG
        });
    }
};

/**
 * Apply coupon code at checkout (e.i, e.ii, e.iii)
 */
export const postApplyCoupon = async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                message: RESPONSE_MESSAGES.AUTH.UNAUTHORIZED
            });
        }

        const { code } = req.body;
        if (!code || !code.trim()) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: "Please enter a coupon code."
            });
        }

        // Prevent multiple coupons (e.ii)
        if (req.session?.appliedCoupon) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: `Coupon "${req.session.appliedCoupon.code}" is already active. Please remove it first to apply another.`
            });
        }

        const isBuyNow = Boolean(req.session?.buyNow);
        let subtotal = 0;
        if (isBuyNow) {
            const { productId, quantity } = req.session.buyNow;
            const checkoutData = await checkoutService.getBuyNowCheckoutDetails(userId, productId, quantity);
            subtotal = checkoutData.financials.subtotal;
        } else {
            const checkoutData = await checkoutService.getCheckoutDetails(userId);
            subtotal = checkoutData.financials.subtotal;
        }

        const validation = await couponService.validateCoupon(code, userId, subtotal);

        req.session.appliedCoupon = {
            code: validation.code,
            discountAmount: validation.discountAmount,
            discountType: validation.discountType,
            discountValue: validation.discountValue
        };

        // Recalculate full financials
        let updatedCheckout;
        if (isBuyNow) {
            const { productId, quantity } = req.session.buyNow;
            updatedCheckout = await checkoutService.getBuyNowCheckoutDetails(userId, productId, quantity, req.session.appliedCoupon);
        } else {
            updatedCheckout = await checkoutService.getCheckoutDetails(userId, req.session.appliedCoupon);
        }

        return res.status(HTTP_STATUS.OK).json({
            success: true,
            message: `Privilege code "${validation.code}" applied! You save ₹${validation.discountAmount.toLocaleString("en-IN")}.`,
            coupon: validation,
            financials: updatedCheckout.financials
        });
    } catch (err) {
        console.error("checkoutController postApplyCoupon error:", err);
        return res.status(err.statusCode || HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: err.message || "Failed to apply coupon."
        });
    }
};

/**
 * Remove applied coupon from checkout (e.i)
 */
export const postRemoveCoupon = async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                message: RESPONSE_MESSAGES.AUTH.UNAUTHORIZED
            });
        }

        req.session.appliedCoupon = null;

        const isBuyNow = Boolean(req.session?.buyNow);
        let updatedCheckout;
        if (isBuyNow) {
            const { productId, quantity } = req.session.buyNow;
            updatedCheckout = await checkoutService.getBuyNowCheckoutDetails(userId, productId, quantity, null);
        } else {
            updatedCheckout = await checkoutService.getCheckoutDetails(userId, null);
        }

        return res.status(HTTP_STATUS.OK).json({
            success: true,
            message: "Coupon removed.",
            financials: updatedCheckout.financials
        });
    } catch (err) {
        console.error("checkoutController postRemoveCoupon error:", err);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Failed to remove coupon."
        });
    }
};

/**
 * Create a secure Razorpay order token for online checkout (a)
 */
export const postCreateRazorpayOrder = async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                message: RESPONSE_MESSAGES.CHECKOUT.AUTH_REQUIRED
            });
        }

        const user = await User.findById(userId);
        if (!user || user.isBlocked) {
            return handleBlockedUser(req, res);
        }

        const { addressId } = req.body;
        if (!addressId) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: "Please select a delivery destination before proceeding to payment."
            });
        }

        const address = await addressService.getAddressById(addressId, userId);
        if (!address) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                message: RESPONSE_MESSAGES.ADDRESS.NOT_FOUND
            });
        }

        const isBuyNow = Boolean(req.session?.buyNow);
        const appliedCoupon = req.session?.appliedCoupon || null;

        let checkoutData;
        if (isBuyNow) {
            const { productId, quantity } = req.session.buyNow;
            checkoutData = await checkoutService.getBuyNowCheckoutDetails(userId, productId, quantity, appliedCoupon);
        } else {
            checkoutData = await checkoutService.getCheckoutDetails(userId, appliedCoupon);
        }

        if (checkoutData.isEmpty || checkoutData.hasBlockingIssues) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: checkoutData.blockingReasons?.[0] || "Acquisition cannot proceed with current items."
            });
        }

        const totalPayable = checkoutData.financials.totalAmount;
        const amountInPaise = Math.round(totalPayable * 100);

        if (amountInPaise <= 0) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: "Total amount must be greater than zero for online payment."
            });
        }

        const rzpClient = getRazorpayClient();
        const rzpReceipt = `rcpt_${Date.now()}_${userId.toString().slice(-4)}`;
        const rzpOrder = await rzpClient.orders.create({
            amount: amountInPaise,
            currency: "INR",
            receipt: rzpReceipt,
            notes: {
                userId: userId.toString(),
                userEmail: user.email,
                isBuyNow: isBuyNow ? "true" : "false"
            }
        });

        return res.status(HTTP_STATUS.OK).json({
            success: true,
            razorpayOrderId: rzpOrder.id,
            amount: rzpOrder.amount,
            currency: rzpOrder.currency,
            key: getRazorpayKeyId(),
            user: {
                name: user.name || address.fullName,
                email: user.email,
                phone: address.phone
            }
        });
    } catch (err) {
        console.error("checkoutController postCreateRazorpayOrder error:", err);
        const desc = err?.error?.description || err?.message || "Failed to initialize payment gateway.";
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: desc
        });
    }
};

/**
 * Verify Razorpay payment signature and fulfill order (a, b)
 */
export const postVerifyPayment = async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                message: RESPONSE_MESSAGES.CHECKOUT.AUTH_REQUIRED
            });
        }

        const {
            addressId,
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature
        } = req.body;

        const isSignatureValid = verifyRazorpaySignature(
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature
        );

        if (!isSignatureValid) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: "Payment signature verification failed. Your transaction could not be verified."
            });
        }

        const isBuyNow = Boolean(req.session?.buyNow);
        const appliedCoupon = req.session?.appliedCoupon || null;

        let order;
        if (isBuyNow) {
            const { productId, quantity } = req.session.buyNow;
            order = await checkoutService.placeBuyNowOrder({
                userId,
                addressId,
                productId,
                quantity,
                paymentMethod: "Razorpay",
                paymentStatus: "Completed",
                razorpayOrderId,
                razorpayPaymentId,
                razorpaySignature,
                appliedCoupon
            });
            req.session.buyNow = null;
        } else {
            order = await checkoutService.placeOrder({
                userId,
                addressId,
                paymentMethod: "Razorpay",
                paymentStatus: "Completed",
                razorpayOrderId,
                razorpayPaymentId,
                razorpaySignature,
                appliedCoupon
            });
        }

        req.session.appliedCoupon = null;

        return res.status(HTTP_STATUS.OK).json({
            success: true,
            orderId: order.orderId,
            redirect: `/checkout/success/${order.orderId}`
        });
    } catch (err) {
        console.error("checkoutController postVerifyPayment error:", err);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: err.message || "An error occurred while confirming your payment."
        });
    }
};

/**
 * Record a failed/dismissed online transaction for retry (c)
 */
export const postPaymentFailed = async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false });
        }

        const { addressId, razorpayOrderId, errorMessage } = req.body;
        const isBuyNow = Boolean(req.session?.buyNow);
        const appliedCoupon = req.session?.appliedCoupon || null;

        let order;
        if (isBuyNow) {
            const { productId, quantity } = req.session.buyNow;
            order = await checkoutService.placeBuyNowOrder({
                userId,
                addressId,
                productId,
                quantity,
                paymentMethod: "Razorpay",
                paymentStatus: "Failed",
                razorpayOrderId,
                appliedCoupon
            });
            req.session.buyNow = null;
        } else {
            order = await checkoutService.placeOrder({
                userId,
                addressId,
                paymentMethod: "Razorpay",
                paymentStatus: "Failed",
                razorpayOrderId,
                appliedCoupon
            });
        }

        req.session.appliedCoupon = null;

        return res.status(HTTP_STATUS.OK).json({
            success: true,
            orderId: order.orderId,
            redirect: `/checkout/failure/${order.orderId}?reason=` + encodeURIComponent(errorMessage || "Payment attempt declined or interrupted")
        });
    } catch (err) {
        console.error("checkoutController postPaymentFailed error:", err);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: err.message || "Failed to record payment state."
        });
    }
};

/**
 * Render Payment Failure Page with Retry and Redirect options (c)
 */
export const getPaymentFailurePage = async (req, res, next) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
            return res.redirect("/user/login");
        }

        const user = await User.findById(userId);
        if (!user || user.isBlocked) {
            return handleBlockedUser(req, res);
        }

        const { orderId } = req.params;
        const order = await checkoutService.getOrderByIdentifier(orderId, userId);

        if (!order) {
            return res.redirect("/orders?error=" + encodeURIComponent(RESPONSE_MESSAGES.ORDER.NOT_FOUND));
        }

        res.set({
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
            "Surrogate-Control": "no-store"
        });

        return res.status(HTTP_STATUS.OK).render("paymentFailure", {
            pageTitle: "Payment Pending / Failed — ROYAL IGNITE",
            isUserLoggedIn: true,
            userId,
            user,
            order,
            failureReason: req.query.reason || "The transaction could not be processed by your bank or the payment window was closed.",
            razorpayKeyId: getRazorpayKeyId()
        });
    } catch (err) {
        console.error("checkoutController getPaymentFailurePage error:", err);
        return next(err);
    }
};

/**
 * Retry Payment: Generate new Razorpay order for existing failed order (c)
 */
export const postRetryPayment = async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                message: RESPONSE_MESSAGES.AUTH.UNAUTHORIZED
            });
        }

        const { orderId } = req.params;
        const order = await checkoutService.getOrderByIdentifier(orderId, userId);

        if (!order) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                message: RESPONSE_MESSAGES.ORDER.NOT_FOUND
            });
        }

        if (order.paymentStatus === "Completed") {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: "This acquisition is already paid and completed."
            });
        }

        const amountInPaise = Math.round(order.pricing.totalAmount * 100);
        const rzpClient = getRazorpayClient();
        const rzpOrder = await rzpClient.orders.create({
            amount: amountInPaise,
            currency: "INR",
            receipt: `retry_${Date.now()}_${order.orderId.slice(-6)}`,
            notes: {
                orderId: order.orderId,
                userId: userId.toString()
            }
        });

        order.razorpayOrderId = rzpOrder.id;
        await order.save();

        const user = await User.findById(userId);

        return res.status(HTTP_STATUS.OK).json({
            success: true,
            razorpayOrderId: rzpOrder.id,
            amount: rzpOrder.amount,
            currency: rzpOrder.currency,
            key: getRazorpayKeyId(),
            user: {
                name: user?.name || order.shippingAddress.fullName,
                email: user?.email,
                phone: order.shippingAddress.phone
            }
        });
    } catch (err) {
        console.error("checkoutController postRetryPayment error:", err);
        const desc = err?.error?.description || err?.message || "Failed to initialize retry payment.";
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: desc
        });
    }
};

/**
 * Verify Razorpay payment on retry and complete order (c)
 */
export const postVerifyRetryPayment = async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                message: RESPONSE_MESSAGES.AUTH.UNAUTHORIZED
            });
        }

        const { orderId } = req.params;
        const {
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature
        } = req.body;

        const isSignatureValid = verifyRazorpaySignature(
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature
        );

        if (!isSignatureValid) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: "Payment verification failed."
            });
        }

        const order = await checkoutService.getOrderByIdentifier(orderId, userId);
        if (!order) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                message: RESPONSE_MESSAGES.ORDER.NOT_FOUND
            });
        }

        order.paymentStatus = "Completed";
        order.paymentMethod = "Razorpay";
        order.razorpayOrderId = razorpayOrderId;
        order.razorpayPaymentId = razorpayPaymentId;
        order.razorpaySignature = razorpaySignature;
        order.orderStatus = "Placed";
        if (Array.isArray(order.items)) {
            order.items.forEach((item) => {
                if (item.status === "Pending") {
                    item.status = "Placed";
                }
            });
        }
        await order.save();

        // Since payment retry completed and order is placed, remove items from user's cart if present
        if (Array.isArray(order.items) && order.items.length > 0) {
            const productIds = order.items.map((i) => i.product);
            await Cart.updateOne(
                { user: userId },
                { $pull: { items: { product: { $in: productIds } } } }
            );
        }

        // Record coupon usage if any
        if (order.coupon?.code) {
            await couponService.recordCouponUsage(order.coupon.code, userId, order._id);
        }

        return res.status(HTTP_STATUS.OK).json({
            success: true,
            redirect: `/checkout/success/${order.orderId}`
        });
    } catch (err) {
        console.error("checkoutController postVerifyRetryPayment error:", err);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: err.message || "Failed to confirm retry payment."
        });
    }
};

export default {
    postBuyNow,
    getCheckoutPage,
    postPlaceOrder,
    getOrderSuccessPage,
    postAddAddressCheckout,
    postEditAddressCheckout,
    postApplyCoupon,
    postRemoveCoupon,
    postCreateRazorpayOrder,
    postVerifyPayment,
    postPaymentFailed,
    getPaymentFailurePage,
    postRetryPayment,
    postVerifyRetryPayment
};
