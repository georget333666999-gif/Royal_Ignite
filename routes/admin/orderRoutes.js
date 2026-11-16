import express from "express";
import orderController from "../../controllers/admin/orderController.js";

const router = express.Router();

// Order Listing with search, sort, filter & pagination (a.i, a.ii, a.iv, a.v)
router.get("/orders", orderController.getOrderListPage);

// View Order Details dossier (a.ii)
router.get("/orders/:orderId", orderController.getOrderDetail);

// Update Order Fulfillment Status (a.iii)
router.post("/orders/:orderId/status", orderController.updateOrderStatus);

// Approve / Reject Return Requests
router.post("/orders/:orderId/return/approve", orderController.approveReturn);
router.post("/orders/:orderId/return/reject", orderController.rejectReturn);
router.post("/orders/:orderId/items/:itemId/return/approve", orderController.approveReturnItem);
router.post("/orders/:orderId/items/:itemId/return/reject", orderController.rejectReturnItem);

export default router;
