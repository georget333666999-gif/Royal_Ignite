const express = require("express");
const userController = require("../controllers/userController");

const router = express.Router();

// User List
router.get("/users", userController.getUserList);

// Edit User Routes
router.get("/users/:id/edit", userController.getEditUser);
router.post("/users/:id/edit", userController.postEditUser);

// Block / Unblock User Routes
router.post("/users/:id/block", userController.blockUser);
router.post("/users/:id/unblock", userController.unblockUser);

module.exports = router;