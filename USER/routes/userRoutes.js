const express = require("express");

const authController = require("../controllers/authController");
const otpController = require("../controllers/otpController");
const passwordController = require("../controllers/passwordController");
const profileController = require("../controllers/profileController");
const userMiddleware = require("../../middleware/userMiddleware");
const authValidationMiddleware = require("../../middleware/authValidationMiddleware");
const addressValidationMiddleware = require("../../middleware/addressValidationMiddleware");
const upload = require("../../middleware/uploadMiddleware");
const addressController = require("../controllers/addressController");

const router = express.Router();


// ========================================
// Signup Page
// ========================================

router.get(
    "/signup",
    authController.getSignup
);


// ========================================
// Signup Form
// ========================================

router.post(
    "/signup",
    authValidationMiddleware.validateSignup,
    authController.postSignup
);


// ========================================
// OTP Verification Page
// ========================================

router.get(
    "/verify-otp",
    otpController.getVerifyOTP
);


// ========================================
// OTP Verification
// ========================================

router.post(
    "/verify-otp",
    authValidationMiddleware.validateOTP,
    otpController.postVerifyOTP
);
// ========================================
// OTP ReSend
// ========================================

router.post(
    "/resend-otp",
    otpController.resendOTP
);

// ========================================
// Login
// ========================================

router.get(
    "/login",
    authController.getLogin
);

router.post(
    "/login",
    authValidationMiddleware.validateLogin,
    authController.postLogin
);

// ========================================
// Logout
// ========================================

router.post(
    "/logout",
    authController.logout
);

// ========================================
// Forgot Password
// ========================================

router.get(
    "/forgot-password",
    passwordController.getForgotPassword
);

router.post(
    "/forgot-password",
    authValidationMiddleware.validateForgotPassword,
    passwordController.postForgotPassword
);

// ========================================
// Reset Password
// ========================================

router.get(
    "/reset-password",
    passwordController.getResetPassword
);

router.post(
    "/reset-password",
    authValidationMiddleware.validateResetPassword,
    passwordController.postResetPassword
);

// ========================================
// User Profile
// ========================================

router.get(
    "/profile",
    userMiddleware,
    profileController.getProfile
);

router.get(
    "/profile",
    userMiddleware,
    profileController.getProfile
);

// ========================================
// Edit Profile
// ========================================

router.get(
    "/profile/edit",
    userMiddleware,
    profileController.getEditProfile
);

router.post(
    "/profile/edit",
    userMiddleware,
    upload.single("profileImage"),
    profileController.postEditProfile
);

// ========================================
// Change Password
// ========================================

router.get(
    "/profile/change-password",
    userMiddleware,
    profileController.getChangePassword
);

router.post(
    "/profile/change-password",
    userMiddleware,
    authValidationMiddleware.validateChangePassword,
    profileController.postChangePassword
);

// ========================================
// Addresses
// ========================================

router.get(
    "/addresses",
    userMiddleware,
    addressController.getAddresses
);

router.get(
    "/addresses/add",
    userMiddleware,
    addressController.getAddAddress
);

router.post(
    "/addresses/add",
    userMiddleware,
    addressValidationMiddleware.validateAddAddress,
    addressController.postAddAddress
);

// ========================================
// Edit Address
// ========================================

router.get(
    "/addresses/edit/:id",
    userMiddleware,
    addressController.getEditAddress
);

router.post(
    "/addresses/edit/:id",
    userMiddleware,
    addressValidationMiddleware.validateEditAddress,
    addressController.postEditAddress
);


// ========================================
// Delete Address
// ========================================

router.post(
    "/addresses/delete/:id",
    userMiddleware,
    addressController.deleteAddress
);


// ========================================
// Set Default Address
// ========================================

router.post(
    "/addresses/default/:id",
    userMiddleware,
    addressController.setDefaultAddress
);

module.exports = router;    