import express from "express";
import authController from "../../controllers/user/authController.js";
import otpController from "../../controllers/user/otpController.js";
import passwordController from "../../controllers/user/passwordController.js";
import { redirectIfUserLoggedIn } from "../../middleware/userMiddleware.js";
import authValidationMiddleware from "../../middleware/authValidationMiddleware.js";

const router = express.Router();

// ========================================
// User Signup Flow
// ========================================
router.get("/signup", redirectIfUserLoggedIn, authController.getSignup);
router.post(
    "/signup",
    redirectIfUserLoggedIn,
    authValidationMiddleware.validateSignup,
    authController.postSignup
);

// ========================================
// OTP Verification Flow
// ========================================
router.get("/verify-otp", redirectIfUserLoggedIn, otpController.getVerifyOTP);
router.post(
    "/verify-otp",
    redirectIfUserLoggedIn,
    authValidationMiddleware.validateOTP,
    otpController.postVerifyOTP
);
router.post("/resend-otp", redirectIfUserLoggedIn, otpController.resendOTP);

// ========================================
// Login & Session Management
// ========================================
router.get("/login", redirectIfUserLoggedIn, authController.getLogin);
router.post(
    "/login",
    redirectIfUserLoggedIn,
    authValidationMiddleware.validateLogin,
    authController.postLogin
);
router.get("/logout", authController.logout);
router.post("/logout", authController.logout);

// ========================================
// Password Recovery Flow
// ========================================
router.get("/forgot-password", redirectIfUserLoggedIn, passwordController.getForgotPassword);
router.post(
    "/forgot-password",
    redirectIfUserLoggedIn,
    authValidationMiddleware.validateForgotPassword,
    passwordController.postForgotPassword
);

router.get("/reset-password", redirectIfUserLoggedIn, passwordController.getResetPassword);
router.post(
    "/reset-password",
    redirectIfUserLoggedIn,
    authValidationMiddleware.validateResetPassword,
    passwordController.postResetPassword
);
router.post("/resend-reset-otp", redirectIfUserLoggedIn, passwordController.resendResetOTP);

export default router;
