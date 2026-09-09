const userService = require("../services/userService");
const OTP = require("../../models/otpModel");

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

const getResetPassword = async (req, res) => {

    if (!req.session.resetUserId) {

        return res.redirect(
            "/user/forgot-password"
        );

    }

    const otpDoc = await OTP.findOne({ userId: req.session.resetUserId, purpose: "reset-password" });
    let remainingSeconds = 300;
    let isExpired = false;

    if (otpDoc) {
        const diffMs = new Date(otpDoc.expiredAt).getTime() - Date.now();
        if (diffMs > 0) {
            remainingSeconds = Math.ceil(diffMs / 1000);
        } else {
            isExpired = true;
            remainingSeconds = 0;
        }
    } else {
        isExpired = true;
        remainingSeconds = 0;
    }

    res.render("resetPassword", {
        error: isExpired ? "Your password reset OTP has expired. Please request a new code." : null,
        remainingSeconds,
        isExpired
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

            const otpDoc = await OTP.findOne({ userId, purpose: "reset-password" });
            let remainingSeconds = 0;
            let isExpired = true;
            if (otpDoc) {
                const diffMs = new Date(otpDoc.expiredAt).getTime() - Date.now();
                if (diffMs > 0) {
                    remainingSeconds = Math.ceil(diffMs / 1000);
                    isExpired = false;
                }
            }

            return res.status(400).render(
                "resetPassword",
                {
                    error: result.message,
                    remainingSeconds,
                    isExpired
                }
            );

        }


        // Clean up session
        delete req.session.resetUserId;

        res.redirect("/user/login?reset=true");


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
