import mongoose from "mongoose";
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
    if (coupon.startDate && now < new Date(coupon.startDate)) {
        const err = new Error("This coupon is not yet active.");
        err.statusCode = 400;
        throw err;
    }

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
 * Record coupon usage when an order is successfully placed (atomic conditional update)
 */
export const recordCouponUsage = async (couponCode, userId, orderId) => {
    if (!couponCode) return { success: false, reason: "NO_CODE" };
    try {
        const cleanCode = couponCode.trim().toUpperCase();
        let userObjId = null;
        if (userId && mongoose.Types.ObjectId.isValid(userId)) {
            userObjId = new mongoose.Types.ObjectId(String(userId));
        }

        // Atomic condition: code matches, active, not deleted, user hasn't used it, and (usageLimit is null OR usedCount < usageLimit)
        const updateQuery = {
            code: cleanCode,
            isDeleted: false,
            $or: [
                { usageLimit: null },
                { $expr: { $lt: ["$usedCount", "$usageLimit"] } }
            ]
        };

        if (userObjId) {
            updateQuery["usedUsers.userId"] = { $ne: userObjId };
        }

        const result = await Coupon.updateOne(
            updateQuery,
            {
                $inc: { usedCount: 1 },
                $push: {
                    usedUsers: {
                        userId: userObjId || userId,
                        orderId: orderId || null,
                        usedAt: new Date()
                    }
                }
            }
        );

        if (result.matchedCount === 0) {
            return {
                success: false,
                reason: "USAGE_LIMIT_EXCEEDED_OR_ALREADY_REDEEMED"
            };
        }

        return { success: true };
    } catch (err) {
        console.error("couponService recordCouponUsage error:", err);
        return { success: false, error: err.message };
    }
};

/**
 * Restore coupon usage if order is cancelled
 */
export const revertCouponUsage = async (couponCode, userId) => {
    if (!couponCode) return;
    try {
        const cleanCode = couponCode.trim().toUpperCase();
        let userObjId = null;
        if (userId && mongoose.Types.ObjectId.isValid(userId)) {
            userObjId = new mongoose.Types.ObjectId(String(userId));
        }

        await Coupon.updateOne(
            { code: cleanCode, usedCount: { $gt: 0 } },
            {
                $inc: { usedCount: -1 },
                $pull: {
                    usedUsers: userObjId ? { userId: userObjId } : { userId }
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

