const adminMiddleware = (req, res, next) => {
    if (!req.session.userId || !req.session.isAdmin) {
        return res.redirect("/admin/login");
    }

    next();
};

module.exports = adminMiddleware;