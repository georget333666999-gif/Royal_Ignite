const userMiddleware = (req, res, next) => {

    if (
        !req.session.userId ||
        !req.session.isUserLoggedIn
    ) {

        return res.redirect("/user/login");

    }

    next();
};

module.exports = userMiddleware;