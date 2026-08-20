const bcrypt = require("bcryptjs");
const User = require("../../models/userModel");
const OTP = require("../../models/otpModel");

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
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    await OTP.create({
        userId: admin._id,
        otpCode,
        expiresAt
    });

    console.log(`[ADMIN OTP] Sent to ${admin.email}: ${otpCode}`);

    return { admin, otpCode };
};

// Verify Admin OTP
const verifyOtp = async (adminId, otpCode) => {
    const otpRecord = await OTP.findOne({ userId: adminId });

    if (!otpRecord) {
        throw new Error("OTP expired or not requested");
    }

    if (otpRecord.otpCode !== otpCode) {
        throw new Error("Invalid OTP code");
    }

    if (new Date() > new Date(otpRecord.expiresAt)) {
        throw new Error("OTP has expired");
    }

    await OTP.deleteOne({ _id: otpRecord._id });
    return true;
};

// Reset Admin Password
const resetPassword = async (adminId, newPassword) => {
    if (!newPassword || newPassword.length < 8) {
        throw new Error("Password must be at least 8 characters long");
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

module.exports = {
    loginAdmin,
    sendResetOtp,
    verifyOtp,
    resetPassword
};