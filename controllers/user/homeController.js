import User from "../../models/userModel.js";
import { HTTP_STATUS } from "../../constants/index.js";
import { getAuthenticatedUserId, handleBlockedUser } from "../../utils/authSession.js";

/**
 * Render home / landing page
 */
export const getHomePage = async (req, res, next) => {
    try {
        const userId = getAuthenticatedUserId(req);
        const isUserLoggedIn = Boolean(userId);

        if (isUserLoggedIn) {
            const user = await User.findById(userId);
            if (!user || user.isBlocked) {
                return handleBlockedUser(req, res);
            }
        }

        return res.status(HTTP_STATUS.OK).render("index", {
            isUserLoggedIn,
            userId
        });
    } catch (err) {
        console.error("Home route error:", err);
        return next(err);
    }
};

export default {
    getHomePage
};
