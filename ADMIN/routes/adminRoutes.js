const express = require("express");
const adminController = require("../controllers/adminController");
const userRoutes = require("./userRoutes");

const router = express.Router();

// Admin Login & Session
router.get("/login", adminController.showLoginPage);
router.post("/login", adminController.login);
router.post("/logout", adminController.logout);

// Admin Dashboard
router.get("/dashboard", adminController.getDashboard);

// Admin Forgot Password Flow
router.get("/forgot-password", adminController.getForgotPassword);
router.post("/forgot-password", adminController.postForgotPassword);

router.get("/verify-otp", adminController.getVerifyOtp);
router.post("/verify-otp", adminController.postVerifyOtp);
router.post("/resend-otp", adminController.postResendOtp);

router.get("/reset-password", adminController.getResetPassword);
router.post("/reset-password", adminController.postResetPassword);

// User Management Routes
router.use(userRoutes);

module.exports = router;