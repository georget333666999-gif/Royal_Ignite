import addressService from "../../services/user/addressService.js";
import userService from "../../services/user/userService.js";
import User from "../../models/userModel.js";
import { getOtpExpiryStatus } from "../../utils/otpHelper.js";
import { HTTP_STATUS, RESPONSE_MESSAGES } from "../../constants/index.js";

const isGoogleUser = async (userId) => {
    try {
        if (!userId) return false;
        const user = await User.findById(userId).select("googleId");
        return Boolean(user && user.googleId);
    } catch (err) {
        console.error("isGoogleUser error:", err);
        return false;
    }
};

const renderVerifyOtpPage = (res, statusCode, { pendingEmail, error = null, success = null, remainingSeconds = 0, resendCooldownSeconds = 0, isExpired = true }) => {
    return res.status(statusCode).render("verifyEmailOtp", {
        pendingEmail,
        error,
        success,
        remainingSeconds,
        resendCooldownSeconds,
        isExpired
    });
};

// ========================================
// User Profile
// ========================================
const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.session.userId).select("-password");

        if (!user) {
            req.session.destroy(() => res.redirect("/user/login"));
            return;
        }

        const addresses = await addressService.getUserAddresses(req.session.userId);
        const success = req.session.successMessage || null;
        const error = req.session.errorMessage || null;
        delete req.session.successMessage;
        delete req.session.errorMessage;

        res.status(HTTP_STATUS.OK).render("profile", { user, addresses, success, error });
    } catch (error) {
        console.error("Profile error:", error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(RESPONSE_MESSAGES.COMMON.SOMETHING_WENT_WRONG);
    }
};

// ========================================
// Edit Profile Page
// ========================================
const getEditProfile = async (req, res) => {
    try {
        const user = await User.findById(req.session.userId).select("-password");

        if (!user) {
            req.session.destroy(() => res.redirect("/user/login"));
            return;
        }

        res.status(HTTP_STATUS.OK).render("editProfile", { user, error: null, success: null });
    } catch (error) {
        console.error("Get edit profile error:", error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(RESPONSE_MESSAGES.COMMON.SOMETHING_WENT_WRONG);
    }
};

// ========================================
// Update Profile
// ========================================
const postEditProfile = async (req, res) => {
    try {
        const { name, phone } = req.body;

        if (!name || !phone) {
            const user = await User.findById(req.session.userId).select("-password");
            return res.status(HTTP_STATUS.BAD_REQUEST).render("editProfile", {
                user,
                error: "Please provide both your name and phone number.",
                success: null
            });
        }

        if (name.trim().length < 2) {
            const user = await User.findById(req.session.userId).select("-password");
            return res.status(HTTP_STATUS.BAD_REQUEST).render("editProfile", {
                user,
                error: "Name must contain at least 2 characters.",
                success: null
            });
        }

        const phoneRegex = /^[0-9]{10}$/;
        if (!phoneRegex.test(phone.trim())) {
            const user = await User.findById(req.session.userId).select("-password");
            return res.status(HTTP_STATUS.BAD_REQUEST).render("editProfile", {
                user,
                error: "Please enter a valid 10-digit mobile number.",
                success: null
            });
        }

        const updateData = {
            name: name.trim(),
            phone: phone.trim()
        };

        if (req.file) {
            updateData.imgUrl = `/uploads/profile/${req.file.filename}`;
        }

        await User.findByIdAndUpdate(
            req.session.userId,
            { $set: updateData },
            { new: true, runValidators: true }
        ).select("-password");

        res.redirect("/user/profile");
    } catch (error) {
        console.error("Update profile error:", error);
        const user = await User.findById(req.session.userId).select("-password");
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render("editProfile", {
            user,
            error: RESPONSE_MESSAGES.COMMON.SOMETHING_WENT_WRONG,
            success: null
        });
    }
};

// ========================================
// Change Password Page & Form
// ========================================
const getChangePassword = async (req, res) => {
    try {
        const user = await User.findById(req.session.userId).select("googleId name email");
        if (!user) {
            return res.redirect("/user/login");
        }
        res.render("changePassword", { user, error: null, success: null });
    } catch (error) {
        console.error("Get change password error:", error);
        res.redirect("/user/profile");
    }
};

const postChangePassword = async (req, res) => {
    try {
        const user = await User.findById(req.session.userId).select("googleId name email");
        if (!user) {
            return res.redirect("/user/login");
        }

        if (user.googleId) {
            return res.status(HTTP_STATUS.FORBIDDEN).render("changePassword", {
                user,
                error: "Password change is disabled for accounts registered with Google Sign-In.",
                success: null
            });
        }

        const { currentPassword, newPassword } = req.body;
        const result = await userService.changePassword(
            req.session.userId,
            currentPassword,
            newPassword
        );

        if (!result.success) {
            return res.status(HTTP_STATUS.BAD_REQUEST).render("changePassword", {
                user,
                error: result.message,
                success: null
            });
        }

        req.session.successMessage = RESPONSE_MESSAGES.AUTH.PASSWORD_CHANGED_SUCCESS;
        res.redirect("/user/profile");
    } catch (error) {
        console.error("Change password error:", error);
        const user = await User.findById(req.session.userId).select("googleId name email");
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render("changePassword", {
            user,
            error: RESPONSE_MESSAGES.COMMON.SOMETHING_WENT_WRONG,
            success: null
        });
    }
};

// ========================================
// Change Email Page & Form
// ========================================
const getChangeEmail = async (req, res) => {
    try {
        const user = await User.findById(req.session.userId).select("email googleId");
        if (!user) {
            return res.redirect("/user/login");
        }

        if (user.googleId) {
            req.session.errorMessage = "Email change is disabled for accounts signed in with Google.";
            return res.redirect("/user/profile");
        }

        res.status(HTTP_STATUS.OK).render("changeEmail", {
            error: null,
            currentEmail: user.email,
            newEmail: req.session.pendingNewEmail || ""
        });
    } catch (_err) {
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render("changeEmail", { error: null, currentEmail: "", newEmail: "" });
    }
};

const postChangeEmail = async (req, res) => {
    try {
        const user = await User.findById(req.session.userId).select("email googleId");
        if (!user) {
            return res.redirect("/user/login");
        }

        if (user.googleId) {
            req.session.errorMessage = "Email change is disabled for accounts signed in with Google.";
            return res.redirect("/user/profile");
        }

        const { newEmail } = req.body;
        const result = await userService.requestEmailChange(
            req.session.userId,
            newEmail
        );

        if (!result.success) {
            return res.status(HTTP_STATUS.BAD_REQUEST).render("changeEmail", {
                error: result.message,
                currentEmail: user.email,
                newEmail: newEmail || ""
            });
        }

        req.session.pendingNewEmail = result.pendingNewEmail;
        req.session.save((saveErr) => {
            if (saveErr) {
                console.error("Session save error during request email change:", saveErr);
            }
            res.redirect("/user/profile/verify-email-otp");
        });
    } catch (error) {
        console.error("Request change email error:", error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render("changeEmail", {
            error: RESPONSE_MESSAGES.COMMON.SOMETHING_WENT_WRONG,
            currentEmail: "",
            newEmail: ""
        });
    }
};

// ========================================
// Verify Email OTP Page & Form
// ========================================
const getVerifyEmailOTP = async (req, res) => {
    try {
        if (await isGoogleUser(req.session.userId)) {
            req.session.errorMessage = "Email change is disabled for accounts signed in with Google.";
            return res.redirect("/user/profile");
        }

        const pendingEmail = req.session.pendingNewEmail;
        if (!pendingEmail) {
            return res.redirect("/user/profile/change-email");
        }

        const { remainingSeconds, resendCooldownSeconds, isExpired } = await getOtpExpiryStatus(req.session.userId, "email-change");
        const success = req.session.emailOtpSuccess || null;
        delete req.session.emailOtpSuccess;

        const error = isExpired ? "OTP has expired. Please click 'Resend Code' below or re-enter your email." : null;
        return renderVerifyOtpPage(res, HTTP_STATUS.OK, { pendingEmail, error, success, remainingSeconds, resendCooldownSeconds, isExpired });
    } catch (err) {
        console.error("getVerifyEmailOTP error:", err);
        return res.redirect("/user/profile/change-email");
    }
};

const postVerifyEmailOTP = async (req, res) => {
    try {
        if (await isGoogleUser(req.session.userId)) {
            req.session.errorMessage = "Email change is disabled for accounts signed in with Google.";
            return res.redirect("/user/profile");
        }

        const pendingNewEmail = req.session.pendingNewEmail;
        if (!pendingNewEmail) {
            return res.redirect("/user/profile/change-email");
        }

        const { otpCode = "" } = req.body;
        const result = await userService.verifyEmailChange(
            req.session.userId,
            pendingNewEmail,
            otpCode.trim()
        );

        if (!result.success) {
            const { remainingSeconds, resendCooldownSeconds, isExpired } = await getOtpExpiryStatus(req.session.userId, "email-change");
            return renderVerifyOtpPage(res, HTTP_STATUS.BAD_REQUEST, {
                pendingEmail: pendingNewEmail,
                error: result.message,
                remainingSeconds,
                resendCooldownSeconds,
                isExpired
            });
        }

        delete req.session.pendingNewEmail;
        req.session.successMessage = RESPONSE_MESSAGES.OTP.EMAIL_CHANGE_VERIFIED;
        req.session.save((saveErr) => {
            if (saveErr) {
                console.error("Session save error after verify email OTP:", saveErr);
            }
            res.redirect("/user/profile");
        });
    } catch (error) {
        console.error("Verify email OTP error:", error);
        return renderVerifyOtpPage(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, {
            pendingEmail: req.session.pendingNewEmail || "",
            error: RESPONSE_MESSAGES.COMMON.SOMETHING_WENT_WRONG
        });
    }
};

const resendEmailChangeOTP = async (req, res) => {
    try {
        const { userId, pendingNewEmail } = req.session;

        if (await isGoogleUser(userId)) {
            req.session.errorMessage = "Email change is disabled for accounts signed in with Google.";
            return res.redirect("/user/profile");
        }

        if (!userId || !pendingNewEmail) {
            return res.redirect("/user/profile/change-email");
        }

        const result = await userService.resendEmailChangeOTP(userId, pendingNewEmail);
        if (!result.success) {
            const { remainingSeconds, resendCooldownSeconds, isExpired } = await getOtpExpiryStatus(userId, "email-change");
            return renderVerifyOtpPage(res, HTTP_STATUS.BAD_REQUEST, {
                pendingEmail: pendingNewEmail,
                error: result.message,
                remainingSeconds,
                resendCooldownSeconds,
                isExpired
            });
        }

        req.session.emailOtpSuccess = RESPONSE_MESSAGES.OTP.RESEND_SUCCESS;
        req.session.save((saveErr) => {
            if (saveErr) {
                console.error("Session save error after resend email OTP:", saveErr);
            }
            res.redirect("/user/profile/verify-email-otp");
        });
    } catch (error) {
        console.error("Resend email change OTP error:", error);
        return renderVerifyOtpPage(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, {
            pendingEmail: req.session.pendingNewEmail || "",
            error: "Unable to resend OTP. Please try again."
        });
    }
};

export {
    getProfile,
    getEditProfile,
    postEditProfile,
    getChangePassword,
    postChangePassword,
    getChangeEmail,
    postChangeEmail,
    getVerifyEmailOTP,
    postVerifyEmailOTP,
    resendEmailChangeOTP
};

export default {
    getProfile,
    getEditProfile,
    postEditProfile,
    getChangePassword,
    postChangePassword,
    getChangeEmail,
    postChangeEmail,
    getVerifyEmailOTP,
    postVerifyEmailOTP,
    resendEmailChangeOTP
};