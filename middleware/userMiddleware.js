const User = require("../models/userModel");

const userMiddleware = async (req, res, next) => {
    try {
        if (
            !req.session.userId ||
            !req.session.isUserLoggedIn
        ) {
            return res.redirect("/user/login");
        }

        const user = await User.findById(req.session.userId);

        if (!user || user.isBlocked) {
            req.session.destroy(() => {
                res.clearCookie("user.sid");
                return res.redirect("/user/login?error=" + encodeURIComponent("Your account has been blocked."));
            });
            return;
        }

        next();
    } catch (error) {
        console.error("userMiddleware error:", error);
        return res.redirect("/user/login");
    }
};

const redirectIfUserLoggedIn = (req, res, next) => {
    if (req.session && req.session.userId && req.session.isUserLoggedIn) {
        return res.redirect("/");
    }
    next();
};

module.exports = {
    userMiddleware,
    redirectIfUserLoggedIn
};