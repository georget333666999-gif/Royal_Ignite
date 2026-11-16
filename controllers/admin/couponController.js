import couponService from "../../services/admin/couponService.js";
import { HTTP_STATUS } from "../../constants/index.js";

/**
 * Render Admin Coupon Management Dossier
 */
export const getCouponsPage = async (req, res, next) => {
    try {
        const { search = "", status = "all", page = 1, limit = 10 } = req.query;

        const data = await couponService.getCoupons({ search, status, page, limit });

        res.set({
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
            "Surrogate-Control": "no-store"
        });

        return res.status(HTTP_STATUS.OK).render("coupons/couponList", {
            pageTitle: "Privilege Coupons — ROYAL IGNITE Admin",
            coupons: data.coupons,
            totalCoupons: data.totalCoupons,
            totalPages: data.totalPages,
            currentPage: data.currentPage,
            limit: data.limit,
            search: data.search,
            status: data.status,
            stats: data.stats,
            success: req.query.success || null,
            error: req.query.error || null,
            activeNav: "coupons"
        });
    } catch (err) {
        console.error("couponController getCouponsPage error:", err);
        return next(err);
    }
};

/**
 * Create a new coupon
 */
export const postCreateCoupon = async (req, res) => {
    try {
        const newCoupon = await couponService.createCoupon(req.body);

        return res.status(HTTP_STATUS.CREATED).json({
            success: true,
            message: `Privilege coupon "${newCoupon.code}" created successfully.`,
            coupon: newCoupon
        });
    } catch (err) {
        console.error("couponController postCreateCoupon error:", err);
        return res.status(err.statusCode || HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: err.message || "Failed to create coupon."
        });
    }
};

/**
 * Toggle active status of a coupon
 */
export const postToggleCoupon = async (req, res) => {
    try {
        const { couponId } = req.params;
        const coupon = await couponService.toggleCouponStatus(couponId);

        return res.status(HTTP_STATUS.OK).json({
            success: true,
            message: `Coupon "${coupon.code}" is now ${coupon.isActive ? "Active" : "Inactive"}.`,
            isActive: coupon.isActive
        });
    } catch (err) {
        console.error("couponController postToggleCoupon error:", err);
        return res.status(err.statusCode || HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: err.message || "Failed to toggle coupon status."
        });
    }
};

/**
 * Soft delete a coupon
 */
export const postDeleteCoupon = async (req, res) => {
    try {
        const { couponId } = req.params;
        const coupon = await couponService.deleteCoupon(couponId);

        return res.status(HTTP_STATUS.OK).json({
            success: true,
            message: `Coupon "${coupon.code}" was permanently deleted.`
        });
    } catch (err) {
        console.error("couponController postDeleteCoupon error:", err);
        return res.status(err.statusCode || HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: err.message || "Failed to delete coupon."
        });
    }
};

export default {
    getCouponsPage,
    postCreateCoupon,
    postToggleCoupon,
    postDeleteCoupon
};

