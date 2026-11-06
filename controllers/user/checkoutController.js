import User from "../../models/userModel.js";
import Product from "../../models/productModel.js";
import checkoutService from "../../services/user/checkoutService.js";
import addressService from "../../services/user/addressService.js";
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
        if (isBuyNow) {
            const { productId, quantity } = req.session.buyNow;
            checkoutData = await checkoutService.getBuyNowCheckoutDetails(userId, productId, quantity);
        } else {
            checkoutData = await checkoutService.getCheckoutDetails(userId);
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

        let order;
        if (isBuyNow) {
            const { productId, quantity } = req.session.buyNow;
            order = await checkoutService.placeBuyNowOrder({
                userId,
                addressId,
                productId,
                quantity,
                paymentMethod
            });
            req.session.buyNow = null; // Clean up Buy Now session
        } else {
            order = await checkoutService.placeOrder({
                userId,
                addressId,
                paymentMethod
            });
        }

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
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
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
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: err.message || RESPONSE_MESSAGES.COMMON.SOMETHING_WENT_WRONG
        });
    }
};

export default {
    postBuyNow,
    getCheckoutPage,
    postPlaceOrder,
    getOrderSuccessPage,
    postAddAddressCheckout,
    postEditAddressCheckout
};
