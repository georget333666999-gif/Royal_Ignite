import express from "express";
import couponController from "../../controllers/admin/couponController.js";

const router = express.Router();

// Coupon Dossier
router.get("/coupons", couponController.getCouponsPage);

// Coupon Actions
router.post("/coupons/create", couponController.postCreateCoupon);
router.post("/coupons/toggle/:couponId", couponController.postToggleCoupon);
router.post("/coupons/delete/:couponId", couponController.postDeleteCoupon);

export default router;

