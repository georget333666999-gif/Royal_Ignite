import Coupon from "../../models/couponModel.js";

/**
 * Validates a coupon code against current subtotal and user eligibility
 * @param {string} code 
 * @param {string} userId 
 * @param {number} subtotal 
 * @returns {Promise<Object>}
 */
export const validateCoupon = async (code, userId, subtotal) => {
    if (!code || typeof code !== "string" || !code.trim()) {
        const err = new Error("Please enter a coupon code.");
        err.statusCode = 400;
        throw err;
    }

    const cleanCode = code.trim().toUpperCase();
    const coupon = await Coupon.findOne({
        code: cleanCode,
        isDeleted: false
    });

    if (!coupon) {
        const err = new Error("Invalid coupon code.");
        err.statusCode = 404;
        throw err;
    }

    if (!coupon.isActive) {
        const err = new Error("This coupon is currently inactive.");
        err.statusCode = 400;
        throw err;
    }

    const now = new Date();
    if (now > new Date(coupon.expiryDate)) {
        const err = new Error("This coupon has expired.");
        err.statusCode = 400;
        throw err;
    }

    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
        const err = new Error("This coupon has reached its maximum global redemption limit.");
        err.statusCode = 400;
        throw err;
    }

    // Check if user has already used this coupon
    const alreadyUsed = Array.isArray(coupon.usedUsers) && coupon.usedUsers.some(
        (u) => u.userId.toString() === userId.toString()
    );
    if (alreadyUsed) {
        const err = new Error("You have already redeemed this privilege code.");
        err.statusCode = 400;
        throw err;
    }

    const currentSubtotal = Math.max(0, Number(subtotal) || 0);
    if (coupon.minPurchase > 0 && currentSubtotal < coupon.minPurchase) {
        const err = new Error(
            `This coupon requires a minimum acquisition value of ₹${coupon.minPurchase.toLocaleString("en-IN")}.`
        );
        err.statusCode = 400;
        throw err;
    }

    // Calculate discount amount
    let discount;
    if (coupon.discountType === "percentage") {
        discount = Math.round((currentSubtotal * coupon.discountValue) / 100);
        if (coupon.maxDiscount !== null && coupon.maxDiscount > 0) {
            discount = Math.min(discount, coupon.maxDiscount);
        }
    } else {
        discount = Math.round(coupon.discountValue);
    }

    discount = Math.min(discount, currentSubtotal);
    const newTotal = Math.max(0, currentSubtotal - discount);

    return {
        valid: true,
        couponId: coupon._id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount: discount,
        minPurchase: coupon.minPurchase,
        maxDiscount: coupon.maxDiscount,
        newTotal
    };
};

/**
 * Record coupon usage when an order is successfully placed
 */
export const recordCouponUsage = async (couponCode, userId, orderId) => {
    if (!couponCode) return;
    try {
        await Coupon.updateOne(
            { code: couponCode.trim().toUpperCase() },
            {
                $inc: { usedCount: 1 },
                $push: {
                    usedUsers: {
                        userId,
                        orderId,
                        usedAt: new Date()
                    }
                }
            }
        );
    } catch (err) {
        console.error("couponService recordCouponUsage error:", err);
    }
};

/**
 * Restore coupon usage if order is cancelled
 */
export const revertCouponUsage = async (couponCode, userId) => {
    if (!couponCode) return;
    try {
        await Coupon.updateOne(
            { code: couponCode.trim().toUpperCase() },
            {
                $inc: { usedCount: -1 },
                $pull: {
                    usedUsers: { userId }
                }
            }
        );
    } catch (err) {
        console.error("couponService revertCouponUsage error:", err);
    }
};

/**
 * Get active coupons available to the user for reference/selection
 */
export const getAvailableCoupons = async (userId) => {
    try {
        const now = new Date();
        const coupons = await Coupon.find({
            isActive: true,
            isDeleted: false,
            expiryDate: { $gt: now }
        }).lean();

        // Filter out coupons already used by this user
        return coupons.filter(
            (c) =>
                (!c.usageLimit || c.usedCount < c.usageLimit) &&
                (!c.usedUsers || !c.usedUsers.some((u) => u.userId.toString() === userId.toString()))
        );
    } catch (err) {
        console.error("couponService getAvailableCoupons error:", err);
        return [];
    }
};

export default {
    validateCoupon,
    recordCouponUsage,
    revertCouponUsage,
    getAvailableCoupons
};

