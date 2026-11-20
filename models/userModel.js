import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        password: {
            type: String,
            required: true
        },
        referralCode: {
            type: String,
            trim: true,
            unique: true,
            sparse: true
        },
        referredBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },
        referralRewardsEarned: {
            type: Number,
            default: 0
        },
        referralRewarded: {
            type: Boolean,
            default: false
        },
        imgUrl: {
            type: String
        },
        isBlocked: {
            type: Boolean,
            default: false
        },
        phone: {
            type: String,
            trim: true
        },
        isAdmin: {
            type: Boolean,
            default: false
        },
        isVerified: {
            type: Boolean,
            default: false
        },
        googleId: {
            type: String,
            sparse: true
        }
    },
    {
        timestamps: true
    }
);

userSchema.index({ isAdmin: 1, createdAt: -1 });

const User = mongoose.model("User", userSchema);
export default User;