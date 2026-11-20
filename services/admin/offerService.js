import mongoose from "mongoose";
import Offer from "../../models/offerModel.js";
import Product from "../../models/productModel.js";
import Category from "../../models/categoryModel.js";
import { escapeRegex, sanitizeSearchQuery } from "../../utils/searchValidation.js";

const calculateOfferDiscount = (offer, regularPrice) => {
    if (!offer) return 0;
    if (offer.discountType === "percentage") {
        return Math.round(regularPrice * (offer.discountValue / 100));
    }
    return Number(offer.discountValue) || 0;
};

/**
 * Validate and normalize offer payload for creation and editing
 */
const validateOfferPayload = async (offerData) => {
    const {
        name,
        offerType,
        description = "",
        discountType = "percentage",
        discountValue = 0,
        productId = null,
        categoryId = null,
        referrerReward = 0,
        refereeReward = 0,
        minOrderAmount = 0,
        startDate,
        endDate
    } = offerData;

    if (!name || name.trim().length < 2 || name.trim().length > 100) {
        throw new Error("Offer title must be between 2 and 100 characters.");
    }

    if (!["product", "category", "referral"].includes(offerType)) {
        throw new Error("Invalid offer type specified.");
    }

    if (description && description.trim().length > 500) {
        throw new Error("Atelier notes cannot exceed 500 characters.");
    }

    if (!endDate) {
        throw new Error("Offer expiration date is required.");
    }

    const end = new Date(endDate);
    if (isNaN(end.getTime()) || end <= new Date()) {
        throw new Error("Offer expiration date must be in the future.");
    }

    const start = startDate ? new Date(startDate) : new Date();
    if (isNaN(start.getTime())) {
        throw new Error("Please provide a valid launch date.");
    }

    if (end <= start) {
        throw new Error("Offer expiration date must be after the launch date.");
    }

    let resolvedProduct = null;
    let resolvedCategory = null;
    const normalizedDiscountType = ["percentage", "flat"].includes(discountType) ? discountType : "percentage";
    const numDiscount = Number(discountValue) || 0;

    if (offerType === "product") {
        if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
            throw new Error("A target product is required for product offers.");
        }
        const product = await Product.findOne({ _id: productId, isDeleted: false });
        if (!product) {
            throw new Error("Selected product does not exist or has been removed.");
        }
        resolvedProduct = product._id;

        if (normalizedDiscountType === "percentage") {
            if (numDiscount < 1 || numDiscount > 90) {
                throw new Error("Percentage discount must be between 1% and 90%.");
            }
        } else if (normalizedDiscountType === "flat") {
            if (numDiscount <= 0 || numDiscount >= product.regularPrice) {
                throw new Error(`Flat discount must be between ₹1 and ₹${product.regularPrice - 1}.`);
            }
        }
    } else if (offerType === "category") {
        if (!categoryId || !mongoose.Types.ObjectId.isValid(categoryId)) {
            throw new Error("A target category is required for category offers.");
        }
        const category = await Category.findOne({ _id: categoryId, isDeleted: false });
        if (!category) {
            throw new Error("Selected category does not exist or has been removed.");
        }
        resolvedCategory = category._id;

        if (normalizedDiscountType === "percentage") {
            if (numDiscount < 1 || numDiscount > 90) {
                throw new Error("Percentage discount must be between 1% and 90%.");
            }
        } else if (normalizedDiscountType === "flat") {
            if (numDiscount <= 0) {
                throw new Error("Flat discount must be greater than zero.");
            }
        }
    } else if (offerType === "referral") {
        const numReferrer = Number(referrerReward) || 0;
        const numReferee = Number(refereeReward) || 0;
        if (numReferrer < 0 || numReferee < 0) {
            throw new Error("Referral rewards cannot be negative.");
        }
        if (numReferrer <= 0 && numReferee <= 0) {
            throw new Error("At least one referral reward (referrer or referee) must be greater than ₹0.");
        }
    }

    return {
        name: name.trim(),
        offerType,
        description: description ? description.trim() : "",
        discountType: offerType === "referral" ? "percentage" : normalizedDiscountType,
        discountValue: offerType === "referral" ? 0 : numDiscount,
        product: resolvedProduct,
        category: resolvedCategory,
        referrerReward: offerType === "referral" ? (Number(referrerReward) || 0) : 0,
        refereeReward: offerType === "referral" ? (Number(refereeReward) || 0) : 0,
        minOrderAmount: Math.max(0, Number(minOrderAmount) || 0),
        startDate: start,
        endDate: end
    };
};

/**
 * Reconcile product sale prices based on active product and category offers.
 * Applies the greater discount between product and category offers.
 *
 * @param {Object} options
 * @param {string} [options.productId]
 * @param {string} [options.categoryId]
 * @param {boolean} [options.all=false]
 */
export const reconcileProductPrices = async ({ productId, categoryId, all = false } = {}) => {
    try {
        const query = { isDeleted: false };
        if (productId) {
            query._id = productId;
        } else if (categoryId) {
            query.category = categoryId;
        } else if (!all) {
            return;
        }

        const products = await Product.find(query)
            .select("_id category regularPrice salePrice baseSalePrice appliedOffer")
            .lean();
        if (products.length === 0) return;

        const now = new Date();
        const productIds = products.map((p) => p._id);
        const categoryIds = [...new Set(products.map((p) => p.category?.toString()).filter(Boolean))];

        // Single batched query for all active product & category offers
        const activeOffers = await Offer.find({
            isActive: true,
            isDeleted: false,
            startDate: { $lte: now },
            endDate: { $gte: now },
            $or: [
                { offerType: "product", product: { $in: productIds } },
                { offerType: "category", category: { $in: categoryIds } }
            ]
        }).lean();

        const productOfferMap = new Map();
        const categoryOfferMap = new Map();
        for (const offer of activeOffers) {
            if (offer.offerType === "product" && offer.product) {
                const key = offer.product.toString();
                if (!productOfferMap.has(key)) productOfferMap.set(key, []);
                productOfferMap.get(key).push(offer);
            } else if (offer.offerType === "category" && offer.category) {
                const key = offer.category.toString();
                if (!categoryOfferMap.has(key)) categoryOfferMap.set(key, []);
                categoryOfferMap.get(key).push(offer);
            }
        }

        const bulkOps = [];

        for (const product of products) {
            let baseSalePrice = product.baseSalePrice;
            if (product.salePrice && baseSalePrice === null && !product.appliedOffer) {
                baseSalePrice = product.salePrice;
            }

            const pOffers = productOfferMap.get(product._id.toString()) || [];
            let bestProductOffer = null;
            let productDiscount = 0;
            for (const offer of pOffers) {
                const disc = calculateOfferDiscount(offer, product.regularPrice);
                if (disc > productDiscount) {
                    productDiscount = disc;
                    bestProductOffer = offer;
                }
            }

            const cOffers = product.category ? (categoryOfferMap.get(product.category.toString()) || []) : [];
            let bestCategoryOffer = null;
            let categoryDiscount = 0;
            for (const offer of cOffers) {
                const disc = calculateOfferDiscount(offer, product.regularPrice);
                if (disc > categoryDiscount) {
                    categoryDiscount = disc;
                    bestCategoryOffer = offer;
                }
            }

            const largestDiscount = Math.max(productDiscount, categoryDiscount);
            let nextSalePrice;
            let nextAppliedOffer;

            if (largestDiscount > 0) {
                nextSalePrice = Math.max(0, product.regularPrice - largestDiscount);
                nextAppliedOffer = productDiscount >= categoryDiscount ? bestProductOffer._id : bestCategoryOffer._id;
            } else {
                nextSalePrice = baseSalePrice || null;
                nextAppliedOffer = null;
            }

            const prevOfferId = product.appliedOffer ? product.appliedOffer.toString() : null;
            const nextOfferId = nextAppliedOffer ? nextAppliedOffer.toString() : null;

            if (
                nextSalePrice !== product.salePrice ||
                baseSalePrice !== product.baseSalePrice ||
                prevOfferId !== nextOfferId
            ) {
                bulkOps.push({
                    updateOne: {
                        filter: { _id: product._id },
                        update: {
                            $set: {
                                salePrice: nextSalePrice,
                                baseSalePrice,
                                appliedOffer: nextAppliedOffer
                            }
                        }
                    }
                });
            }
        }

        if (bulkOps.length > 0) {
            await Product.bulkWrite(bulkOps);
        }
    } catch (error) {
        console.error("offerService reconcileProductPrices error:", error);
        throw error;
    }
};

/**
 * Get paginated list of offers with search and filter
 */
export const getOffers = async ({ search = "", type = "all", page = 1, limit = 10 } = {}) => {
    try {
        const query = { isDeleted: false };

        const { value: cleanSearch, error: searchError } = sanitizeSearchQuery(search);
        if (cleanSearch) {
            query.name = { $regex: escapeRegex(cleanSearch), $options: "i" };
        }

        if (type && type !== "all") {
            query.offerType = type;
        }

        const currentPage = Math.max(1, parseInt(page, 10) || 1);
        const pageLimit = Math.max(1, parseInt(limit, 10) || 10);
        const skip = (currentPage - 1) * pageLimit;

        const [offers, totalCount] = await Promise.all([
            Offer.find(query)
                .populate("product", "name regularPrice images")
                .populate("category", "name")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(pageLimit)
                .lean(),
            Offer.countDocuments(query)
        ]);

        return {
            offers,
            currentPage,
            totalPages: Math.ceil(totalCount / pageLimit) || 1,
            totalOffers: totalCount,
            search: cleanSearch,
            searchError
        };
    } catch (error) {
        console.error("offerService getOffers error:", error);
        throw error;
    }
};

/**
 * Get a single offer by ID for editing
 */
export const getOfferById = async (offerId) => {
    try {
        if (!offerId || !mongoose.Types.ObjectId.isValid(offerId)) {
            throw new Error("Invalid offer identifier.");
        }

        const offer = await Offer.findOne({ _id: offerId, isDeleted: false })
            .populate("product", "name regularPrice")
            .populate("category", "name")
            .lean();

        if (!offer) {
            throw new Error("Offer not found.");
        }

        return offer;
    } catch (error) {
        console.error("offerService getOfferById error:", error);
        throw error;
    }
};

/**
 * Create a new Offer (product, category, or referral) with strict validations
 */
export const createOffer = async (offerData) => {
    try {
        const validated = await validateOfferPayload(offerData);

        const newOffer = await Offer.create({
            ...validated,
            isActive: true,
            isDeleted: false
        });

        // Immediately reconcile prices if product or category offer
        if (validated.offerType === "product" && validated.product) {
            await reconcileProductPrices({ productId: validated.product });
        } else if (validated.offerType === "category" && validated.category) {
            await reconcileProductPrices({ categoryId: validated.category });
        }

        return newOffer;
    } catch (error) {
        console.error("offerService createOffer error:", error);
        throw error;
    }
};

/**
 * Update an existing Offer and reconcile both previous and new target prices
 */
export const updateOffer = async (offerId, offerData) => {
    try {
        if (!offerId || !mongoose.Types.ObjectId.isValid(offerId)) {
            throw new Error("Invalid offer identifier.");
        }

        const offer = await Offer.findOne({ _id: offerId, isDeleted: false });
        if (!offer) {
            throw new Error("Offer not found.");
        }

        const validated = await validateOfferPayload(offerData);

        const oldOfferType = offer.offerType;
        const oldProductId = offer.product ? offer.product.toString() : null;
        const oldCategoryId = offer.category ? offer.category.toString() : null;

        offer.name = validated.name;
        offer.offerType = validated.offerType;
        offer.description = validated.description;
        offer.discountType = validated.discountType;
        offer.discountValue = validated.discountValue;
        offer.product = validated.product;
        offer.category = validated.category;
        offer.referrerReward = validated.referrerReward;
        offer.refereeReward = validated.refereeReward;
        offer.minOrderAmount = validated.minOrderAmount;
        offer.startDate = validated.startDate;
        offer.endDate = validated.endDate;

        await offer.save();

        const newProductId = validated.product ? validated.product.toString() : null;
        const newCategoryId = validated.category ? validated.category.toString() : null;

        // Reconcile old target if offer scope or target changed
        if (oldOfferType === "product" && oldProductId && (validated.offerType !== "product" || oldProductId !== newProductId)) {
            await reconcileProductPrices({ productId: oldProductId });
        } else if (oldOfferType === "category" && oldCategoryId && (validated.offerType !== "category" || oldCategoryId !== newCategoryId)) {
            await reconcileProductPrices({ categoryId: oldCategoryId });
        }

        // Reconcile current target
        if (validated.offerType === "product" && validated.product) {
            await reconcileProductPrices({ productId: validated.product });
        } else if (validated.offerType === "category" && validated.category) {
            await reconcileProductPrices({ categoryId: validated.category });
        }

        return offer;
    } catch (error) {
        console.error("offerService updateOffer error:", error);
        throw error;
    }
};

/**
 * Toggle offer activation status and reconcile affected product prices
 */
export const toggleOfferStatus = async (offerId) => {
    try {
        const offer = await Offer.findOne({ _id: offerId, isDeleted: false });
        if (!offer) {
            throw new Error("Offer not found.");
        }

        offer.isActive = !offer.isActive;
        await offer.save();

        if (offer.offerType === "product" && offer.product) {
            await reconcileProductPrices({ productId: offer.product });
        } else if (offer.offerType === "category" && offer.category) {
            await reconcileProductPrices({ categoryId: offer.category });
        }

        return offer;
    } catch (error) {
        console.error("offerService toggleOfferStatus error:", error);
        throw error;
    }
};

/**
 * Soft delete offer and reconcile affected product prices
 */
export const deleteOffer = async (offerId) => {
    try {
        const offer = await Offer.findOne({ _id: offerId, isDeleted: false });
        if (!offer) {
            throw new Error("Offer not found.");
        }

        offer.isDeleted = true;
        offer.isActive = false;
        await offer.save();

        if (offer.offerType === "product" && offer.product) {
            await reconcileProductPrices({ productId: offer.product });
        } else if (offer.offerType === "category" && offer.category) {
            await reconcileProductPrices({ categoryId: offer.category });
        }

        return true;
    } catch (error) {
        console.error("offerService deleteOffer error:", error);
        throw error;
    }
};

/**
 * Get active referral offer (for signup referral reward attribution)
 */
export const getActiveReferralOffer = async () => {
    try {
        const now = new Date();
        return await Offer.findOne({
            offerType: "referral",
            isActive: true,
            isDeleted: false,
            startDate: { $lte: now },
            endDate: { $gte: now }
        }).sort({ createdAt: -1 });
    } catch (error) {
        console.error("offerService getActiveReferralOffer error:", error);
        return null;
    }
};

export default {
    getOffers,
    getOfferById,
    createOffer,
    updateOffer,
    toggleOfferStatus,
    deleteOffer,
    reconcileProductPrices,
    getActiveReferralOffer
};

