const express = require("express");
const adminController = require("../controllers/adminController");
const { adminMiddleware, redirectIfAdminLoggedIn } = require("../../middleware/adminMiddleware");
const userRoutes = require("./userRoutes");

const router = express.Router();

// Admin Login & Session
router.get("/login", redirectIfAdminLoggedIn, adminController.showLoginPage);
router.post("/login", redirectIfAdminLoggedIn, adminController.login);
router.get("/logout", adminController.logout);
router.post("/logout", adminController.logout);

// Admin Dashboard & Analytics
router.get("/dashboard", adminMiddleware, adminController.getDashboard);
router.get("/analytics", adminMiddleware, adminController.getAnalytics);

// Admin Forgot Password Flow
router.get("/forgot-password", redirectIfAdminLoggedIn, adminController.getForgotPassword);
router.post("/forgot-password", redirectIfAdminLoggedIn, adminController.postForgotPassword);

router.get("/verify-otp", redirectIfAdminLoggedIn, adminController.getVerifyOtp);
router.post("/verify-otp", redirectIfAdminLoggedIn, adminController.postVerifyOtp);
router.post("/resend-otp", redirectIfAdminLoggedIn, adminController.postResendOtp);

router.get("/reset-password", redirectIfAdminLoggedIn, adminController.getResetPassword);
router.post("/reset-password", redirectIfAdminLoggedIn, adminController.postResetPassword);

// User Management Routes
router.use(adminMiddleware, userRoutes);

module.exports = router;