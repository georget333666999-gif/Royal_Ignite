/**
 * Shared authentication and session helper utilities
 */

/**
 * Extracts authenticated user ID from session or passport user
 * @param {import("express").Request} req
 * @returns {string|null}
 */
export const getAuthenticatedUserId = (req) => {
    try {
        const session = req.session;
        if (session && session.isUserLoggedIn) {
            return session.userId || null;
        }

        const user = req.user;
        if (user && user._id) {
            return user._id.toString();
        }

        return null;
    } catch (err) {
        console.error("getAuthenticatedUserId error:", err);
        return null;
    }
};

/**
 * Destroys session, clears cookie, and redirects user
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {string} [redirectUrl="/user/login"]
 */
export const handleBlockedUser = (req, res, redirectUrl = "/user/login?error=" + encodeURIComponent("Your account has been blocked.")) => {
    try {
        if (!req.session) {
            return res.redirect(redirectUrl);
        }

        req.session.destroy(() => {
            res.clearCookie("user.sid", { path: "/" });
            res.redirect(redirectUrl);
        });
    } catch (err) {
        console.error("handleBlockedUser error:", err);
        return res.redirect(redirectUrl);
    }
};

export default {
    getAuthenticatedUserId,
    handleBlockedUser
};
