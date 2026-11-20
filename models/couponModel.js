import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
    {
        code: {
            type: String,
            required: [true, "Coupon code is required"],
            unique: true,
            uppercase: true,
            trim: true,
            minlength: [3, "Coupon code must be at least 3 characters"],
            maxlength: [20, "Coupon code cannot exceed 20 characters"]
        },
        description: {
            type: String,
            trim: true,
            default: ""
        },
        discountType: {
            type: String,
            enum: ["percentage", "flat"],
            default: "percentage",
            required: true
        },
        discountValue: {
            type: Number,
            required: [true, "Discount value is required"],
            min: [1, "Discount value must be at least 1"],
            validate: {
                validator: function (val) {
                    if (this.discountType === "percentage") {
                        return val <= 100;
                    }
                    return true;
                },
                message: "Percentage discount cannot exceed 100%"
            }
        },
        minPurchase: {
            type: Number,
            default: 0,
            min: [0, "Minimum purchase amount cannot be negative"]
        },
        maxDiscount: {
            type: Number,
            default: null,
            min: [0, "Maximum discount cap cannot be negative"]
        },
        startDate: {
            type: Date,
            default: Date.now
        },
        expiryDate: {
            type: Date,
            required: [true, "Expiry date is required"]
        },
        usageLimit: {
            type: Number,
            default: null, // null means unlimited total uses
            min: [1, "Usage limit must be at least 1"]
        },
        usedCount: {
            type: Number,
            default: 0,
            min: 0
        },
        usedUsers: [
            {
                userId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                    required: true
                },
                orderId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Order",
                    default: null
                },
                usedAt: {
                    type: Date,
                    default: Date.now
                }
            }
        ],
        isActive: {
            type: Boolean,
            default: true
        },
        isDeleted: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
);

couponSchema.index({ code: 1, isDeleted: 1, isActive: 1 });
couponSchema.index({ expiryDate: 1 });

const Coupon = mongoose.model("Coupon", couponSchema);
export default Coupon;

