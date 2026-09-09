const bcrypt = require("bcrypt");
const crypto = require("crypto");
const User = require("../../models/userModel");
const OTP = require("../../models/otpModel");
const { sendOtpEmail } = require("../../utils/sendEmail");

// ========================================
// Helper Utilities & Terminal OTP Display
// ========================================
const generateOTP = () => crypto.randomInt(100000, 1000000).toString();

const purposeLabelMap = {
    "signup": "Signup",
    "SIGNUP": "Signup",
    "reset-password": "Password Reset",
    "email-change": "Email Change",
    "admin_password_reset": "Admin Password Reset"
};

/**
 * Display the generated OTP concisely in the terminal
 */
const logOtpToTerminal = ({ otp, purpose = "signup", recipient = "" }) => {
    const emailMatch = recipient.match(/<([^>]+)>/);
    const targetEmail = emailMatch ? emailMatch[1] : recipient;
    const label = purposeLabelMap[purpose] || "Verification";
    console.log(`${label} OTP for ${targetEmail}: ${otp}`);
};

const createOtpDocument = async (userId, purpose, expiryMinutes = 1, overrideRecipient = null) => {
    await OTP.deleteMany({ userId, ...(purpose ? { purpose } : {}) });
    const otp = generateOTP();
    const expiredAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
    const otpDoc = await OTP.create({ userId, otpCode: otp, expiredAt, ...(purpose ? { purpose } : {}) });

    let recipientStr = overrideRecipient;
    if (!recipientStr) {
        try {
            const user = await User.findById(userId);
            if (user) {
                recipientStr = user.email ? `${user.name ? user.name + " " : ""}<${user.email}>` : `User ID: ${userId}`;
            }
        } catch (e) {}
    }

    // Show the generated OTP in the terminal
    logOtpToTerminal({
        otp,
        purpose: purpose || "SIGNUP",
        recipient: recipientStr || `User ID: ${userId}`,
        expiryMinutes,
        expiredAt
    });

    return otpDoc;
};

const checkOtpCooldown = async (userId, purpose, cooldownSeconds = 30) => {
    const existingOTP = await OTP.findOne({ userId, ...(purpose ? { purpose } : {}) });
    if (!existingOTP) return { onCooldown: false };

    // If existing OTP has already expired, allow immediate resend
    if (new Date() > new Date(existingOTP.expiredAt)) {
        return { onCooldown: false };
    }

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
        return { success: false, isExpired: true, message: "OTP expired or not found. Please click 'Resend Code'." };
    }
    if (new Date() > new Date(otpDocument.expiredAt)) {
        await OTP.deleteOne({ _id: otpDocument._id });
        return { success: false, isExpired: true, message: "OTP has expired. Please click 'Resend Code' to get a new code." };
    }
    if (otpDocument.otpCode !== enteredOTP) {
        return { success: false, isExpired: false, message: "Invalid OTP code. Please check and try again." };
    }
    await OTP.deleteOne({ _id: otpDocument._id });
    return { success: true };
};

// ========================================
// Create User
// ========================================
const createUser = async ({ name, email, phone, password }) => {
    const formattedEmail = email.trim().toLowerCase();
    const formattedPhone = phone.trim();

    const existingUser = await User.findOne({
        $or: [{ email: formattedEmail }, { phone: formattedPhone }]
    });

    if (existingUser) {
        // If user already signed up but never verified their OTP, allow updating and resending!
        if (!existingUser.isVerified) {
            const hashedPassword = await bcrypt.hash(password, 10);
            existingUser.name = name.trim();
            existingUser.email = formattedEmail;
            existingUser.phone = formattedPhone;
            existingUser.password = hashedPassword;
            await existingUser.save();
            return existingUser;
        }

        const error = new Error("User already exists");
        error.code = 11000;
        throw error;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    return await User.create({
        name,
        email: formattedEmail,
        phone: formattedPhone,
        password: hashedPassword,
        isAdmin: false,
        isBlocked: false,
        isVerified: false
    });
};

// ========================================
// Create OTP (1 Minute Validity for Signup)
// ========================================
const createOTP = async (userId) => {
    return await createOtpDocument(userId, "signup", 1);
};

// ========================================
// Verify OTP
// ========================================
const verifyOTP = async (userId, enteredOTP) => {
    const result = await verifyAndDeleteOtp({ userId, purpose: "signup" }, enteredOTP);
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
        return {
            success: false,
            isUnverified: true,
            userId: user._id,
            userEmail: user.email,
            userName: user.name,
            message: "Please verify your account first."
        };
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

    const cooldown = await checkOtpCooldown(userId, "signup", 30);
    if (cooldown.onCooldown) {
        return { success: false, message: cooldown.message };
    }

    const otp = await createOTP(userId);
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
const requestEmailChange = async (userId, newEmail, isResend = false) => {
    const formattedEmail = newEmail.trim().toLowerCase();
    const user = await User.findById(userId);

    if (!user) {
        return { success: false, message: "User not found." };
    }
    if (user.googleId) {
        return {
            success: false,
            message: "Email change is disabled for accounts registered with Google Sign-In."
        };
    }
    if (user.email === formattedEmail) {
        return { success: false, message: "New email must be different from current email." };
    }

    const existingUser = await User.findOne({ email: formattedEmail });
    if (existingUser) {
        return { success: false, message: "This email address is already in use." };
    }

    // Cooldown only applies when resending to the same email address
    if (isResend) {
        const cooldown = await checkOtpCooldown(userId, "email-change", 30);
        if (cooldown.onCooldown) {
            return { success: false, message: cooldown.message };
        }
    }

    const otpDocument = await createOtpDocument(
        userId,
        "email-change",
        5,
        `${user.name ? user.name + " " : ""}<${formattedEmail}>`
    );
    await sendOtpEmail(formattedEmail, otpDocument.otpCode, "email-change", user.name);

    return { success: true, pendingNewEmail: formattedEmail };
};

// ========================================
// Resend Email Change OTP
// ========================================
const resendEmailChangeOTP = async (userId, pendingNewEmail) => {
    return await requestEmailChange(userId, pendingNewEmail, true);
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
    logOtpToTerminal,
    verifyOTP,
    loginUser,
    resendOTP,
    forgotPassword,
    resetPassword,
    changePassword,
    requestEmailChange,
    resendEmailChangeOTP,
    verifyEmailChange
};


