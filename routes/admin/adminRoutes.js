

import express from "express";
import { adminMiddleware } from "../../middleware/adminMiddleware.js";
import authRoutes from "./authRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";
import userRoutes from "./userRoutes.js";
import categoryRoutes from "./categoryRoutes.js";
import productRoutes from "./productRoutes.js";
import orderRoutes from "./orderRoutes.js";
import couponRoutes from "./couponRoutes.js";
import offerRoutes from "./offerRoutes.js";
import salesReportRoutes from "./salesReportRoutes.js";

const router = express.Router();

// ========================================
// Admin Feature Modules
// ========================================

// 1. Admin Authentication Module (/admin/login, /admin/logout, /admin/forgot-password, etc.)
router.use(authRoutes);

// 2. Admin Dashboard & Analytics Module (/admin/dashboard, /admin/analytics)
router.use(dashboardRoutes);

// 3. User Management Module (/admin/users, /admin/users/:id/block, etc.)
router.use(adminMiddleware, userRoutes);

// 4. Category Management Module (/admin/categories, etc.)
router.use(adminMiddleware, categoryRoutes);

// 5. Product Management Module (/admin/products, etc.)
router.use(adminMiddleware, productRoutes);

// 6. Order Management Module (/admin/orders, etc.)
router.use(adminMiddleware, orderRoutes);

// 7. Coupon Management Module (/admin/coupons, etc.)
router.use(adminMiddleware, couponRoutes);

// 8. Offer Module (/admin/offers, etc.)
router.use(adminMiddleware, offerRoutes);

// 9. Sales Report Module (/admin/reports/sales, /admin/reports/sales/pdf, /admin/reports/sales/excel)
router.use(adminMiddleware, salesReportRoutes);

export {
    authRoutes,
    dashboardRoutes,
    userRoutes,
    categoryRoutes,
    productRoutes,
    orderRoutes,
    couponRoutes,
    offerRoutes,
    salesReportRoutes
};

export default router;