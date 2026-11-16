import User from "../../models/userModel.js";
import cartService from "../../services/user/cartService.js";
import { HTTP_STATUS, RESPONSE_MESSAGES } from "../../constants/index.js";
import { getAuthenticatedUserId, handleBlockedUser } from "../../utils/authSession.js";

// Render user shopping cart page
export const getCartPage = async (req, res, next) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
            return res.redirect("/user/login?redirect=/cart&error=" + encodeURIComponent(RESPONSE_MESSAGES.CART.AUTH_REQUIRED));
        }

        const user = await User.findById(userId);
        if (!user || user.isBlocked) {
            return handleBlockedUser(req, res);
        }

        const cartData = await cartService.getCart(userId);

        res.set({
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
            "Surrogate-Control": "no-store"
        });

        return res.status(HTTP_STATUS.OK).render("cart", {
            pageTitle: "Your Atelier Bag — ROYAL IGNITE",
            isUserLoggedIn: true,
            userId,
            user,
            cart: cartData,
            error: req.query.error || null,
            success: req.query.success || null
        });
    } catch (err) {
        console.error("User cartController getCartPage error:", err);
        return next(err);
    }
};

// Add a product to the cart
export const postAddToCart = async (req, res, next) => {
    try {
        const userId = getAuthenticatedUserId(req);
        const { productId, quantity = 1, buyNow } = req.body;
        const isBuyNow = buyNow === "true" || buyNow === true;

        if (!userId) {
            if (req.xhr || req.headers.accept?.includes("application/json")) {
                return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                    success: false,
                    redirect: `/user/login?redirect=/products/${productId}`,
                    message: RESPONSE_MESSAGES.CART.AUTH_REQUIRED
                });
            }
            return res.redirect(`/user/login?redirect=/products/${productId}`);
        }

        const user = await User.findById(userId);
        if (!user || user.isBlocked) {
            return handleBlockedUser(req, res);
        }

        const updatedCart = await cartService.addToCart(userId, productId, quantity, { isBuyNow });

        if (req.xhr || req.headers.accept?.includes("application/json")) {
            return res.status(HTTP_STATUS.OK).json({
                success: true,
                message: RESPONSE_MESSAGES.CART.ADDED_SUCCESS,
                cart: updatedCart,
                count: updatedCart ? (updatedCart.itemCount || 0) : 0,
                wishlistCount: updatedCart?.wishlistCount
            });
        }

        if (isBuyNow) {
            return res.redirect(HTTP_STATUS.SEE_OTHER, "/checkout");
        }

        return res.redirect(HTTP_STATUS.SEE_OTHER, `/products/${productId}?success=` + encodeURIComponent(RESPONSE_MESSAGES.CART.ADDED_SUCCESS));
    } catch (err) {
        console.error("User cartController postAddToCart error:", err.message);

        if (req.xhr || req.headers.accept?.includes("application/json")) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                alreadyInCart: Boolean(err.alreadyInCart),
                message: err.message
            });
        }

        const productId = req.body?.productId || "";
        const isUnavailable = /unavailable|unlisted|blocked|not found|discontinued|removed|does not exist/i.test(err.message);
        const redirectPath = (!isUnavailable && productId) ? `/products/${productId}?error=` : "/products?error=";
        return res.redirect(redirectPath + encodeURIComponent(err.message));
    }
};

// Update quantity of a cart item with stock validations
export const postUpdateQuantity = async (req, res, next) => {
    try {
        const userId = getAuthenticatedUserId(req);
        const { productId, quantity } = req.body;

        if (!userId) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                message: RESPONSE_MESSAGES.COMMON.UNAUTHORIZED
            });
        }

        const updatedCart = await cartService.updateCartItemQuantity(userId, productId, quantity);

        if (req.xhr || req.headers.accept?.includes("application/json")) {
            return res.status(HTTP_STATUS.OK).json({
                success: true,
                message: RESPONSE_MESSAGES.CART.QUANTITY_UPDATED,
                cart: updatedCart
            });
        }

        return res.redirect("/cart");
    } catch (err) {
        console.error("User cartController postUpdateQuantity error:", err.message);

        if (req.xhr || req.headers.accept?.includes("application/json")) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: err.message
            });
        }

        return res.redirect("/cart?error=" + encodeURIComponent(err.message));
    }
};

// Remove an item from the cart
export const postRemoveFromCart = async (req, res, next) => {
    try {
        const userId = getAuthenticatedUserId(req);
        const { productId } = req.params;

        if (!userId) {
            return res.redirect("/user/login");
        }

        const updatedCart = await cartService.removeFromCart(userId, productId);

        if (req.xhr || req.headers.accept?.includes("application/json")) {
            return res.status(HTTP_STATUS.OK).json({
                success: true,
                message: RESPONSE_MESSAGES.CART.REMOVED_SUCCESS,
                cart: updatedCart
            });
        }

        return res.redirect(HTTP_STATUS.SEE_OTHER, "/cart?success=" + encodeURIComponent(RESPONSE_MESSAGES.CART.REMOVED_SUCCESS_ATELIER));
    } catch (err) {
        console.error("User cartController postRemoveFromCart error:", err.message);

        if (req.xhr || req.headers.accept?.includes("application/json")) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: err.message
            });
        }

        return res.redirect(HTTP_STATUS.SEE_OTHER, "/cart?error=" + encodeURIComponent(err.message));
    }
};

// Validate cart items before proceeding to checkout
export const getCheckout = async (req, res, next) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
            return res.redirect("/user/login?redirect=/cart");
        }

        const cartData = await cartService.getCart(userId);

        if (!cartData.items || cartData.items.length === 0) {
            return res.redirect("/cart?error=" + encodeURIComponent(RESPONSE_MESSAGES.CART.EMPTY_CART));
        }

        // Prevent checkout if any item is out of stock, unlisted, or exceeds inventory
        if (cartData.hasBlockingIssues) {
            const firstReason = cartData.blockingReasons?.[0] || RESPONSE_MESSAGES.CART.CHECKOUT_BLOCKED;
            return res.redirect("/cart?error=" + encodeURIComponent(firstReason));
        }

        // Proceed to checkout
        return res.redirect(HTTP_STATUS.SEE_OTHER, "/checkout");
    } catch (err) {
        console.error("User cartController getCheckout error:", err);
        return next(err);
    }
};

/**
 * Get count of items in cart for header badges
 */
export const getCartCount = async (req, res, next) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
            return res.status(HTTP_STATUS.OK).json({ success: true, count: 0 });
        }
        const count = await cartService.getCartCount(userId);
        return res.status(HTTP_STATUS.OK).json({ success: true, count });
    } catch (err) {
        console.error("User cartController getCartCount error:", err);
        return res.status(HTTP_STATUS.OK).json({ success: true, count: 0 });
    }
};

export default {
    getCartPage,
    postAddToCart,
    postUpdateQuantity,
    postRemoveFromCart,
    getCheckout,
    getCartCount
};
