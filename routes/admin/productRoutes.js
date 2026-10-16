import express from "express";
import productController from "../../controllers/admin/productController.js";
import inventoryController from "../../controllers/admin/inventoryController.js";
import { productUpload } from "../../middleware/uploadMiddleware.js";

const router = express.Router();

// Product Listing with search, category & status filter, pagination, descending sort
router.get("/products", productController.getProductList);

// Add Product form & submission
router.get("/products/add", productController.showAddProductPage);
router.post(
    "/products/add",
    productUpload.array("productImages", 10),
    productController.addProduct
);

// Edit Product form & submission
router.get("/products/edit/:id", productController.showEditProductPage);
router.post(
    "/products/edit/:id",
    productUpload.array("productImages", 10),
    productController.editProduct
);

// Soft Delete Product
router.post("/products/delete/:id", productController.softDeleteProduct);

// Restore Soft-Deleted Product
router.post("/products/restore/:id", productController.restoreProduct);

// Toggle Listed / Unlisted Status
router.post("/products/toggle-status/:id", productController.toggleListProduct);

// Quick Stock Adjustment
router.post("/products/:id/stock", inventoryController.postUpdateStock);

export default router;
