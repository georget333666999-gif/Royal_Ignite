const User = require("../models/userModel");

const userMiddleware = async (req, res, next) => {
    try {
        const userId = req.session?.userId || (req.user ? req.user._id.toString() : null);
        const isUserLoggedIn = Boolean((req.session?.isUserLoggedIn || (typeof req.isAuthenticated === "function" && req.isAuthenticated())) && userId);

        if (!userId || !isUserLoggedIn) {
            return res.redirect("/user/login");
        }

        const user = await User.findById(userId);

        if (!user || user.isBlocked) {
            req.session.destroy(() => {
                res.clearCookie("user.sid", { path: "/" });
                return res.redirect("/user/login?error=" + encodeURIComponent("Your account has been blocked."));
            });
            return;
        }

        req.user = user;
        next();
    } catch (error) {
        console.error("userMiddleware error:", error);
        return res.redirect("/user/login");
    }
};

const redirectIfUserLoggedIn = (req, res, next) => {
    const userId = req.session?.userId || (req.user ? req.user._id.toString() : null);
    const isUserLoggedIn = Boolean((req.session?.isUserLoggedIn || (typeof req.isAuthenticated === "function" && req.isAuthenticated())) && userId);

    if (isUserLoggedIn) {
        return res.redirect("/");
    }
    next();
};

module.exports = {
    userMiddleware,
    redirectIfUserLoggedIn
};