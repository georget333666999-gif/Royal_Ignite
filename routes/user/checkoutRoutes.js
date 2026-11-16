import express from "express";
import checkoutController from "../../controllers/user/checkoutController.js";

const router = express.Router();

// Main Checkout Page
router.get("/checkout", checkoutController.getCheckoutPage);
router.get("/cart/checkout", checkoutController.getCheckoutPage);

// Buy Now Direct Checkout (Bypasses Cart)
router.post("/checkout/buy-now", checkoutController.postBuyNow);

// Place Order (COD)
router.post("/checkout/place-order", checkoutController.postPlaceOrder);

// Coupon Management
router.post("/checkout/coupon/apply", checkoutController.postApplyCoupon);
router.post("/checkout/coupon/remove", checkoutController.postRemoveCoupon);

// Online Payment Gateway: Razorpay
router.post("/checkout/create-razorpay-order", checkoutController.postCreateRazorpayOrder);
router.post("/checkout/verify-payment", checkoutController.postVerifyPayment);
router.post("/checkout/payment-failed", checkoutController.postPaymentFailed);

// Payment Failure Page & Retry Payment
router.get("/checkout/failure/:orderId", checkoutController.getPaymentFailurePage);
router.post("/checkout/retry-payment/:orderId", checkoutController.postRetryPayment);
router.post("/checkout/verify-retry-payment/:orderId", checkoutController.postVerifyRetryPayment);

// Order Confirmation / Success Page
router.get("/checkout/success/:orderId", checkoutController.getOrderSuccessPage);

// Checkout Inline / Modal Address Management
router.post("/checkout/address/add", checkoutController.postAddAddressCheckout);
router.post("/checkout/address/edit/:addressId", checkoutController.postEditAddressCheckout);

export default router;
