import User from "../../models/userModel.js";
import orderService from "../../services/user/orderService.js";
import { HTTP_STATUS, RESPONSE_MESSAGES } from "../../constants/index.js";
import { getAuthenticatedUserId, handleBlockedUser } from "../../utils/authSession.js";

/**
 * Render User Order Listing Page with search and status filters (c.i, c.vii)
 */
export const getOrderListPage = async (req, res, next) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
            return res.redirect(
                "/user/login?redirect=/orders&error=" +
                    encodeURIComponent(RESPONSE_MESSAGES.AUTH.UNAUTHORIZED)
            );
        }

        const user = await User.findById(userId);
        if (!user || user.isBlocked) {
            return handleBlockedUser(req, res);
        }

        const { search = "", status = "all", page = "1" } = req.query;

        const data = await orderService.getUserOrders(userId, {
            search,
            status,
            page: parseInt(page, 10) || 1,
            limit: 6
        });

        res.set({
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
            "Surrogate-Control": "no-store"
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
            error: req.query.error || null,
            success: req.query.success || null
        });
    } catch (err) {
        console.error("orderController getOrderListPage error:", err);
        return next(err);
    }
};

/**
 * Render Single Order Detail Page (c.v)
 */
export const getOrderDetailPage = async (req, res, next) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
            return res.redirect("/user/login?redirect=/orders");
        }

        const user = await User.findById(userId);
        if (!user || user.isBlocked) {
            return handleBlockedUser(req, res);
        }

        const { orderId } = req.params;
        const order = await orderService.getOrderDetails(orderId, userId);

        if (!order) {
            return res.redirect(
                "/orders?error=" + encodeURIComponent(RESPONSE_MESSAGES.ORDER.NOT_FOUND)
            );
        }

        res.set({
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
            "Surrogate-Control": "no-store"
        });

        return res.status(HTTP_STATUS.OK).render("orderDetails", {
            pageTitle: `Order #${order.orderId} — ROYAL IGNITE`,
            isUserLoggedIn: true,
            userId,
            user,
            order,
            error: req.query.error || null,
            success: req.query.success || null
        });
    } catch (err) {
        console.error("orderController getOrderDetailPage error:", err);
        return next(err);
    }
};

/**
 * Cancel entire order (c.ii, c.iii)
 */
export const postCancelOrder = async (req, res, next) => {
    const isAjax = Boolean(
        req.xhr || req.headers.accept?.includes("application/json") || req.body.format === "json"
    );
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
            if (isAjax) {
                return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                    success: false,
                    message: RESPONSE_MESSAGES.AUTH.UNAUTHORIZED
                });
            }
            return res.redirect("/user/login?redirect=/orders");
        }

        const { orderId } = req.params;
        const { reason = "" } = req.body;

        const result = await orderService.cancelOrder(orderId, userId, reason);

        if (isAjax) {
            return res.status(HTTP_STATUS.OK).json(result);
        }

        return res.redirect(
            `/orders/${orderId}?success=` + encodeURIComponent(result.message)
        );
    } catch (err) {
        console.error("orderController postCancelOrder error:", err);
        const message = err.message || RESPONSE_MESSAGES.COMMON.SOMETHING_WENT_WRONG;

        if (isAjax) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message
            });
        }

        return res.redirect(`/orders?error=` + encodeURIComponent(message));
    }
};

/**
 * Cancel individual product in order (c.ii, c.iii)
 */
export const postCancelOrderItem = async (req, res, next) => {
    const isAjax = Boolean(
        req.xhr || req.headers.accept?.includes("application/json") || req.body.format === "json"
    );
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
            if (isAjax) {
                return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                    success: false,
                    message: RESPONSE_MESSAGES.AUTH.UNAUTHORIZED
                });
            }
            return res.redirect("/user/login?redirect=/orders");
        }

        const { orderId, itemId } = req.params;
        const { reason = "" } = req.body;

        const result = await orderService.cancelOrderItem(orderId, itemId, userId, reason);

        if (isAjax) {
            return res.status(HTTP_STATUS.OK).json(result);
        }

        return res.redirect(
            `/orders/${orderId}?success=` + encodeURIComponent(result.message)
        );
    } catch (err) {
        console.error("orderController postCancelOrderItem error:", err);
        const message = err.message || RESPONSE_MESSAGES.COMMON.SOMETHING_WENT_WRONG;

        if (isAjax) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message
            });
        }

        return res.redirect(`/orders?error=` + encodeURIComponent(message));
    }
};

/**
 * Return delivered order with mandatory reason (c.iv)
 */
export const postReturnOrder = async (req, res, next) => {
    const isAjax = Boolean(
        req.xhr || req.headers.accept?.includes("application/json") || req.body.format === "json"
    );
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
            if (isAjax) {
                return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                    success: false,
                    message: RESPONSE_MESSAGES.AUTH.UNAUTHORIZED
                });
            }
            return res.redirect("/user/login?redirect=/orders");
        }

        const { orderId } = req.params;
        const { reason } = req.body;

        if (!reason || reason.trim() === "") {
            const message = RESPONSE_MESSAGES.ORDER.RETURN_REASON_REQUIRED;
            if (isAjax) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    message
                });
            }
            return res.redirect(
                `/orders/${orderId}?error=` + encodeURIComponent(message)
            );
        }

        const result = await orderService.returnOrder(orderId, userId, reason);

        if (isAjax) {
            return res.status(HTTP_STATUS.OK).json(result);
        }

        return res.redirect(
            `/orders/${orderId}?success=` + encodeURIComponent(result.message)
        );
    } catch (err) {
        console.error("orderController postReturnOrder error:", err);
        const message = err.message || RESPONSE_MESSAGES.COMMON.SOMETHING_WENT_WRONG;

        if (isAjax) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message
            });
        }

        return res.redirect(`/orders?error=` + encodeURIComponent(message));
    }
};

/**
 * Download Invoice PDF (c.vi)
 */
export const downloadInvoice = async (req, res, next) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
            return res.redirect("/user/login?redirect=/orders");
        }

        const { orderId } = req.params;
        await orderService.generateInvoicePDF(orderId, userId, res);
    } catch (err) {
        console.error("orderController downloadInvoice error:", err);
        return res.redirect(
            `/orders?error=` +
                encodeURIComponent(err.message || "Unable to generate invoice at this time.")
        );
    }
};

export default {
    getOrderListPage,
    getOrderDetailPage,
    postCancelOrder,
    postCancelOrderItem,
    postReturnOrder,
    downloadInvoice
};
