import express from "express";
import walletController from "../../controllers/user/walletController.js";
import { userMiddleware } from "../../middleware/userMiddleware.js";

const router = express.Router();

// Wallet Ledger Routes
router.get("/wallet", userMiddleware, walletController.getWalletPage);
router.get("/user/wallet", userMiddleware, walletController.getWalletPage);

// Add Cash to Wallet via Razorpay
router.post(
    "/wallet/add-funds/create-order",
    userMiddleware,
    walletController.postCreateAddFundsOrder
);
router.post(
    "/wallet/add-funds/verify",
    userMiddleware,
    walletController.postVerifyAddFunds
);

export default router;

