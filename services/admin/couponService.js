import mongoose from "mongoose";
import Coupon from "../../models/couponModel.js";
import { escapeRegex, sanitizeSearchQuery } from "../../utils/searchValidation.js";

const buildHttpError = (message, statusCode = 400) => {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
};

/**
 * Shared validation for coupon creation and updates
 */
const validateCouponPayload = async (data, { excludeCouponId = null, existingUsedCount = 0 } = {}) => {
    const {
        code,
        description = "",
        discountType = "percentage",
        discountValue,
        minPurchase = 0,
        maxDiscount,
        expiryDate,
        usageLimit
    } = data;

    // 1. Code Validation
    if (!code || !code.trim()) {
        throw buildHttpError("Coupon code is required.", 400);
    }

    const cleanCode = code.trim().toUpperCase();
    if (cleanCode.length < 3 || cleanCode.length > 20) {
        throw buildHttpError("Coupon code must be between 3 and 20 characters.", 400);
    }

    if (!/^[A-Z0-9_-]+$/.test(cleanCode)) {
        throw buildHttpError("Coupon code can only contain letters, numbers, hyphens, and underscores.", 400);
    }

    const uniquenessQuery = { code: cleanCode };
    if (excludeCouponId) {
        uniquenessQuery._id = { $ne: excludeCouponId };
    }
    const existingCoupon = await Coupon.findOne(uniquenessQuery);
    if (existingCoupon) {
        throw buildHttpError(`A coupon with code "${cleanCode}" already exists.`, 400);
    }

    // 2. Discount Type & Value Validation
    if (!["percentage", "flat"].includes(discountType)) {
        throw buildHttpError("Discount type must be either 'percentage' or 'flat'.", 400);
    }

    const numVal = Number(discountValue);
    if (isNaN(numVal) || numVal <= 0) {
        throw buildHttpError("Discount value must be a positive number greater than 0.", 400);
    }

    if (discountType === "percentage" && (numVal < 1 || numVal > 90)) {
        throw buildHttpError("Percentage discount must be between 1% and 90%.", 400);
    }

    // 3. Minimum Purchase Validation
    const numMin = Number(minPurchase) || 0;
    if (numMin < 0) {
        throw buildHttpError("Minimum acquisition value cannot be negative.", 400);
    }

    if (discountType === "flat" && numMin > 0 && numVal >= numMin) {
        throw buildHttpError(`Minimum purchase (₹${numMin}) must be strictly greater than flat discount (₹${numVal}).`, 400);
    }

    // 4. Maximum Discount Cap (for percentage coupons)
    let numMaxDiscount = null;
    if (discountType === "percentage" && maxDiscount !== undefined && maxDiscount !== null && maxDiscount !== "") {
        numMaxDiscount = Number(maxDiscount);
        if (isNaN(numMaxDiscount) || numMaxDiscount <= 0) {
            throw buildHttpError("Maximum discount cap must be a positive number.", 400);
        }
    }

    // 5. Expiry Date Validation
    if (!expiryDate) {
        throw buildHttpError("Expiry date is required.", 400);
    }

    let exp;
    if (typeof expiryDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(expiryDate.trim())) {
        // End of day in IST (+05:30)
        exp = new Date(`${expiryDate.trim()}T23:59:59.999+05:30`);
    } else {
        exp = new Date(expiryDate);
    }

    if (isNaN(exp.getTime())) {
        throw buildHttpError("Please provide a valid expiry date.", 400);
    }

    if (exp <= new Date()) {
        throw buildHttpError("Expiry date must be in the future.", 400);
    }

    // 6. Usage Limit Validation
    let numUsageLimit = null;
    if (usageLimit !== undefined && usageLimit !== null && usageLimit !== "") {
        numUsageLimit = parseInt(usageLimit, 10);
        if (isNaN(numUsageLimit) || numUsageLimit < 1 || String(numUsageLimit) !== String(usageLimit).trim()) {
            throw buildHttpError("Usage limit must be a positive whole number (at least 1).", 400);
        }
        if (existingUsedCount > 0 && numUsageLimit < existingUsedCount) {
            throw buildHttpError(`Usage limit (${numUsageLimit}) cannot be less than current redemptions (${existingUsedCount}).`, 400);
        }
    }

    // 7. Description Validation
    const cleanDescription = typeof description === "string" ? description.trim() : "";
    if (cleanDescription.length > 200) {
        throw buildHttpError("Description cannot exceed 200 characters.", 400);
    }

    return {
        code: cleanCode,
        description: cleanDescription,
        discountType,
        discountValue: numVal,
        minPurchase: numMin,
        maxDiscount: numMaxDiscount,
        expiryDate: exp,
        usageLimit: numUsageLimit
    };
};

/**
 * Fetch paginated coupons with search & status filters
 * @param {Object} options
 * @param {string} [options.search=""]
 * @param {string} [options.status="all"]
 * @param {number} [options.page=1]
 * @param {number} [options.limit=10]
 * @returns {Promise<Object>}
 */
export const getCoupons = async ({ search = "", status = "all", page = 1, limit = 10 } = {}) => {
    try {
        const query = { isDeleted: false };
        const now = new Date();

        // Status Filter
        if (status === "active") {
            query.isActive = true;
            query.expiryDate = { $gte: now };
        } else if (status === "expired") {
            query.expiryDate = { $lt: now };
        } else if (status === "inactive") {
            query.isActive = false;
        }

        // Search Filter (validated & regex-escaped)
        const { value: cleanSearch, error: searchError } = sanitizeSearchQuery(search);
        if (cleanSearch) {
            const safeSearch = escapeRegex(cleanSearch);
            query.$or = [
                { code: { $regex: safeSearch, $options: "i" } },
                { description: { $regex: safeSearch, $options: "i" } }
            ];
        }

        const currentPage = Math.max(1, parseInt(page, 10) || 1);
        const pageSize = Math.max(1, parseInt(limit, 10) || 10);
        const skip = (currentPage - 1) * pageSize;

        const [coupons, totalCoupons, allNonDeleted] = await Promise.all([
            Coupon.find(query).sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean(),
            Coupon.countDocuments(query),
            Coupon.find({ isDeleted: false }).select("isActive expiryDate").lean()
        ]);

        const totalPages = Math.ceil(totalCoupons / pageSize) || 1;

        // High-level aggregate metrics for admin header cards
        const activeCount = allNonDeleted.filter((c) => c.isActive && new Date(c.expiryDate) >= now).length;
        const expiredCount = allNonDeleted.filter((c) => new Date(c.expiryDate) < now).length;
        const inactiveCount = allNonDeleted.filter((c) => !c.isActive).length;

        return {
            coupons,
            totalCoupons,
            totalPages,
            currentPage,
            limit: pageSize,
            search: cleanSearch,
            searchError,
            status: typeof status === "string" ? status.trim() : "all",
            stats: {
                totalCount: allNonDeleted.length,
                activeCount,
                expiredCount,
                inactiveCount
            }
        };
    } catch (error) {
        console.error("admin couponService getCoupons error:", error);
        throw error;
    }
};

/**
 * Fetch a single non-deleted coupon by ID for editing
 * @param {string} couponId
 * @returns {Promise<Object>}
 */
export const getCouponById = async (couponId) => {
    try {
        if (!couponId || !mongoose.Types.ObjectId.isValid(couponId)) {
            throw buildHttpError("Invalid coupon identifier.", 400);
        }

        const coupon = await Coupon.findOne({ _id: couponId, isDeleted: false }).lean();
        if (!coupon) {
            throw buildHttpError("Coupon not found.", 404);
        }

        return coupon;
    } catch (error) {
        console.error("admin couponService getCouponById error:", error);
        throw error;
    }
};

/**
 * Validate and create a new coupon
 * @param {Object} data
 * @returns {Promise<Object>}
 */
export const createCoupon = async (data) => {
    try {
        const validated = await validateCouponPayload(data);

        const newCoupon = await Coupon.create({
            ...validated,
            isActive: true
        });

        return newCoupon;
    } catch (error) {
        console.error("admin couponService createCoupon error:", error);
        throw error;
    }
};

/**
 * Validate and update an existing coupon
 * @param {string} couponId
 * @param {Object} data
 * @returns {Promise<Object>}
 */
export const updateCoupon = async (couponId, data) => {
    try {
        if (!couponId || !mongoose.Types.ObjectId.isValid(couponId)) {
            throw buildHttpError("Invalid coupon identifier.", 400);
        }

        const coupon = await Coupon.findOne({ _id: couponId, isDeleted: false });
        if (!coupon) {
            throw buildHttpError("Coupon not found.", 404);
        }

        const validated = await validateCouponPayload(data, {
            excludeCouponId: coupon._id,
            existingUsedCount: coupon.usedCount || 0
        });

        coupon.code = validated.code;
        coupon.description = validated.description;
        coupon.discountType = validated.discountType;
        coupon.discountValue = validated.discountValue;
        coupon.minPurchase = validated.minPurchase;
        coupon.maxDiscount = validated.maxDiscount;
        coupon.expiryDate = validated.expiryDate;
        coupon.usageLimit = validated.usageLimit;

        await coupon.save();

        return coupon;
    } catch (error) {
        console.error("admin couponService updateCoupon error:", error);
        throw error;
    }
};

/**
 * Soft delete a coupon
 * @param {string} couponId
 * @returns {Promise<Object>}
 */
export const deleteCoupon = async (couponId) => {
    try {
        const coupon = await Coupon.findOne({ _id: couponId, isDeleted: false });
        if (!coupon) {
            const err = new Error("Coupon not found.");
            err.statusCode = 404;
            throw err;
        }

        coupon.isDeleted = true;
        await coupon.save();

        return coupon;
    } catch (error) {
        console.error("admin couponService deleteCoupon error:", error);
        throw error;
    }
};

/**
 * Toggle active status of a coupon
 * @param {string} couponId
 * @returns {Promise<Object>}
 */
export const toggleCouponStatus = async (couponId) => {
    try {
        const coupon = await Coupon.findOne({ _id: couponId, isDeleted: false });
        if (!coupon) {
            const err = new Error("Coupon not found.");
            err.statusCode = 404;
            throw err;
        }

        coupon.isActive = !coupon.isActive;
        await coupon.save();

        return coupon;
    } catch (error) {
        console.error("admin couponService toggleCouponStatus error:", error);
        throw error;
    }
};

export default {
    getCoupons,
    getCouponById,
    createCoupon,
    updateCoupon,
    deleteCoupon,
    toggleCouponStatus
};

