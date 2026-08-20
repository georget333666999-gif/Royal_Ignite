const addressService = require("../services/addressService");
const userService = require("../services/userService");
const User = require("../../models/userModel");

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

        res.render("profile", { user, addresses });
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
    res.render("changePassword", { error: null, success: null });
};

const postChangePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const result = await userService.changePassword(
            req.session.userId,
            currentPassword,
            newPassword
        );

        if (!result.success) {
            return res.status(400).render("changePassword", {
                error: result.message,
                success: null
            });
        }

        res.render("changePassword", {
            error: null,
            success: "Password changed successfully!"
        });
    } catch (error) {
        console.error("Change password error:", error);
        res.status(500).render("changePassword", {
            error: "Something went wrong. Please try again.",
            success: null
        });
    }
};

// ========================================
// Change Email Page & Form
// ========================================
const getChangeEmail = (req, res) => {
    res.render("changeEmail", { error: null });
};

const postChangeEmail = async (req, res) => {
    try {
        const { newEmail } = req.body;
        const result = await userService.requestEmailChange(
            req.session.userId,
            newEmail
        );

        if (!result.success) {
            return res.status(400).render("changeEmail", {
                error: result.message
            });
        }

        req.session.pendingNewEmail = result.pendingNewEmail;
        res.redirect("/user/profile/verify-email-otp");
    } catch (error) {
        console.error("Request change email error:", error);
        res.status(500).render("changeEmail", {
            error: "Something went wrong. Please try again."
        });
    }
};

// ========================================
// Verify Email OTP Page & Form
// ========================================
const getVerifyEmailOTP = (req, res) => {
    if (!req.session.pendingNewEmail) {
        return res.redirect("/user/profile/change-email");
    }

    res.render("verifyEmailOtp", {
        pendingEmail: req.session.pendingNewEmail,
        error: null
    });
};

const postVerifyEmailOTP = async (req, res) => {
    try {
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
            return res.status(400).render("verifyEmailOtp", {
                pendingEmail: pendingNewEmail,
                error: result.message
            });
        }

        delete req.session.pendingNewEmail;
        res.redirect("/user/profile");
    } catch (error) {
        console.error("Verify email OTP error:", error);
        res.status(500).render("verifyEmailOtp", {
            pendingEmail: req.session.pendingNewEmail || "",
            error: "Something went wrong. Please try again."
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
    postVerifyEmailOTP
};
