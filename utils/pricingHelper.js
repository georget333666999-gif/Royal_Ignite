import Offer from "../models/offerModel.js";

/**
 * Computes pricing details for a product (sale vs regular price).
 * @param {Object} product - Product document or plain object
 * @returns {{ hasDiscount: boolean, effectivePrice: number, discountPercent: number }}
 */
export const computeEffectivePricing = (product) => {
    if (!product) {
        return { hasDiscount: false, effectivePrice: 0, discountPercent: 0 };
    }
    const hasDiscount = Boolean(product.salePrice && product.salePrice > 0 && product.salePrice < product.regularPrice);
    const effectivePrice = hasDiscount ? product.salePrice : (product.regularPrice || 0);
    const discountPercent = hasDiscount && product.regularPrice > 0
        ? Math.round(((product.regularPrice - product.salePrice) / product.regularPrice) * 100)
        : 0;
    return { hasDiscount, effectivePrice, discountPercent };
};

/**
 * Batch-fetches active product & category offers for products that lack an appliedOffer.
 * Returns a fast lookup function `resolveOffer(product)` that resolves the offer in O(1).
 * @param {Array<Object>} products - Array of product objects or items with product attached
 * @returns {Promise<function(Object): (Object|null)>}
 */
export const createOfferResolver = async (products = []) => {
    const missingOfferProdIds = [];
    const missingOfferCatIds = new Set();

    for (const item of products) {
        const prod = item?.product || item;
        if (prod && !prod.appliedOffer && prod.isListed && !prod.isDeleted) {
            if (prod._id) missingOfferProdIds.push(prod._id);
            const catId = prod.category?._id || prod.category;
            if (catId) missingOfferCatIds.add(catId.toString());
        }
    }

    const directOfferMap = new Map();
    const catOfferMap = new Map();

    if (missingOfferProdIds.length > 0 || missingOfferCatIds.size > 0) {
        const now = new Date();
        const orConditions = [];
        if (missingOfferProdIds.length > 0) {
            orConditions.push({ offerType: "product", product: { $in: missingOfferProdIds } });
        }
        if (missingOfferCatIds.size > 0) {
            orConditions.push({ offerType: "category", category: { $in: [...missingOfferCatIds] } });
        }

        const fallbackOffers = await Offer.find({
            isActive: true,
            isDeleted: false,
            startDate: { $lte: now },
            endDate: { $gte: now },
            $or: orConditions
        }).lean();

        for (const off of fallbackOffers) {
            if (off.offerType === "product" && off.product) {
                const key = off.product.toString();
                if (!directOfferMap.has(key)) directOfferMap.set(key, off);
            } else if (off.offerType === "category" && off.category) {
                const key = off.category.toString();
                if (!catOfferMap.has(key)) catOfferMap.set(key, off);
            }
        }
    }

    return (prod) => {
        if (!prod) return null;
        if (prod.appliedOffer) return prod.appliedOffer;
        const prodKey = prod._id ? prod._id.toString() : null;
        const catId = prod.category?._id || prod.category;
        const catKey = catId ? catId.toString() : null;
        return (prodKey ? directOfferMap.get(prodKey) : null) || (catKey ? catOfferMap.get(catKey) : null) || null;
    };
};

export default {
    computeEffectivePricing,
    createOfferResolver
};
