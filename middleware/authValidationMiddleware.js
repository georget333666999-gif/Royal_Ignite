const User = require("../models/userModel");

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
const validateSignup = (req, res, next) => {
    const { name, email, phone, password, confirmPassword } = req.body;

    if (!name || !email || !phone || !password || !confirmPassword) {
        return res.status(400).render("signup", { error: "All fields are required.", formData: req.body });
    }
    const pwdError = validatePasswordStrength(password);
    if (pwdError) {
        return res.status(400).render("signup", { error: pwdError, formData: req.body });
    }
    if (password !== confirmPassword) {
        return res.status(400).render("signup", { error: "Passwords do not match.", formData: req.body });
    }
    if (!isValidEmail(email)) {
        return res.status(400).render("signup", { error: "Please enter a valid email address.", formData: req.body });
    }
    const typoError = checkEmailTypo(email);
    if (typoError) {
        return res.status(400).render("signup", { error: typoError, formData: req.body });
    }

    next();
};

// ========================================
// Login Validation
// ========================================
const validateLogin = (req, res, next) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).render("login", { error: "Email and password are required.", formData: req.body });
    }
    next();
};

// ========================================
// OTP Validation
// ========================================
const validateOTP = (req, res, next) => {
    const { otpCode } = req.body;
    const isEmailChange = req.originalUrl && req.originalUrl.includes("verify-email-otp");

    if (!otpCode || !otpCode.trim()) {
        if (isEmailChange) {
            return res.status(400).render("verifyEmailOtp", {
                pendingEmail: req.session.pendingNewEmail || "",
                error: "Please enter the 6-digit OTP code."
            });
        }
        return res.status(400).render("verifyOtp", {
            error: "Please enter the 6-digit OTP code.",
            remainingSeconds: 0,
            isExpired: false
        });
    }

    if (!/^\d{6}$/.test(otpCode.trim())) {
        if (isEmailChange) {
            return res.status(400).render("verifyEmailOtp", {
                pendingEmail: req.session.pendingNewEmail || "",
                error: "OTP must be exactly 6 digits."
            });
        }
        return res.status(400).render("verifyOtp", {
            error: "OTP must be exactly 6 digits.",
            remainingSeconds: 0,
            isExpired: false
        });
    }

    next();
};

// ========================================
// Forgot Password Validation
// ========================================
const validateForgotPassword = (req, res, next) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).render("forgotPassword", { error: "Please enter your email address.", success: null });
    }
    if (!isValidEmail(email)) {
        return res.status(400).render("forgotPassword", { error: "Please enter a valid email address.", success: null });
    }
    const typoError = checkEmailTypo(email);
    if (typoError) {
        return res.status(400).render("forgotPassword", { error: typoError, success: null });
    }
    next();
};

// ========================================
// Reset Password Validation
// ========================================
const validateResetPassword = (req, res, next) => {
    const { otpCode, newPassword, confirmPassword } = req.body;

    if (!otpCode || !newPassword || !confirmPassword) {
        return res.status(400).render("resetPassword", { error: "All fields are required." });
    }
    if (!/^\d{6}$/.test(otpCode.trim())) {
        return res.status(400).render("resetPassword", { error: "OTP must be exactly 6 digits." });
    }
    const pwdError = validatePasswordStrength(newPassword);
    if (pwdError) {
        return res.status(400).render("resetPassword", { error: pwdError });
    }
    if (newPassword !== confirmPassword) {
        return res.status(400).render("resetPassword", { error: "Passwords do not match." });
    }

    next();
};

// ========================================
// Change Password Validation
// ========================================
const validateChangePassword = (req, res, next) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const user = req.user || null;

    if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).render("changePassword", { user, error: "All fields are required.", success: null });
    }
    const pwdError = validatePasswordStrength(newPassword);
    if (pwdError) {
        return res.status(400).render("changePassword", { user, error: pwdError, success: null });
    }
    if (newPassword !== confirmPassword) {
        return res.status(400).render("changePassword", { user, error: "Passwords do not match.", success: null });
    }
    if (currentPassword === newPassword) {
        return res.status(400).render("changePassword", { user, error: "New password must be different from the current password.", success: null });
    }

    next();
};

// ========================================
// Change Email Validation
// ========================================
const validateChangeEmail = async (req, res, next) => {
    const { newEmail } = req.body;
    let currentEmail = "";
    try {
        if (req.session.userId) {
            const user = await User.findById(req.session.userId).select("email");
            if (user) currentEmail = user.email;
        }
    } catch (e) {}

    if (!newEmail || !newEmail.trim()) {
        return res.status(400).render("changeEmail", { 
            error: "Please enter your new email address.",
            currentEmail,
            newEmail: ""
        });
    }
    if (!isValidEmail(newEmail)) {
        return res.status(400).render("changeEmail", { 
            error: "Please enter a valid email address (e.g., name@domain.com).",
            currentEmail,
            newEmail
        });
    }
    const typoError = checkEmailTypo(newEmail);
    if (typoError) {
        return res.status(400).render("changeEmail", { 
            error: typoError,
            currentEmail,
            newEmail
        });
    }
    if (currentEmail && newEmail.trim().toLowerCase() === currentEmail.toLowerCase()) {
        return res.status(400).render("changeEmail", {
            error: "New email must be different from your current email.",
            currentEmail,
            newEmail
        });
    }
    next();
};

module.exports = {
    validateSignup,
    validateLogin,
    validateOTP,
    validateForgotPassword,
    validateResetPassword,
    validateChangePassword,
    validateChangeEmail
};
