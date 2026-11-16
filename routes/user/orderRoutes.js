import express from "express";
import orderController from "../../controllers/user/orderController.js";

const router = express.Router();

// Order Listing with search & filters (c.i, c.vii)
router.get("/orders", orderController.getOrderListPage);

// Order Details View (c.v)
router.get("/orders/:orderId", orderController.getOrderDetailPage);

// Download Invoice PDF (c.vi)
router.get("/orders/:orderId/invoice", orderController.downloadInvoice);

// Cancel Entire Order (c.ii, c.iii)
router.post("/orders/:orderId/cancel", orderController.postCancelOrder);

// Cancel Individual Product in Order (c.ii, c.iii)
router.post("/orders/:orderId/items/:itemId/cancel", orderController.postCancelOrderItem);

// Return Delivered Order (c.iv)
router.post("/orders/:orderId/return", orderController.postReturnOrder);

// Return Individual Product in Delivered Order
router.post("/orders/:orderId/items/:itemId/return", orderController.postReturnOrderItem);

export default router;
