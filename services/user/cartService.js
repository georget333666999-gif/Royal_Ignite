import mongoose from "mongoose";
import Cart from "../../models/cartModel.js";
import Wishlist from "../../models/wishlistModel.js";
import Product from "../../models/productModel.js";
import { computeEffectivePricing, createOfferResolver } from "../../utils/pricingHelper.js";
import { CART, RESPONSE_MESSAGES } from "../../constants/index.js";
import { invalidateUserBadgeCache } from "../../utils/cache.js";

/**
 * Validates that a product is active, listed, non-deleted, and in a valid category
 */
export const validateProductForCart = async (productId) => {
    try {
        if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
            return { valid: false, message: "Invalid product identifier." };
        }

        const product = await Product.findById(productId).populate("category");
        if (!product) {
            return { valid: false, message: "Product does not exist." };
        }

        // Check product listed & delete state
        if (product.isDeleted || !product.isListed) {
            return { valid: false, message: "This item is currently unavailable." };
        }

        // Check category listed & delete state
        if (!product.category || product.category.isDeleted || !product.category.isListed) {
            return { valid: false, message: "This collection is currently unavailable." };
        }

        // Check stock
        if (product.stock <= 0) {
            return { valid: false, message: "This item is currently out of stock." };
        }

        // Calculate effective price
        const hasDiscount = Boolean(product.salePrice && product.salePrice > 0 && product.salePrice < product.regularPrice);
        const effectivePrice = hasDiscount ? product.salePrice : product.regularPrice;

        return {
            valid: true,
            product,
            effectivePrice
        };
    } catch (error) {
        console.error("validateProductForCart error:", error);
        throw error;
    }
};

/**
 * Add a product to the user's cart with stock validations, limits, and wishlist removal
 */
export const addToCart = async (userId, productId, requestedQty = 1, { isBuyNow = false } = {}) => {
    try {
        // 1. Validate product availability and status
        const validation = await validateProductForCart(productId);
        if (!validation.valid) {
            throw new Error(validation.message);
        }

        const { product, effectivePrice } = validation;

        // 2. Determine quantity limits
        const maxAllowedPerItem = Math.min(CART.MAX_QUANTITY_PER_ITEM, product.stock);
        const qtyToAdd = Math.max(1, parseInt(requestedQty, 10) || 1);

        if (qtyToAdd > maxAllowedPerItem) {
            throw new Error(`You can add up to ${maxAllowedPerItem} units of this item.`);
        }

        // 3. Find or create user cart
        let cart = await Cart.findOne({ user: userId });
        if (!cart) {
            cart = new Cart({
                user: userId,
                items: []
            });
        }

        // 4. Check if product is already in cart
        const itemIndex = cart.items.findIndex(
            (item) => item.product.toString() === product._id.toString()
        );

        if (itemIndex > -1) {
            if (isBuyNow) {
                return getCart(userId);
            }
            const error = new Error(RESPONSE_MESSAGES.CART.ALREADY_IN_CART);
            error.code = "ALREADY_IN_CART";
            error.alreadyInCart = true;
            throw error;
        } else {
            cart.items.push({
                product: product._id,
                quantity: qtyToAdd,
                price: effectivePrice
            });
        }

        await cart.save();

        // 5. Remove from wishlist & invalidate cached header badge counts in parallel
        await Promise.all([
            Wishlist.updateOne(
                { user: userId },
                { $pull: { products: product._id } }
            ).catch((wishlistErr) => {
                console.warn("Could not update wishlist after adding to cart:", wishlistErr);
            })
        ]);
        invalidateUserBadgeCache(userId);

        const [cartData, wl] = await Promise.all([
            getCart(userId),
            Wishlist.findOne({ user: userId }, { products: 1 }).lean().catch(() => null)
        ]);
        const wishlistCount = wl && Array.isArray(wl.products) ? wl.products.length : 0;
        cartData.wishlistCount = wishlistCount;
        return cartData;
    } catch (error) {
        console.error("addToCart error:", error.message);
        throw error;
    }
};

/**
 * Get user's cart with real-time stock inspection and checkout restriction flags
 */
export const getCart = async (userId) => {
    try {
        const cart = await Cart.findOne({ user: userId })
            .populate({
                path: "items.product",
                populate: [
                    { path: "category" },
                    { path: "appliedOffer" }
                ]
            })
            .lean();

        if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
            return {
                items: [],
                itemCount: 0,
                subtotal: 0,
                regularTotal: 0,
                savings: 0,
                taxEstimate: 0,
                courierCost: 0,
                totalPrice: 0,
                hasBlockingIssues: false,
                blockingReasons: []
            };
        }

        let subtotal = 0;
        let itemCount = 0;
        const processedItems = [];
        const blockingReasons = [];
        let hasBlockingIssues = false;

        // Only fetch raw cart IDs if any populated product is missing (deleted from DB)
        const rawProductMap = new Map();
        const hasMissingProduct = cart.items.some((item) => !item.product);
        if (hasMissingProduct) {
            const rawCart = await Cart.findOne({ user: userId }).select("items.product items._id").lean();
            if (rawCart && Array.isArray(rawCart.items)) {
                for (const rawItem of rawCart.items) {
                    if (rawItem && rawItem._id) {
                        rawProductMap.set(rawItem._id.toString(), rawItem.product ? rawItem.product.toString() : null);
                    }
                }
            }
        }

        // Batch-fetch fallback active offers via shared helper
        const resolveOffer = await createOfferResolver(cart.items);

        for (const item of cart.items) {
            const prod = item.product;
            const itemIdStr = item._id ? item._id.toString() : null;
            const rawProdId = itemIdStr && rawProductMap.has(itemIdStr) ? rawProductMap.get(itemIdStr) : null;

            // If product was completely removed/deleted from DB
            if (!prod) {
                processedItems.push({
                    _id: item._id,
                    productId: rawProdId || item._id,
                    quantity: item.quantity,
                    price: item.price,
                    isUnavailable: true,
                    unavailableReason: "This item is no longer available in our collection."
                });
                hasBlockingIssues = true;
                blockingReasons.push("An item in your bag is no longer available. Please remove it to proceed.");
                continue;
            }

            // Check if product or category is unlisted/deleted
            const isUnlisted = !prod.isListed || prod.isDeleted;
            const isCatUnlisted = !prod.category || prod.category.isDeleted || !prod.category.isListed;

            if (isUnlisted || isCatUnlisted) {
                processedItems.push({
                    _id: item._id,
                    productId: prod._id,
                    name: prod.name,
                    images: prod.images || [],
                    quantity: item.quantity,
                    price: item.price,
                    isUnavailable: true,
                    unavailableReason: "This item is currently unavailable."
                });
                hasBlockingIssues = true;
                blockingReasons.push(`"${prod.name}" is currently unavailable. Please remove it from your bag to proceed.`);
                continue;
            }

            // Check current pricing via shared pricing helper
            const { hasDiscount, effectivePrice: currentEffectivePrice } = computeEffectivePricing(prod);

            // Check inventory stock status
            const isOutOfStock = prod.stock <= 0;
            const isInsufficientStock = !isOutOfStock && item.quantity > prod.stock;

            let unavailableReason = null;
            if (isOutOfStock) {
                hasBlockingIssues = true;
                unavailableReason = "This item is currently out of stock.";
                blockingReasons.push(`"${prod.name}" is out of stock. Please remove it to proceed.`);
            } else if (isInsufficientStock) {
                hasBlockingIssues = true;
                unavailableReason = `Only ${prod.stock} left in stock. Please reduce your quantity.`;
                blockingReasons.push(`"${prod.name}" only has ${prod.stock} units available. Please adjust your quantity.`);
            }

            const maxItemLimit = Math.min(CART.MAX_QUANTITY_PER_ITEM, prod.stock);
            const itemLineTotal = currentEffectivePrice * item.quantity;

            if (!isOutOfStock && !isInsufficientStock) {
                subtotal += itemLineTotal;
                itemCount += item.quantity;
            }

            const appliedOffer = resolveOffer(prod);

            processedItems.push({
                _id: item._id,
                productId: prod._id,
                name: prod.name,
                categoryName: prod.category ? prod.category.name : "Exclusive Edition",
                images: prod.images || [],
                quantity: item.quantity,
                price: currentEffectivePrice,
                regularPrice: prod.regularPrice,
                hasDiscount,
                appliedOffer: appliedOffer,
                stock: prod.stock,
                maxAllowed: maxItemLimit,
                lineTotal: itemLineTotal,
                isOutOfStock,
                isInsufficientStock,
                isUnavailable: false,
                unavailableReason
            });
        }

        let regularTotal = 0;
        for (const itm of processedItems) {
            if (!itm.isOutOfStock && !itm.isInsufficientStock && !itm.isUnavailable) {
                regularTotal += (itm.regularPrice || itm.price) * itm.quantity;
            }
        }
        const savings = Math.max(0, regularTotal - subtotal);
        const courierCost = 0; // Complimentary Insured Courier
        const totalPrice = subtotal;

        return {
            items: processedItems,
            itemCount,
            subtotal,
            regularTotal,
            savings,
            courierCost,
            totalPrice,
            hasBlockingIssues,
            blockingReasons
        };
    } catch (error) {
        console.error("getCart error:", error);
        throw error;
    }
};

/**
 * Update cart item quantity with inventory stock validation
 */
export const updateCartItemQuantity = async (userId, productId, requestedQty) => {
    try {
        const qty = parseInt(requestedQty, 10);
        if (isNaN(qty) || qty < 1) {
            throw new Error("Quantity must be at least 1.");
        }

        const cart = await Cart.findOne({ user: userId });
        if (!cart) {
            throw new Error("Cart not found.");
        }

        const itemIndex = cart.items.findIndex(
            (item) => item.product.toString() === productId.toString()
        );
        if (itemIndex === -1) {
            throw new Error("Item not found in your bag.");
        }

        // Verify product stock & status
        const product = await Product.findById(productId).populate("category");
        if (!product || product.isDeleted || !product.isListed) {
            throw new Error("This item is currently unavailable.");
        }
        if (!product.category || product.category.isDeleted || !product.category.isListed) {
            throw new Error("This collection is currently unavailable.");
        }

        const maxAllowed = Math.min(CART.MAX_QUANTITY_PER_ITEM, product.stock);
        if (qty > maxAllowed) {
            throw new Error(
                `Only ${maxAllowed} units are available for this item.`
            );
        }

        // Recalculate price
        const hasDiscount = Boolean(product.salePrice && product.salePrice > 0 && product.salePrice < product.regularPrice);
        const effectivePrice = hasDiscount ? product.salePrice : product.regularPrice;

        cart.items[itemIndex].quantity = qty;
        cart.items[itemIndex].price = effectivePrice;
        await cart.save();
        invalidateUserBadgeCache(userId);

        return getCart(userId);
    } catch (error) {
        console.error("updateCartItemQuantity error:", error.message);
        throw error;
    }
};

/**
 * Remove an item from the user's cart
 */
export const removeFromCart = async (userId, productId) => {
    try {
        const targetId = new mongoose.Types.ObjectId(productId);
        await Cart.updateOne(
            { user: userId },
            {
                $pull: {
                    items: {
                        $or: [
                            { product: targetId },
                            { _id: targetId }
                        ]
                    }
                }
            }
        );
        invalidateUserBadgeCache(userId);

        return getCart(userId);
    } catch (error) {
        console.error("removeFromCart error:", error.message);
        throw error;
    }
};

/**
 * Clear all items from cart
 */
export const clearCart = async (userId) => {
    try {
        await Cart.updateOne({ user: userId }, { $set: { items: [] } });
        invalidateUserBadgeCache(userId);
        return getCart(userId);
    } catch (error) {
        console.error("clearCart error:", error.message);
        throw error;
    }
};

/**
 * Get total item count in user's cart (fast lightweight query)
 * @param {string} userId
 * @returns {Promise<number>}
 */
export const getCartCount = async (userId) => {
    try {
        if (!userId) return 0;
        const cartDoc = await Cart.findOne({ user: userId }).select("items.quantity").lean();
        if (!cartDoc || !Array.isArray(cartDoc.items)) return 0;
        return cartDoc.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    } catch (error) {
        console.error("cartService getCartCount error:", error);
        return 0;
    }
};

export default {
    validateProductForCart,
    addToCart,
    getCart,
    updateCartItemQuantity,
    removeFromCart,
    clearCart,
    getCartCount
};
