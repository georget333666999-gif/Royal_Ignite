const userService = require("../services/userService");
const OTP = require("../../models/otpModel");

// Helper to compute remaining seconds for active OTP
const getOtpExpiryStatus = async (userId, purpose = "signup") => {
    const otpDoc = await OTP.findOne({ userId, purpose });
    if (!otpDoc) {
        return { remainingSeconds: 0, isExpired: true };
    }

    const diffMs = new Date(otpDoc.expiredAt).getTime() - Date.now();
    if (diffMs <= 0) {
        return { remainingSeconds: 0, isExpired: true };
    }

    return {
        remainingSeconds: Math.ceil(diffMs / 1000),
        isExpired: false
    };
};

// ========================================
// OTP Verification Page
// ========================================
const getVerifyOTP = async (req, res) => {
    if (!req.session.otpUserId) {
        return res.redirect("/user/signup");
    }

    const { remainingSeconds, isExpired } = await getOtpExpiryStatus(req.session.otpUserId, "signup");
    const success = req.session.otpSuccessMessage || null;
    delete req.session.otpSuccessMessage;

    res.render("verifyOtp", {
        error: isExpired && !success ? "Your OTP has expired. Please click 'Resend Code' to get a fresh code." : null,
        success,
        remainingSeconds,
        isExpired
    });
};

// ========================================
// Verify OTP
// ========================================
const postVerifyOTP = async (req, res) => {
    try {
        const userId = req.session.otpUserId;
        const { otpCode } = req.body;

        if (!userId) {
            return res.redirect("/user/signup");
        }

        if (!otpCode || !otpCode.trim()) {
            const { remainingSeconds, isExpired } = await getOtpExpiryStatus(userId, "signup");
            return res.status(400).render("verifyOtp", {
                error: "Please enter the 6-digit OTP code.",
                success: null,
                remainingSeconds,
                isExpired
            });
        }

        const result = await userService.verifyOTP(
            userId,
            otpCode.trim()
        );

        if (!result.success) {
            const { remainingSeconds, isExpired } = await getOtpExpiryStatus(userId, "signup");
            return res.status(400).render("verifyOtp", {
                error: result.message,
                success: null,
                remainingSeconds,
                isExpired: result.isExpired !== undefined ? result.isExpired : isExpired
            });
        }

        // OTP verified successfully
        delete req.session.otpUserId;
        res.redirect("/user/login?verified=true");

    } catch (error) {
        console.error("OTP verification error:", error);
        const { remainingSeconds, isExpired } = await getOtpExpiryStatus(req.session.otpUserId, "signup");
        res.status(500).render("verifyOtp", {
            error: "Something went wrong. Please try again.",
            success: null,
            remainingSeconds,
            isExpired
        });
    }
};

// ========================================
// Resend OTP
// ========================================
const resendOTP = async (req, res) => {
    try {
        const userId = req.session.otpUserId;

        if (!userId) {
            return res.status(400).render("verifyOtp", {
                error: "Signup session expired. Please sign up again.",
                success: null,
                remainingSeconds: 0,
                isExpired: true
            });
        }

        const result = await userService.resendOTP(userId);

        if (!result.success) {
            const { remainingSeconds, isExpired } = await getOtpExpiryStatus(userId, "signup");
            return res.status(400).render("verifyOtp", {
                error: result.message,
                success: null,
                remainingSeconds,
                isExpired
            });
        }

        req.session.otpSuccessMessage = "A fresh 6-digit verification code has been generated and sent.";
        res.redirect("/user/verify-otp");

    } catch (error) {
        console.error("Resend OTP error:", error);
        const { remainingSeconds, isExpired } = await getOtpExpiryStatus(req.session.otpUserId, "signup");
        res.status(500).render("verifyOtp", {
            error: "Unable to resend OTP. Please try again.",
            success: null,
            remainingSeconds,
            isExpired
        });
    }
};

module.exports = {
    getVerifyOTP,
    postVerifyOTP,
    resendOTP
};
