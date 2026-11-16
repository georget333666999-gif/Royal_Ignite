import express from "express";
import offerController from "../../controllers/admin/offerController.js";

const router = express.Router();

// Offer Dossier
router.get("/offers", offerController.getOffersPage);

// Offer Actions
router.post("/offers/create", offerController.postCreateOffer);
router.post("/offers/toggle/:id", offerController.postToggleOffer);
router.post("/offers/delete/:id", offerController.postDeleteOffer);

export default router;
