const addressService = require("../services/addressService");
const userService = require("../services/userService");
const User = require("../../models/userModel");
const OTP = require("../../models/otpModel");

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

        res.render("profile", { user, addresses, success, error });
    } catch (error) {
        console.error("Profile error:", error);
        res.status(500).send("Something went wrong.");
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

        res.render("editProfile", { user, error: null, success: null });
    } catch (error) {
        console.error("Get edit profile error:", error);
        res.status(500).send("Something went wrong.");
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
            return res.status(400).render("editProfile", {
                user,
                error: "Name and phone are required.",
                success: null
            });
        }

        if (name.trim().length < 2) {
            const user = await User.findById(req.session.userId).select("-password");
            return res.status(400).render("editProfile", {
                user,
                error: "Name must contain at least 2 characters.",
                success: null
            });
        }

        const phoneRegex = /^[0-9]{10}$/;
        if (!phoneRegex.test(phone.trim())) {
            const user = await User.findById(req.session.userId).select("-password");
            return res.status(400).render("editProfile", {
                user,
                error: "Please enter a valid 10-digit phone number.",
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
        res.status(500).render("editProfile", {
            user,
            error: "Something went wrong. Please try again.",
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

        // Prevent Google OAuth users from setting or altering passwords
        if (user.googleId) {
            return res.status(403).render("changePassword", {
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
            return res.status(400).render("changePassword", {
                user,
                error: result.message,
                success: null
            });
        }

        req.session.successMessage = "Password changed successfully!";
        res.redirect("/user/profile");
    } catch (error) {
        console.error("Change password error:", error);
        const user = await User.findById(req.session.userId).select("googleId name email");
        res.status(500).render("changePassword", {
            user,
            error: "Something went wrong. Please try again.",
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

        res.render("changeEmail", {
            error: null,
            currentEmail: user.email,
            newEmail: req.session.pendingNewEmail || ""
        });
    } catch (e) {
        res.render("changeEmail", { error: null, currentEmail: "", newEmail: "" });
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
            return res.status(400).render("changeEmail", {
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
        res.status(500).render("changeEmail", {
            error: "Something went wrong. Please try again.",
            currentEmail: "",
            newEmail: ""
        });
    }
};

// ========================================
// Verify Email OTP Page & Form
// ========================================
const getVerifyEmailOTP = async (req, res) => {
    const user = await User.findById(req.session.userId).select("googleId");
    if (user && user.googleId) {
        req.session.errorMessage = "Email change is disabled for accounts signed in with Google.";
        return res.redirect("/user/profile");
    }

    if (!req.session.pendingNewEmail) {
        return res.redirect("/user/profile/change-email");
    }

    const otpDoc = await OTP.findOne({ userId: req.session.userId, purpose: "email-change" });
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

    const success = req.session.emailOtpSuccess || null;
    delete req.session.emailOtpSuccess;

    res.render("verifyEmailOtp", {
        pendingEmail: req.session.pendingNewEmail,
        error: isExpired ? "OTP has expired. Please click 'Resend Code' below or re-enter your email." : null,
        success,
        remainingSeconds,
        isExpired
    });
};

const postVerifyEmailOTP = async (req, res) => {
    try {
        const user = await User.findById(req.session.userId).select("googleId");
        if (user && user.googleId) {
            req.session.errorMessage = "Email change is disabled for accounts signed in with Google.";
            return res.redirect("/user/profile");
        }

        const { otpCode } = req.body;
        const pendingNewEmail = req.session.pendingNewEmail;

        if (!pendingNewEmail) {
            return res.redirect("/user/profile/change-email");
        }

        const result = await userService.verifyEmailChange(
            req.session.userId,
            pendingNewEmail,
            otpCode.trim()
        );

        if (!result.success) {
            const otpDoc = await OTP.findOne({ userId: req.session.userId, purpose: "email-change" });
            let remainingSeconds = 0;
            let isExpired = true;
            if (otpDoc) {
                const diffMs = new Date(otpDoc.expiredAt).getTime() - Date.now();
                if (diffMs > 0) {
                    remainingSeconds = Math.ceil(diffMs / 1000);
                    isExpired = false;
                }
            }

            return res.status(400).render("verifyEmailOtp", {
                pendingEmail: pendingNewEmail,
                error: result.message,
                success: null,
                remainingSeconds,
                isExpired
            });
        }

        delete req.session.pendingNewEmail;
        req.session.successMessage = "Your email address has been updated successfully.";
        req.session.save((saveErr) => {
            if (saveErr) {
                console.error("Session save error after verify email OTP:", saveErr);
            }
            res.redirect("/user/profile");
        });
    } catch (error) {
        console.error("Verify email OTP error:", error);
        res.status(500).render("verifyEmailOtp", {
            pendingEmail: req.session.pendingNewEmail || "",
            error: "Something went wrong. Please try again.",
            success: null,
            remainingSeconds: 0,
            isExpired: true
        });
    }
};

const resendEmailChangeOTP = async (req, res) => {
    try {
        const userId = req.session.userId;
        const pendingNewEmail = req.session.pendingNewEmail;

        const user = await User.findById(userId).select("googleId");
        if (user && user.googleId) {
            req.session.errorMessage = "Email change is disabled for accounts signed in with Google.";
            return res.redirect("/user/profile");
        }

        if (!userId || !pendingNewEmail) {
            return res.redirect("/user/profile/change-email");
        }

        const result = await userService.resendEmailChangeOTP(userId, pendingNewEmail);
        if (!result.success) {
            const otpDoc = await OTP.findOne({ userId, purpose: "email-change" });
            let remainingSeconds = 0;
            let isExpired = true;
            if (otpDoc) {
                const diffMs = new Date(otpDoc.expiredAt).getTime() - Date.now();
                if (diffMs > 0) {
                    remainingSeconds = Math.ceil(diffMs / 1000);
                    isExpired = false;
                }
            }
            return res.status(400).render("verifyEmailOtp", {
                pendingEmail: pendingNewEmail,
                error: result.message,
                success: null,
                remainingSeconds,
                isExpired
            });
        }

        req.session.emailOtpSuccess = "A fresh 6-digit verification code has been sent.";
        req.session.save((saveErr) => {
            if (saveErr) {
                console.error("Session save error after resend email OTP:", saveErr);
            }
            res.redirect("/user/profile/verify-email-otp");
        });
    } catch (error) {
        console.error("Resend email change OTP error:", error);
        res.status(500).render("verifyEmailOtp", {
            pendingEmail: req.session.pendingNewEmail || "",
            error: "Unable to resend OTP. Please try again.",
            success: null,
            remainingSeconds: 0,
            isExpired: true
        });
    }
};

module.exports = {
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