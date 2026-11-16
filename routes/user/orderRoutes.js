import express from "express";
import orderController from "../../controllers/user/orderController.js";

const router = express.Router();

// Order listing with search and filters
router.get("/orders", orderController.getOrderListPage);

// Order details view
router.get("/orders/:orderId", orderController.getOrderDetailPage);

// Download invoice PDF
router.get("/orders/:orderId/invoice", orderController.downloadInvoice);

// Cancel entire order
router.post("/orders/:orderId/cancel", orderController.postCancelOrder);

// Cancel individual product in order
router.post("/orders/:orderId/items/:itemId/cancel", orderController.postCancelOrderItem);

// Return delivered order
router.post("/orders/:orderId/return", orderController.postReturnOrder);

// Return Individual Product in Delivered Order
router.post("/orders/:orderId/items/:itemId/return", orderController.postReturnOrderItem);

export default router;
