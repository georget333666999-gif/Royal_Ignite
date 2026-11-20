import orderService from "../../services/user/orderService.js";
import { HTTP_STATUS, RESPONSE_MESSAGES } from "../../constants/index.js";
import { requireActiveUser, isAjaxRequest } from "../../utils/controllerHelpers.js";

/**
 * Render user order listing page with search and status filters
 */
export const getOrderListPage = async (req, res, next) => {
    try {
        const auth = await requireActiveUser(req, res, {
            redirectUrl: "/user/login?redirect=/orders&error=" + encodeURIComponent(RESPONSE_MESSAGES.AUTH.UNAUTHORIZED)
        });
        if (!auth) return;
        const { userId, user } = auth;

        const { search = "", status = "all", page = "1" } = req.query;

        const data = await orderService.getUserOrders(userId, {
            search,
            status,
            page: parseInt(page, 10) || 1,
            limit: 6
        });

        return res.status(HTTP_STATUS.OK).render("orderList", {
            pageTitle: "Your Acquired Editions — ROYAL IGNITE",
            isUserLoggedIn: true,
            userId,
            user,
            orders: data.orders,
            totalOrders: data.totalOrders,
            totalPages: data.totalPages,
            currentPage: data.currentPage,
            search: data.search,
            status: data.status,
            maxReturnAttempts: orderService.MAX_RETURN_ATTEMPTS,
            error: req.query.error || data.searchError || null,
            success: req.query.success || null
        });
    } catch (err) {
        console.error("orderController getOrderListPage error:", err);
        return next(err);
    }
};

/**
 * Render order details page
 */
export const getOrderDetailPage = async (req, res, next) => {
    try {
        const auth = await requireActiveUser(req, res, { redirectUrl: "/user/login?redirect=/orders" });
        if (!auth) return;
        const { userId, user } = auth;

        const { orderId } = req.params;
        const order = await orderService.getOrderDetails(orderId, userId);

        if (!order) {
            return res.redirect("/orders?error=" + encodeURIComponent(RESPONSE_MESSAGES.ORDER.NOT_FOUND));
        }

        return res.status(HTTP_STATUS.OK).render("orderDetails", {
            pageTitle: `Order #${order.orderId} — ROYAL IGNITE`,
            isUserLoggedIn: true,
            userId,
            user,
            order,
            maxReturnAttempts: orderService.MAX_RETURN_ATTEMPTS,
            error: req.query.error || null,
            success: req.query.success || null
        });
    } catch (err) {
        console.error("orderController getOrderDetailPage error:", err);
        return next(err);
    }
};

/**
 * Helper to handle order item or full order cancellations
 */
const handleOrderCancel = async (req, res, cancelFn) => {
    const isAjax = isAjaxRequest(req);
    try {
        const auth = await requireActiveUser(req, res, {
            redirectUrl: "/user/login?redirect=/orders",
            authMessage: RESPONSE_MESSAGES.AUTH.UNAUTHORIZED
        });
        if (!auth) return;

        const { orderId } = req.params;
        const result = await cancelFn(auth.userId);

        if (isAjax) {
            return res.status(HTTP_STATUS.OK).json(result);
        }
        return res.redirect(`/orders/${orderId}?success=` + encodeURIComponent(result.message));
    } catch (err) {
        console.error("orderController cancellation error:", err);
        const message = err.message || RESPONSE_MESSAGES.COMMON.SOMETHING_WENT_WRONG;
        if (isAjax) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message });
        }
        return res.redirect(`/orders?error=` + encodeURIComponent(message));
    }
};

/**
 * Cancel entire order
 */
export const postCancelOrder = (req, res) =>
    handleOrderCancel(req, res, (userId) =>
        orderService.cancelOrder(req.params.orderId, userId, req.body.reason || "")
    );

/**
 * Cancel individual product in order
 */
export const postCancelOrderItem = (req, res) =>
    handleOrderCancel(req, res, (userId) =>
        orderService.cancelOrderItem(req.params.orderId, req.params.itemId, userId, req.body.reason || "")
    );

const handleReturnRequest = async (req, res, action) => {
    const isAjax = isAjaxRequest(req);
    try {
        const auth = await requireActiveUser(req, res, {
            redirectUrl: "/user/login?redirect=/orders",
            authMessage: RESPONSE_MESSAGES.AUTH.UNAUTHORIZED
        });
        if (!auth) return;

        const { orderId } = req.params;
        const { reason } = req.body;

        if (!reason || reason.trim() === "") {
            const message = RESPONSE_MESSAGES.ORDER.RETURN_REASON_REQUIRED;
            if (isAjax) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message });
            }
            return res.redirect(`/orders/${orderId}?error=` + encodeURIComponent(message));
        }

        const result = await action(auth.userId, reason);

        if (isAjax) {
            return res.status(HTTP_STATUS.OK).json(result);
        }

        return res.redirect(`/orders/${orderId}?success=` + encodeURIComponent(result.message));
    } catch (err) {
        console.error("orderController return request error:", err);
        const message = err.message || RESPONSE_MESSAGES.COMMON.SOMETHING_WENT_WRONG;

        if (isAjax) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message });
        }

        return res.redirect(`/orders?error=` + encodeURIComponent(message));
    }
};

/**
 * Return delivered order (or re-request return after rejection) with mandatory reason
 */
export const postReturnOrder = (req, res) =>
    handleReturnRequest(req, res, (userId, reason) =>
        orderService.returnOrder(req.params.orderId, userId, reason, {
            isReReturn: Boolean(req.body.isReReturn)
        })
    );

/**
 * Return individual delivered product within an order
 */
export const postReturnOrderItem = (req, res) =>
    handleReturnRequest(req, res, (userId, reason) =>
        orderService.returnOrderItem(req.params.orderId, req.params.itemId, userId, reason)
    );

/**
 * Download Invoice PDF
 */
export const downloadInvoice = async (req, res) => {
    try {
        const auth = await requireActiveUser(req, res, { redirectUrl: "/user/login?redirect=/orders" });
        if (!auth) return;

        const { orderId } = req.params;
        await orderService.generateInvoicePDF(orderId, auth.userId, res);
    } catch (err) {
        console.error("orderController downloadInvoice error:", err);
        return res.redirect(
            `/orders?error=` + encodeURIComponent(err.message || "Unable to generate invoice at this time.")
        );
    }
};

export default {
    getOrderListPage,
    getOrderDetailPage,
    postCancelOrder,
    postCancelOrderItem,
    postReturnOrder,
    postReturnOrderItem,
    downloadInvoice
};
