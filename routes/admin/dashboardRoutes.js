import express from "express";
import adminController from "../../controllers/admin/adminController.js";
import { adminMiddleware } from "../../middleware/adminMiddleware.js";

const router = express.Router();

// Apply admin authentication middleware to dashboard and analytics
router.use(adminMiddleware);

// ========================================
// Admin Dashboard & Analytics
// ========================================
router.get("/dashboard", adminController.getDashboard);
router.get("/analytics", adminController.getAnalytics);

export default router;
