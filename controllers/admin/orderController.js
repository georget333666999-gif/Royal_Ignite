import orderService from "../../services/admin/orderService.js";
import { HTTP_STATUS, RESPONSE_MESSAGES } from "../../constants/index.js";

const isJsonRequest = (req) => {
    try {
        if (req?.query?.format === "json" || req?.body?.format === "json") return true;
        if (req?.xhr) return true;
        const acceptHeader = req?.headers?.accept;
        return Boolean(acceptHeader && acceptHeader.includes("application/json"));
    } catch {
        return false;
    }
};

/**
 * Render Admin Orders Listing Page (a.i, a.ii, a.iv, a.v)
 */
export const getOrderListPage = async (req, res, next) => {
    const isJson = isJsonRequest(req);
    try {
        const {
            search = "",
            status = "all",
            sort = "newest",
            page = "1",
            limit = "10"
        } = req.query;

        const data = await orderService.getAdminOrders({
            search,
            status,
            sort,
            page: parseInt(page, 10) || 1,
            limit: parseInt(limit, 10) || 10
        });

        if (isJson) {
            return res.status(HTTP_STATUS.OK).json({
                success: true,
                ...data
            });
        }

        res.set({
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        });

        return res.status(HTTP_STATUS.OK).render("orders/orderList", {
            pageTitle: "Order Management — ROYAL IGNITE Admin",
            adminUser: req.session?.adminUser || { username: "Administrator", role: "Super Admin" },
            orders: data.orders,
            totalOrders: data.totalOrders,
            totalPages: data.totalPages,
            currentPage: data.currentPage,
            limit: data.limit,
            search: data.search,
            status: data.status,
            sort: data.sort,
            stats: data.stats,
            allowedTransitions: orderService.ORDER_STATUS_TRANSITIONS,
            error: req.query.error || null,
            success: req.query.success || null
        });
    } catch (err) {
        console.error("admin orderController getOrderListPage error:", err);
        if (isJson) {
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: err.message || RESPONSE_MESSAGES.COMMON.SOMETHING_WENT_WRONG
            });
        }
        return next(err);
    }
};

/**
 * Get single order details as JSON or render dossier (a.ii)
 */
export const getOrderDetail = async (req, res, next) => {
    const isJson = isJsonRequest(req);
    try {
        const { orderId } = req.params;
        const order = await orderService.getAdminOrderDetails(orderId);

        if (!order) {
            if (isJson) {
                return res.status(HTTP_STATUS.NOT_FOUND).json({
                    success: false,
                    message: RESPONSE_MESSAGES.ORDER.NOT_FOUND
                });
            }
            return res.redirect("/admin/orders?error=" + encodeURIComponent(RESPONSE_MESSAGES.ORDER.NOT_FOUND));
        }

        if (isJson) {
            return res.status(HTTP_STATUS.OK).json({
                success: true,
                order
            });
        }

        return res.status(HTTP_STATUS.OK).render("orders/orderDetails", {
            pageTitle: `Order #${order.orderId} — ROYAL IGNITE Admin`,
            adminUser: req.session?.adminUser || { username: "Administrator", role: "Super Admin" },
            order,
            allowedTransitions: orderService.ORDER_STATUS_TRANSITIONS,
            error: req.query.error || null,
            success: req.query.success || null
        });
    } catch (err) {
        console.error("admin orderController getOrderDetail error:", err);
        if (isJson) {
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: err.message || RESPONSE_MESSAGES.COMMON.SOMETHING_WENT_WRONG
            });
        }
        return next(err);
    }
};

/**
 * Update order fulfillment status (a.iii)
 */
export const updateOrderStatus = async (req, res, next) => {
    const isJson = isJsonRequest(req);
    const { orderId } = req.params;
    try {
        const { status, notes = "" } = req.body;

        if (!status) {
            const message = "Fulfillment status is required.";
            if (isJson) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message });
            }
            return res.redirect(`/admin/orders?error=` + encodeURIComponent(message));
        }

        if (status === "Return Rejected" && (!notes || !notes.trim())) {
            const message = "Please provide a reason for rejecting the return request.";
            if (isJson) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message });
            }
            return res.redirect(`/admin/orders/${orderId}?error=` + encodeURIComponent(message));
        }

        const result = await orderService.updateAdminOrderStatus(orderId, status, notes);

        if (isJson) {
            return res.status(HTTP_STATUS.OK).json(result);
        }

        const redirectUrl = req.headers.referer?.includes(`/admin/orders/${orderId}`)
            ? `/admin/orders/${orderId}`
            : `/admin/orders`;

        return res.redirect(`${redirectUrl}?success=` + encodeURIComponent(result.message));
    } catch (err) {
        console.error("admin orderController updateOrderStatus error:", err);
        const message = err.message || RESPONSE_MESSAGES.COMMON.SOMETHING_WENT_WRONG;
        if (isJson) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message
            });
        }
        const redirectUrl = req.headers.referer?.includes(`/admin/orders/${orderId}`)
            ? `/admin/orders/${orderId}`
            : `/admin/orders`;
        return res.redirect(`${redirectUrl}?error=` + encodeURIComponent(message));
    }
};

/**
 * Approve Return Request
 */
export const approveReturn = async (req, res, next) => {
    const isJson = isJsonRequest(req);
    try {
        const { orderId } = req.params;
        const { notes = "" } = req.body;

        const result = await orderService.approveReturn(orderId, notes);

        if (isJson) {
            return res.status(HTTP_STATUS.OK).json(result);
        }

        return res.redirect(`/admin/orders/${orderId}?success=` + encodeURIComponent(result.message));
    } catch (err) {
        console.error("admin orderController approveReturn error:", err);
        const message = err.message || RESPONSE_MESSAGES.COMMON.SOMETHING_WENT_WRONG;
        if (isJson) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message });
        }
        return res.redirect(`/admin/orders/${req.params.orderId}?error=` + encodeURIComponent(message));
    }
};

/**
 * Reject Return Request with mandatory reason
 */
export const rejectReturn = async (req, res, next) => {
    const isJson = isJsonRequest(req);
    try {
        const { orderId } = req.params;
        const reason = req.body.reason || req.body.notes;

        if (!reason || !reason.trim()) {
            const message = "Please provide a reason for rejecting the return request.";
            if (isJson) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message });
            }
            return res.redirect(`/admin/orders/${orderId}?error=` + encodeURIComponent(message));
        }

        const result = await orderService.rejectReturn(orderId, reason.trim());

        if (isJson) {
            return res.status(HTTP_STATUS.OK).json(result);
        }

        return res.redirect(`/admin/orders/${orderId}?success=` + encodeURIComponent(result.message));
    } catch (err) {
        console.error("admin orderController rejectReturn error:", err);
        const message = err.message || RESPONSE_MESSAGES.COMMON.SOMETHING_WENT_WRONG;
        if (isJson) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message });
        }
        return res.redirect(`/admin/orders/${req.params.orderId}?error=` + encodeURIComponent(message));
    }
};

export const approveReturnItem = async (req, res) => {
    const isJson = isJsonRequest(req);
    const { orderId, itemId } = req.params;
    try {
        const result = await orderService.approveReturnItem(orderId, itemId);
        if (isJson) return res.status(HTTP_STATUS.OK).json(result);
        return res.redirect(`/admin/orders/${orderId}?success=` + encodeURIComponent(result.message));
    } catch (err) {
        const message = err.message || RESPONSE_MESSAGES.COMMON.SOMETHING_WENT_WRONG;
        if (isJson) return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message });
        return res.redirect(`/admin/orders/${orderId}?error=` + encodeURIComponent(message));
    }
};

export const rejectReturnItem = async (req, res) => {
    const isJson = isJsonRequest(req);
    const { orderId, itemId } = req.params;
    try {
        const reason = req.body.reason || req.body.notes;
        if (!reason || !reason.trim()) {
            const message = "Please provide a reason for rejecting the return request.";
            if (isJson) return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message });
            return res.redirect(`/admin/orders/${orderId}?error=` + encodeURIComponent(message));
        }
        const result = await orderService.rejectReturnItem(orderId, itemId, reason.trim());
        if (isJson) return res.status(HTTP_STATUS.OK).json(result);
        return res.redirect(`/admin/orders/${orderId}?success=` + encodeURIComponent(result.message));
    } catch (err) {
        const message = err.message || RESPONSE_MESSAGES.COMMON.SOMETHING_WENT_WRONG;
        if (isJson) return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message });
        return res.redirect(`/admin/orders/${orderId}?error=` + encodeURIComponent(message));
    }
};

export default {
    getOrderListPage,
    getOrderDetail,
    updateOrderStatus,
    approveReturn,
    rejectReturn,
    approveReturnItem,
    rejectReturnItem
};
