import express from "express";
import userController from "../../controllers/admin/userController.js";

const router = express.Router();

// User List
router.get("/users", userController.getUserList);

// Block / Unblock User Routes
router.post("/users/:id/block", userController.blockUser);
router.post("/users/:id/unblock", userController.unblockUser);

export default router;