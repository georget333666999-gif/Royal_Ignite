import express from "express";
import adminController from "../../controllers/admin/adminController.js";
import { adminMiddleware } from "../../middleware/adminMiddleware.js";

const router = express.Router();

// Apply admin authentication middleware to dashboard and analytics
router.use(adminMiddleware);

// ========================================
// Admin dashboard & analytics
// ========================================
router.get("/dashboard", adminController.getDashboard);
router.get("/dashboard/chart-data", adminController.getChartDataApi);
router.get("/dashboard/ledger", adminController.getLedgerBook);
router.get("/analytics", adminController.getAnalytics);

export default router;
