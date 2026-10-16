import mongoose from "mongoose";
import Cart from "../../models/cartModel.js";
import Wishlist from "../../models/wishlistModel.js";
import Product from "../../models/productModel.js";
import { CART, RESPONSE_MESSAGES } from "../../constants/index.js";

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
        if (product.isDeleted) {
            return { valid: false, message: "This masterpiece is no longer available in the atelier." };
        }
        if (!product.isListed) {
            return { valid: false, message: "This masterpiece has been unlisted from public acquisition." };
        }

        // Check category listed & delete state
        if (!product.category || product.category.isDeleted || !product.category.isListed) {
            return { valid: false, message: "This collection is currently unavailable." };
        }

        // Check stock
        if (product.stock <= 0) {
            return { valid: false, message: "This numbered edition is currently out of stock." };
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
        // 1. Validate product visibility and active status (d.ii)
        const validation = await validateProductForCart(productId);
        if (!validation.valid) {
            throw new Error(validation.message);
        }

        const { product, effectivePrice } = validation;

        // 2. Determine quantity limits (d.vi)
        const maxAllowedPerItem = Math.min(CART.MAX_QUANTITY_PER_ITEM, product.stock);
        const qtyToAdd = Math.max(1, parseInt(requestedQty, 10) || 1);

        if (qtyToAdd > maxAllowedPerItem) {
            throw new Error(`Maximum ${maxAllowedPerItem} units allowed for this piece.`);
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

        // 5. Remove from wishlist when added to cart (d.iv)
        try {
            await Wishlist.updateOne(
                { user: userId },
                { $pull: { products: product._id } }
            );
        } catch (wishlistErr) {
            console.warn("Could not update wishlist after adding to cart:", wishlistErr);
        }

        return getCart(userId);
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
                populate: { path: "category" }
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

        // Retrieve raw cart first to capture unpopulated product IDs
        const rawCart = await Cart.findOne({ user: userId }).select("items.product items._id").lean();
        const rawProductMap = new Map();
        if (rawCart && Array.isArray(rawCart.items)) {
            for (const rawItem of rawCart.items) {
                if (rawItem && rawItem._id) {
                    rawProductMap.set(rawItem._id.toString(), rawItem.product ? rawItem.product.toString() : null);
                }
            }
        }

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
                    unavailableReason: "This product is no longer in our catalog."
                });
                hasBlockingIssues = true;
                blockingReasons.push("An item in your bag has been removed from the catalog.");
                continue;
            }

            // Check if unlisted, soft deleted, or category unlisted/deleted (d.ii)
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
                    unavailableReason: "This creation or its collection has been archived or unlisted."
                });
                hasBlockingIssues = true;
                blockingReasons.push(`"${prod.name}" has been unlisted and cannot be purchased.`);
                continue;
            }

            // Check current pricing
            const hasDiscount = Boolean(prod.salePrice && prod.salePrice > 0 && prod.salePrice < prod.regularPrice);
            const currentEffectivePrice = hasDiscount ? prod.salePrice : prod.regularPrice;

            // Check stock status (d.vii)
            const isOutOfStock = prod.stock <= 0;
            const isInsufficientStock = !isOutOfStock && item.quantity > prod.stock;

            let unavailableReason = null;
            if (isOutOfStock) {
                hasBlockingIssues = true;
                unavailableReason = "This creation is now completely sold out.";
                blockingReasons.push(`"${prod.name}" is sold out. Please remove it to proceed.`);
            } else if (isInsufficientStock) {
                hasBlockingIssues = true;
                unavailableReason = `Only ${prod.stock} left in the atelier. Please reduce your quantity.`;
                blockingReasons.push(`"${prod.name}" has only ${prod.stock} pieces remaining.`);
            }

            const maxItemLimit = Math.min(CART.MAX_QUANTITY_PER_ITEM, prod.stock);
            const itemLineTotal = currentEffectivePrice * item.quantity;

            if (!isOutOfStock && !isInsufficientStock) {
                subtotal += itemLineTotal;
                itemCount += item.quantity;
            }

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
 * Update cart item quantity with strict stock bounds (d.v, d.vi)
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
            throw new Error("This piece is no longer available.");
        }
        if (!product.category || product.category.isDeleted || !product.category.isListed) {
            throw new Error("This collection has been archived.");
        }

        const maxAllowed = Math.min(CART.MAX_QUANTITY_PER_ITEM, product.stock);
        if (qty > maxAllowed) {
            throw new Error(
                `Cannot add ${qty} units. Maximum allowed for this piece is ${maxAllowed}.`
            );
        }

        // Recalculate price
        const hasDiscount = Boolean(product.salePrice && product.salePrice > 0 && product.salePrice < product.regularPrice);
        const effectivePrice = hasDiscount ? product.salePrice : product.regularPrice;

        cart.items[itemIndex].quantity = qty;
        cart.items[itemIndex].price = effectivePrice;
        await cart.save();

        return getCart(userId);
    } catch (error) {
        console.error("updateCartItemQuantity error:", error.message);
        throw error;
    }
};

/**
 * Remove an item from the user's cart (d.i)
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
        return getCart(userId);
    } catch (error) {
        console.error("clearCart error:", error.message);
        throw error;
    }
};

export default {
    validateProductForCart,
    addToCart,
    getCart,
    updateCartItemQuantity,
    removeFromCart,
    clearCart
};
