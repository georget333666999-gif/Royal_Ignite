import Order from "../../models/orderModel.js";
import Product from "../../models/productModel.js";
import couponService from "./couponService.js";
import walletService from "./walletService.js";
import userService from "./userService.js";
import { RESPONSE_MESSAGES } from "../../constants/index.js";
import { escapeRegex, sanitizeSearchQuery } from "../../utils/searchValidation.js";
import { renderInvoicePDF } from "../../utils/invoicePdf.js";

/**
 * Get paginated and filtered user orders
 * @param {string} userId
 * @param {Object} options
 * @param {string} [options.search=""]
 * @param {string} [options.status=""]
 * @param {number} [options.page=1]
 * @param {number} [options.limit=8]
 * @returns {Promise<Object>}
 */
export const getUserOrders = async (
    userId,
    { search = "", status = "", page = 1, limit = 8 } = {}
) => {
    try {
        const query = { user: userId };

        // Status filter
        if (status && status !== "all") {
            query.orderStatus = status;
        }

        // Search by orderId or product name (validated & regex-escaped)
        const { value: cleanSearch, error: searchError } = sanitizeSearchQuery(search);
        if (cleanSearch) {
            const safeSearch = escapeRegex(cleanSearch);
            query.$or = [
                { orderId: { $regex: safeSearch, $options: "i" } },
                { "items.name": { $regex: safeSearch, $options: "i" } }
            ];
        }

        const currentPage = Math.max(1, parseInt(page, 10) || 1);
        const pageSize = Math.max(1, parseInt(limit, 10) || 8);
        const skip = (currentPage - 1) * pageSize;

        const [orders, totalOrders] = await Promise.all([
            Order.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(pageSize)
                .lean(),
            Order.countDocuments(query)
        ]);

        const totalPages = Math.ceil(totalOrders / pageSize) || 1;

        return {
            orders,
            totalOrders,
            totalPages,
            currentPage,
            limit: pageSize,
            search: cleanSearch,
            searchError,
            status: typeof status === "string" ? status.trim() : "all"
        };
    } catch (error) {
        console.error("orderService getUserOrders error:", error);
        throw error;
    }
};

/**
 * Get detailed order by custom orderId or MongoDB ObjectId
 * @param {string} orderIdentifier
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
export const getOrderDetails = async (orderIdentifier, userId) => {
    try {
        const query = {
            user: userId,
            $or: [{ orderId: orderIdentifier }]
        };

        if (orderIdentifier.match(/^[0-9a-fA-F]{24}$/)) {
            query.$or.push({ _id: orderIdentifier });
        }

        const order = await Order.findOne(query).populate("items.product");
        return order;
    } catch (error) {
        console.error("orderService getOrderDetails error:", error);
        throw error;
    }
};

/**
 * Cancel entire order
 * Increments inventory for all cancelled items
 * @param {string} orderIdentifier
 * @param {string} userId
 * @param {string} [reason=""]
 * @returns {Promise<Object>}
 */
export const cancelOrder = async (orderIdentifier, userId, reason = "") => {
    try {
        const order = await getOrderDetails(orderIdentifier, userId);
        if (!order) {
            const err = new Error(RESPONSE_MESSAGES.ORDER.NOT_FOUND);
            err.code = "ORDER_NOT_FOUND";
            throw err;
        }

        // Only Placed, Processing, or Pending orders can be cancelled
        if (!["Placed", "Processing", "Pending"].includes(order.orderStatus)) {
            const err = new Error(RESPONSE_MESSAGES.ORDER.CANNOT_CANCEL);
            err.code = "CANNOT_CANCEL";
            throw err;
        }

        // 1. Stock Increment for all active items
        for (const item of order.items) {
            if (item.status !== "Cancelled") {
                await Product.updateOne(
                    { _id: item.product },
                    { $inc: { stock: item.quantity } }
                );
                item.status = "Cancelled";
                item.cancelReason = reason.trim() || "Order cancelled by client";
                item.cancelledAt = new Date();
            }
        }

        // 2. Direct Refund to Wallet for prepaid orders (Razorpay or Wallet)
        const refundAmount = order.pricing?.totalAmount || 0;
        if (order.paymentStatus === "Completed" && refundAmount > 0) {
            await walletService.creditWallet(userId, {
                amount: refundAmount,
                description: `Direct refund for cancellation of order #${order.orderId}`,
                source: "order_cancellation",
                orderId: order.orderId
            });
            order.paymentStatus = "Refunded";
        }

        // 3. Update overall order status
        order.orderStatus = "Cancelled";
        order.cancellationReason = reason.trim() || "Order cancelled by client";
        order.cancelledAt = new Date();
        order.pricing.totalAmount = 0;

        await order.save();

        // 4. Revert coupon usage if applied
        if (order.coupon && order.coupon.code) {
            await couponService.revertCouponUsage(order.coupon.code, order.user);
        }
        if (order.unlockedReferralBonus?.referrerId && !order.unlockedReferralBonus.isRevoked) {
            await userService.revokeReferralRewardOnOrderSettlement(order);
        }

        return {
            success: true,
            order,
            message: RESPONSE_MESSAGES.ORDER.CANCEL_SUCCESS
        };
    } catch (error) {
        console.error("orderService cancelOrder error:", error);
        throw error;
    }
};

/**
 * Cancel single product within an order
 * Increments stock specifically for that piece
 * @param {string} orderIdentifier
 * @param {string} itemId
 * @param {string} userId
 * @param {string} [reason=""]
 * @returns {Promise<Object>}
 */
export const cancelOrderItem = async (orderIdentifier, itemId, userId, reason = "") => {
    try {
        const order = await getOrderDetails(orderIdentifier, userId);
        if (!order) {
            const err = new Error(RESPONSE_MESSAGES.ORDER.NOT_FOUND);
            err.code = "ORDER_NOT_FOUND";
            throw err;
        }

        if (!["Placed", "Processing", "Pending"].includes(order.orderStatus)) {
            const err = new Error(RESPONSE_MESSAGES.ORDER.CANNOT_CANCEL);
            err.code = "CANNOT_CANCEL";
            throw err;
        }

        const item = order.items.id(itemId) || order.items.find((i) => String(i._id) === String(itemId));
        if (!item) {
            const err = new Error("Item could not be found in this order.");
            err.code = "ITEM_NOT_FOUND";
            throw err;
        }

        if (item.status === "Cancelled") {
            const err = new Error("This item has already been cancelled.");
            err.code = "ALREADY_CANCELLED";
            throw err;
        }

        // 1. Increment product inventory
        await Product.updateOne(
            { _id: item.product },
            { $inc: { stock: item.quantity } }
        );

        // 2. Mark item as cancelled
        item.status = "Cancelled";
        item.cancelReason = reason.trim() || "Item cancelled by customer";
        item.cancelledAt = new Date();

        // 3. Direct Refund to Wallet if piece was prepaid (refund net payable amount after discount share)
        const itemRefundAmount = (typeof item.netRefundableAmount === "number" && item.netRefundableAmount >= 0)
            ? item.netRefundableAmount
            : Math.max(0, item.lineTotal - (item.discountShare || 0));

        if (order.paymentStatus === "Completed" && itemRefundAmount > 0) {
            await walletService.creditWallet(userId, {
                amount: itemRefundAmount,
                description: `Direct refund for cancellation of "${item.name}" from order #${order.orderId}`,
                source: "item_cancellation",
                orderId: order.orderId
            });
        }

        // 4. Check if all items in the order are now cancelled
        const allCancelled = order.items.every((i) => i.status === "Cancelled");
        if (allCancelled) {
            order.orderStatus = "Cancelled";
            order.cancellationReason = reason.trim() || "All items cancelled by customer";
            order.cancelledAt = new Date();
            order.pricing.totalAmount = 0;
            if (order.paymentStatus === "Completed") {
                order.paymentStatus = "Refunded";
            }
            if (order.coupon && order.coupon.code) {
                await couponService.revertCouponUsage(order.coupon.code, order.user);
            }
            if (order.unlockedReferralBonus?.referrerId && !order.unlockedReferralBonus.isRevoked) {
                await userService.revokeReferralRewardOnOrderSettlement(order);
            }
        } else {
            // Adjust total payable for remaining active items using their net payable amounts
            const activeTotal = order.items
                .filter((i) => i.status !== "Cancelled")
                .reduce((acc, i) => {
                    const itemNet = (typeof i.netRefundableAmount === "number" && i.netRefundableAmount >= 0)
                        ? i.netRefundableAmount
                        : Math.max(0, i.lineTotal - (i.discountShare || 0));
                    return acc + itemNet;
                }, 0);
            order.pricing.totalAmount = activeTotal;
        }

        await order.save();

        return {
            success: true,
            order,
            message: RESPONSE_MESSAGES.ORDER.CANCEL_ITEM_SUCCESS
        };
    } catch (error) {
        console.error("orderService cancelOrderItem error:", error);
        throw error;
    }
};

export const MAX_RETURN_ATTEMPTS = 3;

/**
 * Return an order (initial return or re-return request after rejection)
 * Mandatory reason required
 * @param {string} orderIdentifier
 * @param {string} userId
 * @param {string} reason
 * @param {Object} [options={}]
 * @param {boolean} [options.isReReturn=false]
 * @returns {Promise<Object>}
 */
export const returnOrder = async (orderIdentifier, userId, reason, { isReReturn = false } = {}) => {
    try {
        if (!reason || reason.trim() === "") {
            const err = new Error(RESPONSE_MESSAGES.ORDER.RETURN_REASON_REQUIRED);
            err.code = "REASON_REQUIRED";
            throw err;
        }

        const order = await getOrderDetails(orderIdentifier, userId);
        if (!order) {
            const err = new Error(RESPONSE_MESSAGES.ORDER.NOT_FOUND);
            err.code = "ORDER_NOT_FOUND";
            throw err;
        }

        const isDeliveredOrder = order.deliveredAt || ["Delivered", "Return Requested", "Return Rejected", "Returned"].includes(order.orderStatus);
        const deliveredItems = order.items.filter(
            (i) => i.status === "Delivered" || (order.orderStatus === "Delivered" && i.status === "Placed")
        );
        const rejectedItems = order.items.filter((i) => i.status === "Return Rejected");

        const targetReReturn = isReReturn || (deliveredItems.length === 0 && rejectedItems.length > 0);
        let returnableItems = deliveredItems;

        if (targetReReturn) {
            const eligibleRejected = rejectedItems.filter(
                (i) => Math.max(1, i.returnRequestCount || 0) < MAX_RETURN_ATTEMPTS
            );
            if (rejectedItems.length > 0 && eligibleRejected.length === 0) {
                const err = new Error(
                    `Maximum return request attempts (${MAX_RETURN_ATTEMPTS}) have already been reached for this order.`
                );
                err.code = "MAX_RETURN_ATTEMPTS_REACHED";
                throw err;
            }
            returnableItems = eligibleRejected;
        }

        if (!isDeliveredOrder || returnableItems.length === 0) {
            const err = new Error("Return requests can only be submitted for delivered or eligible return-rejected items.");
            err.code = "CANNOT_RETURN";
            throw err;
        }

        const cleanReason = reason.trim();
        const now = new Date();
        let maxAttemptCount = order.returnRequestCount || 0;

        if (targetReReturn && order.returnRejectReason) {
            order.previousReturnRejectReason = order.returnRejectReason;
        }

        for (const item of returnableItems) {
            const wasRejected = item.status === "Return Rejected";
            if (wasRejected && item.returnRejectReason) {
                item.previousReturnRejectReason = item.returnRejectReason;
            }
            const nextCount = wasRejected
                ? Math.max(1, item.returnRequestCount || 0) + 1
                : (item.returnRequestCount || 0) + 1;

            item.status = "Return Requested";
            item.returnReason = cleanReason;
            item.returnRequestedAt = now;
            item.returnRejectReason = null;
            item.returnRejectedAt = null;
            item.returnRequestCount = nextCount;
            if (nextCount > maxAttemptCount) {
                maxAttemptCount = nextCount;
            }
        }

        order.orderStatus = "Return Requested";
        order.returnReason = cleanReason;
        order.returnRequestedAt = now;
        order.returnRejectReason = null;
        order.returnRejectedAt = null;
        order.returnRequestCount = maxAttemptCount;

        // Note: Inventory is NOT re-stocked now. It will only be re-stocked once the admin approves the return.
        await order.save();

        return {
            success: true,
            order,
            isReReturn: targetReReturn,
            message: targetReReturn
                ? "Return request re-submitted successfully. Our atelier concierge will re-evaluate your request."
                : (RESPONSE_MESSAGES.ORDER.RETURN_REQUESTED || "Return request submitted successfully. We will notify you once approved.")
        };
    } catch (error) {
        console.error("orderService returnOrder error:", error);
        throw error;
    }
};

/**
 * Request return (or re-return after rejection) for a single delivered product within an order
 * @param {string} orderIdentifier
 * @param {string} itemId
 * @param {string} userId
 * @param {string} reason
 * @returns {Promise<Object>}
 */
export const returnOrderItem = async (orderIdentifier, itemId, userId, reason) => {
    try {
        if (!reason || reason.trim() === "") {
            const err = new Error(RESPONSE_MESSAGES.ORDER.RETURN_REASON_REQUIRED);
            err.code = "REASON_REQUIRED";
            throw err;
        }

        const order = await getOrderDetails(orderIdentifier, userId);
        if (!order) {
            const err = new Error(RESPONSE_MESSAGES.ORDER.NOT_FOUND);
            err.code = "ORDER_NOT_FOUND";
            throw err;
        }

        const isDeliveredOrder = order.deliveredAt || ["Delivered", "Return Requested", "Return Rejected", "Returned"].includes(order.orderStatus);
        if (!isDeliveredOrder) {
            const err = new Error("Return requests can only be submitted after your order has been delivered.");
            err.code = "CANNOT_RETURN";
            throw err;
        }

        const item = order.items.id(itemId) || order.items.find((i) => String(i._id) === String(itemId));
        if (!item) {
            const err = new Error("Item could not be found in this order.");
            err.code = "ITEM_NOT_FOUND";
            throw err;
        }

        const isItemDelivered = item.status === "Delivered" || (order.orderStatus === "Delivered" && item.status === "Placed");
        const isItemRejected = item.status === "Return Rejected";

        if (!isItemDelivered && !isItemRejected) {
            const err = new Error(`This item cannot be returned because its status is "${item.status}".`);
            err.code = "CANNOT_RETURN";
            throw err;
        }

        if (isItemRejected && Math.max(1, item.returnRequestCount || 0) >= MAX_RETURN_ATTEMPTS) {
            const err = new Error(
                `Maximum return request attempts (${MAX_RETURN_ATTEMPTS}) have already been reached for this piece.`
            );
            err.code = "MAX_RETURN_ATTEMPTS_REACHED";
            throw err;
        }

        const cleanReason = reason.trim();
        const now = new Date();

        if (isItemRejected && item.returnRejectReason) {
            item.previousReturnRejectReason = item.returnRejectReason;
            order.previousReturnRejectReason = item.returnRejectReason;
        }

        const nextCount = isItemRejected
            ? Math.max(1, item.returnRequestCount || 0) + 1
            : (item.returnRequestCount || 0) + 1;

        item.status = "Return Requested";
        item.returnReason = cleanReason;
        item.returnRequestedAt = now;
        item.returnRejectReason = null;
        item.returnRejectedAt = null;
        item.returnRequestCount = nextCount;

        order.orderStatus = "Return Requested";
        order.returnReason = cleanReason;
        order.returnRequestedAt = now;
        order.returnRejectReason = null;
        order.returnRejectedAt = null;
        order.returnRequestCount = Math.max(order.returnRequestCount || 0, nextCount);

        await order.save();

        return {
            success: true,
            order,
            isReReturn: isItemRejected,
            message: isItemRejected
                ? "Return request re-submitted for this piece. Our atelier concierge will review it shortly."
                : (RESPONSE_MESSAGES.ORDER.RETURN_REQUESTED || "Return request submitted for the selected product.")
        };
    } catch (error) {
        console.error("orderService returnOrderItem error:", error);
        throw error;
    }
};

/**
 * Generate PDF invoice
 * @param {string} orderIdentifier
 * @param {string} userId
 * @param {import("express").Response} res
 */
export const generateInvoicePDF = async (orderIdentifier, userId, res) => {
    try {
        const order = await getOrderDetails(orderIdentifier, userId);
        if (!order) {
            const err = new Error(RESPONSE_MESSAGES.ORDER.NOT_FOUND);
            err.code = "ORDER_NOT_FOUND";
            throw err;
        }

        renderInvoicePDF(order, res);
    } catch (error) {
        console.error("orderService generateInvoicePDF error:", error);
        throw error;
    }
};

export default {
    MAX_RETURN_ATTEMPTS,
    getUserOrders,
    getOrderDetails,
    cancelOrder,
    cancelOrderItem,
    returnOrder,
    returnOrderItem,
    generateInvoicePDF
};
