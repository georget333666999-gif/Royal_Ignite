import walletService from "../../services/user/walletService.js";
import { HTTP_STATUS, RESPONSE_MESSAGES } from "../../constants/index.js";
import { requireActiveUser } from "../../utils/controllerHelpers.js";
import { getRazorpayClient, getRazorpayKeyId, verifyRazorpaySignature } from "../../config/razorpay.js";

/**
 * Render the User Digital Wallet Ledger Page
 */
export const getWalletPage = async (req, res, next) => {
    try {
        const auth = await requireActiveUser(req, res, { redirectUrl: "/user/login?redirect=/wallet" });
        if (!auth) return;
        const { userId, user } = auth;

        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const walletData = await walletService.getWalletDetails(userId, { page, limit });

        return res.status(HTTP_STATUS.OK).render("wallet", {
            pageTitle: "My Digital Wallet — ROYAL IGNITE",
            isUserLoggedIn: true,
            user,
            userId,
            wallet: walletData,
            transactions: walletData.transactions,
            currentPage: walletData.currentPage,
            totalPages: walletData.totalPages,
            totalTransactions: walletData.totalTransactions,
            totalCredited: walletData.totalCredited,
            totalDebited: walletData.totalDebited,
            activeNav: "wallet"
        });
    } catch (err) {
        console.error("walletController getWalletPage error:", err);
        return next(err);
    }
};

/**
 * Create a Razorpay Order for Adding Cash to Wallet
 */
export const postCreateAddFundsOrder = async (req, res) => {
    try {
        const auth = await requireActiveUser(req, res, { authMessage: RESPONSE_MESSAGES.AUTH.UNAUTHORIZED });
        if (!auth) return;
        const { userId, user } = auth;

        const { amount } = req.body;
        const parsedAmount = Math.round(Number(amount) * 100) / 100;

        if (isNaN(parsedAmount) || parsedAmount < 10) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: "Please enter a valid amount of at least ₹10."
            });
        }

        if (parsedAmount > 100000) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: "Maximum top-up amount allowed in a single transaction is ₹1,00,000."
            });
        }

        const rzpClient = getRazorpayClient();
        const amountInPaise = Math.round(parsedAmount * 100);
        const receipt = `topup_${Date.now()}_${userId.toString().slice(-4)}`;

        const rzpOrder = await rzpClient.orders.create({
            amount: amountInPaise,
            currency: "INR",
            receipt,
            notes: {
                userId: userId.toString(),
                userEmail: user.email,
                type: "wallet_topup",
                amount: parsedAmount.toString()
            }
        });

        return res.status(HTTP_STATUS.OK).json({
            success: true,
            razorpayOrderId: rzpOrder.id,
            amount: rzpOrder.amount,
            currency: rzpOrder.currency,
            key: getRazorpayKeyId(),
            user: {
                name: user.name || "Royal Client",
                email: user.email || "",
                phone: user.phone || ""
            }
        });
    } catch (err) {
        console.error("walletController postCreateAddFundsOrder error:", err);
        const desc = err?.error?.description || err?.message || "Failed to initialize top-up gateway.";
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: desc
        });
    }
};

/**
 * Verify Razorpay Payment Signature and Credit Wallet
 */
export const postVerifyAddFunds = async (req, res) => {
    try {
        const auth = await requireActiveUser(req, res, { authMessage: RESPONSE_MESSAGES.AUTH.UNAUTHORIZED });
        if (!auth) return;
        const { userId } = auth;

        const { razorpayOrderId, razorpayPaymentId, razorpaySignature, amount } = req.body;

        const isSignatureValid = verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
        if (!isSignatureValid) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: "Payment authentication failed. Funds could not be verified."
            });
        }

        const parsedAmount = Math.round(Number(amount) * 100) / 100;
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: "Invalid top-up amount provided."
            });
        }

        const creditResult = await walletService.creditWallet(userId, {
            amount: parsedAmount,
            description: `Top-up added to wallet via Razorpay (${razorpayPaymentId})`,
            source: "wallet_topup",
            orderId: razorpayPaymentId
        });

        return res.status(HTTP_STATUS.OK).json({
            success: true,
            message: `₹${parsedAmount.toLocaleString("en-IN")} credited to your wallet successfully!`,
            balance: creditResult.balance
        });
    } catch (err) {
        console.error("walletController postVerifyAddFunds error:", err);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: err.message || "An error occurred while crediting funds to your wallet."
        });
    }
};

export default {
    getWalletPage,
    postCreateAddFundsOrder,
    postVerifyAddFunds
};
