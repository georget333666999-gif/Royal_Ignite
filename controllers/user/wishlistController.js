import User from "../../models/userModel.js";
import wishlistService from "../../services/user/wishlistService.js";
import { HTTP_STATUS, RESPONSE_MESSAGES } from "../../constants/index.js";
import { getAuthenticatedUserId, handleBlockedUser } from "../../utils/authSession.js";

/**
 * Render wishlist page
 */
export const getWishlistPage = async (req, res, next) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
            return res.redirect("/user/login?redirect=/wishlist&error=" + encodeURIComponent(RESPONSE_MESSAGES.WISHLIST.AUTH_REQUIRED));
        }

        const user = await User.findById(userId);
        if (!user || user.isBlocked) {
            return handleBlockedUser(req, res);
        }

        const wishlistData = await wishlistService.getWishlist(userId);

        res.set({
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
            "Surrogate-Control": "no-store"
        });

        return res.status(HTTP_STATUS.OK).render("wishlist", {
            pageTitle: "Your Wishlist Vault — ROYAL IGNITE",
            isUserLoggedIn: true,
            userId,
            user,
            wishlist: wishlistData,
            products: wishlistData.products,
            count: wishlistData.count,
            error: req.query.error || null,
            success: req.query.success || null
        });
    } catch (err) {
        console.error("wishlistController getWishlistPage error:", err);
        return next(err);
    }
};

/**
 * Toggle product in user's wishlist (Add / Remove)
 */
export const toggleWishlist = async (req, res, next) => {
    try {
        const userId = getAuthenticatedUserId(req);
        const productId = req.body.productId || req.params.productId;

        if (!productId) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: RESPONSE_MESSAGES.PRODUCT.INVALID_ID
            });
        }

        if (!userId) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                redirect: `/user/login?redirect=/products/${productId}`,
                message: RESPONSE_MESSAGES.WISHLIST.AUTH_REQUIRED
            });
        }

        const user = await User.findById(userId);
        if (!user || user.isBlocked) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                message: RESPONSE_MESSAGES.AUTH.ACCOUNT_BLOCKED
            });
        }

        const result = await wishlistService.toggleWishlist(userId, productId);
        return res.status(HTTP_STATUS.OK).json(result);
    } catch (err) {
        console.error("wishlistController toggleWishlist error:", err);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: err.message || RESPONSE_MESSAGES.COMMON.SOMETHING_WENT_WRONG
        });
    }
};

/**
 * Explicit remove from wishlist
 */
export const removeFromWishlist = async (req, res, next) => {
    try {
        const userId = getAuthenticatedUserId(req);
        const productId = req.params.productId || req.body.productId;

        if (!userId) {
            if (req.xhr || req.headers.accept?.includes("application/json")) {
                return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                    success: false,
                    message: RESPONSE_MESSAGES.WISHLIST.AUTH_REQUIRED
                });
            }
            return res.redirect("/user/login?redirect=/wishlist");
        }

        const user = await User.findById(userId);
        if (!user || user.isBlocked) {
            return handleBlockedUser(req, res);
        }

        const result = await wishlistService.removeFromWishlist(userId, productId);

        if (req.xhr || req.headers.accept?.includes("application/json")) {
            return res.status(HTTP_STATUS.OK).json(result);
        }

        return res.redirect("/wishlist?success=" + encodeURIComponent(result.message));
    } catch (err) {
        console.error("wishlistController removeFromWishlist error:", err);
        if (req.xhr || req.headers.accept?.includes("application/json")) {
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: err.message || RESPONSE_MESSAGES.COMMON.SOMETHING_WENT_WRONG
            });
        }
        return next(err);
    }
};

/**
 * Move item from wishlist to shopping cart
 */
export const moveToCart = async (req, res, next) => {
    try {
        const userId = getAuthenticatedUserId(req);
        const productId = req.params.productId || req.body.productId;

        if (!userId) {
            if (req.xhr || req.headers.accept?.includes("application/json")) {
                return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                    success: false,
                    redirect: "/user/login?redirect=/wishlist",
                    message: RESPONSE_MESSAGES.WISHLIST.AUTH_REQUIRED
                });
            }
            return res.redirect("/user/login?redirect=/wishlist");
        }

        const user = await User.findById(userId);
        if (!user || user.isBlocked) {
            return handleBlockedUser(req, res);
        }

        const result = await wishlistService.moveToCart(userId, productId);

        if (req.xhr || req.headers.accept?.includes("application/json")) {
            return res.status(HTTP_STATUS.OK).json(result);
        }

        return res.redirect("/cart?success=" + encodeURIComponent(result.message));
    } catch (err) {
        console.error("wishlistController moveToCart error:", err);
        const isAjax = Boolean(req.xhr || req.headers.accept?.includes("application/json"));
        const message = err.message || RESPONSE_MESSAGES.COMMON.SOMETHING_WENT_WRONG;

        if (isAjax) {
            const status = err.code === "OUT_OF_STOCK" ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.INTERNAL_SERVER_ERROR;
            return res.status(status).json({
                success: false,
                message
            });
        }

        return res.redirect("/wishlist?error=" + encodeURIComponent(message));
    }
};

/**
 * Get count of items in wishlist for header badges
 */
export const getWishlistCount = async (req, res, next) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
            return res.status(HTTP_STATUS.OK).json({ success: true, count: 0 });
        }
        const count = await wishlistService.getWishlistCount(userId);
        return res.status(HTTP_STATUS.OK).json({ success: true, count });
    } catch (err) {
        console.error("wishlistController getWishlistCount error:", err);
        return res.status(HTTP_STATUS.OK).json({ success: true, count: 0 });
    }
};

export default {
    getWishlistPage,
    toggleWishlist,
    removeFromWishlist,
    moveToCart,
    getWishlistCount
};
