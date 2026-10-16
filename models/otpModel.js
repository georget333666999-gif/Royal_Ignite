import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        otpCode: {
            type: String,
            required: true
        },
        purpose: {
            type: String
        },
        expiredAt: {
            type: Date,
            required: true,
            index: {
                expires: 0
            }
        },
        isUsed: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
);

const OTP = mongoose.model("OTP", otpSchema);
export default OTP;