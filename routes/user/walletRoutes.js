import express from "express";
import walletController from "../../controllers/user/walletController.js";
import { userMiddleware } from "../../middleware/userMiddleware.js";

const router = express.Router();

router.use(userMiddleware);

// Wallet Ledger Routes
router.get("/wallet", walletController.getWalletPage);
router.get("/user/wallet", walletController.getWalletPage);

// Add Cash to Wallet via Razorpay
router.post("/wallet/add-funds/create-order", walletController.postCreateAddFundsOrder);
router.post("/wallet/add-funds/verify", walletController.postVerifyAddFunds);

export default router;

