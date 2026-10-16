import OTP from "../models/otpModel.js";

/**
 * Compute remaining seconds and expiration status for an active OTP
 * @param {string} userId
 * @param {string} [purpose="signup"]
 * @returns {Promise<{ remainingSeconds: number, resendCooldownSeconds: number, isExpired: boolean }>}
 */
export const getOtpExpiryStatus = async (userId, purpose = "signup") => {
    try {
        if (!userId) {
            return { remainingSeconds: 0, resendCooldownSeconds: 0, isExpired: true };
        }

        const otpDoc = await OTP.findOne({ userId, ...(purpose ? { purpose } : {}) }).sort({ createdAt: -1 });
        if (!otpDoc) {
            return { remainingSeconds: 0, resendCooldownSeconds: 0, isExpired: true };
        }

        const diffMs = new Date(otpDoc.expiredAt).getTime() - Date.now();
        if (diffMs <= 0) {
            return { remainingSeconds: 0, resendCooldownSeconds: 0, isExpired: true };
        }

        const remainingSeconds = Math.ceil(diffMs / 1000);
        return {
            remainingSeconds,
            resendCooldownSeconds: remainingSeconds,
            isExpired: false
        };
    } catch (err) {
        console.error("getOtpExpiryStatus error:", err);
        return { remainingSeconds: 0, resendCooldownSeconds: 0, isExpired: true };
    }
};

export default {
    getOtpExpiryStatus
};
