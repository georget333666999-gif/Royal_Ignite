import express from "express";
import authRoutes from "./authRoutes.js";
import profileRoutes from "./profileRoutes.js";
import addressRoutes from "./addressRoutes.js";

const router = express.Router();

// ========================================
// User Feature Modules
// ========================================

// 1. Authentication & Password Recovery Module
router.use(authRoutes);

// 2. Profile & Security Module
router.use(profileRoutes);

// 3. Address Management Module
router.use(addressRoutes);

export {
    authRoutes,
    profileRoutes,
    addressRoutes
};

export default router;