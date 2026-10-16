import crypto from "crypto";
import bcrypt from "bcrypt";
import User from "../../models/userModel.js";
import OTP from "../../models/otpModel.js";
import { sendOtpEmail } from "../../utils/sendEmail.js";

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

const resolveOtpRecipient = async (userId, overrideRecipient) => {
    if (overrideRecipient) return overrideRecipient;
    try {
        const user = await User.findById(userId).select("email name");
        if (user && user.email) {
            const prefix = user.name ? `${user.name} ` : "";
            return `${prefix}<${user.email}>`;
        }
    } catch {
        // Fallback below
    }
    return `User ID: ${userId}`;
};

const createOtpDocument = async (userId, purpose = "signup", expiryMinutes = 1, overrideRecipient = null) => {
    try {
        const purposeFilter = purpose ? { purpose } : {};
        await OTP.deleteMany({ userId, ...purposeFilter });

        const otp = generateOTP();
        const expiredAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
        const otpDoc = await OTP.create({ userId, otpCode: otp, expiredAt, ...purposeFilter });

        const recipient = await resolveOtpRecipient(userId, overrideRecipient);
        logOtpToTerminal({ otp, purpose, recipient });

        return otpDoc;
    } catch (error) {
        console.error("createOtpDocument error:", error.message);
        throw error;
    }
};

const checkOtpCooldown = async (userId, purpose) => {
    try {
        const existingOTP = await OTP.findOne({ userId, ...(purpose ? { purpose } : {}) }).sort({ createdAt: -1 });
        if (!existingOTP) return { onCooldown: false };

        // If existing OTP has already expired, allow immediate resend
        if (new Date() > new Date(existingOTP.expiredAt)) {
            return { onCooldown: false };
        }

        const remainingMs = new Date(existingOTP.expiredAt).getTime() - Date.now();
        if (remainingMs > 0) {
            const remainingTime = Math.ceil(remainingMs / 1000);
            return {
                onCooldown: true,
                message: `Please wait ${remainingTime} seconds until your current OTP expires before requesting a new one.`
            };
        }
        return { onCooldown: false };
    } catch (error) {
        console.error("checkOtpCooldown error:", error.message);
        throw error;
    }
};

const verifyAndDeleteOtp = async (query, enteredOTP) => {
    try {
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
    } catch (error) {
        console.error("verifyAndDeleteOtp error:", error.message);
        throw error;
    }
};

// ========================================
// Create User
// ========================================
const createUser = async ({ name, email, phone, password }) => {
    try {
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
    } catch (error) {
        console.error("createUser error:", error.message);
        throw error;
    }
};

// ========================================
// Create OTP (1 Minute Validity for Signup)
// ========================================
const createOTP = async (userId) => {
    try {
        return await createOtpDocument(userId, "signup", 1);
    } catch (error) {
        console.error("createOTP error:", error.message);
        throw error;
    }
};

// ========================================
// Verify OTP
// ========================================
const verifyOTP = async (userId, enteredOTP) => {
    try {
        const result = await verifyAndDeleteOtp({ userId, purpose: "signup" }, enteredOTP);
        if (!result.success) return result;

        await User.findByIdAndUpdate(userId, {
            $set: { isVerified: true }
        });

        return { success: true };
    } catch (error) {
        console.error("verifyOTP error:", error.message);
        throw error;
    }
};

// ========================================
// Login User
// ========================================
const loginUser = async (email, password) => {
    try {
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
    } catch (error) {
        console.error("loginUser error:", error.message);
        throw error;
    }
};

// ========================================
// Resend OTP
// ========================================
const resendOTP = async (userId) => {
    try {
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
    } catch (error) {
        console.error("resendOTP error:", error.message);
        throw error;
    }
};

// ========================================
// Forgot Password (Send Reset OTP)
// ========================================
const forgotPassword = async (email) => {
    try {
        const user = await User.findOne({
            email: email.trim().toLowerCase()
        });

        if (!user) {
            return { success: false, message: "No account found with this email." };
        }
        if (user.isBlocked) {
            return { success: false, message: "Your account has been blocked." };
        }
        if (user.googleId) {
            return {
                success: false,
                message: "This account is registered with Google Sign-In. Please sign in directly using Google."
            };
        }

        const cooldown = await checkOtpCooldown(user._id, "reset-password");
        if (cooldown.onCooldown) {
            return { success: false, message: cooldown.message };
        }

        const otpDocument = await createOtpDocument(user._id, "reset-password", 5);
        await sendOtpEmail(user.email, otpDocument.otpCode, "reset-password", user.name);

        return { success: true, userId: user._id };
    } catch (error) {
        console.error("forgotPassword error:", error.message);
        throw error;
    }
};

// ========================================
// Reset Password (Verify OTP + Update)
// ========================================
const resetPassword = async (userId, enteredOTP, newPassword) => {
    try {
        const result = await verifyAndDeleteOtp({ userId, purpose: "reset-password" }, enteredOTP);
        if (!result.success) return result;

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await User.findByIdAndUpdate(userId, {
            $set: { password: hashedPassword }
        });

        return { success: true };
    } catch (error) {
        console.error("resetPassword error:", error.message);
        throw error;
    }
};

// ========================================
// Change Password (Logged-in User)
// ========================================
const changePassword = async (userId, currentPassword, newPassword) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            return { success: false, message: "User not found." };
        }

        if (user.googleId) {
            return {
                success: false,
                message: "Password change is disabled for accounts authenticated with Google Sign-In."
            };
        }

        if (!user.password) {
            return {
                success: false,
                message: "This account does not have a local password set."
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
    } catch (error) {
        console.error("changePassword error:", error.message);
        throw error;
    }
};

// ========================================
// Request Email Change (Send OTP)
const validateEmailChangePrerequisites = async (user, formattedEmail) => {
    try {
        if (!user) {
            return "User not found.";
        }
        if (user.googleId) {
            return "Email change is disabled for accounts registered with Google Sign-In.";
        }
        if (user.email === formattedEmail) {
            return "New email must be different from current email.";
        }
        const existingUser = await User.findOne({ email: formattedEmail });
        if (existingUser) {
            return "This email address is already in use.";
        }
        return null;
    } catch (error) {
        console.error("validateEmailChangePrerequisites error:", error.message);
        throw error;
    }
};

const verifyResendCooldown = async (userId, isResend) => {
    try {
        if (!isResend) return null;
        const cooldown = await checkOtpCooldown(userId, "email-change", 30);
        return cooldown.onCooldown ? cooldown.message : null;
    } catch (error) {
        console.error("verifyResendCooldown error:", error.message);
        throw error;
    }
};

// ========================================
// Request Email Change
// ========================================
const requestEmailChange = async (userId, newEmail, isResend = false) => {
    try {
        const formattedEmail = newEmail.trim().toLowerCase();
        const user = await User.findById(userId);

        const validationError = await validateEmailChangePrerequisites(user, formattedEmail);
        if (validationError) {
            return { success: false, message: validationError };
        }

        const cooldownError = await verifyResendCooldown(userId, isResend);
        if (cooldownError) {
            return { success: false, message: cooldownError };
        }

        const recipient = user.name ? `${user.name} <${formattedEmail}>` : `<${formattedEmail}>`;
        const otpDocument = await createOtpDocument(userId, "email-change", 5, recipient);
        await sendOtpEmail(formattedEmail, otpDocument.otpCode, "email-change", user.name);

        return { success: true, pendingNewEmail: formattedEmail };
    } catch (error) {
        console.error("requestEmailChange error:", error.message);
        throw error;
    }
};

// ========================================
// Resend Email Change OTP
// ========================================
const resendEmailChangeOTP = async (userId, pendingNewEmail) => {
    try {
        return await requestEmailChange(userId, pendingNewEmail, true);
    } catch (error) {
        console.error("resendEmailChangeOTP error:", error.message);
        throw error;
    }
};

// ========================================
// Verify Email Change OTP
// ========================================
const verifyEmailChange = async (userId, pendingNewEmail, enteredOTP) => {
    try {
        const result = await verifyAndDeleteOtp({ userId, purpose: "email-change" }, enteredOTP);
        if (!result.success) return result;

        await User.findByIdAndUpdate(userId, {
            $set: { email: pendingNewEmail }
        });

        return { success: true };
    } catch (error) {
        console.error("verifyEmailChange error:", error.message);
        throw error;
    }
};

export {
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

export default {
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