export const adminMiddleware = (req, res, next) => {
    try {
        if (!req.session?.userId || !req.session?.isAdmin) {
            return res.redirect("/admin/login");
        }
        next();
    } catch (err) {
        console.error("adminMiddleware error:", err);
        return res.redirect("/admin/login");
    }
};

export const redirectIfAdminLoggedIn = (req, res, next) => {
    try {
        if (req.session && req.session.userId && req.session.isAdmin) {
            return res.redirect("/admin/dashboard");
        }
        next();
    } catch (err) {
        console.error("redirectIfAdminLoggedIn error:", err);
        next();
    }
};

export default {
    adminMiddleware,
    redirectIfAdminLoggedIn
};