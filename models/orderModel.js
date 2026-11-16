import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
    {
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        image: {
            type: String,
            default: "/uploads/hero_lighter.png"
        },
        categoryName: {
            type: String,
            default: "Royal Ignite Edition"
        },
        price: {
            type: Number,
            required: true,
            min: 0
        },
        regularPrice: {
            type: Number,
            default: 0
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        lineTotal: {
            type: Number,
            required: true,
            min: 0
        },
        status: {
            type: String,
            enum: ["Pending", "Placed", "Processing", "Shipped", "Out for Delivery", "Delivered", "Cancelled", "Returned", "Return Requested", "Return Rejected"],
            default: "Placed"
        },
        cancelReason: {
            type: String,
            default: null
        },
        cancelledAt: {
            type: Date,
            default: null
        },
        returnReason: {
            type: String,
            default: null
        },
        returnRequestedAt: {
            type: Date,
            default: null
        },
        returnedAt: {
            type: Date,
            default: null
        },
        returnRejectReason: {
            type: String,
            default: null
        },
        returnRejectedAt: {
            type: Date,
            default: null
        }
    },
    { _id: true }
);

const orderSchema = new mongoose.Schema(
    {
        orderId: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        items: [orderItemSchema],
        shippingAddress: {
            fullName: { type: String, required: true, trim: true },
            phone: { type: String, required: true, trim: true },
            addressLine: { type: String, required: true, trim: true },
            city: { type: String, required: true, trim: true },
            state: { type: String, required: true, trim: true },
            pincode: { type: String, required: true, trim: true },
            country: { type: String, default: "India", trim: true },
            addressType: { type: String, default: "Home" }
        },
        paymentMethod: {
            type: String,
            enum: ["COD", "Razorpay", "Wallet"],
            default: "COD",
            required: true
        },
        paymentStatus: {
            type: String,
            enum: ["Pending", "Completed", "Failed", "Refunded"],
            default: "Pending"
        },
        razorpayOrderId: {
            type: String,
            default: null
        },
        razorpayPaymentId: {
            type: String,
            default: null
        },
        razorpaySignature: {
            type: String,
            default: null
        },
        coupon: {
            code: {
                type: String,
                default: null
            },
            discountAmount: {
                type: Number,
                default: 0,
                min: 0
            }
        },
        pricing: {
            subtotal: { type: Number, required: true, min: 0 },
            discount: { type: Number, default: 0, min: 0 },
            couponDiscount: { type: Number, default: 0, min: 0 },
            tax: { type: Number, default: 0, min: 0 },
            shippingFee: { type: Number, default: 0, min: 0 },
            totalAmount: { type: Number, required: true, min: 0 }
        },
        orderStatus: {
            type: String,
            enum: ["Pending", "Placed", "Processing", "Shipped", "Out for Delivery", "Delivered", "Cancelled", "Returned", "Return Requested", "Return Rejected"],
            default: "Placed",
            index: true
        },
        cancellationReason: {
            type: String,
            default: null
        },
        cancelledAt: {
            type: Date,
            default: null
        },
        returnReason: {
            type: String,
            default: null
        },
        returnRequestedAt: {
            type: Date,
            default: null
        },
        returnedAt: {
            type: Date,
            default: null
        },
        returnRejectReason: {
            type: String,
            default: null
        },
        returnRejectedAt: {
            type: Date,
            default: null
        },
        deliveredAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

/**
 * Generate unique human-readable Order Identifier (e.g. RYL-20261013-8472)
 */
orderSchema.statics.generateOrderId = function () {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    return `RYL-${year}${month}${day}-${randomPart}`;
};

const Order = mongoose.model("Order", orderSchema);
export default Order;
