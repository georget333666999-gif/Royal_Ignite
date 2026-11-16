import mongoose from "mongoose";
import Category from "../../models/categoryModel.js";

const escapeRegex = (value) => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

/**
 * Map status filters to Mongoose filter queries
 */
const getStatusFilterQuery = (status) => {
    switch (status) {
        case "active":
            return { isDeleted: false, isListed: true };
        case "unlisted":
            return { isDeleted: false, isListed: false };
        case "deleted":
            return { isDeleted: true };
        case "all":
        default:
            return { isDeleted: false };
    }
};

/**
 * Build search regex query for category name and description
 */
const getSearchFilter = (trimmedSearch) => {
    if (!trimmedSearch) return {};
    const safeSearch = escapeRegex(trimmedSearch);
    const searchRegex = new RegExp(safeSearch, "i");
    return {
        $or: [
            { name: searchRegex },
            { description: searchRegex }
        ]
    };
};

/**
 * Fetch overview metrics for categories
 */
const fetchCategoryMetrics = async () => {
    try {
        const [totalCategories, activeCategories, unlistedCategories, deletedCategories] = await Promise.all([
            Category.countDocuments({ isDeleted: false }),
            Category.countDocuments({ isDeleted: false, isListed: true }),
            Category.countDocuments({ isDeleted: false, isListed: false }),
            Category.countDocuments({ isDeleted: true })
        ]);
        return { totalCategories, activeCategories, unlistedCategories, deletedCategories };
    } catch (error) {
        console.error("fetchCategoryMetrics error:", error);
        throw error;
    }
};

/**
 * Get paginated, searched, and descending-sorted categories
 */
const getCategories = async (search = "", statusFilter = "all", page = 1, limit = 5) => {
    try {
        const trimmedSearch = search.trim();
        const filter = {
            ...getStatusFilterQuery(statusFilter),
            ...getSearchFilter(trimmedSearch)
        };

        const [metrics, totalMatching] = await Promise.all([
            fetchCategoryMetrics(),
            Category.countDocuments(filter)
        ]);

        const totalPages = Math.ceil(totalMatching / limit) || 1;
        const currentPage = Math.min(Math.max(1, page), totalPages);
        const skip = (currentPage - 1) * limit;

        // Sort categories descending by creation date
        const categories = await Category.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        return {
            categories,
            ...metrics,
            totalMatching,
            totalPages,
            currentPage,
            limit
        };
    } catch (error) {
        console.error("getCategories error:", error);
        throw error;
    }
};

/**
 * Get category by ID
 */
const getCategoryById = async (categoryId) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(categoryId)) {
            return null;
        }
        return await Category.findById(categoryId);
    } catch (error) {
        console.error("getCategoryById error:", error);
        throw error;
    }
};

/**
 * Add a new category with duplicate check
 */
const addCategory = async ({ name, description = "", isListed = true }) => {
    try {
        const trimmedName = name.trim();
        const safeName = escapeRegex(trimmedName);

        // Case-insensitive check for existing category
        const existing = await Category.findOne({
            name: { $regex: new RegExp(`^${safeName}$`, "i") }
        });

        if (existing) {
            if (!existing.isDeleted) {
                throw new Error(`Category "${existing.name}" already exists.`);
            } else {
                throw new Error(`A category named "${existing.name}" is currently in deleted items. You can restore it instead.`);
            }
        }

        const newCategory = new Category({
            name: trimmedName,
            description: description ? description.trim() : "",
            isListed: Boolean(isListed),
            isDeleted: false
        });

        return await newCategory.save();
    } catch (error) {
        console.error("addCategory error:", error.message);
        throw error;
    }
};

/**
 * Edit an existing category with duplicate check
 */
const editCategory = async (categoryId, { name, description = "", isListed }) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(categoryId)) {
            throw new Error("Invalid Category ID");
        }

        const category = await Category.findById(categoryId);
        if (!category) {
            throw new Error("Category not found");
        }

        const trimmedName = name.trim();
        const safeName = escapeRegex(trimmedName);

        // Check if another category with the same name exists
        const existing = await Category.findOne({
            _id: { $ne: categoryId },
            name: { $regex: new RegExp(`^${safeName}$`, "i") },
            isDeleted: false
        });

        if (existing) {
            throw new Error(`Another category named "${existing.name}" already exists.`);
        }

        category.name = trimmedName;
        if (description !== undefined) {
            category.description = description.trim();
        }
        if (isListed !== undefined) {
            category.isListed = Boolean(isListed);
        }

        return await category.save();
    } catch (error) {
        console.error("editCategory error:", error.message);
        throw error;
    }
};

/**
 * Soft delete a category
 */
const softDeleteCategory = async (categoryId) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(categoryId)) {
            throw new Error("Invalid Category ID");
        }

        const category = await Category.findByIdAndUpdate(
            categoryId,
            { $set: { isDeleted: true } },
            { returnDocument: "after" }
        );

        if (!category) {
            throw new Error("Category not found");
        }

        return category;
    } catch (error) {
        console.error("softDeleteCategory error:", error.message);
        throw error;
    }
};

/**
 * Restore a soft-deleted category
 */
const restoreCategory = async (categoryId) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(categoryId)) {
            throw new Error("Invalid Category ID");
        }

        const category = await Category.findByIdAndUpdate(
            categoryId,
            { $set: { isDeleted: false } },
            { returnDocument: "after" }
        );

        if (!category) {
            throw new Error("Category not found");
        }

        return category;
    } catch (error) {
        console.error("restoreCategory error:", error.message);
        throw error;
    }
};

/**
 * Toggle listed / unlisted status of a category
 */
const toggleListCategory = async (categoryId) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(categoryId)) {
            throw new Error("Invalid Category ID");
        }

        const category = await Category.findById(categoryId);
        if (!category) {
            throw new Error("Category not found");
        }

        category.isListed = !category.isListed;
        return await category.save();
    } catch (error) {
        console.error("toggleListCategory error:", error.message);
        throw error;
    }
};

export {
    getCategories,
    getCategoryById,
    addCategory,
    editCategory,
    softDeleteCategory,
    restoreCategory,
    toggleListCategory
};

export default {
    getCategories,
    getCategoryById,
    addCategory,
    editCategory,
    softDeleteCategory,
    restoreCategory,
    toggleListCategory
};
