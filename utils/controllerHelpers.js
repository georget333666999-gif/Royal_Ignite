import User from "../models/userModel.js";
import { HTTP_STATUS } from "../constants/index.js";
import { getAuthenticatedUserId, resolveRequestUser, handleBlockedUser } from "./authSession.js";

/**
 * Apply aggressive no-cache headers to sensitive dynamic views and endpoints.
 * @param {import("express").Response} res
 */
export const setNoCacheHeaders = (res) => {
    res.set({
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "Surrogate-Control": "no-store"
    });
};

/**
 * Determine if an incoming request expects a JSON / AJAX response.
 * @param {import("express").Request} req
 * @returns {boolean}
 */
export const isAjaxRequest = (req) => Boolean(
    req.xhr ||
    req.headers.accept?.includes("application/json") ||
    req.query?.format === "json" ||
    req.body?.format === "json" ||
    req.headers["content-type"]?.includes("application/json")
);

/**
 * Ensures user is authenticated and not blocked, applying no-cache headers.
 * Returns { userId, user, isAjax } if valid, or null after handling redirect/JSON response.
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {Object} [options]
 * @param {string} [options.redirectUrl="/login"]
 * @param {string} [options.authMessage="Authentication required."]
 * @param {boolean} [options.noCache=true]
 * @returns {Promise<{ userId: string, user: Object, isAjax: boolean }|null>}
 */
export const requireActiveUser = async (req, res, options = {}) => {
    if (options.noCache !== false) {
        setNoCacheHeaders(res);
    }
    const isAjax = isAjaxRequest(req);
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
        const redirectUrl = options.redirectUrl || "/login";
        if (isAjax) {
            res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                message: options.authMessage || "Authentication required.",
                redirect: redirectUrl
            });
            return null;
        }
        res.redirect(redirectUrl);
        return null;
    }

    const user = await resolveRequestUser(req, User);
    if (!user || user.isBlocked) {
        handleBlockedUser(req, res);
        return null;
    }

    return { userId, user, isAjax };
};

export default {
    setNoCacheHeaders,
    isAjaxRequest,
    requireActiveUser
};
