import bcrypt from "bcrypt";
import User from "../../models/userModel.js";
import Product from "../../models/productModel.js";
import Category from "../../models/categoryModel.js";
import OTP from "../../models/otpModel.js";
import { sendOtpEmail } from "../../utils/sendEmail.js";

const loginAdmin = async (email, password) => {
    try {
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
    } catch (error) {
        console.error("loginAdmin error:", error.message);
        throw error;
    }
};

// Send Reset OTP for Admin
const sendResetOtp = async (email) => {
    try {
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
    } catch (error) {
        console.error("sendResetOtp error:", error.message);
        throw error;
    }
};

// Verify Admin OTP
const verifyOtp = async (adminId, otpCode) => {
    try {
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
    } catch (error) {
        console.error("verifyOtp error:", error.message);
        throw error;
    }
};

// Reset Admin Password
const resetPassword = async (adminId, newPassword) => {
    try {
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
    } catch (error) {
        console.error("resetPassword error:", error.message);
        throw error;
    }
};

// Get Dashboard Metrics
const getDashboardMetrics = async () => {
    try {
        const [totalUsers, totalProducts, totalCategories] = await Promise.all([
            User.countDocuments({ isAdmin: false }),
            Product.countDocuments({ isDeleted: false }),
            Category.countDocuments({ isDeleted: false })
        ]);
        return {
            totalUsers,
            totalProducts,
            totalCategories
        };
    } catch (error) {
        console.error("getDashboardMetrics error:", error.message);
        throw error;
    }
};

export {
    loginAdmin,
    sendResetOtp,
    verifyOtp,
    resetPassword,
    getDashboardMetrics
};

export default {
    loginAdmin,
    sendResetOtp,
    verifyOtp,
    resetPassword,
    getDashboardMetrics
};