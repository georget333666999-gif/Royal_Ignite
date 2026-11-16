import express from "express";
import orderController from "../../controllers/admin/orderController.js";

const router = express.Router();

// Order listing with search, sort, filter, and pagination
router.get("/orders", orderController.getOrderListPage);

// View order details
router.get("/orders/:orderId", orderController.getOrderDetail);

// Update order fulfillment status
router.post("/orders/:orderId/status", orderController.updateOrderStatus);

// Approve / Reject Return Requests
router.post("/orders/:orderId/return/approve", orderController.approveReturn);
router.post("/orders/:orderId/return/reject", orderController.rejectReturn);
router.post("/orders/:orderId/items/:itemId/return/approve", orderController.approveReturnItem);
router.post("/orders/:orderId/items/:itemId/return/reject", orderController.rejectReturnItem);

export default router;
