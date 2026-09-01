const adminMiddleware = (req, res, next) => {
    if (!req.session.userId || !req.session.isAdmin) {
        return res.redirect("/admin/login");
    }

    next();
};

const redirectIfAdminLoggedIn = (req, res, next) => {
    if (req.session && req.session.userId && req.session.isAdmin) {
        return res.redirect("/admin/dashboard");
    }
    next();
};

module.exports = {
    adminMiddleware,
    redirectIfAdminLoggedIn
};