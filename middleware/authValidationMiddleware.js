// ========================================
// Signup Validation
// ========================================

const validateSignup = (req, res, next) => {
    const {
        name,
        email,
        phone,
        password,
        confirmPassword
    } = req.body;

    if (!name || !email || !phone || !password || !confirmPassword) {
        return res.status(400).render("signup", {
            error: "All fields are required.",
            formData: req.body
        });
    }

    if (password !== confirmPassword) {
        return res.status(400).render("signup", {
            error: "Passwords do not match.",
            formData: req.body
        });
    }

    if (password.length < 8) {
        return res.status(400).render("signup", {
            error: "Password must be at least 8 characters.",
            formData: req.body
        });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).render("signup", {
            error: "Please enter a valid email address.",
            formData: req.body
        });
    }

    next();
};

// ========================================
// Login Validation
// ========================================

const validateLogin = (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).render("login", {
            error: "Email and password are required.",
            formData: req.body
        });
    }

    next();
};

// ========================================
// OTP Validation
// ========================================

const validateOTP = (req, res, next) => {
    const { otpCode } = req.body;

    if (!otpCode) {
        return res.status(400).render("verifyOtp", {
            error: "Please enter the OTP."
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
        return res.status(400).render("forgotPassword", {
            error: "Please enter your email address.",
            success: null
        });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).render("forgotPassword", {
            error: "Please enter a valid email address.",
            success: null
        });
    }

    next();
};


// ========================================
// Reset Password Validation
// ========================================

const validateResetPassword = (req, res, next) => {

    const {
        otpCode,
        newPassword,
        confirmPassword
    } = req.body;

    if (!otpCode || !newPassword || !confirmPassword) {
        return res.status(400).render("resetPassword", {
            error: "All fields are required."
        });
    }

    if (newPassword.length < 8) {
        return res.status(400).render("resetPassword", {
            error: "Password must be at least 8 characters."
        });
    }

    if (newPassword !== confirmPassword) {
        return res.status(400).render("resetPassword", {
            error: "Passwords do not match."
        });
    }

    next();
};


// ========================================
// Change Password Validation
// ========================================

const validateChangePassword = (req, res, next) => {

    const {
        currentPassword,
        newPassword,
        confirmPassword
    } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).render("changePassword", {
            error: "All fields are required.",
            success: null
        });
    }

    if (newPassword.length < 8) {
        return res.status(400).render("changePassword", {
            error: "New password must be at least 8 characters.",
            success: null
        });
    }

    if (newPassword !== confirmPassword) {
        return res.status(400).render("changePassword", {
            error: "New passwords do not match.",
            success: null
        });
    }

    if (currentPassword === newPassword) {
        return res.status(400).render("changePassword", {
            error: "New password must be different from the current password.",
            success: null
        });
    }

    next();
};


// ========================================
// Change Email Validation
// ========================================

const validateChangeEmail = (req, res, next) => {

    const { newEmail } = req.body;

    if (!newEmail) {

        return res.status(400).render("changeEmail", {
            error: "Please enter your new email address."
        });

    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(newEmail.trim())) {

        return res.status(400).render("changeEmail", {
            error: "Please enter a valid email address."
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
