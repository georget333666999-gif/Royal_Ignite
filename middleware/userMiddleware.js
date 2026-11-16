import User from "../models/userModel.js";
import { getAuthenticatedUserId, handleBlockedUser } from "../utils/authSession.js";

export const userMiddleware = async (req, res, next) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
            return res.redirect("/user/login");
        }

        const user = await User.findById(userId);
        if (!user || user.isBlocked) {
            return handleBlockedUser(req, res);
        }

        req.user = user;
        next();
    } catch (error) {
        console.error("userMiddleware error:", error);
        return res.redirect("/user/login");
    }
};

export const redirectIfUserLoggedIn = (req, res, next) => {
    try {
        if (getAuthenticatedUserId(req)) {
            res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
            res.set("Pragma", "no-cache");
            res.set("Expires", "0");
            return res.redirect("/");
        }
        next();
    } catch (err) {
        console.error("redirectIfUserLoggedIn error:", err);
        next();
    }
};

export default {
    userMiddleware,
    redirectIfUserLoggedIn
};