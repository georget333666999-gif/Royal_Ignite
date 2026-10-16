import Order from "../../models/orderModel.js";
import User from "../../models/userModel.js";
import Product from "../../models/productModel.js";
import { RESPONSE_MESSAGES } from "../../constants/index.js";

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
            const cleanSearch = search.trim();
            const searchRegex = new RegExp(cleanSearch, "i");

            // Look up matching users first to enable customer name/email search
            const matchingUsers = await User.find({
                $or: [{ name: searchRegex }, { email: searchRegex }, { phone: searchRegex }]
            })
                .select("_id")
                .lean();

            const matchingUserIds = matchingUsers.map((u) => u._id);

            query.$or = [
                { orderId: searchRegex },
                { "shippingAddress.fullName": searchRegex },
                { "shippingAddress.phone": searchRegex },
                { "shippingAddress.city": searchRegex },
                { "items.name": searchRegex }
            ];

            if (matchingUserIds.length > 0) {
                query.$or.push({ user: { $in: matchingUserIds } });
            }
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
            pendingCount: 0,
            processingCount: 0,
            shippedCount: 0,
            outForDeliveryCount: 0,
            deliveredCount: 0,
            cancelledCount: 0,
            returnedCount: 0,
            grossRevenue: 0
        };

        if (Array.isArray(statsAgg)) {
            statsAgg.forEach((group) => {
                const st = group._id;
                const count = group.count || 0;
                stats.totalOrdersCount += count;
                stats.grossRevenue += group.totalRevenue || 0;

                if (st === "Pending" || st === "Placed") stats.pendingCount += count;
                else if (st === "Processing") stats.processingCount += count;
                else if (st === "Shipped") stats.shippedCount += count;
                else if (st === "Out for Delivery") stats.outForDeliveryCount += count;
                else if (st === "Delivered") stats.deliveredCount += count;
                else if (st === "Cancelled") stats.cancelledCount += count;
                else if (st === "Returned") stats.returnedCount += count;
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
        const allowedStatuses = [
            "Pending",
            "Placed",
            "Processing",
            "Shipped",
            "Out for Delivery",
            "Delivered",
            "Cancelled",
            "Returned"
        ];

        if (!allowedStatuses.includes(newStatus)) {
            const err = new Error(RESPONSE_MESSAGES.ORDER.INVALID_STATUS);
            err.code = "INVALID_STATUS";
            throw err;
        }

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

        // 1. Stock Reconciliation on cancellation
        if (newStatus === "Cancelled" && oldStatus !== "Cancelled" && oldStatus !== "Returned") {
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
        }

        // 2. Stock Deduction if un-cancelling back to active status
        if ((oldStatus === "Cancelled" || oldStatus === "Returned") && newStatus !== "Cancelled" && newStatus !== "Returned") {
            for (const item of order.items) {
                await Product.updateOne(
                    { _id: item.product },
                    { $inc: { stock: -item.quantity } }
                );
                item.status = newStatus;
            }
            // Recalculate total amount from items
            order.pricing.totalAmount = order.items.reduce((acc, i) => acc + i.lineTotal, 0);
        }

        // 3. Delivered timestamp
        if (newStatus === "Delivered") {
            order.deliveredAt = new Date();
            order.paymentStatus = "Completed";
            for (const item of order.items) {
                if (item.status !== "Cancelled") {
                    item.status = "Delivered";
                }
            }
        }

        // 4. Update overall status
        order.orderStatus = newStatus;
        await order.save();

        return {
            success: true,
            order,
            message: RESPONSE_MESSAGES.ORDER.STATUS_UPDATED
        };
    } catch (error) {
        console.error("admin orderService updateAdminOrderStatus error:", error);
        throw error;
    }
};

export default {
    getAdminOrders,
    getAdminOrderDetails,
    updateAdminOrderStatus
};
