import User from "../models/userModel.js";
import { getOtpExpiryStatus } from "../utils/otpHelper.js";
import { HTTP_STATUS, RESPONSE_MESSAGES } from "../constants/index.js";

// Email regex helper
const isValidEmail = (email) => /^[a-zA-Z0-9._%+-]+@([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(email?.trim() || "");

// Common email provider typo detection
const commonDomainTypos = {
    "gmal.com": "gmail.com",
    "gamil.com": "gmail.com",
    "gmial.com": "gmail.com",
    "gmaill.com": "gmail.com",
    "gmai.com": "gmail.com",
    "gml.com": "gmail.com",
    "gmail.co": "gmail.com",
    "gemail.com": "gmail.com",
    "yaho.com": "yahoo.com",
    "yahooo.com": "yahoo.com",
    "yahu.com": "yahoo.com",
    "hotmial.com": "hotmail.com",
    "hotmai.com": "hotmail.com",
    "outlok.com": "outlook.com",
    "outluk.com": "outlook.com",
    "iclud.com": "icloud.com",
    "icld.com": "icloud.com"
};

const checkEmailTypo = (email) => {
    const domain = (email || "").split("@")[1]?.toLowerCase().trim();
    if (domain && commonDomainTypos[domain]) {
        return `Did you mean @${commonDomainTypos[domain]}? Please check your email domain.`;
    }
    return null;
};

// Universal Password Strength Validator
const validatePasswordStrength = (password) => {
    if (!password || password.length < 8) {
        return "Password must be at least 8 characters.";
    }
    if (!/[a-zA-Z]/.test(password)) {
        return "Password must contain at least one letter.";
    }
    if (!/\d/.test(password)) {
        return "Password must contain at least one number.";
    }
    if (/^[^a-zA-Z0-9]+$/.test(password)) {
        return "Password cannot consist only of symbols or underscores.";
    }
    return null;
};

// ========================================
// Signup Validation
// ========================================
const getSignupValidationError = (body = {}) => {
    const { name, email, phone, password, confirmPassword } = body;
    if (!name || !email || !phone || !password || !confirmPassword) {
        return "All fields are required.";
    }

    const pwdError = validatePasswordStrength(password);
    if (pwdError) return pwdError;

    if (password !== confirmPassword) {
        return RESPONSE_MESSAGES.AUTH.PASSWORD_MISMATCH;
    }
    if (!isValidEmail(email)) {
        return "Please enter a valid email address.";
    }
    return checkEmailTypo(email);
};

const validateSignup = (req, res, next) => {
    try {
        const error = getSignupValidationError(req.body);
        if (error) {
            return res.status(HTTP_STATUS.BAD_REQUEST).render("signup", { error, formData: req.body });
        }
        next();
    } catch (err) {
        console.error("validateSignup error:", err);
        return next(err);
    }
};

// ========================================
// Login Validation
// ========================================
const validateLogin = (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(HTTP_STATUS.BAD_REQUEST).render("login", { error: RESPONSE_MESSAGES.AUTH.EMAIL_PASSWORD_REQUIRED, formData: req.body });
        }
        next();
    } catch (err) {
        console.error("validateLogin error:", err);
        return next(err);
    }
};

// ========================================
// OTP Validation
// ========================================
const renderOtpValidationError = async (req, res, errorMessage) => {
    try {
        const isEmailChange = Boolean(req.originalUrl && req.originalUrl.includes("verify-email-otp"));
        if (isEmailChange) {
            const { remainingSeconds, resendCooldownSeconds, isExpired } = await getOtpExpiryStatus(req.session?.userId, "email-change");
            return res.status(HTTP_STATUS.BAD_REQUEST).render("verifyEmailOtp", {
                pendingEmail: req.session?.pendingNewEmail || "",
                error: errorMessage,
                remainingSeconds,
                resendCooldownSeconds,
                isExpired
            });
        }

        const { remainingSeconds, resendCooldownSeconds, isExpired } = await getOtpExpiryStatus(req.session?.otpUserId, "signup");
        return res.status(HTTP_STATUS.BAD_REQUEST).render("verifyOtp", {
            error: errorMessage,
            remainingSeconds,
            resendCooldownSeconds,
            isExpired
        });
    } catch (err) {
        console.error("renderOtpValidationError error:", err);
        return res.status(HTTP_STATUS.BAD_REQUEST).render("verifyOtp", {
            error: errorMessage,
            remainingSeconds: 0,
            resendCooldownSeconds: 0,
            isExpired: true
        });
    }
};

const validateOTP = async (req, res, next) => {
    try {
        const otpCode = req.body.otpCode ? req.body.otpCode.trim() : "";
        const isAjax = Boolean(req.xhr || req.headers?.accept?.includes("application/json") || req.is?.("json"));

        if (!otpCode) {
            if (isAjax) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: RESPONSE_MESSAGES.OTP.ENTER_CODE });
            }
            return await renderOtpValidationError(req, res, RESPONSE_MESSAGES.OTP.ENTER_CODE);
        }
        if (!/^\d{6}$/.test(otpCode)) {
            if (isAjax) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: RESPONSE_MESSAGES.OTP.EXACT_6_DIGITS });
            }
            return await renderOtpValidationError(req, res, RESPONSE_MESSAGES.OTP.EXACT_6_DIGITS);
        }

        next();
    } catch (err) {
        console.error("validateOTP error:", err);
        return next(err);
    }
};

// ========================================
// Forgot Password Validation
// ========================================
const validateForgotPassword = (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(HTTP_STATUS.BAD_REQUEST).render("forgotPassword", { error: "Please enter your email address.", success: null });
        }
        if (!isValidEmail(email)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).render("forgotPassword", { error: "Please enter a valid email address.", success: null });
        }
        const typoError = checkEmailTypo(email);
        if (typoError) {
            return res.status(HTTP_STATUS.BAD_REQUEST).render("forgotPassword", { error: typoError, success: null });
        }
        next();
    } catch (err) {
        console.error("validateForgotPassword error:", err);
        return next(err);
    }
};

// ========================================
// Reset Password Validation
// ========================================
const getResetPasswordValidationError = (body = {}) => {
    const { otpCode, newPassword, confirmPassword } = body;
    if (!otpCode || !newPassword || !confirmPassword) {
        return "All fields are required.";
    }
    if (!/^\d{6}$/.test(otpCode.trim())) {
        return RESPONSE_MESSAGES.OTP.EXACT_6_DIGITS;
    }
    const pwdError = validatePasswordStrength(newPassword);
    if (pwdError) return pwdError;

    if (newPassword !== confirmPassword) {
        return RESPONSE_MESSAGES.AUTH.PASSWORD_MISMATCH;
    }
    return null;
};

const validateResetPassword = (req, res, next) => {
    try {
        const error = getResetPasswordValidationError(req.body);
        if (error) {
            return res.status(HTTP_STATUS.BAD_REQUEST).render("resetPassword", { error });
        }
        next();
    } catch (err) {
        console.error("validateResetPassword error:", err);
        return next(err);
    }
};

// ========================================
// Change Password Validation
// ========================================
const getChangePasswordValidationError = (body = {}) => {
    const { currentPassword, newPassword, confirmPassword } = body;
    if (!currentPassword || !newPassword || !confirmPassword) {
        return "All fields are required.";
    }
    const pwdError = validatePasswordStrength(newPassword);
    if (pwdError) return pwdError;

    if (newPassword !== confirmPassword) {
        return RESPONSE_MESSAGES.AUTH.PASSWORD_MISMATCH;
    }
    if (currentPassword === newPassword) {
        return "New password must be different from the current password.";
    }
    return null;
};

const validateChangePassword = (req, res, next) => {
    try {
        const user = req.user || null;
        const error = getChangePasswordValidationError(req.body);
        if (error) {
            return res.status(HTTP_STATUS.BAD_REQUEST).render("changePassword", { user, error, success: null });
        }
        next();
    } catch (err) {
        console.error("validateChangePassword error:", err);
        return next(err);
    }
};

// ========================================
// Change Email Validation
// ========================================
const getChangeEmailValidationError = (newEmail, currentEmail) => {
    const trimmed = (newEmail || "").trim();
    if (!trimmed) {
        return "Please enter your new email address.";
    }
    if (!isValidEmail(trimmed)) {
        return "Please enter a valid email address (e.g., name@domain.com).";
    }
    const typoError = checkEmailTypo(trimmed);
    if (typoError) {
        return typoError;
    }
    if (currentEmail && trimmed.toLowerCase() === currentEmail.toLowerCase()) {
        return "New email must be different from your current email.";
    }
    return null;
};

const validateChangeEmail = async (req, res, next) => {
    try {
        const { newEmail } = req.body;
        let currentEmail = "";
        try {
            if (req.session?.userId) {
                const user = await User.findById(req.session.userId).select("email");
                if (user) currentEmail = user.email;
            }
        } catch (_) {}

        const error = getChangeEmailValidationError(newEmail, currentEmail);
        if (error) {
            return res.status(HTTP_STATUS.BAD_REQUEST).render("changeEmail", {
                error,
                currentEmail,
                newEmail: newEmail || ""
            });
        }

        next();
    } catch (err) {
        console.error("validateChangeEmail error:", err);
        return next(err);
    }
};

export {
    validateSignup,
    validateLogin,
    validateOTP,
    validateForgotPassword,
    validateResetPassword,
    validateChangePassword,
    validateChangeEmail
};

export default {
    validateSignup,
    validateLogin,
    validateOTP,
    validateForgotPassword,
    validateResetPassword,
    validateChangePassword,
    validateChangeEmail
};
