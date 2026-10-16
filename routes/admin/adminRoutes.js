

import express from "express";
import { adminMiddleware } from "../../middleware/adminMiddleware.js";
import authRoutes from "./authRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";
import userRoutes from "./userRoutes.js";
import categoryRoutes from "./categoryRoutes.js";
import productRoutes from "./productRoutes.js";
import orderRoutes from "./orderRoutes.js";
import inventoryRoutes from "./inventoryRoutes.js";

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

// 7. Inventory & Stock Management Module (/admin/inventory, etc.)
router.use(adminMiddleware, inventoryRoutes);

export {
    authRoutes,
    dashboardRoutes,
    userRoutes,
    categoryRoutes,
    productRoutes,
    orderRoutes,
    inventoryRoutes
};

export default router;