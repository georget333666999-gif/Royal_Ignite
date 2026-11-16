import mongoose from "mongoose";

const walletTransactionSchema = new mongoose.Schema(
    {
        transactionId: {
            type: String,
            required: true,
            default: () => "WTX-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7).toUpperCase()
        },
        type: {
            type: String,
            enum: ["credit", "debit"],
            required: true
        },
        amount: {
            type: Number,
            required: true,
            min: [0.01, "Transaction amount must be greater than zero"]
        },
        balanceAfter: {
            type: Number,
            required: true,
            min: 0
        },
        description: {
            type: String,
            required: true,
            trim: true
        },
        source: {
            type: String,
            enum: [
                "order_cancellation",
                "order_return",
                "item_cancellation",
                "item_return",
                "checkout_payment",
                "admin_adjustment",
                "referral_bonus",
                "referral_reward",
                "wallet_topup"
            ],
            required: true
        },
        orderId: {
            type: String,
            default: null,
            trim: true
        },
        date: {
            type: Date,
            default: Date.now
        }
    },
    { _id: true }
);

const walletSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
            index: true
        },
        balance: {
            type: Number,
            default: 0,
            min: [0, "Wallet balance cannot fall below zero"]
        },
        transactions: [walletTransactionSchema]
    },
    {
        timestamps: true
    }
);

const Wallet = mongoose.model("Wallet", walletSchema);
export default Wallet;

