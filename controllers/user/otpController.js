import userService from "../../services/user/userService.js";
import { HTTP_STATUS, RESPONSE_MESSAGES } from "../../constants/index.js";
import { getOtpExpiryStatus } from "../../utils/otpHelper.js";

const renderOtpPage = async (res, statusCode, userId, { error = null, success = null, overrideExpired = null } = {}) => {
    try {
        const { remainingSeconds, resendCooldownSeconds, isExpired } = await getOtpExpiryStatus(userId, "signup");
        return res.status(statusCode).render("verifyOtp", {
            error,
            success,
            remainingSeconds,
            resendCooldownSeconds,
            isExpired: overrideExpired !== null ? overrideExpired : isExpired
        });
    } catch (err) {
        console.error("renderOtpPage error:", err);
        return res.status(statusCode).render("verifyOtp", {
            error,
            success,
            remainingSeconds: 0,
            resendCooldownSeconds: 0,
            isExpired: true
        });
    }
};

/**
 * Render OTP Verification Page
 */
const getVerifyOTP = async (req, res) => {
    try {
        const userId = req.session?.otpUserId;
        if (!userId) {
            return res.redirect("/user/signup");
        }

        const { remainingSeconds, resendCooldownSeconds, isExpired } = await getOtpExpiryStatus(userId, "signup");
        const success = req.session.otpSuccessMessage || null;
        delete req.session.otpSuccessMessage;

        const error = isExpired && !success ? RESPONSE_MESSAGES.OTP.EXPIRED_GET_FRESH : null;
        return res.status(HTTP_STATUS.OK).render("verifyOtp", {
            error,
            success,
            remainingSeconds,
            resendCooldownSeconds,
            isExpired
        });
    } catch (err) {
        console.error("getVerifyOTP error:", err);
        return res.redirect("/user/signup");
    }
};

/**
 * Handle OTP Verification Submission
 */
const postVerifyOTP = async (req, res) => {
    const isAjax = Boolean(req.xhr || req.headers?.accept?.includes("application/json") || req.is?.("json"));
    try {
        const userId = req.session?.otpUserId;
        const otpCode = req.body.otpCode ? req.body.otpCode.trim() : "";

        if (!userId) {
            if (isAjax) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    redirectUrl: "/user/signup",
                    message: RESPONSE_MESSAGES.OTP.SIGNUP_SESSION_EXPIRED
                });
            }
            return res.redirect("/user/signup");
        }

        if (!otpCode) {
            if (isAjax) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    message: RESPONSE_MESSAGES.OTP.ENTER_CODE
                });
            }
            return await renderOtpPage(res, HTTP_STATUS.BAD_REQUEST, userId, {
                error: RESPONSE_MESSAGES.OTP.ENTER_CODE
            });
        }

        const result = await userService.verifyOTP(userId, otpCode);

        if (!result.success) {
            if (isAjax) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    message: result.message,
                    isExpired: result.isExpired || false
                });
            }
            return await renderOtpPage(res, HTTP_STATUS.BAD_REQUEST, userId, {
                error: result.message,
                overrideExpired: result.isExpired !== undefined ? result.isExpired : null
            });
        }

        // OTP verified successfully
        delete req.session.otpUserId;
        req.session.save((saveErr) => {
            if (saveErr) {
                console.error("Session save error after OTP verify:", saveErr);
            }
            if (isAjax) {
                return res.status(HTTP_STATUS.OK).json({
                    success: true,
                    redirectUrl: "/user/login?verified=true",
                    message: RESPONSE_MESSAGES.AUTH.VERIFIED_SUCCESS
                });
            }
            res.redirect("/user/login?verified=true");
        });
    } catch (error) {
        console.error("OTP verification error:", error);
        if (isAjax) {
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: RESPONSE_MESSAGES.COMMON.SOMETHING_WENT_WRONG
            });
        }
        await renderOtpPage(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, req.session?.otpUserId, {
            error: RESPONSE_MESSAGES.COMMON.SOMETHING_WENT_WRONG
        });
    }
};

/**
 * Resend OTP Code
 */
const resendOTP = async (req, res) => {
    const isAjax = Boolean(req.xhr || req.headers?.accept?.includes("application/json") || req.is?.("json"));
    try {
        const userId = req.session?.otpUserId;

        if (!userId) {
            if (isAjax) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    redirectUrl: "/user/signup",
                    message: RESPONSE_MESSAGES.OTP.SIGNUP_SESSION_EXPIRED
                });
            }
            return res.status(HTTP_STATUS.BAD_REQUEST).render("verifyOtp", {
                error: RESPONSE_MESSAGES.OTP.SIGNUP_SESSION_EXPIRED,
                success: null,
                remainingSeconds: 0,
                resendCooldownSeconds: 0,
                isExpired: true
            });
        }

        const result = await userService.resendOTP(userId);

        if (!result.success) {
            if (isAjax) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    message: result.message
                });
            }
            return await renderOtpPage(res, HTTP_STATUS.BAD_REQUEST, userId, {
                error: result.message
            });
        }

        const successMessage = RESPONSE_MESSAGES.OTP.RESEND_SUCCESS;

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
            if (saveErr) {
                console.error("Session save error after OTP resend:", saveErr);
            }
            res.redirect("/user/verify-otp");
        });
    } catch (error) {
        console.error("Resend OTP error:", error);
        if (isAjax) {
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: "Unable to resend OTP. Please try again."
            });
        }
        await renderOtpPage(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, req.session?.otpUserId, {
            error: "Unable to resend OTP. Please try again."
        });
    }
};

export {
    getVerifyOTP,
    postVerifyOTP,
    resendOTP
};

export default {
    getVerifyOTP,
    postVerifyOTP,
    resendOTP
};
