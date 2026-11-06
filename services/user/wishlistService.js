import Wishlist from "../../models/wishlistModel.js";
import Product from "../../models/productModel.js";
import cartService from "./cartService.js";
import { RESPONSE_MESSAGES } from "../../constants/index.js";

/**
 * Get user's wishlist with populated active products
 * Automatically filters unlisted or deleted items
 * @param {string} userId
 * @returns {Promise<Object>}
 */
export const getWishlist = async (userId) => {
    try {
        let wishlist = await Wishlist.findOne({ user: userId })
            .populate({
                path: "products",
                populate: { path: "category" }
            });

        if (!wishlist) {
            wishlist = await Wishlist.create({ user: userId, products: [] });
            return {
                _id: wishlist._id,
                user: userId,
                products: [],
                count: 0
            };
        }

        // Clean up any deleted/unlisted products or products whose categories are unlisted/deleted
        const validProducts = [];
        const staleProductIds = [];

        for (const product of wishlist.products) {
            if (
                !product ||
                product.isDeleted ||
                !product.isListed ||
                (product.category && (product.category.isDeleted || !product.category.isListed))
            ) {
                if (product && product._id) {
                    staleProductIds.push(product._id);
                }
            } else {
                const effectivePrice = (product.salePrice && product.salePrice > 0 && product.salePrice < product.regularPrice)
                    ? product.salePrice
                    : product.regularPrice;
                const hasDiscount = Boolean(product.salePrice && product.salePrice > 0 && product.salePrice < product.regularPrice);
                const discountPercent = hasDiscount
                    ? Math.round(((product.regularPrice - product.salePrice) / product.regularPrice) * 100)
                    : 0;

                validProducts.push({
                    _id: product._id,
                    name: product.name,
                    description: product.description,
                    regularPrice: product.regularPrice,
                    salePrice: product.salePrice,
                    effectivePrice,
                    hasDiscount,
                    discountPercent,
                    stock: product.stock,
                    isOutOfStock: product.stock <= 0,
                    category: product.category,
                    images: product.images || [],
                    primaryImage: (product.images && product.images.length > 0) ? product.images[0] : "/uploads/hero_lighter.png"
                });
            }
        }

        // Background cleanup of stale product IDs
        if (staleProductIds.length > 0) {
            Wishlist.updateOne(
                { _id: wishlist._id },
                { $pull: { products: { $in: staleProductIds } } }
            ).catch(err => console.warn("Wishlist cleanup warning:", err.message));
        }

        return {
            _id: wishlist._id,
            user: userId,
            products: validProducts,
            count: validProducts.length
        };
    } catch (error) {
        console.error("wishlistService getWishlist error:", error);
        throw error;
    }
};

/**
 * Add a single product to user's wishlist
 * @param {string} userId
 * @param {string} productId
 * @returns {Promise<Object>}
 */
export const addToWishlist = async (userId, productId) => {
    try {
        const product = await Product.findOne({ _id: productId, isDeleted: false, isListed: true });
        if (!product) {
            const err = new Error(RESPONSE_MESSAGES.PRODUCT.UNAVAILABLE);
            err.code = "PRODUCT_NOT_FOUND";
            throw err;
        }

        const wishlist = await Wishlist.findOneAndUpdate(
            { user: userId },
            { $addToSet: { products: productId } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        return {
            success: true,
            inWishlist: true,
            count: wishlist.products.length,
            message: RESPONSE_MESSAGES.WISHLIST.ADDED_SUCCESS
        };
    } catch (error) {
        console.error("wishlistService addToWishlist error:", error);
        throw error;
    }
};

/**
 * Remove a product from user's wishlist
 * @param {string} userId
 * @param {string} productId
 * @returns {Promise<Object>}
 */
export const removeFromWishlist = async (userId, productId) => {
    try {
        const wishlist = await Wishlist.findOneAndUpdate(
            { user: userId },
            { $pull: { products: productId } },
            { new: true }
        );

        const count = wishlist ? wishlist.products.length : 0;
        return {
            success: true,
            inWishlist: false,
            count,
            message: RESPONSE_MESSAGES.WISHLIST.REMOVED_SUCCESS
        };
    } catch (error) {
        console.error("wishlistService removeFromWishlist error:", error);
        throw error;
    }
};

/**
 * Toggle product in user's wishlist (adds if not present, removes if present)
 * @param {string} userId
 * @param {string} productId
 * @returns {Promise<Object>}
 */
export const toggleWishlist = async (userId, productId) => {
    try {
        // Ensure wishlist doc exists
        let wishlist = await Wishlist.findOne({ user: userId });
        if (!wishlist) {
            wishlist = await Wishlist.create({ user: userId, products: [] });
        }

        const isCurrentlySaved = wishlist.products.some(
            id => id.toString() === productId.toString()
        );

        if (isCurrentlySaved) {
            const updated = await Wishlist.findOneAndUpdate(
                { user: userId },
                { $pull: { products: productId } },
                { new: true }
            );
            return {
                success: true,
                inWishlist: false,
                count: updated ? updated.products.length : 0,
                message: RESPONSE_MESSAGES.WISHLIST.REMOVED_SUCCESS
            };
        } else {
            const product = await Product.findOne({ _id: productId, isDeleted: false, isListed: true });
            if (!product) {
                const err = new Error(RESPONSE_MESSAGES.PRODUCT.UNAVAILABLE);
                err.code = "PRODUCT_NOT_FOUND";
                throw err;
            }

            const updated = await Wishlist.findOneAndUpdate(
                { user: userId },
                { $addToSet: { products: productId } },
                { new: true }
            );
            return {
                success: true,
                inWishlist: true,
                count: updated ? updated.products.length : 0,
                message: RESPONSE_MESSAGES.WISHLIST.ADDED_SUCCESS
            };
        }
    } catch (error) {
        console.error("wishlistService toggleWishlist error:", error);
        throw error;
    }
};

/**
 * Move item from wishlist to cart
 * (Adds to cart, then removes from wishlist)
 * @param {string} userId
 * @param {string} productId
 * @returns {Promise<Object>}
 */
export const moveToCart = async (userId, productId) => {
    try {
        const product = await Product.findOne({ _id: productId, isDeleted: false, isListed: true });
        if (!product) {
            const err = new Error(RESPONSE_MESSAGES.PRODUCT.UNAVAILABLE);
            err.code = "PRODUCT_NOT_FOUND";
            throw err;
        }

        if (product.stock <= 0) {
            const err = new Error(RESPONSE_MESSAGES.CART.OUT_OF_STOCK);
            err.code = "OUT_OF_STOCK";
            throw err;
        }

        let alreadyInCart = false;
        try {
            await cartService.addToCart(userId, productId, 1);
        } catch (cartErr) {
            if (cartErr.code === "ALREADY_IN_CART" || cartErr.alreadyInCart) {
                alreadyInCart = true;
                // Still ensure removed from wishlist
                await Wishlist.updateOne(
                    { user: userId },
                    { $pull: { products: productId } }
                );
            } else {
                throw cartErr;
            }
        }

        // Fetch remaining count
        const updatedWishlist = await Wishlist.findOne({ user: userId });
        const count = updatedWishlist ? updatedWishlist.products.length : 0;
        const cartCount = await cartService.getCartCount(userId);

        return {
            success: true,
            alreadyInCart,
            count,
            cartCount,
            message: alreadyInCart
                ? "This piece was already in your bag. Removed from wishlist."
                : RESPONSE_MESSAGES.WISHLIST.MOVED_TO_CART
        };
    } catch (error) {
        console.error("wishlistService moveToCart error:", error);
        throw error;
    }
};

/**
 * Get product IDs currently in user's wishlist as string array for fast UI checks
 * @param {string} userId
 * @returns {Promise<string[]>}
 */
export const getWishlistProductIds = async (userId) => {
    try {
        if (!userId) return [];
        const wl = await Wishlist.findOne({ user: userId }, { products: 1 }).lean();
        if (!wl || !Array.isArray(wl.products)) return [];
        return wl.products.map(id => id.toString());
    } catch (error) {
        console.error("wishlistService getWishlistProductIds error:", error);
        return [];
    }
};

/**
 * Get number of items in user's wishlist
 * @param {string} userId
 * @returns {Promise<number>}
 */
export const getWishlistCount = async (userId) => {
    try {
        if (!userId) return 0;
        const wl = await Wishlist.findOne({ user: userId }, { products: 1 }).lean();
        return wl && Array.isArray(wl.products) ? wl.products.length : 0;
    } catch (error) {
        console.error("wishlistService getWishlistCount error:", error);
        return 0;
    }
};

export default {
    getWishlist,
    addToWishlist,
    removeFromWishlist,
    toggleWishlist,
    moveToCart,
    getWishlistProductIds,
    getWishlistCount
};
