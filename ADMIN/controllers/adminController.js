const adminService = require("../services/adminService");

const showLoginPage = (req, res) => {
    res.render("auth/login");
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).render("auth/login", {
                error: "Email and password are required",
                email
            });
        }

        const admin = await adminService.loginAdmin(email, password);

        req.session.userId = admin._id;
        req.session.isAdmin = true;

        return res.redirect("/admin/dashboard");
    } catch (error) {
        return res.status(401).render("auth/login", {
            error: error.message,
            email: req.body.email
        });
    }
};

// Admin Dashboard GET
const getDashboard = async (req, res) => {
    try {
        const metrics = await adminService.getDashboardMetrics();
        res.render("dashboard", {
            totalUsers: metrics.totalUsers
        });
    } catch (error) {
        res.status(500).render("dashboard", {
            totalUsers: 0
        });
    }
};

// Logout POST
const logout = (req, res) => {
    req.session.destroy(() => {
        res.redirect("/admin/login");
    });
};

// Forgot Password GET
const getForgotPassword = (req, res) => {
    res.render("auth/forgotPassword", { error: null });
};

// Forgot Password POST
const postForgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.render("auth/forgotPassword", { error: "Email is required" });
        }

        const { admin } = await adminService.sendResetOtp(email);
        req.session.adminResetId = admin._id.toString();
        req.session.adminResetEmail = admin.email;

        res.redirect("/admin/verify-otp");
    } catch (error) {
        res.render("auth/forgotPassword", { error: error.message });
    }
};

// Verify OTP GET
const getVerifyOtp = (req, res) => {
    if (!req.session.adminResetId) {
        return res.redirect("/admin/forgot-password");
    }
    res.render("auth/verifyOtp", { error: null });
};

// Verify OTP POST
const postVerifyOtp = async (req, res) => {
    try {
        const adminId = req.session.adminResetId;
        const { otpCode } = req.body;

        if (!adminId) {
            return res.redirect("/admin/forgot-password");
        }

        await adminService.verifyOtp(adminId, otpCode ? otpCode.trim() : "");
        req.session.adminOtpVerified = true;

        res.redirect("/admin/reset-password");
    } catch (error) {
        res.render("auth/verifyOtp", { error: error.message });
    }
};

// Resend OTP POST
const postResendOtp = async (req, res) => {
    try {
        const email = req.session.adminResetEmail;
        if (!email) {
            return res.redirect("/admin/forgot-password");
        }

        await adminService.sendResetOtp(email);
        res.render("auth/verifyOtp", { error: "A new OTP code has been sent to your email." });
    } catch (error) {
        res.render("auth/verifyOtp", { error: error.message });
    }
};

// Reset Password GET
const getResetPassword = (req, res) => {
    if (!req.session.adminResetId || !req.session.adminOtpVerified) {
        return res.redirect("/admin/forgot-password");
    }
    res.render("auth/resetPassword", { error: null });
};

// Reset Password POST
const postResetPassword = async (req, res) => {
    try {
        const adminId = req.session.adminResetId;
        const { newPassword, confirmPassword } = req.body;

        if (!adminId || !req.session.adminOtpVerified) {
            return res.redirect("/admin/forgot-password");
        }

        if (newPassword !== confirmPassword) {
            return res.render("auth/resetPassword", { error: "Passwords do not match" });
        }

        await adminService.resetPassword(adminId, newPassword);

        // Clear reset session
        delete req.session.adminResetId;
        delete req.session.adminResetEmail;
        delete req.session.adminOtpVerified;

        res.render("auth/resetSuccess");
    } catch (error) {
        res.render("auth/resetPassword", { error: error.message });
    }
};

module.exports = {
    showLoginPage,
    login,
    getDashboard,
    logout,
    getForgotPassword,
    postForgotPassword,
    getVerifyOtp,
    postVerifyOtp,
    postResendOtp,
    getResetPassword,
    postResetPassword
};