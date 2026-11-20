import mongoose from "mongoose";
import Product from "../../models/productModel.js";
import Category from "../../models/categoryModel.js";
import Offer from "../../models/offerModel.js";
import { RESPONSE_MESSAGES } from "../../constants/index.js";
import { getCache, setCache } from "../../utils/cache.js";

const ACTIVE_CATEGORIES_CACHE_KEY = "catalog:activeCategoriesWithCounts";
const ACTIVE_CATEGORIES_TTL_MS = 30000;

/**
 * Escapes regex special characters to prevent regex injection
 */
const escapeRegex = (value = "") => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

/**
 * Fetch all publicly active categories with count of listed products
 */
export const getActiveCategoriesWithCounts = async () => {
    try {
        const cached = getCache(ACTIVE_CATEGORIES_CACHE_KEY);
        if (cached) return cached;

        // 1. Find all listed & non-deleted categories
        const categories = await Category.find({ isListed: true, isDeleted: false })
            .sort({ name: 1 })
            .lean();

        const categoryIds = categories.map((c) => c._id);

        // 2. Count active, listed products per active category
        const counts = await Product.aggregate([
            {
                $match: {
                    isListed: true,
                    isDeleted: false,
                    category: { $in: categoryIds }
                }
            },
            {
                $group: {
                    _id: "$category",
                    count: { $sum: 1 }
                }
            }
        ]);

        const countMap = {};
        counts.forEach((item) => {
            countMap[item._id.toString()] = item.count;
        });

        const totalActiveProducts = counts.reduce((acc, curr) => acc + curr.count, 0);

        const result = {
            categories: categories.map((cat) => ({
                ...cat,
                productCount: countMap[cat._id.toString()] || 0
            })),
            totalActiveProducts
        };

        return setCache(ACTIVE_CATEGORIES_CACHE_KEY, result, ACTIVE_CATEGORIES_TTL_MS);
    } catch (error) {
        console.error("getActiveCategoriesWithCounts error:", error);
        throw error;
    }
};

/**
 * Get paginated, filtered, searched, and sorted products for public catalog
 */
export const getShopProducts = async ({
    search = "",
    category = "",
    minPrice,
    maxPrice,
    sort = "newest",
    inStockOnly = false,
    page = 1,
    limit = 9
} = {}) => {
    try {
        // 1. Reuse cached active categories & sidebar counts (eliminates 2 redundant Atlas queries)
        const { categories: categoryListWithCounts, totalActiveProducts } = await getActiveCategoriesWithCounts();
        const activeCategories = categoryListWithCounts;
        const activeCategoryIds = activeCategories.map((c) => c._id);

    // If no active categories exist, return empty list
    if (activeCategoryIds.length === 0) {
        return {
            products: [],
            totalProducts: 0,
            totalPages: 1,
            currentPage: 1,
            limit,
            categories: [],
            totalActiveProducts: 0
        };
    }

    // 2. Base Match Filter: Listed, not deleted, belonging to active categories
    const matchFilter = {
        isListed: true,
        isDeleted: false,
        category: { $in: activeCategoryIds }
    };

    // Category filter: supports ObjectId OR friendly category name
    let selectedCategoryId = "";
    if (category) {
        if (mongoose.Types.ObjectId.isValid(category)) {
            const catObjectId = new mongoose.Types.ObjectId(category);
            const isCatActive = activeCategoryIds.some((id) => id.equals(catObjectId));
            if (isCatActive) {
                matchFilter.category = catObjectId;
                selectedCategoryId = catObjectId.toString();
            } else {
                matchFilter.category = null;
            }
        } else {
            const cleanQuery = category.toLowerCase().replace(/[^a-z0-9]/g, "");
            const foundCat = activeCategories.find((c) => {
                const cleanName = c.name.toLowerCase().replace(/[^a-z0-9]/g, "");
                return cleanName === cleanQuery || cleanName.includes(cleanQuery) || cleanQuery.includes(cleanName);
            });
            if (foundCat) {
                matchFilter.category = foundCat._id;
                selectedCategoryId = foundCat._id.toString();
            }
        }
    }

    // In-stock filter
    if (inStockOnly === true || inStockOnly === "true") {
        matchFilter.stock = { $gt: 0 };
    }

    // Search filter across product name, description, or matching category name
    const trimmedSearch = (search || "").trim();
    if (trimmedSearch) {
        const safeSearch = escapeRegex(trimmedSearch);
        const searchRegex = new RegExp(safeSearch, "i");

        // Find active categories matching the search term
        const matchingCategoryIds = activeCategories
            .filter((c) => searchRegex.test(c.name))
            .map((c) => c._id);

        matchFilter.$or = [
            { name: searchRegex },
            { description: searchRegex },
            { category: { $in: matchingCategoryIds } }
        ];
    }

    // 3. Build Aggregation Pipeline
    const pipeline = [
        { $match: matchFilter },
        // Calculate effective price: salePrice if present and valid (< regularPrice and > 0), else regularPrice
        {
            $addFields: {
                effectivePrice: {
                    $cond: [
                        {
                            $and: [
                                { $ne: ["$salePrice", null] },
                                { $gt: ["$salePrice", 0] },
                                { $lt: ["$salePrice", "$regularPrice"] }
                            ]
                        },
                        "$salePrice",
                        "$regularPrice"
                    ]
                }
            }
        }
    ];

    // Price range filter
    const parsedMinPrice = minPrice !== undefined && minPrice !== "" ? Number(minPrice) : null;
    const parsedMaxPrice = maxPrice !== undefined && maxPrice !== "" ? Number(maxPrice) : null;

    if ((parsedMinPrice !== null && !isNaN(parsedMinPrice)) || (parsedMaxPrice !== null && !isNaN(parsedMaxPrice))) {
        const priceFilter = {};
        if (parsedMinPrice !== null && !isNaN(parsedMinPrice) && parsedMinPrice >= 0) {
            priceFilter.$gte = parsedMinPrice;
        }
        if (parsedMaxPrice !== null && !isNaN(parsedMaxPrice) && parsedMaxPrice >= 0) {
            priceFilter.$lte = parsedMaxPrice;
        }
        pipeline.push({
            $match: {
                effectivePrice: priceFilter
            }
        });
    }

    // 4. Determine Sorting
    let sortStage = {};
    let collation = null;

    switch (sort) {
        case "price_asc":
            sortStage = { effectivePrice: 1, createdAt: -1 };
            break;
        case "price_desc":
            sortStage = { effectivePrice: -1, createdAt: -1 };
            break;
        case "name_asc":
            sortStage = { name: 1 };
            collation = { locale: "en", strength: 2 };
            break;
        case "name_desc":
            sortStage = { name: -1 };
            collation = { locale: "en", strength: 2 };
            break;
        case "newest":
        default:
            sortStage = { createdAt: -1 };
            break;
    }

    pipeline.push({ $sort: sortStage });

    // 5. Facet for total count and paginated items, running $lookup only on paginated items
    const parsedLimit = Math.max(1, Math.min(Number(limit) || 9, 36));
    const parsedPage = Math.max(1, Number(page) || 1);
    const skip = (parsedPage - 1) * parsedLimit;
    const now = new Date();

    const facetStage = {
        $facet: {
            metadata: [{ $count: "total" }],
            products: [
                { $skip: skip },
                { $limit: parsedLimit },
                {
                    $lookup: {
                        from: "categories",
                        localField: "category",
                        foreignField: "_id",
                        as: "categoryDoc"
                    }
                },
                {
                    $unwind: {
                        path: "$categoryDoc",
                        preserveNullAndEmptyArrays: false
                    }
                },
                {
                    $lookup: {
                        from: "offers",
                        localField: "appliedOffer",
                        foreignField: "_id",
                        as: "appliedOfferDoc"
                    }
                },
                {
                    $unwind: {
                        path: "$appliedOfferDoc",
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $lookup: {
                        from: "offers",
                        let: { prodId: "$_id", catId: "$category" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$isActive", true] },
                                            { $eq: ["$isDeleted", false] },
                                            { $lte: ["$startDate", now] },
                                            { $gte: ["$endDate", now] },
                                            {
                                                $or: [
                                                    { $and: [{ $eq: ["$offerType", "product"] }, { $eq: ["$product", "$$prodId"] }] },
                                                    { $and: [{ $eq: ["$offerType", "category"] }, { $eq: ["$category", "$$catId"] }] }
                                                ]
                                            }
                                        ]
                                    }
                                }
                            },
                            { $sort: { discountValue: -1 } },
                            { $limit: 1 }
                        ],
                        as: "fallbackOfferDocs"
                    }
                },
                {
                    $addFields: {
                        appliedOfferDoc: {
                            $ifNull: ["$appliedOfferDoc", { $arrayElemAt: ["$fallbackOfferDocs", 0] }]
                        }
                    }
                }
            ]
        }
    };

    pipeline.push(facetStage);

    // Execute aggregation
    const aggregateOptions = collation ? { collation } : {};
    const [result] = await Product.aggregate(pipeline, aggregateOptions);

    const totalProducts = result?.metadata?.[0]?.total || 0;
    const products = result?.products || [];
    const totalPages = Math.ceil(totalProducts / parsedLimit) || 1;
    const currentPage = Math.min(parsedPage, totalPages);

    return {
        products,
        totalProducts,
        totalPages,
        currentPage,
        limit: parsedLimit,
        categories: categoryListWithCounts,
        totalActiveProducts,
        selectedCategoryId
    };
    } catch (error) {
        console.error("getShopProducts error:", error);
        throw error;
    }
};

// Fetch product details by ID, strictly verifying that product and its category are listed and not deleted
export const getProductDetailsById = async (productId) => {
    try {
        if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
            return { product: null, unavailable: true, reason: RESPONSE_MESSAGES.PRODUCT.INVALID_ID };
        }

        const product = await Product.findById(productId)
            .populate("category")
            .populate("appliedOffer");

        if (!product) {
            return { product: null, unavailable: true, reason: RESPONSE_MESSAGES.PRODUCT.DOES_NOT_EXIST };
        }

        // Check if product is soft deleted or unlisted
        if (product.isDeleted || !product.isListed) {
            return { product: null, unavailable: true, reason: RESPONSE_MESSAGES.PRODUCT.UNAVAILABLE };
        }

        // Check if category is soft deleted or unlisted
        if (!product.category || product.category.isDeleted || !product.category.isListed) {
            return { product: null, unavailable: true, reason: RESPONSE_MESSAGES.PRODUCT.CATEGORY_UNAVAILABLE };
        }

        // Check applied offer validity or resolve active offer in real time
        const now = new Date();
        let appliedOffer = null;

        if (product.appliedOffer && product.appliedOffer.isActive && !product.appliedOffer.isDeleted) {
            if (new Date(product.appliedOffer.endDate) >= now && new Date(product.appliedOffer.startDate) <= now) {
                appliedOffer = {
                    _id: product.appliedOffer._id,
                    name: product.appliedOffer.name,
                    offerType: product.appliedOffer.offerType,
                    description: product.appliedOffer.description || "",
                    discountType: product.appliedOffer.discountType,
                    discountValue: product.appliedOffer.discountValue,
                    endDate: product.appliedOffer.endDate,
                    startDate: product.appliedOffer.startDate
                };
            }
        }

        // Fallback: If appliedOffer not directly populated or was null, query live offer for this product or category
        if (!appliedOffer) {
            const activeOffer = await Offer.findOne({
                $or: [
                    { offerType: "product", product: product._id },
                    { offerType: "category", category: product.category._id || product.category }
                ],
                isActive: true,
                isDeleted: false,
                startDate: { $lte: now },
                endDate: { $gte: now }
            }).sort({ discountValue: -1 }).lean();

            if (activeOffer) {
                appliedOffer = {
                    _id: activeOffer._id,
                    name: activeOffer.name,
                    offerType: activeOffer.offerType,
                    description: activeOffer.description || "",
                    discountType: activeOffer.discountType,
                    discountValue: activeOffer.discountValue,
                    endDate: activeOffer.endDate,
                    startDate: activeOffer.startDate
                };
            }
        }

        // Calculate effective price & discount
        const hasDiscount = Boolean(product.salePrice && product.salePrice > 0 && product.salePrice < product.regularPrice);
        const effectivePrice = hasDiscount ? product.salePrice : product.regularPrice;
        const discountAmount = hasDiscount ? product.regularPrice - product.salePrice : 0;
        const discountPercent = hasDiscount ? Math.round((discountAmount / product.regularPrice) * 100) : 0;

        return {
            product: {
                ...product.toObject(),
                effectivePrice,
                hasDiscount,
                discountAmount,
                discountPercent,
                appliedOffer
            },
            unavailable: false
        };
    } catch (error) {
        console.error("getProductDetailsById error:", error);
        return { product: null, unavailable: true, reason: "Error retrieving product details" };
    }
};

// Fetch related products from the same category (or active catalog fallback)
export const getRelatedProducts = async (currentProductId, categoryId, limit = 4) => {
    try {
        if (!currentProductId || !mongoose.Types.ObjectId.isValid(currentProductId)) {
            return [];
        }

        const activeCategories = await Category.find({ isListed: true, isDeleted: false }).select("_id");
        const activeCategoryIds = activeCategories.map((c) => c._id);

        const baseFilter = {
            _id: { $ne: new mongoose.Types.ObjectId(currentProductId) },
            category: { $in: activeCategoryIds },
            isListed: true,
            isDeleted: false
        };

        // First try finding in same category
        let related = [];
        if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
            related = await Product.find({
                ...baseFilter,
                category: new mongoose.Types.ObjectId(categoryId)
            })
                .populate("category", "name")
                .populate("appliedOffer")
                .limit(limit)
                .lean();
        }

        // If fewer than limit, supplement with other active products
        if (related.length < limit) {
            const remainingNeeded = limit - related.length;
            const existingIds = [
                new mongoose.Types.ObjectId(currentProductId),
                ...related.map((p) => p._id)
            ];

            const additional = await Product.find({
                _id: { $nin: existingIds },
                category: { $in: activeCategoryIds },
                isListed: true,
                isDeleted: false
            })
                .populate("category", "name")
                .populate("appliedOffer")
                .sort({ createdAt: -1 })
                .limit(remainingNeeded)
                .lean();

            related = [...related, ...additional];
        }

        return related.map((p) => {
            const hasDiscount = Boolean(p.salePrice && p.salePrice > 0 && p.salePrice < p.regularPrice);
            return {
                ...p,
                effectivePrice: hasDiscount ? p.salePrice : p.regularPrice,
                hasDiscount,
                discountPercent: hasDiscount ? Math.round(((p.regularPrice - p.salePrice) / p.regularPrice) * 100) : 0
            };
        });
    } catch (error) {
        console.error("getRelatedProducts error:", error);
        return [];
    }
};

export default {
    getActiveCategoriesWithCounts,
    getShopProducts,
    getProductDetailsById,
    getRelatedProducts
};
