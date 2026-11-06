import express from "express";
import cartController from "../../controllers/user/cartController.js";

const router = express.Router();

// Cart / Shopping Bag Routes
router.get("/cart", cartController.getCartPage);
router.get("/cart/count", cartController.getCartCount);
router.post("/cart/add", cartController.postAddToCart);
router.post("/cart/update-quantity", cartController.postUpdateQuantity);
router.post("/cart/remove/:productId", cartController.postRemoveFromCart);
router.get("/cart/checkout", cartController.getCheckout);

export default router;
