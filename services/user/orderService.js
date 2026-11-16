import PDFDocument from "pdfkit";
import Order from "../../models/orderModel.js";
import Product from "../../models/productModel.js";
import couponService from "./couponService.js";
import walletService from "./walletService.js";
import { RESPONSE_MESSAGES } from "../../constants/index.js";

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

        // Search by orderId or product name
        if (search && search.trim() !== "") {
            const cleanSearch = search.trim();
            query.$or = [
                { orderId: { $regex: cleanSearch, $options: "i" } },
                { "items.name": { $regex: cleanSearch, $options: "i" } }
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
            search: search.trim(),
            status: status.trim()
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

        await order.save();

        // 4. Revert coupon usage if applied
        if (order.coupon && order.coupon.code) {
            await couponService.revertCouponUsage(order.coupon.code, order.user);
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

        // 3. Direct Refund to Wallet if piece was prepaid
        if (order.paymentStatus === "Completed" && item.lineTotal > 0) {
            await walletService.creditWallet(userId, {
                amount: item.lineTotal,
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
        } else {
            // Adjust total payable for remaining active items
            const activeTotal = order.items
                .filter((i) => i.status !== "Cancelled")
                .reduce((acc, i) => acc + i.lineTotal, 0);
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

/**
 * Return an order
 * Mandatory reason required
 * @param {string} orderIdentifier
 * @param {string} userId
 * @param {string} reason
 * @returns {Promise<Object>}
 */
export const returnOrder = async (orderIdentifier, userId, reason) => {
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
        const returnableItems = order.items.filter(
            (i) => i.status === "Delivered" || (order.orderStatus === "Delivered" && i.status === "Placed")
        );

        if (!isDeliveredOrder || returnableItems.length === 0) {
            const err = new Error("Return requests can only be submitted for delivered items.");
            err.code = "CANNOT_RETURN";
            throw err;
        }

        const cleanReason = reason.trim();
        const now = new Date();
        order.orderStatus = "Return Requested";
        order.returnReason = cleanReason;
        order.returnRequestedAt = now;
        order.returnRejectReason = null;
        order.returnRejectedAt = null;

        for (const item of returnableItems) {
            item.status = "Return Requested";
            item.returnReason = cleanReason;
            item.returnRequestedAt = now;
            item.returnRejectReason = null;
            item.returnRejectedAt = null;
        }

        // Note: Inventory is NOT re-stocked now. It will only be re-stocked once the admin approves the return.
        await order.save();

        return {
            success: true,
            order,
            message: RESPONSE_MESSAGES.ORDER.RETURN_REQUESTED || "Return request submitted successfully. We will notify you once approved."
        };
    } catch (error) {
        console.error("orderService returnOrder error:", error);
        throw error;
    }
};

/**
 * Request return for a single delivered product within an order
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
        if (!isItemDelivered) {
            const err = new Error(`This item cannot be returned because its status is "${item.status}".`);
            err.code = "CANNOT_RETURN";
            throw err;
        }

        const cleanReason = reason.trim();
        const now = new Date();
        item.status = "Return Requested";
        item.returnReason = cleanReason;
        item.returnRequestedAt = now;
        item.returnRejectReason = null;
        item.returnRejectedAt = null;

        order.orderStatus = "Return Requested";
        order.returnReason = cleanReason;
        order.returnRequestedAt = now;
        order.returnRejectReason = null;
        order.returnRejectedAt = null;

        await order.save();

        return {
            success: true,
            order,
            message: RESPONSE_MESSAGES.ORDER.RETURN_REQUESTED || "Return request submitted for the selected product."
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

        const doc = new PDFDocument({
            size: "A4",
            margin: 40,
            info: {
                Title: `Invoice ${order.orderId} - ROYAL IGNITE`,
                Author: "Royal Ignite Haute Briquet Atelier"
            }
        });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="Invoice-${order.orderId}.pdf"`
        );

        doc.pipe(res);

        // Styling helpers
        const GOLD = "#C59B4E";
        const DARK = "#121216";
        const GRAY = "#5A5A65";
        const LIGHT_GRAY = "#EEEEF0";

        // Top Brand Header
        doc.rect(40, 40, 515, 80).fill(DARK);

        doc.fillColor("#FFFFFF")
            .font("Helvetica-Bold")
            .fontSize(22)
            .text("ROYAL IGNITE", 60, 58, { characterSpacing: 2 });

        doc.fillColor(GOLD)
            .font("Helvetica")
            .fontSize(9)
            .text("HAUTE ATELIER & PRECISION FLAME HORLOGERIE", 60, 84, { characterSpacing: 1.5 });

        doc.fillColor("#FFFFFF")
            .font("Helvetica-Bold")
            .fontSize(12)
            .text("OFFICIAL PROVENANCE INVOICE", 340, 68, { align: "right" });

        // Invoice Meta Block
        let y = 140;
        doc.fillColor(DARK).font("Helvetica-Bold").fontSize(10);
        doc.text("ORDER REFERENCE:", 40, y);
        doc.font("Helvetica").text(order.orderId, 160, y);

        doc.font("Helvetica-Bold").text("INVOICE DATE:", 340, y);
        doc.font("Helvetica").text(
            new Date(order.createdAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric"
            }),
            430,
            y
        );

        y += 18;
        doc.font("Helvetica-Bold").text("ORDER STATUS:", 40, y);
        doc.font("Helvetica").text(order.orderStatus.toUpperCase(), 160, y);

        doc.font("Helvetica-Bold").text("PAYMENT MODE:", 340, y);
        doc.font("Helvetica").text("Cash on Delivery (COD)", 430, y);

        // Divider
        y += 24;
        doc.strokeColor(GOLD).lineWidth(1).moveTo(40, y).lineTo(555, y).stroke();

        // Sold By & Shipped To Columns
        y += 15;
        doc.fillColor(GOLD).font("Helvetica-Bold").fontSize(10).text("ATELIER HEADQUARTERS", 40, y);
        doc.text("DELIVERY DESTINATION", 300, y);

        y += 15;
        doc.fillColor(DARK).font("Helvetica").fontSize(9);
        doc.text("Royal Ignite Luxury Atelier Pvt. Ltd.", 40, y);
        doc.text(order.shippingAddress.fullName, 300, y);

        y += 13;
        doc.text("The Palladium Pavilion, Level 4", 40, y);
        doc.text(order.shippingAddress.addressLine, 300, y);

        y += 13;
        doc.text("Senapati Bapat Marg, Lower Parel", 40, y);
        doc.text(
            `${order.shippingAddress.city}, ${order.shippingAddress.state} — ${order.shippingAddress.pincode}`,
            300,
            y
        );

        y += 13;
        doc.text("Mumbai, Maharashtra 400013, India", 40, y);
        doc.text(`Contact: ${order.shippingAddress.phone}`, 300, y);

        // Table Header
        y += 35;
        doc.rect(40, y, 515, 24).fill(DARK);
        doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(9);
        doc.text("#", 50, y + 7);
        doc.text("CREATION SPECIFICATION", 80, y + 7);
        doc.text("STATUS", 290, y + 7);
        doc.text("QTY", 370, y + 7);
        doc.text("UNIT PRICE", 420, y + 7);
        doc.text("TOTAL", 500, y + 7);

        // Table Rows
        y += 24;
        let index = 1;
        doc.font("Helvetica").fontSize(9);

        for (const item of order.items) {
            const rowBg = index % 2 === 0 ? LIGHT_GRAY : "#FFFFFF";
            doc.rect(40, y, 515, 24).fill(rowBg);

            doc.fillColor(DARK);
            doc.text(String(index).padStart(2, "0"), 50, y + 7);
            doc.text(item.name, 80, y + 7, { width: 200, ellipsis: true });
            doc.text(item.status, 290, y + 7);
            doc.text(String(item.quantity), 370, y + 7);
            doc.text(`INR ${Number(item.price).toLocaleString("en-IN")}`, 420, y + 7);
            doc.text(`INR ${Number(item.lineTotal).toLocaleString("en-IN")}`, 490, y + 7);

            y += 24;
            index++;
        }

        // Ledger Summary Block
        y += 15;
        const subtotal = order.pricing.subtotal || order.pricing.totalAmount;
        const discount = order.pricing.discount || 0;
        const total = order.pricing.totalAmount;

        doc.fillColor(GRAY).font("Helvetica").fontSize(9);
        doc.text("BAG SUBTOTAL:", 360, y);
        doc.fillColor(DARK).text(`INR ${Number(subtotal).toLocaleString("en-IN")}`, 470, y, { align: "right" });

        if (discount > 0) {
            y += 15;
            doc.fillColor(GRAY).text("ATELIER COURTESY DISCOUNT:", 310, y);
            doc.fillColor(GOLD).text(`- INR ${Number(discount).toLocaleString("en-IN")}`, 470, y, { align: "right" });
        }

        y += 15;
        doc.fillColor(GRAY).text("INSURED AIR COURIER:", 360, y);
        doc.fillColor(DARK).text("COMPLIMENTARY", 470, y, { align: "right" });

        y += 15;
        doc.fillColor(GRAY).text("TAXES & DUTIES:", 360, y);
        doc.fillColor(DARK).text("INCLUDED", 470, y, { align: "right" });

        y += 18;
        doc.rect(340, y, 215, 28).fill(DARK);
        doc.fillColor(GOLD).font("Helvetica-Bold").fontSize(11).text("TOTAL PAYABLE:", 355, y + 9);
        doc.fillColor("#FFFFFF").text(`INR ${Number(total).toLocaleString("en-IN")}`, 450, y + 9, { align: "right" });

        // Authenticity Certification Footer
        y = 730;
        doc.strokeColor(GOLD).lineWidth(0.75).moveTo(40, y).lineTo(555, y).stroke();
        y += 12;

        doc.fillColor(GOLD)
            .font("Helvetica-Bold")
            .fontSize(8)
            .text("ROYAL IGNITE SEAL OF PROVENANCE & AUTHENTICITY", 40, y, { align: "center", characterSpacing: 1.5 });

        y += 12;
        doc.fillColor(GRAY)
            .font("Helvetica")
            .fontSize(7.5)
            .text(
                "Each creation is handcrafted to horological micrometer tolerances. Serial numbers registered in the Master Registry. For ignition concierge service, visit royalignite.com",
                40,
                y,
                { align: "center" }
            );

        doc.end();
    } catch (error) {
        console.error("orderService generateInvoicePDF error:", error);
        throw error;
    }
};

export default {
    getUserOrders,
    getOrderDetails,
    cancelOrder,
    cancelOrderItem,
    returnOrder,
    returnOrderItem,
    generateInvoicePDF
};
