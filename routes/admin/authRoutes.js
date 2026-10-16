import express from "express";
import adminController from "../../controllers/admin/adminController.js";
import { redirectIfAdminLoggedIn } from "../../middleware/adminMiddleware.js";

const router = express.Router();

// ========================================
// Admin Login & Session
// ========================================
router.get("/login", redirectIfAdminLoggedIn, adminController.showLoginPage);
router.post("/login", redirectIfAdminLoggedIn, adminController.login);
router.get("/logout", adminController.logout);
router.post("/logout", adminController.logout);

// ========================================
// Admin Forgot Password Flow
// ========================================
router.get("/forgot-password", redirectIfAdminLoggedIn, adminController.getForgotPassword);
router.post("/forgot-password", redirectIfAdminLoggedIn, adminController.postForgotPassword);

router.get("/verify-otp", redirectIfAdminLoggedIn, adminController.getVerifyOtp);
router.post("/verify-otp", redirectIfAdminLoggedIn, adminController.postVerifyOtp);
router.post("/resend-otp", redirectIfAdminLoggedIn, adminController.postResendOtp);

router.get("/reset-password", redirectIfAdminLoggedIn, adminController.getResetPassword);
router.post("/reset-password", redirectIfAdminLoggedIn, adminController.postResetPassword);

export default router;
