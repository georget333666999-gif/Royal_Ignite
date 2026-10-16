import express from "express";
import checkoutController from "../../controllers/user/checkoutController.js";

const router = express.Router();

// Main Checkout Page
router.get("/checkout", checkoutController.getCheckoutPage);
router.get("/cart/checkout", checkoutController.getCheckoutPage);

// Place Order (COD)
router.post("/checkout/place-order", checkoutController.postPlaceOrder);

// Order Confirmation / Success Page
router.get("/checkout/success/:orderId", checkoutController.getOrderSuccessPage);

// Checkout Inline / Modal Address Management
router.post("/checkout/address/add", checkoutController.postAddAddressCheckout);
router.post("/checkout/address/edit/:addressId", checkoutController.postEditAddressCheckout);

export default router;
