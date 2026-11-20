import express from "express";
import couponController from "../../controllers/admin/couponController.js";

const router = express.Router();

// Coupon Dossier
router.get("/coupons", couponController.getCouponsPage);
router.get("/coupons/:couponId", couponController.getCouponById);

// Coupon Actions
router.post("/coupons/create", couponController.postCreateCoupon);
router.put("/coupons/edit/:couponId", couponController.putUpdateCoupon);
router.post("/coupons/edit/:couponId", couponController.putUpdateCoupon);
router.post("/coupons/toggle/:couponId", couponController.postToggleCoupon);
router.post("/coupons/delete/:couponId", couponController.postDeleteCoupon);

export default router;

