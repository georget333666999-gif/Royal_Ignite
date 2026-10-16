import express from "express";
import profileController from "../../controllers/user/profileController.js";
import { userMiddleware } from "../../middleware/userMiddleware.js";
import authValidationMiddleware from "../../middleware/authValidationMiddleware.js";
import { handleProfileUpload } from "../../middleware/uploadMiddleware.js";

const router = express.Router();

// Apply userMiddleware to protect all profile routes
router.use(userMiddleware);

// ========================================
// Profile Overview & Profile Editing
// ========================================
router.get("/profile", profileController.getProfile);
router.get("/profile/edit", profileController.getEditProfile);
router.post("/profile/edit", handleProfileUpload, profileController.postEditProfile);

// ========================================
// Password Change
// ========================================
router.get("/profile/change-password", profileController.getChangePassword);
router.post(
    "/profile/change-password",
    authValidationMiddleware.validateChangePassword,
    profileController.postChangePassword
);

// ========================================
// Email Change & Verification Flow
// ========================================
router.get("/profile/change-email", profileController.getChangeEmail);
router.post(
    "/profile/change-email",
    authValidationMiddleware.validateChangeEmail,
    profileController.postChangeEmail
);

router.get("/profile/verify-email-otp", profileController.getVerifyEmailOTP);
router.post(
    "/profile/verify-email-otp",
    authValidationMiddleware.validateOTP,
    profileController.postVerifyEmailOTP
);
router.post("/profile/resend-email-otp", profileController.resendEmailChangeOTP);

export default router;
