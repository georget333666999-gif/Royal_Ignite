import express from "express";
import addressController from "../../controllers/user/addressController.js";
import { userMiddleware } from "../../middleware/userMiddleware.js";
import addressValidationMiddleware from "../../middleware/addressValidationMiddleware.js";

const router = express.Router();

// Apply userMiddleware to protect all address routes
router.use(userMiddleware);

// ========================================
// Address Book Listing
// ========================================
router.get("/addresses", addressController.getAddresses);

// ========================================
// Create New Address
// ========================================
router.get("/addresses/add", addressController.getAddAddress);
router.post(
    "/addresses/add",
    addressValidationMiddleware.validateAddAddress,
    addressController.postAddAddress
);

// ========================================
// Edit Existing Address
// ========================================
router.get("/addresses/edit/:id", addressController.getEditAddress);
router.post(
    "/addresses/edit/:id",
    addressValidationMiddleware.validateEditAddress,
    addressController.postEditAddress
);

// ========================================
// Delete Address & Set Default Address
// ========================================
router.post("/addresses/delete/:id", addressController.deleteAddress);
router.post("/addresses/default/:id", addressController.setDefaultAddress);

export default router;
