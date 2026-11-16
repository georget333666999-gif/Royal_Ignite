import Coupon from "../../models/couponModel.js";

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

        // Search Filter
        if (search && search.trim() !== "") {
            const cleanSearch = search.trim();
            query.$or = [
                { code: { $regex: cleanSearch, $options: "i" } },
                { description: { $regex: cleanSearch, $options: "i" } }
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
            search: search.trim(),
            status: status.trim(),
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
 * Validate and create a new coupon
 * @param {Object} data
 * @returns {Promise<Object>}
 */
export const createCoupon = async (data) => {
    try {
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
            const err = new Error("Coupon code is required.");
            err.statusCode = 400;
            throw err;
        }

        const cleanCode = code.trim().toUpperCase();
        if (cleanCode.length < 3 || cleanCode.length > 20) {
            const err = new Error("Coupon code must be between 3 and 20 characters.");
            err.statusCode = 400;
            throw err;
        }

        if (!/^[A-Z0-9_-]+$/.test(cleanCode)) {
            const err = new Error("Coupon code can only contain letters, numbers, hyphens, and underscores.");
            err.statusCode = 400;
            throw err;
        }

        // Check uniqueness among non-deleted coupons
        const existingCoupon = await Coupon.findOne({ code: cleanCode, isDeleted: false });
        if (existingCoupon) {
            const err = new Error(`A coupon with code "${cleanCode}" already exists.`);
            err.statusCode = 400;
            throw err;
        }

        // 2. Discount Type & Value Validation
        if (!["percentage", "flat"].includes(discountType)) {
            const err = new Error("Discount type must be either 'percentage' or 'flat'.");
            err.statusCode = 400;
            throw err;
        }

        const numVal = Number(discountValue);
        if (isNaN(numVal) || numVal <= 0) {
            const err = new Error("Discount value must be a positive number greater than 0.");
            err.statusCode = 400;
            throw err;
        }

        if (discountType === "percentage" && (numVal < 1 || numVal > 90)) {
            const err = new Error("Percentage discount must be between 1% and 90%.");
            err.statusCode = 400;
            throw err;
        }

        // 3. Minimum Purchase Validation
        const numMin = Number(minPurchase) || 0;
        if (numMin < 0) {
            const err = new Error("Minimum acquisition value cannot be negative.");
            err.statusCode = 400;
            throw err;
        }

        if (discountType === "flat" && numMin > 0 && numVal >= numMin) {
            const err = new Error(`Minimum purchase (₹${numMin}) must be strictly greater than flat discount (₹${numVal}).`);
            err.statusCode = 400;
            throw err;
        }

        // 4. Maximum Discount Cap (for percentage coupons)
        let numMaxDiscount = null;
        if (discountType === "percentage" && maxDiscount !== undefined && maxDiscount !== null && maxDiscount !== "") {
            numMaxDiscount = Number(maxDiscount);
            if (isNaN(numMaxDiscount) || numMaxDiscount <= 0) {
                const err = new Error("Maximum discount cap must be a positive number.");
                err.statusCode = 400;
                throw err;
            }
        }

        // 5. Expiry Date Validation
        if (!expiryDate) {
            const err = new Error("Expiry date is required.");
            err.statusCode = 400;
            throw err;
        }

        const exp = new Date(expiryDate);
        if (isNaN(exp.getTime())) {
            const err = new Error("Please provide a valid expiry date.");
            err.statusCode = 400;
            throw err;
        }

        const now = new Date();
        if (exp <= now) {
            const err = new Error("Expiry date must be in the future.");
            err.statusCode = 400;
            throw err;
        }

        // 6. Usage Limit Validation
        let numUsageLimit = null;
        if (usageLimit !== undefined && usageLimit !== null && usageLimit !== "") {
            numUsageLimit = parseInt(usageLimit, 10);
            if (isNaN(numUsageLimit) || numUsageLimit < 1) {
                const err = new Error("Usage limit must be at least 1.");
                err.statusCode = 400;
                throw err;
            }
        }

        const newCoupon = await Coupon.create({
            code: cleanCode,
            description: description.trim(),
            discountType,
            discountValue: numVal,
            minPurchase: numMin,
            maxDiscount: numMaxDiscount,
            expiryDate: exp,
            usageLimit: numUsageLimit,
            isActive: true
        });

        return newCoupon;
    } catch (error) {
        console.error("admin couponService createCoupon error:", error);
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
    createCoupon,
    deleteCoupon,
    toggleCouponStatus
};

