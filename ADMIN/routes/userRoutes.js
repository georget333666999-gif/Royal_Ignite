const express = require("express");
const userController = require("../controllers/userController");

const router = express.Router();

// User List
router.get("/users", userController.getUserList);

// Block / Unblock User Routes
router.post("/users/:id/block", userController.blockUser);
router.post("/users/:id/unblock", userController.unblockUser);

module.exports = router;