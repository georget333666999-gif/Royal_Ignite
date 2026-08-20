const bcrypt = require("bcrypt");
const crypto = require("crypto");

const User = require("../../models/userModel");
const OTP = require("../../models/otpModel");


// ========================================
// Generate OTP
// ========================================

const generateOTP = () => {

    return crypto
        .randomInt(100000, 1000000)
        .toString();

};


// ========================================
// Create User
// ========================================

const createUser = async ({
    name,
    email,
    phone,
    password
}) => {

    const existingUser = await User.findOne({
        $or: [
            { email },
            { phone }
        ]
    });

    if (existingUser) {

        const error = new Error(
            "User already exists"
        );

        error.code = 11000;

        throw error;
    }


    const hashedPassword = await bcrypt.hash(
        password,
        10
    );


    const user = await User.create({

        name,

        email,

        phone,

        password: hashedPassword,

        isAdmin: false,

        isBlocked: false,

        isVerified: false

    });


    return user;
};


// ========================================
// Create OTP
// ========================================

const createOTP = async (userId) => {

    const otp = generateOTP();

    const expiresAt = new Date(
        Date.now() + 1 * 60 * 1000
    );


    // Remove any previous OTP
    await OTP.deleteMany({
        userId
    });


    const otpDocument = await OTP.create({

        userId,

        otp,

        expiresAt

    });


    return otpDocument;
};


// ========================================
// Verify OTP
// ========================================

const verifyOTP = async (userId, enteredOTP) => {

    const otpDocument = await OTP.findOne({
        userId
    });

    if (!otpDocument) {

        return {
            success: false,
            message: "OTP expired or not found."
        };

    }


    if (otpDocument.expiresAt < new Date()) {

        await OTP.deleteOne({
            _id: otpDocument._id
        });

        return {
            success: false,
            message: "OTP has expired."
        };

    }


    if (otpDocument.otp !== enteredOTP) {

        return {
            success: false,
            message: "Invalid OTP."
        };

    }


    await User.findByIdAndUpdate(
        userId,
        {
            $set: {
                isVerified: true
            }
        }
    );


    await OTP.deleteOne({
        _id: otpDocument._id
    });


    return {
        success: true
    };
};
// ========================================
// Login User
// ========================================

const loginUser = async (email, password) => {

    const user = await User.findOne({
        email: email.trim().toLowerCase()
    });

    if (!user) {

        return {
            success: false,
            message: "Invalid email or password."
        };

    }


    // Check if account is blocked

    if (user.isBlocked) {

        return {
            success: false,
            message: "Your account has been blocked."
        };

    }


    // Check verification

    if (!user.isVerified) {

        return {
            success: false,
            message: "Please verify your account first."
        };

    }


    // Compare password

    const passwordMatch = await bcrypt.compare(
        password,
        user.password
    );


    if (!passwordMatch) {

        return {
            success: false,
            message: "Invalid email or password."
        };

    }


    return {
        success: true,
        user
    };

};

// ========================================
// Resend OTP
// ========================================

const resendOTP = async (userId) => {

    const user = await User.findById(userId);

    if (!user) {

        return {
            success: false,
            message: "User not found."
        };

    }


    // ------------------------------------
    // Check if already verified
    // ------------------------------------

    if (user.isVerified) {

        return {
            success: false,
            message: "User is already verified."
        };

    }


    // ------------------------------------
    // Find existing OTP
    // ------------------------------------

    const existingOTP = await OTP.findOne({
        userId
    });


    // ------------------------------------
    // Resend cooldown
    // ------------------------------------

    if (existingOTP) {

        const cooldownTime = 30 * 1000;

        const timeSinceCreation =
            Date.now() -
            new Date(existingOTP.createdAt).getTime();


        if (timeSinceCreation < cooldownTime) {

            const remainingTime =
                Math.ceil(
                    (cooldownTime - timeSinceCreation) / 1000
                );


            return {
                success: false,
                message:
                    `Please wait ${remainingTime} seconds before requesting a new OTP.`
            };

        }

    }


    // ------------------------------------
    // Generate new OTP
    // ------------------------------------

    const otp = await createOTP(userId);


    // TEMPORARY - development only

    console.log(
        `New OTP for ${user.email}: ${otp.otp}`
    );


    return {
        success: true,
        otp
    };

};
module.exports = {
    createUser,
    createOTP,
    verifyOTP,
    loginUser,
    resendOTP
};