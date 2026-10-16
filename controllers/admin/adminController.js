import adminService from "../../services/admin/adminService.js";
import { HTTP_STATUS, RESPONSE_MESSAGES } from "../../constants/index.js";

const showLoginPage = (req, res) => {
    try {
        return res.status(HTTP_STATUS.OK).render("auth/login");
    } catch (err) {
        console.error("showLoginPage error:", err);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(RESPONSE_MESSAGES.AUTH.ADMIN_LOGIN_PAGE_ERROR);
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(HTTP_STATUS.BAD_REQUEST).render("auth/login", {
                error: RESPONSE_MESSAGES.AUTH.EMAIL_PASSWORD_REQUIRED,
                email
            });
        }

        const admin = await adminService.loginAdmin(email, password);

        req.session.userId = admin._id;
        req.session.isAdmin = true;

        return res.redirect("/admin/dashboard");
    } catch (error) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).render("auth/login", {
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
            totalUsers: metrics.totalUsers,
            totalProducts: metrics.totalProducts,
            totalCategories: metrics.totalCategories
        });
    } catch (error) {
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render("dashboard", {
            totalUsers: 0,
            totalProducts: 0,
            totalCategories: 0
        });
    }
};

// Admin Analytics GET
const getAnalytics = async (req, res) => {
    try {
        const metrics = await adminService.getDashboardMetrics();
        res.render("analytics", {
            totalUsers: metrics.totalUsers,
            totalProducts: metrics.totalProducts,
            totalCategories: metrics.totalCategories
        });
    } catch (error) {
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render("analytics", {
            totalUsers: 0,
            totalProducts: 0,
            totalCategories: 0
        });
    }
};

// Logout POST
const logout = (req, res) => {
    try {
        req.session.destroy(() => {
            res.clearCookie("admin.sid");
            res.redirect("/admin/login");
        });
    } catch (err) {
        console.error("admin logout error:", err);
        return res.redirect("/admin/login");
    }
};

// Forgot Password GET
const getForgotPassword = (req, res) => {
    try {
        return res.status(HTTP_STATUS.OK).render("auth/forgotPassword", { error: null });
    } catch (err) {
        console.error("getForgotPassword error:", err);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(RESPONSE_MESSAGES.AUTH.ADMIN_FORGOT_PASSWORD_ERROR);
    }
};

// Forgot Password POST
const postForgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(HTTP_STATUS.BAD_REQUEST).render("auth/forgotPassword", { error: "Email is required" });
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
    try {
        if (!req.session.adminResetId) {
            return res.redirect("/admin/forgot-password");
        }
        return res.render("auth/verifyOtp", { error: null, success: null });
    } catch (err) {
        console.error("getVerifyOtp error:", err);
        return res.redirect("/admin/forgot-password");
    }
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
        res.render("auth/verifyOtp", { error: error.message, success: null });
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
        res.render("auth/verifyOtp", { error: null, success: RESPONSE_MESSAGES.OTP.ADMIN_RESEND_SUCCESS });
    } catch (error) {
        res.render("auth/verifyOtp", { error: error.message, success: null });
    }
};

// Reset Password GET
const getResetPassword = (req, res) => {
    try {
        if (!req.session.adminResetId || !req.session.adminOtpVerified) {
            return res.redirect("/admin/forgot-password");
        }
        return res.render("auth/resetPassword", { error: null });
    } catch (err) {
        console.error("getResetPassword error:", err);
        return res.redirect("/admin/forgot-password");
    }
};

const validateAdminNewPassword = (newPassword, confirmPassword) => {
    if (!newPassword || newPassword.length < 8) {
        return "Password must be at least 8 characters.";
    }
    if (!/[a-zA-Z]/.test(newPassword)) {
        return "Password must contain at least one letter.";
    }
    if (!/\d/.test(newPassword)) {
        return "Password must contain at least one number.";
    }
    if (/^[^a-zA-Z0-9]+$/.test(newPassword)) {
        return "Password cannot consist only of symbols.";
    }
    if (newPassword !== confirmPassword) {
        return "Passwords do not match.";
    }
    return null;
};

// Reset Password POST
const postResetPassword = async (req, res) => {
    try {
        const adminId = req.session.adminResetId;
        const { newPassword, confirmPassword } = req.body;

        if (!adminId || !req.session.adminOtpVerified) {
            return res.redirect("/admin/forgot-password");
        }

        const error = validateAdminNewPassword(newPassword, confirmPassword);
        if (error) {
            return res.render("auth/resetPassword", { error });
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

export {
    showLoginPage,
    login,
    getDashboard,
    getAnalytics,
    logout,
    getForgotPassword,
    postForgotPassword,
    getVerifyOtp,
    postVerifyOtp,
    postResendOtp,
    getResetPassword,
    postResetPassword
};

export default {
    showLoginPage,
    login,
    getDashboard,
    getAnalytics,
    logout,
    getForgotPassword,
    postForgotPassword,
    getVerifyOtp,
    postVerifyOtp,
    postResendOtp,
    getResetPassword,
    postResetPassword
};