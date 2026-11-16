import mongoose from "mongoose";

const offerSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Offer title is required"],
            trim: true,
            minlength: [2, "Offer title must be at least 2 characters"],
            maxlength: [100, "Offer title cannot exceed 100 characters"]
        },
        offerType: {
            type: String,
            enum: ["product", "category", "referral"],
            required: [true, "Offer type is required"]
        },
        description: {
            type: String,
            trim: true,
            default: ""
        },
        discountType: {
            type: String,
            enum: ["percentage", "flat"],
            default: "percentage"
        },
        discountValue: {
            type: Number,
            default: 0,
            min: [0, "Discount value cannot be negative"]
        },
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            default: null
        },
        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
            default: null
        },
        referrerReward: {
            type: Number,
            default: 0,
            min: [0, "Referrer reward cannot be negative"]
        },
        refereeReward: {
            type: Number,
            default: 0,
            min: [0, "Referee reward cannot be negative"]
        },
        minOrderAmount: {
            type: Number,
            default: 0,
            min: [0, "Minimum acquisition threshold cannot be negative"]
        },
        startDate: {
            type: Date,
            default: Date.now
        },
        endDate: {
            type: Date,
            required: [true, "Offer end date is required"]
        },
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

offerSchema.index({ offerType: 1, isActive: 1, isDeleted: 1 });
offerSchema.index({ product: 1 });
offerSchema.index({ category: 1 });
offerSchema.index({ endDate: 1 });

const Offer = mongoose.model("Offer", offerSchema);
export default Offer;

