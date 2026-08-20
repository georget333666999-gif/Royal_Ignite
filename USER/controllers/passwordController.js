const userService = require("../services/userService");

// ========================================
// Forgot Password Page
// ========================================

const getForgotPassword = (req, res) => {

    res.render("forgotPassword", {
        error: null,
        success: null
    });

};


// ========================================
// Forgot Password Form
// ========================================

const postForgotPassword = async (req, res) => {

    try {

        const { email } = req.body;

        const result =
            await userService.forgotPassword(email);

        if (!result.success) {

            return res.status(400).render(
                "forgotPassword",
                {
                    error: result.message,
                    success: null
                }
            );

        }


        // Store userId in session for reset
        req.session.resetUserId =
            result.userId.toString();

        res.redirect("/user/reset-password");


    } catch (error) {

        console.error(
            "Forgot password error:",
            error
        );

        res.status(500).render(
            "forgotPassword",
            {
                error:
                    "Something went wrong. Please try again.",
                success: null
            }
        );

    }

};


// ========================================
// Reset Password Page
// ========================================

const getResetPassword = (req, res) => {

    if (!req.session.resetUserId) {

        return res.redirect(
            "/user/forgot-password"
        );

    }

    res.render("resetPassword", {
        error: null
    });

};


// ========================================
// Reset Password Form
// ========================================

const postResetPassword = async (req, res) => {

    try {

        const userId = req.session.resetUserId;

        const {
            otpCode,
            newPassword
        } = req.body;


        if (!userId) {

            return res.redirect(
                "/user/forgot-password"
            );

        }


        const result =
            await userService.resetPassword(
                userId,
                otpCode.trim(),
                newPassword
            );


        if (!result.success) {

            return res.status(400).render(
                "resetPassword",
                {
                    error: result.message
                }
            );

        }


        // Clean up session
        delete req.session.resetUserId;

        res.redirect("/user/login");


    } catch (error) {

        console.error(
            "Reset password error:",
            error
        );

        res.status(500).render(
            "resetPassword",
            {
                error:
                    "Something went wrong. Please try again."
            }
        );

    }

};

module.exports = {
    getForgotPassword,
    postForgotPassword,
    getResetPassword,
    postResetPassword
};
