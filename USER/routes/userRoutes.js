const express = require("express");

const authController = require("../controllers/authController");
const otpController = require("../controllers/otpController");
const passwordController = require("../controllers/passwordController");
const profileController = require("../controllers/profileController");
const { userMiddleware, redirectIfUserLoggedIn } = require("../../middleware/userMiddleware");
const authValidationMiddleware = require("../../middleware/authValidationMiddleware");
const addressValidationMiddleware = require("../../middleware/addressValidationMiddleware");
const { handleProfileUpload } = require("../../middleware/uploadMiddleware");
const addressController = require("../controllers/addressController");

const router = express.Router();


// ========================================
// Signup Page
// ========================================

router.get(
    "/signup",
    redirectIfUserLoggedIn,
    authController.getSignup
);


// ========================================
// Signup Form
// ========================================

router.post(
    "/signup",
    redirectIfUserLoggedIn,
    authValidationMiddleware.validateSignup,
    authController.postSignup
);


// ========================================
// OTP Verification Page
// ========================================

router.get(
    "/verify-otp",
    redirectIfUserLoggedIn,
    otpController.getVerifyOTP
);


// ========================================
// OTP Verification
// ========================================

router.post(
    "/verify-otp",
    redirectIfUserLoggedIn,
    authValidationMiddleware.validateOTP,
    otpController.postVerifyOTP
);
// ========================================
// OTP ReSend
// ========================================

router.post(
    "/resend-otp",
    redirectIfUserLoggedIn,
    otpController.resendOTP
);

// ========================================
// Login
// ========================================

router.get(
    "/login",
    redirectIfUserLoggedIn,
    authController.getLogin
);

router.post(
    "/login",
    redirectIfUserLoggedIn,
    authValidationMiddleware.validateLogin,
    authController.postLogin
);

// ========================================
// Logout
// ========================================

router.get(
    "/logout",
    authController.logout
);

router.post(
    "/logout",
    authController.logout
);

// ========================================
// Forgot Password
// ========================================

router.get(
    "/forgot-password",
    redirectIfUserLoggedIn,
    passwordController.getForgotPassword
);

router.post(
    "/forgot-password",
    redirectIfUserLoggedIn,
    authValidationMiddleware.validateForgotPassword,
    passwordController.postForgotPassword
);

// ========================================
// Reset Password
// ========================================

router.get(
    "/reset-password",
    redirectIfUserLoggedIn,
    passwordController.getResetPassword
);

router.post(
    "/reset-password",
    redirectIfUserLoggedIn,
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
    handleProfileUpload,
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
// Change Email & Verification
// ========================================

router.get(
    "/profile/change-email",
    userMiddleware,
    profileController.getChangeEmail
);

router.post(
    "/profile/change-email",
    userMiddleware,
    authValidationMiddleware.validateChangeEmail,
    profileController.postChangeEmail
);

router.get(
    "/profile/verify-email-otp",
    userMiddleware,
    profileController.getVerifyEmailOTP
);

router.post(
    "/profile/verify-email-otp",
    userMiddleware,
    authValidationMiddleware.validateOTP,
    profileController.postVerifyEmailOTP
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