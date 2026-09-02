const bcrypt = require("bcrypt");
const crypto = require("crypto");
const User = require("../../models/userModel");
const OTP = require("../../models/otpModel");
const { sendOtpEmail } = require("../../utils/sendEmail");

// ========================================
// Helper Utilities
// ========================================
const generateOTP = () => crypto.randomInt(100000, 1000000).toString();

const createOtpDocument = async (userId, purpose, expiryMinutes = 5) => {
    await OTP.deleteMany({ userId, ...(purpose ? { purpose } : {}) });
    const otp = generateOTP();
    const expiredAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
    return await OTP.create({ userId, otpCode: otp, expiredAt, ...(purpose ? { purpose } : {}) });
};

const checkOtpCooldown = async (userId, purpose, cooldownSeconds = 30) => {
    const existingOTP = await OTP.findOne({ userId, ...(purpose ? { purpose } : {}) });
    if (!existingOTP) return { onCooldown: false };

    const cooldownTime = cooldownSeconds * 1000;
    const timeSinceCreation = Date.now() - new Date(existingOTP.createdAt).getTime();
    if (timeSinceCreation < cooldownTime) {
        const remainingTime = Math.ceil((cooldownTime - timeSinceCreation) / 1000);
        return {
            onCooldown: true,
            message: `Please wait ${remainingTime} seconds before requesting a new OTP.`
        };
    }
    return { onCooldown: false };
};

const verifyAndDeleteOtp = async (query, enteredOTP) => {
    const otpDocument = await OTP.findOne(query);
    if (!otpDocument) {
        return { success: false, message: "OTP expired or not found." };
    }
    if (otpDocument.expiredAt < new Date()) {
        await OTP.deleteOne({ _id: otpDocument._id });
        return { success: false, message: "OTP has expired." };
    }
    if (otpDocument.otpCode !== enteredOTP) {
        return { success: false, message: "Invalid OTP." };
    }
    await OTP.deleteOne({ _id: otpDocument._id });
    return { success: true };
};

// ========================================
// Create User
// ========================================
const createUser = async ({ name, email, phone, password }) => {
    const existingUser = await User.findOne({
        $or: [{ email }, { phone }]
    });

    if (existingUser) {
        const error = new Error("User already exists");
        error.code = 11000;
        throw error;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    return await User.create({
        name,
        email,
        phone,
        password: hashedPassword,
        isAdmin: false,
        isBlocked: false,
        isVerified: false
    });
};

// ========================================
// Create OTP
// ========================================
const createOTP = async (userId) => {
    return await createOtpDocument(userId, "signup", 1);
};

// ========================================
// Verify OTP
// ========================================
const verifyOTP = async (userId, enteredOTP) => {
    const result = await verifyAndDeleteOtp({ userId }, enteredOTP);
    if (!result.success) return result;

    await User.findByIdAndUpdate(userId, {
        $set: { isVerified: true }
    });

    return { success: true };
};

// ========================================
// Login User
// ========================================
const loginUser = async (email, password) => {
    const user = await User.findOne({
        email: email.trim().toLowerCase()
    });

    if (!user) {
        return { success: false, message: "Invalid email or password." };
    }

    if (user.isBlocked) {
        return { success: false, message: "Your account has been blocked." };
    }

    if (!user.isVerified) {
        return { success: false, message: "Please verify your account first." };
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
        return { success: false, message: "Invalid email or password." };
    }

    return { success: true, user };
};

// ========================================
// Resend OTP
// ========================================
const resendOTP = async (userId) => {
    const user = await User.findById(userId);
    if (!user) {
        return { success: false, message: "User not found." };
    }
    if (user.isVerified) {
        return { success: false, message: "User is already verified." };
    }

    const cooldown = await checkOtpCooldown(userId);
    if (cooldown.onCooldown) {
        return { success: false, message: cooldown.message };
    }

    const otp = await createOTP(userId);
    console.log(`New OTP for ${user.email}: ${otp.otpCode}`);
    await sendOtpEmail(user.email, otp.otpCode, "signup", user.name);

    return { success: true, otp };
};

// ========================================
// Forgot Password (Send Reset OTP)
// ========================================
const forgotPassword = async (email) => {
    const user = await User.findOne({
        email: email.trim().toLowerCase()
    });

    if (!user) {
        return { success: false, message: "No account found with this email." };
    }
    if (user.isBlocked) {
        return { success: false, message: "Your account has been blocked." };
    }

    const cooldown = await checkOtpCooldown(user._id, "reset-password");
    if (cooldown.onCooldown) {
        return { success: false, message: cooldown.message };
    }

    const otpDocument = await createOtpDocument(user._id, "reset-password", 5);
    console.log(`Password Reset OTP for ${user.email}: ${otpDocument.otpCode}`);
    await sendOtpEmail(user.email, otpDocument.otpCode, "reset-password", user.name);

    return { success: true, userId: user._id };
};

// ========================================
// Reset Password (Verify OTP + Update)
// ========================================
const resetPassword = async (userId, enteredOTP, newPassword) => {
    const result = await verifyAndDeleteOtp({ userId, purpose: "reset-password" }, enteredOTP);
    if (!result.success) return result;

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.findByIdAndUpdate(userId, {
        $set: { password: hashedPassword }
    });

    return { success: true };
};

// ========================================
// Change Password (Logged-in User)
// ========================================
const changePassword = async (userId, currentPassword, newPassword) => {
    const user = await User.findById(userId);
    if (!user) {
        return { success: false, message: "User not found." };
    }

    if (!user.password) {
        return {
            success: false,
            message: "This account does not have a local password set (e.g. Google Sign-In)."
        };
    }

    const passwordMatch = await bcrypt.compare(currentPassword, user.password);
    if (!passwordMatch) {
        return { success: false, message: "Current password is incorrect." };
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.findByIdAndUpdate(userId, {
        $set: { password: hashedPassword }
    });

    return { success: true };
};

// ========================================
// Request Email Change (Send OTP)
// ========================================
const requestEmailChange = async (userId, newEmail) => {
    const formattedEmail = newEmail.trim().toLowerCase();
    const user = await User.findById(userId);

    if (!user) {
        return { success: false, message: "User not found." };
    }
    if (user.email === formattedEmail) {
        return { success: false, message: "New email must be different from current email." };
    }

    const existingUser = await User.findOne({ email: formattedEmail });
    if (existingUser) {
        return { success: false, message: "This email address is already in use." };
    }

    const otpDocument = await createOtpDocument(userId, "email-change", 5);
    console.log(`Email Change OTP for ${formattedEmail}: ${otpDocument.otpCode}`);
    await sendOtpEmail(formattedEmail, otpDocument.otpCode, "email-change", user.name);

    return { success: true, pendingNewEmail: formattedEmail };
};

// ========================================
// Verify Email Change OTP
// ========================================
const verifyEmailChange = async (userId, pendingNewEmail, enteredOTP) => {
    const result = await verifyAndDeleteOtp({ userId, purpose: "email-change" }, enteredOTP);
    if (!result.success) return result;

    await User.findByIdAndUpdate(userId, {
        $set: { email: pendingNewEmail }
    });

    return { success: true };
};

module.exports = {
    createUser,
    createOTP,
    verifyOTP,
    loginUser,
    resendOTP,
    forgotPassword,
    resetPassword,
    changePassword,
    requestEmailChange,
    verifyEmailChange
};


