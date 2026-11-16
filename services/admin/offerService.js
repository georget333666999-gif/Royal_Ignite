import Offer from "../../models/offerModel.js";
import Product from "../../models/productModel.js";
import Category from "../../models/categoryModel.js";

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

        const products = await Product.find(query);
        const now = new Date();

        for (const product of products) {
            // Preserve original base sale price if present
            if (product.salePrice && product.baseSalePrice === null && !product.appliedOffer) {
                product.baseSalePrice = product.salePrice;
            }

            // Find best active product-specific offer
            const productOffer = await Offer.findOne({
                offerType: "product",
                product: product._id,
                isActive: true,
                isDeleted: false,
                startDate: { $lte: now },
                endDate: { $gte: now }
            }).sort({ discountValue: -1 });

            // Find best active category offer
            const categoryOffer = await Offer.findOne({
                offerType: "category",
                category: product.category,
                isActive: true,
                isDeleted: false,
                startDate: { $lte: now },
                endDate: { $gte: now }
            }).sort({ discountValue: -1 });

            let productDiscount = 0;
            if (productOffer) {
                if (productOffer.discountType === "percentage") {
                    productDiscount = Math.round(product.regularPrice * (productOffer.discountValue / 100));
                } else {
                    productDiscount = Number(productOffer.discountValue) || 0;
                }
            }

            let categoryDiscount = 0;
            if (categoryOffer) {
                if (categoryOffer.discountType === "percentage") {
                    categoryDiscount = Math.round(product.regularPrice * (categoryOffer.discountValue / 100));
                } else {
                    categoryDiscount = Number(categoryOffer.discountValue) || 0;
                }
            }

            // Pick the higher discount between product and category offers
            const largestDiscount = Math.max(productDiscount, categoryDiscount);

            if (largestDiscount > 0) {
                product.salePrice = Math.max(0, product.regularPrice - largestDiscount);
                product.appliedOffer = productDiscount >= categoryDiscount ? productOffer._id : categoryOffer._id;
            } else {
                // Revert to original baseline or null
                product.salePrice = product.baseSalePrice || null;
                product.appliedOffer = null;
            }

            await product.save();
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

        if (search && search.trim()) {
            query.name = { $regex: search.trim(), $options: "i" };
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
            totalOffers: totalCount
        };
    } catch (error) {
        console.error("offerService getOffers error:", error);
        throw error;
    }
};

/**
 * Create a new Offer (product, category, or referral) with strict validations
 */
export const createOffer = async (offerData) => {
    try {
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

        if (!endDate) {
            throw new Error("Offer expiration date is required.");
        }

        const end = new Date(endDate);
        if (isNaN(end.getTime()) || end <= new Date()) {
            throw new Error("Offer expiration date must be in the future.");
        }

        const start = startDate ? new Date(startDate) : new Date();

        let resolvedProduct = null;
        let resolvedCategory = null;
        const numDiscount = Number(discountValue) || 0;

        if (offerType === "product") {
            if (!productId) {
                throw new Error("A target product is required for product offers.");
            }
            const product = await Product.findOne({ _id: productId, isDeleted: false });
            if (!product) {
                throw new Error("Selected product does not exist or has been removed.");
            }
            resolvedProduct = product._id;

            if (discountType === "percentage") {
                if (numDiscount < 1 || numDiscount > 90) {
                    throw new Error("Percentage discount must be between 1% and 90%.");
                }
            } else if (discountType === "flat") {
                if (numDiscount <= 0 || numDiscount >= product.regularPrice) {
                    throw new Error(`Flat discount must be between ₹1 and ₹${product.regularPrice - 1}.`);
                }
            }
        } else if (offerType === "category") {
            if (!categoryId) {
                throw new Error("A target category is required for category offers.");
            }
            const category = await Category.findOne({ _id: categoryId, isDeleted: false });
            if (!category) {
                throw new Error("Selected category does not exist or has been removed.");
            }
            resolvedCategory = category._id;

            if (discountType === "percentage") {
                if (numDiscount < 1 || numDiscount > 90) {
                    throw new Error("Percentage discount must be between 1% and 90%.");
                }
            } else if (discountType === "flat") {
                if (numDiscount <= 0) {
                    throw new Error("Flat discount must be greater than zero.");
                }
            }
        } else if (offerType === "referral") {
            const numReferrer = Number(referrerReward) || 0;
            const numReferee = Number(refereeReward) || 0;
            if (numReferrer <= 0 && numReferee <= 0) {
                throw new Error("At least one referral reward (referrer or referee) must be greater than ₹0.");
            }
        }

        const newOffer = await Offer.create({
            name: name.trim(),
            offerType,
            description: description.trim(),
            discountType,
            discountValue: numDiscount,
            product: resolvedProduct,
            category: resolvedCategory,
            referrerReward: Number(referrerReward) || 0,
            refereeReward: Number(refereeReward) || 0,
            minOrderAmount: Math.max(0, Number(minOrderAmount) || 0),
            startDate: start,
            endDate: end,
            isActive: true,
            isDeleted: false
        });

        // Immediately reconcile prices if product or category offer
        if (offerType === "product") {
            await reconcileProductPrices({ productId: resolvedProduct });
        } else if (offerType === "category") {
            await reconcileProductPrices({ categoryId: resolvedCategory });
        }

        return newOffer;
    } catch (error) {
        console.error("offerService createOffer error:", error);
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
    createOffer,
    toggleOfferStatus,
    deleteOffer,
    reconcileProductPrices,
    getActiveReferralOffer
};

