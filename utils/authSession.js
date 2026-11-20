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
        if (session && (session.isUserLoggedIn || session.userId)) {
            return session.userId || null;
        }

        if (typeof req.isAuthenticated === "function" && req.isAuthenticated() && req.user?._id) {
            return req.user._id.toString();
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

/**
 * Reuses req.user if already loaded on this request (e.g. by Passport or middleware),
 * otherwise fetches a lightweight lean user document once and caches it on req.user.
 */
export const resolveRequestUser = async (req, UserModel) => {
    const userId = getAuthenticatedUserId(req);
    if (!userId) return null;

    if (req.user && req.user._id && req.user._id.toString() === userId.toString()) {
        return req.user;
    }

    const user = await UserModel.findById(userId)
        .select("_id name email phone isBlocked isAdmin isVerified imgUrl googleId")
        .lean();

    if (user) {
        req.user = user;
    }
    return user;
};

export default {
    getAuthenticatedUserId,
    resolveRequestUser,
    handleBlockedUser
};
