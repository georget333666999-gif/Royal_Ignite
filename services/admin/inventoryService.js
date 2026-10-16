import Product from "../../models/productModel.js";
import Category from "../../models/categoryModel.js";
import { RESPONSE_MESSAGES } from "../../constants/index.js";

/**
 * Fetch filtered, sorted, and paginated inventory items with vault metrics
 * @param {Object} options
 * @param {string} [options.search=""]
 * @param {string} [options.categoryId=""]
 * @param {string} [options.stockFilter="all"]
 * @param {string} [options.sort="stock_asc"]
 * @param {number} [options.page=1]
 * @param {number} [options.limit=10]
 * @returns {Promise<Object>}
 */
export const getInventoryItems = async ({
    search = "",
    categoryId = "",
    stockFilter = "all",
    sort = "stock_asc",
    page = 1,
    limit = 10
} = {}) => {
    try {
        const query = { isDeleted: false };

        // 1. Text Search
        if (search && search.trim() !== "") {
            query.name = { $regex: search.trim(), $options: "i" };
        }

        // 2. Category Filter
        if (categoryId && categoryId !== "all") {
            query.category = categoryId;
        }

        // 3. Stock Level Filter
        if (stockFilter === "lowStock") {
            query.stock = { $gt: 0, $lte: 5 };
        } else if (stockFilter === "outOfStock") {
            query.stock = { $lte: 0 };
        } else if (stockFilter === "inStock") {
            query.stock = { $gt: 5 };
        }

        // 4. Sorting Criteria (Default: lowest stock first to surface critical alerts)
        let sortCriteria = { stock: 1 };
        if (sort === "stock_desc") {
            sortCriteria = { stock: -1 };
        } else if (sort === "name_asc") {
            sortCriteria = { name: 1 };
        } else if (sort === "newest") {
            sortCriteria = { createdAt: -1 };
        }

        // 5. Pagination
        const currentPage = Math.max(1, parseInt(page, 10) || 1);
        const pageSize = Math.max(1, parseInt(limit, 10) || 10);
        const skip = (currentPage - 1) * pageSize;

        const [products, totalMatching, categories, metricsAgg] = await Promise.all([
            Product.find(query)
                .sort(sortCriteria)
                .skip(skip)
                .limit(pageSize)
                .populate("category", "name isListed isDeleted")
                .lean(),
            Product.countDocuments(query),
            Category.find({ isDeleted: false }).select("name").sort({ name: 1 }).lean(),
            Product.aggregate([
                { $match: { isDeleted: false } },
                {
                    $group: {
                        _id: null,
                        totalProducts: { $sum: 1 },
                        totalUnits: { $sum: "$stock" },
                        outOfStockCount: {
                            $sum: { $cond: [{ $lte: ["$stock", 0] }, 1, 0] }
                        },
                        lowStockCount: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $gt: ["$stock", 0] },
                                            { $lte: ["$stock", 5] }
                                        ]
                                    },
                                    1,
                                    0
                                ]
                            }
                        },
                        healthyStockCount: {
                            $sum: { $cond: [{ $gt: ["$stock", 5] }, 1, 0] }
                        }
                    }
                }
            ])
        ]);

        const totalPages = Math.ceil(totalMatching / pageSize) || 1;

        const metrics = metricsAgg && metricsAgg.length > 0 ? metricsAgg[0] : {
            totalProducts: 0,
            totalUnits: 0,
            outOfStockCount: 0,
            lowStockCount: 0,
            healthyStockCount: 0
        };

        return {
            products,
            totalMatching,
            totalPages,
            currentPage,
            limit: pageSize,
            categories,
            search: search.trim(),
            categoryId,
            stockFilter,
            sort,
            metrics
        };
    } catch (error) {
        console.error("inventoryService getInventoryItems error:", error);
        throw error;
    }
};

/**
 * Adjust or set stock quantity for a specific product
 * @param {string} productId
 * @param {number} stockValue
 * @param {"set"|"add"} [mode="set"]
 * @returns {Promise<Object>}
 */
export const updateProductStock = async (productId, stockValue, mode = "set") => {
    try {
        const numValue = parseInt(stockValue, 10);
        if (isNaN(numValue)) {
            const err = new Error(RESPONSE_MESSAGES.INVENTORY.INVALID_STOCK);
            err.code = "INVALID_STOCK";
            throw err;
        }

        const product = await Product.findById(productId);
        if (!product || product.isDeleted) {
            const err = new Error(RESPONSE_MESSAGES.INVENTORY.PRODUCT_NOT_FOUND);
            err.code = "NOT_FOUND";
            throw err;
        }

        let newStock = product.stock;
        if (mode === "add") {
            newStock = Math.max(0, product.stock + numValue);
        } else {
            newStock = Math.max(0, numValue);
        }

        product.stock = newStock;
        await product.save();

        return {
            success: true,
            product,
            message: RESPONSE_MESSAGES.INVENTORY.STOCK_UPDATED_SUCCESS
        };
    } catch (error) {
        console.error("inventoryService updateProductStock error:", error);
        throw error;
    }
};

export default {
    getInventoryItems,
    updateProductStock
};
