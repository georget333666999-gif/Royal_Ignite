const express = require("express");

const adminController = require("../controllers/adminController");
const userRoutes = require("./userRoutes");

const router = express.Router();

router.get("/login", adminController.showLoginPage);

router.post("/login", adminController.login);

router.use(userRoutes);

module.exports = router;