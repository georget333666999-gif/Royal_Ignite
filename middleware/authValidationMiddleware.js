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
    const { otp } = req.body;

    if (!otp) {
        return res.status(400).render("verifyOtp", {
            error: "Please enter the OTP."
        });
    }

    next();
};

module.exports = {
    validateSignup,
    validateLogin,
    validateOTP
};
