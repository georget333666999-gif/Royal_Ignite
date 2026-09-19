const bcrypt = require("bcryptjs");
const User = require("../../models/userModel");
const OTP = require("../../models/otpModel");
const { sendOtpEmail } = require("../../utils/sendEmail");

const loginAdmin = async (email, password) => {
    const admin = await User.findOne({
        email: email.toLowerCase(),
        isAdmin: true
    });

    if (!admin) {
        throw new Error("Invalid email or password");
    }

    if (admin.isBlocked) {
        throw new Error("Your account has been blocked");
    }

    const isPasswordMatch = await bcrypt.compare(
        password,
        admin.password
    );

    if (!isPasswordMatch) {
        throw new Error("Invalid email or password");
    }

    return admin;
};

// Send Reset OTP for Admin
const sendResetOtp = async (email) => {
    const admin = await User.findOne({
        email: email.trim().toLowerCase(),
        isAdmin: true
    });

    if (!admin) {
        throw new Error("No admin account found with that email address");
    }

    // Delete previous OTP if any
    await OTP.deleteMany({ userId: admin._id });

    // Generate 6 digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiredAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    await OTP.create({
        userId: admin._id,
        otpCode,
        expiredAt,
        purpose: "admin_password_reset"
    });

    console.log(`Admin Password Reset OTP for ${admin.email}: ${otpCode}`);

    await sendOtpEmail(admin.email, otpCode, "admin_password_reset", admin.name || "Admin");

    return { admin, otpCode };
};

// Verify Admin OTP
const verifyOtp = async (adminId, otpCode) => {
    if (!otpCode || otpCode.length !== 6) {
        throw new Error("Please enter a valid 6-digit OTP code");
    }

    const otpRecord = await OTP.findOne({ userId: adminId });

    if (!otpRecord) {
        throw new Error("OTP expired or not requested");
    }

    if (new Date() > new Date(otpRecord.expiredAt)) {
        await OTP.deleteOne({ _id: otpRecord._id });
        throw new Error("OTP has expired. Please request a new code.");
    }

    if (otpRecord.otpCode !== otpCode.trim()) {
        throw new Error("Invalid OTP code. Please check and try again.");
    }

    await OTP.deleteOne({ _id: otpRecord._id });
    return true;
};

// Reset Admin Password
const resetPassword = async (adminId, newPassword) => {
    if (!newPassword || newPassword.length < 8) {
        throw new Error("Password must be at least 8 characters.");
    }
    if (!/[a-zA-Z]/.test(newPassword)) {
        throw new Error("Password must contain at least one letter.");
    }
    if (!/\d/.test(newPassword)) {
        throw new Error("Password must contain at least one number.");
    }
    if (/^[^a-zA-Z0-9]+$/.test(newPassword)) {
        throw new Error("Password cannot consist only of symbols.");
    }

    const admin = await User.findById(adminId);
    if (!admin) {
        throw new Error("Admin not found");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    admin.password = hashedPassword;
    await admin.save();

    return true;
};

// Get Dashboard Metrics
const getDashboardMetrics = async () => {
    const totalUsers = await User.countDocuments({ isAdmin: false });
    return {
        totalUsers
    };
};

module.exports = {
    loginAdmin,
    sendResetOtp,
    verifyOtp,
    resetPassword,
    getDashboardMetrics
};