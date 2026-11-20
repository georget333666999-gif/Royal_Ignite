import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import productService from "../../services/admin/productService.js";
import { validateProductInput } from "../../validators/productValidator.js";
import { HTTP_STATUS, RESPONSE_MESSAGES } from "../../constants/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isJsonRequest = (req) => {
    try {
        if (req?.query?.format === "json") return true;
        if (req?.xhr) return true;
        const acceptHeader = req?.headers?.accept;
        return Boolean(acceptHeader && acceptHeader.includes("application/json"));
    } catch {
        return false;
    }
};

// Save base64 image data URL to disk
const saveBase64Image = (base64Str) => {
    try {
        const matches = base64Str.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
        if (!matches || matches.length < 3) return null;

        const rawExt = matches[1].toLowerCase();
        const ext = rawExt === "jpeg" ? "jpg" : rawExt;
        const buffer = Buffer.from(matches[2], "base64");

        const uploadDir = path.join(__dirname, "../../public/uploads/products");
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const filename = `product-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
        const filePath = path.join(uploadDir, filename);
        fs.writeFileSync(filePath, buffer);

        return `/uploads/products/${filename}`;
    } catch (err) {
        console.error("Error saving base64 image:", err);
        return null;
    }
};

// Collect images from both multer uploaded files and base64 strings
const collectUploadedImages = (req) => {
    try {
        const images = [];

        // 1. Files uploaded via Multer (multipart/form-data)
        if (req.files && Array.isArray(req.files)) {
            req.files.forEach((file) => {
                images.push(`/uploads/products/${file.filename}`);
            });
        }

        // 2. Base64 cropped image strings submitted from client-side cropper
        if (req.body?.croppedImages) {
            const croppedList = Array.isArray(req.body.croppedImages)
                ? req.body.croppedImages
                : [req.body.croppedImages];

            croppedList.forEach((dataUrl) => {
                if (typeof dataUrl === "string" && dataUrl.startsWith("data:image/")) {
                    const savedPath = saveBase64Image(dataUrl);
                    if (savedPath) images.push(savedPath);
                }
            });
        }

        return images;
    } catch (err) {
        console.error("Error collecting uploaded images:", err);
        return [];
    }
};

// Product listing page with search, filters, pagination, and descending sort
const getProductList = async (req, res) => {
    const isJson = isJsonRequest(req);
    try {
        const search = req.query.search || "";
        const categoryId = req.query.category || "";
        const statusFilter = req.query.status || "all";
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 6;

        const [result, categories] = await Promise.all([
            productService.getProducts({
                search,
                categoryId,
                statusFilter,
                page,
                limit
            }),
            productService.getActiveCategories()
        ]);

        const responseData = {
            ...result,
            categories,
            search: result.search,
            categoryId,
            statusFilter,
            error: req.query.error || result.searchError || null,
            success: req.query.success || null
        };

        if (isJson) {
            return res.status(HTTP_STATUS.OK).json({ success: true, ...responseData });
        }

        return res.status(HTTP_STATUS.OK).render("products/productList", responseData);
    } catch (error) {
        console.error("Error loading products:", error);
        if (isJson) {
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: RESPONSE_MESSAGES.PRODUCT.LOAD_ERROR });
        }
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(RESPONSE_MESSAGES.PRODUCT.LOAD_ERROR);
    }
};

// Render Add Product page
const showAddProductPage = async (req, res) => {
    try {
        const categories = await productService.getActiveCategories();
        return res.status(HTTP_STATUS.OK).render("products/productForm", {
            mode: "add",
            product: {},
            categories,
            error: req.query.error || null,
            success: req.query.success || null
        });
    } catch (error) {
        console.error("Error loading add product page:", error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).redirect(`/admin/products?error=${encodeURIComponent(RESPONSE_MESSAGES.PRODUCT.FORM_ERROR)}`);
    }
};

//Add new product
const addProduct = async (req, res) => {
    const isJson = isJsonRequest(req);
    try {
        const { name, description, category, regularPrice, salePrice, stock, isListed } = req.body;
        const images = collectUploadedImages(req);

        // Validation (enforcing minimum 3 images)
        const validation = validateProductInput({
            name,
            description,
            category,
            regularPrice,
            salePrice,
            stock,
            images
        });

        if (!validation.isValid) {
            const errorMessage = validation.errors.join(" ");
            if (isJson) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: errorMessage });
            }
            return res.redirect(`/admin/products/add?error=${encodeURIComponent(errorMessage)}`);
        }

        const newProduct = await productService.addProduct({
            name,
            description,
            category,
            regularPrice,
            salePrice,
            stock,
            images,
            isListed: isListed === "true" || isListed === true || isListed === "on"
        });

        const successMessage = `Product "${newProduct.name}" added successfully.`;
        if (isJson) {
            return res.status(HTTP_STATUS.CREATED).json({ success: true, message: successMessage, product: newProduct });
        }
        return res.redirect(`/admin/products?success=${encodeURIComponent(successMessage)}`);
    } catch (error) {
        console.error("Error adding product:", error);
        const errorMessage = error.message || "Failed to add product";
        if (isJson) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: errorMessage });
        }
        return res.redirect(`/admin/products/add?error=${encodeURIComponent(errorMessage)}`);
    }
};

// Render Edit Product page
const showEditProductPage = async (req, res) => {
    try {
        const { id } = req.params;
        const [product, categories] = await Promise.all([
            productService.getProductById(id),
            productService.getActiveCategories()
        ]);

        if (!product) {
            return res.redirect(`/admin/products?error=${encodeURIComponent(RESPONSE_MESSAGES.PRODUCT.NOT_FOUND)}`);
        }

        return res.status(HTTP_STATUS.OK).render("products/productForm", {
            mode: "edit",
            product,
            categories,
            error: req.query.error || null,
            success: req.query.success || null
        });
    } catch (error) {
        console.error("Error loading edit product page:", error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).redirect(`/admin/products?error=${encodeURIComponent(RESPONSE_MESSAGES.PRODUCT.EDIT_FORM_ERROR)}`);
    }
};

// Edit existing product
const editProduct = async (req, res) => {
    const isJson = isJsonRequest(req);
    try {
        const { id } = req.params;
        const { name, description, category, regularPrice, salePrice, stock, isListed } = req.body;

        // Existing images kept by admin
        let retainedImages = [];
        if (req.body.existingImages) {
            retainedImages = Array.isArray(req.body.existingImages)
                ? req.body.existingImages
                : [req.body.existingImages];
        }

        // Newly uploaded images
        const newImages = collectUploadedImages(req);
        const finalImages = [...retainedImages, ...newImages];

        // Validate combined images count >= 3
        const validation = validateProductInput({
            name,
            description,
            category,
            regularPrice,
            salePrice,
            stock,
            images: finalImages
        });

        if (!validation.isValid) {
            const errorMessage = validation.errors.join(" ");
            if (isJson) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: errorMessage });
            }
            return res.redirect(`/admin/products/edit/${id}?error=${encodeURIComponent(errorMessage)}`);
        }

        const updatedProduct = await productService.editProduct(id, {
            name,
            description,
            category,
            regularPrice,
            salePrice,
            stock,
            images: finalImages,
            isListed: isListed === "true" || isListed === true || isListed === "on"
        });

        const successMessage = `Product "${updatedProduct.name}" updated successfully.`;
        if (isJson) {
            return res.status(HTTP_STATUS.OK).json({ success: true, message: successMessage, product: updatedProduct });
        }
        return res.redirect(`/admin/products?success=${encodeURIComponent(successMessage)}`);
    } catch (error) {
        console.error("Error updating product:", error);
        const errorMessage = error.message || "Failed to update product";
        if (isJson) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: errorMessage });
        }
        return res.redirect(`/admin/products/edit/${req.params.id}?error=${encodeURIComponent(errorMessage)}`);
    }
};

// Soft delete product
const softDeleteProduct = async (req, res) => {
    const isJson = isJsonRequest(req);
    try {
        const { id } = req.params;
        const product = await productService.softDeleteProduct(id);
        const successMessage = `Product "${product.name}" moved to deleted items.`;

        if (isJson) {
            return res.status(HTTP_STATUS.OK).json({ success: true, message: successMessage });
        }
        return res.redirect(`/admin/products?success=${encodeURIComponent(successMessage)}`);
    } catch (error) {
        console.error("Error deleting product:", error);
        const errorMessage = error.message || "Failed to delete product";
        if (isJson) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: errorMessage });
        }
        return res.redirect(`/admin/products?error=${encodeURIComponent(errorMessage)}`);
    }
};

// Restore soft-deleted product
const restoreProduct = async (req, res) => {
    const isJson = isJsonRequest(req);
    try {
        const { id } = req.params;
        const product = await productService.restoreProduct(id);
        const successMessage = `Product "${product.name}" restored successfully.`;

        if (isJson) {
            return res.status(HTTP_STATUS.OK).json({ success: true, message: successMessage });
        }
        return res.redirect(`/admin/products?success=${encodeURIComponent(successMessage)}`);
    } catch (error) {
        console.error("Error restoring product:", error);
        const errorMessage = error.message || "Failed to restore product";
        if (isJson) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: errorMessage });
        }
        return res.redirect(`/admin/products?error=${encodeURIComponent(errorMessage)}`);
    }
};

// Toggle Listed / Unlisted status of product
const toggleListProduct = async (req, res) => {
    const isJson = isJsonRequest(req);
    try {
        const { id } = req.params;
        const product = await productService.toggleListProduct(id);
        const statusText = product.isListed ? "listed (active)" : "unlisted";
        const successMessage = `Product "${product.name}" is now ${statusText}.`;

        if (isJson) {
            return res.status(HTTP_STATUS.OK).json({ success: true, message: successMessage, isListed: product.isListed });
        }
        return res.redirect(`/admin/products?success=${encodeURIComponent(successMessage)}`);
    } catch (error) {
        console.error("Error toggling product status:", error);
        const errorMessage = error.message || "Failed to toggle product status";
        if (isJson) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: errorMessage });
        }
        return res.redirect(`/admin/products?error=${encodeURIComponent(errorMessage)}`);
    }
};

// Quick Stock Adjustment for product
const updateStock = async (req, res) => {
    const isJson = isJsonRequest(req);
    try {
        const { id } = req.params;
        const { stock, mode = "set" } = req.body;

        if (stock === undefined || stock === null || stock === "") {
            const message = RESPONSE_MESSAGES.INVENTORY.INVALID_STOCK;
            if (isJson) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message });
            }
            return res.redirect(`/admin/products?error=${encodeURIComponent(message)}`);
        }

        const result = await productService.updateProductStock(id, stock, mode);

        if (isJson) {
            return res.status(HTTP_STATUS.OK).json(result);
        }

        return res.redirect(`/admin/products?success=${encodeURIComponent(result.message)}`);
    } catch (err) {
        console.error("productController updateStock error:", err);
        const message = err.message || RESPONSE_MESSAGES.COMMON.SOMETHING_WENT_WRONG;
        if (isJson) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message
            });
        }
        return res.redirect(`/admin/products?error=${encodeURIComponent(message)}`);
    }
};

export {
    getProductList,
    showAddProductPage,
    addProduct,
    showEditProductPage,
    editProduct,
    softDeleteProduct,
    restoreProduct,
    toggleListProduct,
    updateStock
};

export default {
    getProductList,
    showAddProductPage,
    addProduct,
    showEditProductPage,
    editProduct,
    softDeleteProduct,
    restoreProduct,
    toggleListProduct,
    updateStock
};
