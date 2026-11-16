import Order from "../../models/orderModel.js";
import User from "../../models/userModel.js";
import Product from "../../models/productModel.js";
import couponService from "../user/couponService.js";
import walletService from "../user/walletService.js";
import { RESPONSE_MESSAGES } from "../../constants/index.js";

const syncOrderReturnSummary = (order) => {
    const activeItems = order.items.filter((i) => i.status !== "Cancelled");
    if (activeItems.some((i) => i.status === "Return Requested")) {
        order.orderStatus = "Return Requested";
        return;
    }
    if (activeItems.length > 0 && activeItems.every((i) => i.status === "Returned")) {
        order.orderStatus = "Returned";
        order.returnedAt = order.returnedAt || new Date();
        if (order.paymentStatus === "Completed") {
            order.paymentStatus = "Refunded";
        }
        return;
    }
    if (activeItems.length > 0 && activeItems.every((i) => i.status === "Return Rejected")) {
        order.orderStatus = "Return Rejected";
        order.returnRejectedAt = order.returnRejectedAt || new Date();
        return;
    }
    if (activeItems.some((i) => i.status === "Delivered")) {
        order.orderStatus = "Delivered";
        return;
    }
    if (activeItems.some((i) => i.status === "Return Rejected")) {
        order.orderStatus = "Return Rejected";
        order.returnRejectedAt = order.returnRejectedAt || new Date();
    }
};

export const ORDER_STATUS_TRANSITIONS = Object.freeze({
    Placed: ["Processing", "Cancelled"],
    Pending: ["Processing", "Cancelled"],
    Processing: ["Shipped", "Cancelled"],
    Shipped: ["Out for Delivery", "Cancelled"],
    "Out for Delivery": ["Delivered", "Cancelled"],
    "Return Requested": ["Returned", "Return Rejected"],
    Delivered: [],
    Cancelled: [],
    Returned: [],
    "Return Rejected": []
});

/**
 * Fetch filtered, sorted, and paginated orders for administration (a.i, a.iv, a.v)
 * @param {Object} options
 * @param {string} [options.search=""]
 * @param {string} [options.status="all"]
 * @param {string} [options.sort="newest"]
 * @param {number} [options.page=1]
 * @param {number} [options.limit=10]
 * @returns {Promise<Object>}
 */
export const getAdminOrders = async ({
    search = "",
    status = "all",
    sort = "newest",
    page = 1,
    limit = 10
} = {}) => {
    try {
        const query = {};

        // 1. Status Filter (a.iv)
        if (status && status !== "all") {
            if (status === "Pending") {
                query.orderStatus = { $in: ["Pending", "Placed"] };
            } else {
                query.orderStatus = status;
            }
        }

        // 2. Search Functionality (a.iv: orderID, user details, items)
        if (search && search.trim() !== "") {
            const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const cleanSearch = search.trim();
            const tokens = cleanSearch.split(/\s+/).filter(Boolean);
            const escapedTokens = tokens.map(escapeRegex);
            const phraseRegex = new RegExp(escapedTokens.join("\\s+"), "i");
            const tokenRegex = new RegExp(escapedTokens.map((t) => `(?=.*${t})`).join(""), "i");

            // Match letters with optional whitespace/dots (e.g. "sk" or "s.k" matches "s     k")
            const compactLetters = cleanSearch.replace(/[\s.]+/g, "");
            const compactRegex = compactLetters.length <= 6
                ? new RegExp(compactLetters.split("").map(escapeRegex).join("[\\s.]*"), "i")
                : phraseRegex;

            // Look up matching users first to enable customer name/email/phone search
            const matchingUsers = await User.find({
                $or: [
                    { name: phraseRegex },
                    { name: tokenRegex },
                    { name: compactRegex },
                    { email: phraseRegex },
                    { phone: phraseRegex }
                ]
            })
                .select("_id")
                .lean();

            const matchingUserIds = matchingUsers.map((u) => u._id);

            query.$or = [
                { orderId: phraseRegex },
                { "items.name": phraseRegex },
                { "items.name": tokenRegex },
                { "shippingAddress.city": phraseRegex }
            ];

            if (matchingUserIds.length > 0) {
                query.$or.push({ user: { $in: matchingUserIds } });
            }

            // For guest orders with no registered user account, match shipping details
            query.$or.push({
                $and: [
                    { user: null },
                    {
                        $or: [
                            { "shippingAddress.fullName": phraseRegex },
                            { "shippingAddress.fullName": tokenRegex },
                            { "shippingAddress.fullName": compactRegex },
                            { "shippingAddress.phone": phraseRegex }
                        ]
                    }
                ]
            });
        }

        // 3. Sorting Criteria (a.i: default descending order date)
        let sortCriteria = { createdAt: -1 };
        if (sort === "oldest") {
            sortCriteria = { createdAt: 1 };
        } else if (sort === "amount_desc") {
            sortCriteria = { "pricing.totalAmount": -1 };
        } else if (sort === "amount_asc") {
            sortCriteria = { "pricing.totalAmount": 1 };
        }

        // 4. Pagination (a.v)
        const currentPage = Math.max(1, parseInt(page, 10) || 1);
        const pageSize = Math.max(1, parseInt(limit, 10) || 10);
        const skip = (currentPage - 1) * pageSize;

        const [orders, totalOrders, statsAgg] = await Promise.all([
            Order.find(query)
                .sort(sortCriteria)
                .skip(skip)
                .limit(pageSize)
                .populate("user", "name email phone isBlocked profileImage")
                .lean(),
            Order.countDocuments(query),
            Order.aggregate([
                {
                    $group: {
                        _id: "$orderStatus",
                        count: { $sum: 1 },
                        totalRevenue: {
                            $sum: {
                                $cond: [
                                    { $in: ["$orderStatus", ["Delivered", "Shipped", "Out for Delivery", "Processing", "Placed", "Pending"]] },
                                    "$pricing.totalAmount",
                                    0
                                ]
                            }
                        }
                    }
                }
            ])
        ]);

        const totalPages = Math.ceil(totalOrders / pageSize) || 1;

        // Compile dashboard summary statistics
        const stats = {
            totalOrdersCount: 0,
            placedCount: 0,
            pendingCount: 0,
            processingCount: 0,
            shippedCount: 0,
            outForDeliveryCount: 0,
            deliveredCount: 0,
            cancelledCount: 0,
            returnedCount: 0,
            returnRequestedCount: 0,
            returnRejectedCount: 0,
            grossRevenue: 0
        };

        if (Array.isArray(statsAgg)) {
            statsAgg.forEach((group) => {
                const st = group._id;
                const count = group.count || 0;
                stats.totalOrdersCount += count;
                stats.grossRevenue += group.totalRevenue || 0;

                if (st === "Pending" || st === "Placed") {
                    stats.placedCount = (stats.placedCount || 0) + count;
                    stats.pendingCount += count;
                }
                else if (st === "Processing") stats.processingCount += count;
                else if (st === "Shipped") stats.shippedCount += count;
                else if (st === "Out for Delivery") stats.outForDeliveryCount += count;
                else if (st === "Delivered") stats.deliveredCount += count;
                else if (st === "Cancelled") stats.cancelledCount += count;
                else if (st === "Returned") stats.returnedCount += count;
                else if (st === "Return Requested") stats.returnRequestedCount += count;
                else if (st === "Return Rejected") stats.returnRejectedCount += count;
            });
        }

        return {
            orders,
            totalOrders,
            totalPages,
            currentPage,
            limit: pageSize,
            search: search.trim(),
            status,
            sort,
            stats
        };
    } catch (error) {
        console.error("admin orderService getAdminOrders error:", error);
        throw error;
    }
};

/**
 * Fetch detailed single order for admin dossier (a.ii)
 * @param {string} orderIdentifier
 * @returns {Promise<Object|null>}
 */
export const getAdminOrderDetails = async (orderIdentifier) => {
    try {
        const query = { $or: [{ orderId: orderIdentifier }] };
        if (orderIdentifier.match(/^[0-9a-fA-F]{24}$/)) {
            query.$or.push({ _id: orderIdentifier });
        }

        const order = await Order.findOne(query)
            .populate("user", "name email phone isBlocked profileImage createdAt")
            .populate("items.product");

        return order;
    } catch (error) {
        console.error("admin orderService getAdminOrderDetails error:", error);
        throw error;
    }
};

/**
 * Update order fulfillment status with inventory reconciliation (a.iii)
 * @param {string} orderIdentifier
 * @param {string} newStatus
 * @param {string} [adminNotes=""]
 * @returns {Promise<Object>}
 */
export const updateAdminOrderStatus = async (orderIdentifier, newStatus, adminNotes = "") => {
    try {
        const order = await getAdminOrderDetails(orderIdentifier);
        if (!order) {
            const err = new Error(RESPONSE_MESSAGES.ORDER.NOT_FOUND);
            err.code = "NOT_FOUND";
            throw err;
        }

        const oldStatus = order.orderStatus;

        // If status didn't change, return early
        if (oldStatus === newStatus) {
            return {
                success: true,
                order,
                message: "Order is already in this status."
            };
        }

        const validNextStatuses = ORDER_STATUS_TRANSITIONS[oldStatus] || [];
        if (!validNextStatuses.includes(newStatus)) {
            let msg = `Cannot change order status from "${oldStatus}" to "${newStatus}".`;
            if (oldStatus === "Delivered") {
                msg = "Delivered orders cannot be moved back to previous statuses.";
            } else if (["Cancelled", "Returned", "Return Rejected"].includes(oldStatus)) {
                msg = `Orders in "${oldStatus}" status cannot be modified.`;
            } else if (["Returned", "Return Rejected", "Return Requested"].includes(newStatus)) {
                msg = "Return options can only be processed after a client requests a return.";
            } else if (validNextStatuses.length > 0) {
                msg = `Cannot skip status from "${oldStatus}" to "${newStatus}". Next allowed: ${validNextStatuses.join(", ")}.`;
            }
            const err = new Error(msg);
            err.code = "INVALID_STATUS_TRANSITION";
            throw err;
        }

        // 1. Stock Reconciliation on cancellation
        if (newStatus === "Cancelled" && oldStatus !== "Cancelled" && oldStatus !== "Returned") {
            const refundAmount = order.pricing?.totalAmount || 0;
            const targetUserId = order.user?._id || order.user;
            if (order.paymentStatus === "Completed" && refundAmount > 0 && targetUserId) {
                await walletService.creditWallet(targetUserId, {
                    amount: refundAmount,
                    description: `Direct refund for cancellation of order #${order.orderId}`,
                    source: "order_cancellation",
                    orderId: order.orderId
                });
                order.paymentStatus = "Refunded";
            }

            for (const item of order.items) {
                if (item.status !== "Cancelled") {
                    await Product.updateOne(
                        { _id: item.product },
                        { $inc: { stock: item.quantity } }
                    );
                    item.status = "Cancelled";
                    item.cancelReason = adminNotes || "Cancelled by atelier administrator";
                    item.cancelledAt = new Date();
                }
            }
            order.cancellationReason = adminNotes || "Cancelled by atelier administrator";
            order.cancelledAt = new Date();
            order.pricing.totalAmount = 0;
            if (order.coupon && order.coupon.code) {
                await couponService.revertCouponUsage(order.coupon.code, order.user);
            }
        }

        // 2. Sync active item statuses across fulfillment stages & handle delivery completion
        if (["Processing", "Shipped", "Out for Delivery", "Delivered"].includes(newStatus)) {
            for (const item of order.items) {
                if (item.status !== "Cancelled") {
                    item.status = newStatus;
                }
            }
        }
        if (newStatus === "Delivered") {
            order.deliveredAt = new Date();
            order.paymentStatus = "Completed";
        }

        // 4. Return Approved ("Returned") - Stock reconciliation & refund handling
        let statusAlreadySynced = false;
        if (newStatus === "Returned" && oldStatus !== "Returned") {
            const hasExplicitItemRequests = order.items.some((i) => i.status === "Return Requested");
            let totalRefund = 0;
            for (const item of order.items) {
                const shouldReturnItem = hasExplicitItemRequests
                    ? item.status === "Return Requested"
                    : (item.status !== "Cancelled" && item.status !== "Returned");
                if (shouldReturnItem) {
                    await Product.updateOne(
                        { _id: item.product },
                        { $inc: { stock: item.quantity } }
                    );
                    item.status = "Returned";
                    item.returnedAt = new Date();
                    totalRefund += item.lineTotal;
                    order.pricing.totalAmount = Math.max(0, (order.pricing.totalAmount || 0) - item.lineTotal);
                }
            }
            if (totalRefund > 0 && order.user) {
                const targetUserId = order.user._id || order.user;
                await walletService.creditWallet(targetUserId, {
                    amount: totalRefund,
                    description: `Refund for approved return of order #${order.orderId}`,
                    source: "order_return",
                    orderId: order.orderId
                });
                order.paymentStatus = "Refunded";
            }
            syncOrderReturnSummary(order);
            statusAlreadySynced = true;
        }

        // 5. Return Rejected - Record admin rejection reason
        if (newStatus === "Return Rejected") {
            if (!adminNotes || !adminNotes.trim()) {
                const err = new Error("Please provide a reason for rejecting the return request.");
                err.code = "REJECTION_REASON_REQUIRED";
                throw err;
            }
            const cleanReason = adminNotes.trim();
            order.returnRejectReason = cleanReason;
            order.returnRejectedAt = new Date();
            const hasExplicitItemRequests = order.items.some((i) => i.status === "Return Requested");
            for (const item of order.items) {
                const shouldRejectItem = hasExplicitItemRequests
                    ? item.status === "Return Requested"
                    : (item.status === "Return Requested" || item.status === "Delivered");
                if (shouldRejectItem) {
                    item.status = "Return Rejected";
                    item.returnRejectReason = cleanReason;
                    item.returnRejectedAt = new Date();
                }
            }
            syncOrderReturnSummary(order);
            statusAlreadySynced = true;
        }

        // 6. Update overall status
        if (!statusAlreadySynced) {
            order.orderStatus = newStatus;
        }
        await order.save();

        let message = RESPONSE_MESSAGES.ORDER.STATUS_UPDATED;
        if (newStatus === "Returned") {
            message = "Return request approved. Stock restored to atelier.";
        } else if (newStatus === "Return Rejected") {
            message = "Return request rejected successfully.";
        }

        return {
            success: true,
            order,
            message
        };
    } catch (error) {
        console.error("admin orderService updateAdminOrderStatus error:", error);
        throw error;
    }
};

/**
 * Approve a return request for an order
 * @param {string} orderIdentifier 
 * @param {string} adminNotes 
 * @returns {Promise<Object>}
 */
export const approveReturn = async (orderIdentifier, adminNotes = "") => {
    return updateAdminOrderStatus(orderIdentifier, "Returned", adminNotes || "Return approved by administrator");
};

/**
 * Reject a return request for an order with a mandatory reason
 * @param {string} orderIdentifier 
 * @param {string} rejectionReason 
 * @returns {Promise<Object>}
 */
export const rejectReturn = async (orderIdentifier, rejectionReason) => {
    if (!rejectionReason || !rejectionReason.trim()) {
        const err = new Error("A reason is mandatory to reject a return request.");
        err.code = "REJECTION_REASON_REQUIRED";
        throw err;
    }
    return updateAdminOrderStatus(orderIdentifier, "Return Rejected", rejectionReason.trim());
};

/**
 * Approve a return request for a single item within an order
 */
export const approveReturnItem = async (orderIdentifier, itemId) => {
    const order = await getAdminOrderDetails(orderIdentifier);
    if (!order) {
        const err = new Error(RESPONSE_MESSAGES.ORDER.NOT_FOUND);
        err.code = "NOT_FOUND";
        throw err;
    }

    const item = order.items.id(itemId) || order.items.find((i) => String(i._id) === String(itemId));
    if (!item || item.status !== "Return Requested") {
        const err = new Error("This item does not have a pending return request.");
        err.code = "INVALID_STATUS_TRANSITION";
        throw err;
    }

    await Product.updateOne(
        { _id: item.product },
        { $inc: { stock: item.quantity } }
    );
    item.status = "Returned";
    item.returnedAt = new Date();
    order.pricing.totalAmount = Math.max(0, (order.pricing.totalAmount || 0) - item.lineTotal);

    if (item.lineTotal > 0 && order.user) {
        const targetUserId = order.user._id || order.user;
        await walletService.creditWallet(targetUserId, {
            amount: item.lineTotal,
            description: `Refund for approved return of "${item.name}" from order #${order.orderId}`,
            source: "item_return",
            orderId: order.orderId
        });
    }

    syncOrderReturnSummary(order);
    await order.save();

    return {
        success: true,
        order,
        message: "Item return approved and stock restored."
    };
};

/**
 * Reject a return request for a single item within an order
 */
export const rejectReturnItem = async (orderIdentifier, itemId, rejectionReason) => {
    if (!rejectionReason || !rejectionReason.trim()) {
        const err = new Error("A reason is mandatory to reject a return request.");
        err.code = "REJECTION_REASON_REQUIRED";
        throw err;
    }

    const order = await getAdminOrderDetails(orderIdentifier);
    if (!order) {
        const err = new Error(RESPONSE_MESSAGES.ORDER.NOT_FOUND);
        err.code = "NOT_FOUND";
        throw err;
    }

    const item = order.items.id(itemId) || order.items.find((i) => String(i._id) === String(itemId));
    if (!item || item.status !== "Return Requested") {
        const err = new Error("This item does not have a pending return request.");
        err.code = "INVALID_STATUS_TRANSITION";
        throw err;
    }

    const cleanReason = rejectionReason.trim();
    item.status = "Return Rejected";
    item.returnRejectReason = cleanReason;
    item.returnRejectedAt = new Date();
    order.returnRejectReason = cleanReason;
    order.returnRejectedAt = new Date();
    syncOrderReturnSummary(order);
    await order.save();

    return {
        success: true,
        order,
        message: "Item return request rejected."
    };
};

export default {
    ORDER_STATUS_TRANSITIONS,
    getAdminOrders,
    getAdminOrderDetails,
    updateAdminOrderStatus,
    approveReturn,
    rejectReturn,
    approveReturnItem,
    rejectReturnItem
};
