import Product from "../../models/productModel.js";
import Cart from "../../models/cartModel.js";
import checkoutService from "../../services/user/checkoutService.js";
import addressService from "../../services/user/addressService.js";
import couponService from "../../services/user/couponService.js";
import { getRazorpayClient, getRazorpayKeyId, verifyRazorpaySignature } from "../../config/razorpay.js";
import { HTTP_STATUS, RESPONSE_MESSAGES } from "../../constants/index.js";
import { invalidateUserBadgeCache } from "../../utils/cache.js";
import { requireActiveUser, isAjaxRequest } from "../../utils/controllerHelpers.js";

/**
 * Helper to fetch checkout details whether Cart or Buy-Now
 */
const fetchCheckoutDetails = async (req, userId, coupon = null) => {
    let details;
    if (req.session?.buyNow) {
        const { productId, quantity } = req.session.buyNow;
        details = await checkoutService.getBuyNowCheckoutDetails(userId, productId, quantity, coupon);
    } else {
        details = await checkoutService.getCheckoutDetails(userId, coupon);
    }

    if (coupon && !details.financials.couponCode) {
        req.session.appliedCoupon = null;
    } else if (coupon && details.financials.couponCode && req.session?.appliedCoupon) {
        req.session.appliedCoupon.discountAmount = details.financials.couponDiscount;
    }

    return details;
};

/**
 * Shared order placement execution (Cart or Buy-Now, COD, Wallet, or Razorpay)
 */
const executeOrderPlacement = async ({ req, userId, addressId, paymentMethod, paymentStatus = "Pending", razorpayDetails = {} }) => {
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
            appliedCoupon,
            paymentStatus,
            ...razorpayDetails
        });
        req.session.buyNow = null;
    } else {
        order = await checkoutService.placeOrder({
            userId,
            addressId,
            paymentMethod,
            appliedCoupon,
            paymentStatus,
            ...razorpayDetails
        });
    }

    req.session.appliedCoupon = null;
    await invalidateUserBadgeCache(userId);
    return order;
};

/**
 * Helper to parse and normalize address request body
 */
const parseAddressBody = (body) => ({
    fullName: body.fullName,
    phone: body.phone,
    addressLine: body.addressLine,
    city: body.city,
    state: body.state,
    pincode: body.pincode,
    country: body.country || "India",
    addressType: body.addressType || "Home",
    isDefault: body.isDefault === "true" || body.isDefault === true
});

/**
 * Initiate Buy Now direct checkout (stores item in session and redirects to checkout)
 */
export const postBuyNow = async (req, res, next) => {
    const isAjax = isAjaxRequest(req);
    try {
        const auth = await requireActiveUser(req, res, {
            redirectUrl: `/user/login?redirect=/products/${req.body?.productId || ""}`
        });
        if (!auth) return;

        const { productId, quantity = 1 } = req.body;
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
 * Render user checkout page
 */
export const getCheckoutPage = async (req, res, next) => {
    try {
        const auth = await requireActiveUser(req, res, {
            redirectUrl: "/user/login?redirect=/checkout&error=" + encodeURIComponent(RESPONSE_MESSAGES.CHECKOUT.AUTH_REQUIRED)
        });
        if (!auth) return;
        const { userId, user } = auth;

        const isBuyNow = (req.query.buyNow === "true" || req.query.buyNow === "1") && Boolean(req.session?.buyNow);
        if (!isBuyNow && req.session?.buyNow && !req.query.buyNow) {
            req.session.buyNow = null;
        }

        const appliedCoupon = req.session?.appliedCoupon || null;
        const checkoutData = await fetchCheckoutDetails(req, userId, appliedCoupon);

        if (checkoutData.isEmpty) {
            return res.redirect(
                isBuyNow
                    ? "/shop?error=" + encodeURIComponent("Selected product is sold out.")
                    : "/cart?error=" + encodeURIComponent(RESPONSE_MESSAGES.CHECKOUT.EMPTY_BAG)
            );
        }

        if (checkoutData.hasBlockingIssues) {
            const firstReason = checkoutData.blockingReasons?.[0] || RESPONSE_MESSAGES.CHECKOUT.ITEMS_BLOCKED;
            return res.redirect((isBuyNow ? "/shop" : "/cart") + "?error=" + encodeURIComponent(firstReason));
        }

        const availableCoupons = await couponService.getAvailableCoupons(userId);

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
 * Place order using Cash on Delivery
 */
export const postPlaceOrder = async (req, res, next) => {
    const isAjax = isAjaxRequest(req);
    try {
        const auth = await requireActiveUser(req, res, {
            redirectUrl: "/user/login?redirect=/checkout",
            authMessage: RESPONSE_MESSAGES.CHECKOUT.AUTH_REQUIRED
        });
        if (!auth) return;
        const { userId } = auth;

        const { addressId, paymentMethod = "COD" } = req.body;
        const order = await executeOrderPlacement({ req, userId, addressId, paymentMethod, paymentStatus: "Pending" });

        const orderId = order.orderId || order._id;
        const redirectUrl = `/checkout/success/${orderId}`;

        if (isAjax) {
            return res.status(HTTP_STATUS.OK).json({
                success: true,
                message: RESPONSE_MESSAGES.CHECKOUT.ORDER_PLACED,
                redirect: redirectUrl,
                orderId
            });
        }
        return res.redirect(redirectUrl);
    } catch (err) {
        console.error("checkoutController postPlaceOrder error:", err);
        const isStockIssue = err.code === "STOCK_EXCEEDED" || err.code === "PRODUCT_UNAVAILABLE" || err.code === "ITEMS_BLOCKED";
        const clientMessage = isStockIssue
            ? err.message
            : (err.message || RESPONSE_MESSAGES.CHECKOUT.ORDER_FAILED);

        if (isAjax) {
            return res.status(err.statusCode || HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: clientMessage,
                code: err.code || "ORDER_PLACEMENT_FAILED"
            });
        }
        return res.redirect(`/checkout?error=${encodeURIComponent(clientMessage)}`);
    }
};

/**
 * Render order success confirmation page
 */
export const getOrderSuccessPage = async (req, res, next) => {
    try {
        const auth = await requireActiveUser(req, res, { redirectUrl: "/user/login" });
        if (!auth) return;
        const { userId, user } = auth;

        const { orderId } = req.params;
        const order = await checkoutService.getOrderByIdentifier(orderId, userId);

        if (!order) {
            return res.redirect("/orders?error=" + encodeURIComponent(RESPONSE_MESSAGES.ORDER.NOT_FOUND));
        }

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
 * Add shipping address during checkout
 */
export const postAddAddressCheckout = async (req, res) => {
    try {
        const auth = await requireActiveUser(req, res, { authMessage: RESPONSE_MESSAGES.AUTH.UNAUTHORIZED });
        if (!auth) return;
        const { userId } = auth;

        const addressPayload = parseAddressBody(req.body);
        const { fullName, phone, addressLine, city, state, pincode } = addressPayload;

        if (!fullName || !phone || !addressLine || !city || !state || !pincode) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: "All address fields marked with * are required."
            });
        }

        const newAddress = await addressService.createAddress({ userId, ...addressPayload });

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
 * Edit shipping address during checkout
 */
export const postEditAddressCheckout = async (req, res) => {
    try {
        const auth = await requireActiveUser(req, res, { authMessage: RESPONSE_MESSAGES.AUTH.UNAUTHORIZED });
        if (!auth) return;
        const { userId } = auth;

        const { addressId } = req.params;
        const updatedAddress = await addressService.updateAddress(addressId, userId, parseAddressBody(req.body));

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
 * Apply coupon code at checkout
 */
export const postApplyCoupon = async (req, res) => {
    try {
        const auth = await requireActiveUser(req, res, { authMessage: RESPONSE_MESSAGES.AUTH.UNAUTHORIZED });
        if (!auth) return;
        const { userId } = auth;

        const { code } = req.body;
        if (!code || !code.trim()) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: "Please enter a coupon code."
            });
        }

        if (req.session?.appliedCoupon) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: `Coupon "${req.session.appliedCoupon.code}" is already active. Please remove it first to apply another.`
            });
        }

        const initialCheckout = await fetchCheckoutDetails(req, userId);
        const validation = await couponService.validateCoupon(code, userId, initialCheckout.financials.subtotal);

        req.session.appliedCoupon = {
            code: validation.code,
            discountAmount: validation.discountAmount,
            discountType: validation.discountType,
            discountValue: validation.discountValue
        };

        const updatedCheckout = await fetchCheckoutDetails(req, userId, req.session.appliedCoupon);

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
 * Remove applied coupon from checkout
 */
export const postRemoveCoupon = async (req, res) => {
    try {
        const auth = await requireActiveUser(req, res, { authMessage: RESPONSE_MESSAGES.AUTH.UNAUTHORIZED });
        if (!auth) return;
        const { userId } = auth;

        req.session.appliedCoupon = null;
        const updatedCheckout = await fetchCheckoutDetails(req, userId, null);

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
 * Create Razorpay order token for online checkout
 */
export const postCreateRazorpayOrder = async (req, res) => {
    try {
        const auth = await requireActiveUser(req, res, { authMessage: RESPONSE_MESSAGES.CHECKOUT.AUTH_REQUIRED });
        if (!auth) return;
        const { userId, user } = auth;

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
        const checkoutData = await fetchCheckoutDetails(req, userId, appliedCoupon);

        if (checkoutData.isEmpty || checkoutData.hasBlockingIssues) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: checkoutData.blockingReasons?.[0] || "Acquisition cannot proceed with current items."
            });
        }

        const totalPayable = checkoutData.financials.totalAmount;
        const amountInPaise = Math.round(totalPayable * 100);

        if (amountInPaise <= 0) {
            // Fulfill directly as zero-payable order when total is ₹0 (100% coupon or full store credit)
            const order = await executeOrderPlacement({
                req,
                userId,
                addressId,
                paymentMethod: "COD",
                paymentStatus: "Completed"
            });
            return res.status(HTTP_STATUS.OK).json({
                success: true,
                isZeroPay: true,
                orderId: order.orderId,
                redirect: `/checkout/success/${order.orderId}`
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
 * Verify Razorpay payment signature and fulfill order
 */
export const postVerifyPayment = async (req, res) => {
    try {
        const auth = await requireActiveUser(req, res, { authMessage: RESPONSE_MESSAGES.CHECKOUT.AUTH_REQUIRED });
        if (!auth) return;
        const { userId } = auth;

        const { addressId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
        const isSignatureValid = verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);

        if (!isSignatureValid) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: "Payment signature verification failed. Your transaction could not be verified."
            });
        }

        const order = await executeOrderPlacement({
            req,
            userId,
            addressId,
            paymentMethod: "Razorpay",
            paymentStatus: "Completed",
            razorpayDetails: { razorpayOrderId, razorpayPaymentId, razorpaySignature }
        });

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
 * Record a failed online transaction for retry
 */
export const postPaymentFailed = async (req, res) => {
    try {
        const auth = await requireActiveUser(req, res);
        if (!auth) return;
        const { userId } = auth;

        const { addressId, razorpayOrderId, errorMessage } = req.body;
        const order = await executeOrderPlacement({
            req,
            userId,
            addressId,
            paymentMethod: "Razorpay",
            paymentStatus: "Failed",
            razorpayDetails: { razorpayOrderId }
        });

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
 * Render payment failure page with retry and redirect options
 */
export const getPaymentFailurePage = async (req, res, next) => {
    try {
        const auth = await requireActiveUser(req, res, { redirectUrl: "/user/login" });
        if (!auth) return;
        const { userId, user } = auth;

        const { orderId } = req.params;
        const order = await checkoutService.getOrderByIdentifier(orderId, userId);

        if (!order) {
            return res.redirect("/orders?error=" + encodeURIComponent(RESPONSE_MESSAGES.ORDER.NOT_FOUND));
        }

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
 * Generate new Razorpay order to retry payment on existing order
 */
export const postRetryPayment = async (req, res) => {
    try {
        const auth = await requireActiveUser(req, res, { authMessage: RESPONSE_MESSAGES.AUTH.UNAUTHORIZED });
        if (!auth) return;
        const { userId, user } = auth;

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
 * Verify Razorpay payment on retry and complete order
 */
export const postVerifyRetryPayment = async (req, res) => {
    try {
        const auth = await requireActiveUser(req, res, { authMessage: RESPONSE_MESSAGES.AUTH.UNAUTHORIZED });
        if (!auth) return;
        const { userId } = auth;

        const { orderId } = req.params;
        const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

        const isSignatureValid = verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
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

        const postRetryTasks = [];
        if (Array.isArray(order.items) && order.items.length > 0) {
            const productIds = order.items.map((i) => i.product);
            postRetryTasks.push(
                Cart.updateOne(
                    { user: userId },
                    { $pull: { items: { product: { $in: productIds } } } }
                ).then(() => invalidateUserBadgeCache(userId))
            );
        }

        if (order.coupon?.code) {
            postRetryTasks.push(couponService.recordCouponUsage(order.coupon.code, userId, order._id));
        }
        await Promise.all(postRetryTasks).catch(() => {});

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
