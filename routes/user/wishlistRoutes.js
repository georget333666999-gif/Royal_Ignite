import express from "express";
import wishlistController from "../../controllers/user/wishlistController.js";

const router = express.Router();

// Wishlist Page & Actions
router.get("/wishlist", wishlistController.getWishlistPage);
router.post("/wishlist/toggle", wishlistController.toggleWishlist);
router.post("/wishlist/remove/:productId", wishlistController.removeFromWishlist);
router.post("/wishlist/move-to-cart/:productId", wishlistController.moveToCart);
router.get("/wishlist/count", wishlistController.getWishlistCount);

export default router;
