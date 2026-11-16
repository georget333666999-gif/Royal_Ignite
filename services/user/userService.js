import crypto from "crypto";
import bcrypt from "bcrypt";
import User from "../../models/userModel.js";
import OTP from "../../models/otpModel.js";
import walletService from "./walletService.js";
import offerService from "../admin/offerService.js";
import { sendOtpEmail } from "../../utils/sendEmail.js";
import { RESPONSE_MESSAGES } from "../../constants/index.js";

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
                message: `Please wait ${remainingTime} seconds before requesting a new verification code.`
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
            return { success: false, isExpired: true, message: RESPONSE_MESSAGES.OTP.EXPIRED_OR_NOT_FOUND };
        }
        if (new Date() > new Date(otpDocument.expiredAt)) {
            await OTP.deleteOne({ _id: otpDocument._id });
            return { success: false, isExpired: true, message: RESPONSE_MESSAGES.OTP.EXPIRED };
        }
        if (otpDocument.otpCode !== enteredOTP) {
            return { success: false, isExpired: false, message: RESPONSE_MESSAGES.OTP.INVALID_CODE };
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
const createUser = async ({ name, email, phone, password, referralCode = "" }) => {
    try {
        const formattedEmail = email.trim().toLowerCase();
        const formattedPhone = phone.trim();

        // Check if referral code was supplied and matches a valid referrer
        let referrerUser = null;
        if (referralCode && referralCode.trim()) {
            referrerUser = await User.findOne({
                referralCode: referralCode.trim().toUpperCase(),
                isBlocked: false
            });
        }

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
                if (referrerUser && !existingUser.referredBy) {
                    existingUser.referredBy = referrerUser._id;
                }
                await existingUser.save();
                return existingUser;
            }

            const error = new Error(RESPONSE_MESSAGES.AUTH.EMAIL_PHONE_EXISTS);
            error.code = 11000;
            throw error;
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate a unique referral code for the new user
        let myReferralCode;
        let isCodeUnique = false;
        while (!isCodeUnique) {
            myReferralCode = "RYL" + crypto.randomBytes(3).toString("hex").toUpperCase();
            const clash = await User.findOne({ referralCode: myReferralCode });
            if (!clash) isCodeUnique = true;
        }

        return await User.create({
            name,
            email: formattedEmail,
            phone: formattedPhone,
            password: hashedPassword,
            referralCode: myReferralCode,
            referredBy: referrerUser ? referrerUser._id : null,
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

        const user = await User.findById(userId);
        if (!user) {
            return { success: false, message: "User account not found." };
        }

        user.isVerified = true;

        // Process referral rewards upon successful verification
        if (user.referredBy && !user.referralRewarded) {
            try {
                const referralOffer = await offerService.getActiveReferralOffer();
                const referrerReward = referralOffer ? Number(referralOffer.referrerReward || 0) : 100;
                const refereeReward = referralOffer ? Number(referralOffer.refereeReward || 0) : 50;

                if (refereeReward > 0) {
                    await walletService.creditWallet(user._id, {
                        amount: refereeReward,
                        description: "Welcome privilege bonus for joining via referral invitation",
                        source: "referral_bonus"
                    });
                }

                if (referrerReward > 0) {
                    await walletService.creditWallet(user.referredBy, {
                        amount: referrerReward,
                        description: `Referral privilege reward for welcoming ${user.name}`,
                        source: "referral_bonus"
                    });

                    await User.findByIdAndUpdate(user.referredBy, {
                        $inc: { referralRewardsEarned: referrerReward }
                    });
                }

                user.referralRewarded = true;
            } catch (refErr) {
                console.error("Referral reward distribution error:", refErr);
            }
        }

        await user.save();
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
            return { success: false, message: RESPONSE_MESSAGES.AUTH.INVALID_CREDENTIALS };
        }

        if (user.isBlocked) {
            return { success: false, message: RESPONSE_MESSAGES.AUTH.ACCOUNT_BLOCKED };
        }

        if (!user.isVerified) {
            return {
                success: false,
                isUnverified: true,
                userId: user._id,
                userEmail: user.email,
                userName: user.name,
                message: RESPONSE_MESSAGES.AUTH.ACCOUNT_UNVERIFIED
            };
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return { success: false, message: RESPONSE_MESSAGES.AUTH.INVALID_CREDENTIALS };
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
            return { success: false, message: RESPONSE_MESSAGES.AUTH.USER_NOT_FOUND };
        }
        if (user.isVerified) {
            return { success: false, message: RESPONSE_MESSAGES.OTP.USER_ALREADY_VERIFIED };
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
            return { success: false, message: RESPONSE_MESSAGES.AUTH.NO_ACCOUNT_WITH_EMAIL };
        }
        if (user.isBlocked) {
            return { success: false, message: RESPONSE_MESSAGES.AUTH.ACCOUNT_BLOCKED };
        }
        if (user.googleId) {
            return {
                success: false,
                message: RESPONSE_MESSAGES.AUTH.GOOGLE_ACCOUNT_REGISTERED
            };
        }

        const cooldown = await checkOtpCooldown(user._id, "reset-password");
        if (cooldown.onCooldown) {
            return { success: false, message: cooldown.message };
        }

        const otpDocument = await createOtpDocument(user._id, "reset-password", 1);
        await sendOtpEmail(user.email, otpDocument.otpCode, "reset-password", user.name);

        return { success: true, userId: user._id };
    } catch (error) {
        console.error("forgotPassword error:", error.message);
        throw error;
    }
};

// ========================================
// Resend Reset Password OTP (1 Minute Validity)
// ========================================
const resendResetOTP = async (userId) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            return { success: false, message: RESPONSE_MESSAGES.AUTH.USER_NOT_FOUND };
        }
        if (user.isBlocked) {
            return { success: false, message: RESPONSE_MESSAGES.AUTH.ACCOUNT_BLOCKED };
        }

        const cooldown = await checkOtpCooldown(userId, "reset-password");
        if (cooldown.onCooldown) {
            return { success: false, message: cooldown.message };
        }

        const otpDocument = await createOtpDocument(userId, "reset-password", 1);
        await sendOtpEmail(user.email, otpDocument.otpCode, "reset-password", user.name);

        return { success: true, userId: user._id };
    } catch (error) {
        console.error("resendResetOTP error:", error.message);
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
            return { success: false, message: RESPONSE_MESSAGES.AUTH.USER_NOT_FOUND };
        }

        if (user.googleId) {
            return {
                success: false,
                message: RESPONSE_MESSAGES.AUTH.GOOGLE_PASSWORD_CHANGE_DISABLED
            };
        }

        if (!user.password) {
            return {
                success: false,
                message: RESPONSE_MESSAGES.AUTH.LOCAL_PASSWORD_NOT_SET
            };
        }

        const passwordMatch = await bcrypt.compare(currentPassword, user.password);
        if (!passwordMatch) {
            return { success: false, message: RESPONSE_MESSAGES.AUTH.CURRENT_PASSWORD_INCORRECT };
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
            return RESPONSE_MESSAGES.AUTH.USER_NOT_FOUND;
        }
        if (user.googleId) {
            return RESPONSE_MESSAGES.AUTH.GOOGLE_EMAIL_CHANGE_DISABLED;
        }
        if (user.email === formattedEmail) {
            return RESPONSE_MESSAGES.AUTH.NEW_EMAIL_DIFFERENT;
        }
        const existingUser = await User.findOne({ email: formattedEmail });
        if (existingUser) {
            return RESPONSE_MESSAGES.AUTH.EMAIL_IN_USE;
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
    resendResetOTP,
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
    resendResetOTP,
    resetPassword,
    changePassword,
    requestEmailChange,
    resendEmailChangeOTP,
    verifyEmailChange
};