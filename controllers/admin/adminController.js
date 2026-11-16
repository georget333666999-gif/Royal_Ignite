import adminService from "../../services/admin/adminService.js";
import dashboardService from "../../services/admin/dashboardService.js";
import { HTTP_STATUS, RESPONSE_MESSAGES, SESSION } from "../../constants/index.js";

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

        return req.session.regenerate((regenErr) => {
            if (regenErr) console.error("Admin session regenerate error:", regenErr);
            req.session.userId = admin._id;
            req.session.isAdmin = true;
            return req.session.save((saveErr) => {
                if (saveErr) console.error("Admin session save error:", saveErr);
                return res.redirect("/admin/dashboard");
            });
        });
    } catch (error) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).render("auth/login", {
            error: error.message,
            email: req.body.email
        });
    }
};

// Render admin dashboard
const getDashboard = async (req, res) => {
    try {
        const [
            liveMetrics,
            topProducts,
            topCategories,
            topBrands,
            chartData
        ] = await Promise.all([
            dashboardService.getLiveDashboardMetrics(),
            dashboardService.getTop10Products(),
            dashboardService.getTop10Categories(),
            dashboardService.getTop10Brands(),
            dashboardService.getChartData("monthly")
        ]);

        res.render("dashboard", {
            pageTitle: "Atelier Executive Dashboard — ROYAL IGNITE Admin",
            adminUser: req.session.adminUser || null,
            todayRevenue: liveMetrics.todayRevenue,
            todayOrdersCount: liveMetrics.todayOrdersCount,
            pendingOrdersCount: liveMetrics.pendingOrdersCount,
            totalUsers: liveMetrics.totalUsers,
            totalProducts: liveMetrics.totalProducts,
            totalCategories: liveMetrics.totalCategories,
            recentOrders: liveMetrics.recentOrders,
            topProducts,
            topCategories,
            topBrands,
            chartData
        });
    } catch (error) {
        console.error("adminController getDashboard error:", error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render("dashboard", {
            todayRevenue: 0,
            todayOrdersCount: 0,
            pendingOrdersCount: 0,
            totalUsers: 0,
            totalProducts: 0,
            totalCategories: 0,
            recentOrders: [],
            topProducts: [],
            topCategories: [],
            topBrands: [],
            chartData: { labels: [], revenues: [], orderCounts: [] }
        });
    }
};

// Fetch chart data by timeframe (yearly, monthly, weekly)
const getChartDataApi = async (req, res) => {
    try {
        const { filter = "monthly" } = req.query;
        const data = await dashboardService.getChartData(filter);
        return res.status(HTTP_STATUS.OK).json({ success: true, ...data });
    } catch (error) {
        console.error("adminController getChartDataApi error:", error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Unable to retrieve chart trajectory."
        });
    }
};

// Generate ledger summary
const getLedgerBook = async (req, res) => {
    try {
        const ledger = await dashboardService.getLedgerBookSummary();
        if (req.xhr || req.headers.accept?.includes("application/json")) {
            return res.status(HTTP_STATUS.OK).json({ success: true, ledger });
        }
        return res.redirect("/admin/reports/sales?period=yearly");
    } catch (error) {
        console.error("adminController getLedgerBook error:", error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Unable to generate ledger summary."
        });
    }
};

// Admin Analytics GET
const getAnalytics = async (req, res) => {
    try {
        const [
            liveMetrics,
            topProducts,
            topCategories,
            topBrands,
            chartData,
            ledger
        ] = await Promise.all([
            dashboardService.getLiveDashboardMetrics(),
            dashboardService.getTop10Products(),
            dashboardService.getTop10Categories(),
            dashboardService.getTop10Brands(),
            dashboardService.getChartData("monthly"),
            dashboardService.getLedgerBookSummary()
        ]);

        res.render("analytics", {
            pageTitle: "Business Intelligence & Analytics — ROYAL IGNITE Admin",
            adminUser: req.session.adminUser || null,
            totalUsers: liveMetrics.totalUsers,
            totalProducts: liveMetrics.totalProducts,
            totalCategories: liveMetrics.totalCategories,
            todayRevenue: liveMetrics.todayRevenue,
            todayOrdersCount: liveMetrics.todayOrdersCount,
            pendingOrdersCount: liveMetrics.pendingOrdersCount,
            topProducts,
            topCategories,
            topBrands,
            chartData,
            ledger
        });
    } catch (error) {
        console.error("adminController getAnalytics error:", error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render("analytics", {
            totalUsers: 0,
            totalProducts: 0,
            totalCategories: 0,
            todayRevenue: 0,
            todayOrdersCount: 0,
            pendingOrdersCount: 0,
            topProducts: [],
            topCategories: [],
            topBrands: [],
            chartData: { labels: [], revenues: [], orderCounts: [] },
            ledger: null
        });
    }
};

// Logout POST
const logout = (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) console.error("admin logout destroy error:", err);
            res.clearCookie(SESSION.ADMIN_COOKIE, { path: "/" });
            return res.redirect("/admin/login");
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
    getChartDataApi,
    getLedgerBook,
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
    getChartDataApi,
    getLedgerBook,
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