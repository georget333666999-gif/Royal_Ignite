import express from "express";
import inventoryController from "../../controllers/admin/inventoryController.js";

const router = express.Router();

// Inventory listing & dashboard
router.get("/inventory", inventoryController.getInventoryPage);

// Direct stock adjustment
router.post("/inventory/:id/stock", inventoryController.postUpdateStock);

export default router;
