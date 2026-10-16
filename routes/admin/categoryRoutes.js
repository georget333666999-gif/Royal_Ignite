import express from "express";
import categoryController from "../../controllers/admin/categoryController.js";

const router = express.Router();

// Category Listing with Search, Status filter & Pagination
router.get("/categories", categoryController.getCategoryList);

// Add Category
router.post("/categories/add", categoryController.addCategory);

// Get Category by ID (for prefilling edit modal)
router.get("/categories/:id", categoryController.getCategoryById);

// Edit Category
router.post("/categories/edit/:id", categoryController.editCategory);

// Soft Delete Category
router.post("/categories/delete/:id", categoryController.softDeleteCategory);

// Restore Soft-deleted Category
router.post("/categories/restore/:id", categoryController.restoreCategory);

// Toggle Listed / Unlisted status
router.post("/categories/toggle-status/:id", categoryController.toggleListCategory);

export default router;
