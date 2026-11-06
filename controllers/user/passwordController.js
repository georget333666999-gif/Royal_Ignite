import userService from "../../services/user/userService.js";
import OTP from "../../models/otpModel.js";
import { HTTP_STATUS, RESPONSE_MESSAGES } from "../../constants/index.js";

// Render Forgot Password Page
const getForgotPassword = (req, res) => {
    try {
        return res.status(HTTP_STATUS.OK).render("forgotPassword", {
            error: null,
            success: null
        });
    } catch (err) {
        console.error("getForgotPassword error:", err);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send("Error rendering forgot password page.");
    }
};

// Handle Forgot Password Form Submission
const postForgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const result = await userService.forgotPassword(email);

        if (!result.success) {
            return res.status(HTTP_STATUS.BAD_REQUEST).render("forgotPassword", {
                error: result.message,
                success: null
            });
        }

        req.session.resetUserId = result.userId.toString();
        req.session.save((saveErr) => {
            if (saveErr) {
                console.error("Session save error during forgot password:", saveErr);
            }
            res.redirect("/user/reset-password");
        });
    } catch (error) {
        console.error("Forgot password error:", error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render("forgotPassword", {
            error: RESPONSE_MESSAGES.COMMON.SOMETHING_WENT_WRONG,
            success: null
        });
    }
};

// Render Reset Password Page
 
const getResetPassword = async (req, res) => {
    try {
        if (!req.session.resetUserId) {
            return res.redirect("/user/forgot-password");
        }

        const otpDoc = await OTP.findOne({ userId: req.session.resetUserId, purpose: "reset-password" });
        let remainingSeconds = 60;
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

        const success = req.session.otpSuccessMessage || null;
        delete req.session.otpSuccessMessage;

        return res.status(HTTP_STATUS.OK).render("resetPassword", {
            error: isExpired && !success ? "Your password reset OTP has expired. Please click Resend Code to request a new code." : null,
            success,
            remainingSeconds,
            isExpired
        });
    } catch (err) {
        console.error("getResetPassword error:", err);
        return res.redirect("/user/forgot-password");
    }
};

// Handle Reset Password Form Submission

const postResetPassword = async (req, res) => {
    try {
        const userId = req.session.resetUserId;
        const { otpCode, newPassword } = req.body;

        if (!userId) {
            return res.redirect("/user/forgot-password");
        }

        const result = await userService.resetPassword(userId, otpCode.trim(), newPassword);

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

            return res.status(HTTP_STATUS.BAD_REQUEST).render("resetPassword", {
                error: result.message,
                remainingSeconds,
                isExpired
            });
        }

        // Clean up session and redirect to login
        delete req.session.resetUserId;
        res.redirect("/user/login?reset=true");
    } catch (error) {
        console.error("Reset password error:", error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render("resetPassword", {
            error: RESPONSE_MESSAGES.COMMON.SOMETHING_WENT_WRONG
        });
    }
};

// Handle Resend Reset OTP Submission
const resendResetOTP = async (req, res) => {
    const isAjax = Boolean(req.xhr || req.headers?.accept?.includes("application/json") || req.is?.("json"));
    try {
        const userId = req.session?.resetUserId;
        if (!userId) {
            if (isAjax) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    redirectUrl: "/user/forgot-password",
                    message: "Reset session expired. Please start over."
                });
            }
            return res.redirect("/user/forgot-password");
        }

        const result = await userService.resendResetOTP(userId);
        if (!result.success) {
            if (isAjax) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    message: result.message
                });
            }
            return res.status(HTTP_STATUS.BAD_REQUEST).render("resetPassword", {
                error: result.message,
                remainingSeconds: 0,
                isExpired: true,
                success: null
            });
        }

        const successMessage = "A fresh password reset code has been sent to your email.";
        if (isAjax) {
            return res.status(HTTP_STATUS.OK).json({
                success: true,
                message: successMessage,
                remainingSeconds: 60,
                resendCooldownSeconds: 60
            });
        }

        req.session.otpSuccessMessage = successMessage;
        req.session.save((saveErr) => {
            if (saveErr) console.error("Session save error:", saveErr);
            res.redirect("/user/reset-password");
        });
    } catch (error) {
        console.error("resendResetOTP error:", error);
        if (isAjax) {
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: "Unable to resend OTP. Please try again."
            });
        }
        return res.redirect("/user/forgot-password");
    }
};

export {
    getForgotPassword,
    postForgotPassword,
    getResetPassword,
    postResetPassword,
    resendResetOTP
};

export default {
    getForgotPassword,
    postForgotPassword,
    getResetPassword,
    postResetPassword,
    resendResetOTP
};
