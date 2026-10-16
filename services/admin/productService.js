import mongoose from "mongoose";
import Product from "../../models/productModel.js";
import Category from "../../models/categoryModel.js";

const escapeRegex = (value) => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// Map status filters to Mongoose queries
const getStatusFilterQuery = (status) => {
    switch (status) {
        case "active":
            return { isDeleted: false, isListed: true };
        case "unlisted":
            return { isDeleted: false, isListed: false };
        case "outOfStock":
            return { isDeleted: false, stock: { $lte: 0 } };
        case "deleted":
            return { isDeleted: true };
        case "all":
        default:
            return { isDeleted: false };
    }
};

// Fetch overview metrics for products
const fetchProductMetrics = async () => {
    try {
        const [totalProducts, activeProducts, unlistedProducts, outOfStockProducts, deletedProducts] = await Promise.all([
            Product.countDocuments({ isDeleted: false }),
            Product.countDocuments({ isDeleted: false, isListed: true }),
            Product.countDocuments({ isDeleted: false, isListed: false }),
            Product.countDocuments({ isDeleted: false, stock: { $lte: 0 } }),
            Product.countDocuments({ isDeleted: true })
        ]);
        return {
            totalProducts,
            activeProducts,
            unlistedProducts,
            outOfStockProducts,
            deletedProducts
        };
    } catch (error) {
        console.error("fetchProductMetrics error:", error);
        throw error;
    }
};

// Get paginated, searched, and descending-sorted products
const getProducts = async ({
    search = "",
    categoryId = "",
    statusFilter = "all",
    page = 1,
    limit = 6
} = {}) => {
    try {
        const trimmedSearch = search.trim();
        const filter = {
            ...getStatusFilterQuery(statusFilter)
        };

        if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
            filter.category = new mongoose.Types.ObjectId(categoryId);
        }

        if (trimmedSearch) {
            const safeSearch = escapeRegex(trimmedSearch);
            const searchRegex = new RegExp(safeSearch, "i");

            // Find categories matching search term to include matching products
            const matchingCategories = await Category.find({ name: searchRegex }).select("_id");
            const categoryIds = matchingCategories.map((c) => c._id);

            filter.$or = [
                { name: searchRegex },
                { description: searchRegex },
                { category: { $in: categoryIds } }
            ];
        }

        const [metrics, totalMatching] = await Promise.all([
            fetchProductMetrics(),
            Product.countDocuments(filter)
        ]);

        const totalPages = Math.ceil(totalMatching / limit) || 1;
        const currentPage = Math.min(Math.max(1, page), totalPages);
        const skip = (currentPage - 1) * limit;

        // Requirement: Sort table in descending order (newest first)
        const products = await Product.find(filter)
            .populate("category", "name isListed isDeleted")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        return {
            products,
            ...metrics,
            totalMatching,
            totalPages,
            currentPage,
            limit
        };
    } catch (error) {
        console.error("getProducts error:", error);
        throw error;
    }
};

// Get product by ID
const getProductById = async (productId) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return null;
        }
        return await Product.findById(productId).populate("category", "name isListed isDeleted");
    } catch (error) {
        console.error("getProductById error:", error);
        throw error;
    }
};

// Fetch all active categories for product form dropdowns
const getActiveCategories = async () => {
    try {
        return await Category.find({ isDeleted: false }).sort({ name: 1 });
    } catch (error) {
        console.error("getActiveCategories error:", error);
        throw error;
    }
};

// Add a new product with duplicate check
const addProduct = async ({
    name,
    description,
    category,
    regularPrice,
    salePrice,
    stock,
    images = [],
    isListed = true
}) => {
    try {
        const trimmedName = name.trim();
        const safeName = escapeRegex(trimmedName);

        // Case-insensitive duplicate check for active products
        const existing = await Product.findOne({
            name: { $regex: new RegExp(`^${safeName}$`, "i") },
            isDeleted: false
        });

        if (existing) {
            throw new Error(`A product with the title "${existing.name}" already exists.`);
        }

        // Ensure category exists
        const categoryDoc = await Category.findById(category);
        if (!categoryDoc) {
            throw new Error("Selected category does not exist.");
        }

        const newProduct = new Product({
            name: trimmedName,
            description: description.trim(),
            category,
            regularPrice: Number(regularPrice),
            salePrice: salePrice ? Number(salePrice) : null,
            stock: Number(stock),
            images,
            isListed: Boolean(isListed),
            isDeleted: false
        });

        return await newProduct.save();
    } catch (error) {
        console.error("addProduct error:", error.message);
        throw error;
    }
};

// Edit an existing product
const editProduct = async (
    productId,
    {
        name,
        description,
        category,
        regularPrice,
        salePrice,
        stock,
        images,
        isListed
    }
) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            throw new Error("Invalid Product ID.");
        }

        const product = await Product.findById(productId);
        if (!product) {
            throw new Error("Product not found.");
        }

        const trimmedName = name.trim();
        const safeName = escapeRegex(trimmedName);

        // Duplicate check excluding this product
        const existing = await Product.findOne({
            _id: { $ne: productId },
            name: { $regex: new RegExp(`^${safeName}$`, "i") },
            isDeleted: false
        });

        if (existing) {
            throw new Error(`Another product with the title "${existing.name}" already exists.`);
        }

        // Ensure category exists
        const categoryDoc = await Category.findById(category);
        if (!categoryDoc) {
            throw new Error("Selected category does not exist.");
        }

        product.name = trimmedName;
        product.description = description.trim();
        product.category = category;
        product.regularPrice = Number(regularPrice);
        product.salePrice = salePrice ? Number(salePrice) : null;
        product.stock = Number(stock);

        if (Array.isArray(images) && images.length >= 3) {
            product.images = images;
        }

        if (isListed !== undefined) {
            product.isListed = Boolean(isListed);
        }

        return await product.save();
    } catch (error) {
        console.error("editProduct error:", error.message);
        throw error;
    }
};

// Soft delete a product
const softDeleteProduct = async (productId) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            throw new Error("Invalid Product ID.");
        }

        const product = await Product.findByIdAndUpdate(
            productId,
            { $set: { isDeleted: true } },
            { returnDocument: "after" }
        );

        if (!product) {
            throw new Error("Product not found.");
        }

        return product;
    } catch (error) {
        console.error("softDeleteProduct error:", error.message);
        throw error;
    }
};

// Restore a soft-deleted product
const restoreProduct = async (productId) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            throw new Error("Invalid Product ID.");
        }

        const product = await Product.findByIdAndUpdate(
            productId,
            { $set: { isDeleted: false } },
            { returnDocument: "after" }
        );

        if (!product) {
            throw new Error("Product not found.");
        }

        return product;
    } catch (error) {
        console.error("restoreProduct error:", error.message);
        throw error;
    }
};

// Toggle listed / unlisted status of a product
const toggleListProduct = async (productId) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            throw new Error("Invalid Product ID.");
        }

        const product = await Product.findById(productId);
        if (!product) {
            throw new Error("Product not found.");
        }

        product.isListed = !product.isListed;
        return await product.save();
    } catch (error) {
        console.error("toggleListProduct error:", error.message);
        throw error;
    }
};

export {
    getProducts,
    getProductById,
    getActiveCategories,
    addProduct,
    editProduct,
    softDeleteProduct,
    restoreProduct,
    toggleListProduct
};

export default {
    getProducts,
    getProductById,
    getActiveCategories,
    addProduct,
    editProduct,
    softDeleteProduct,
    restoreProduct,
    toggleListProduct
};
