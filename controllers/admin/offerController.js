import offerService from "../../services/admin/offerService.js";
import Product from "../../models/productModel.js";
import Category from "../../models/categoryModel.js";
import { HTTP_STATUS } from "../../constants/index.js";

/**
 * Render Admin Offers Management Console
 */
export const getOffersPage = async (req, res, next) => {
    try {
        const { search = "", type = "all", page = 1 } = req.query;

        const [offerData, products, categories] = await Promise.all([
            offerService.getOffers({ search, type, page, limit: 10 }),
            Product.find({ isDeleted: false, isListed: true }).select("name regularPrice images").sort({ name: 1 }).lean(),
            Category.find({ isDeleted: false, isListed: true }).select("name").sort({ name: 1 }).lean()
        ]);

        return res.status(HTTP_STATUS.OK).render("admin/offers/offerList", {
            pageTitle: "Privilege Offers & Incentives — ROYAL IGNITE Admin",
            adminUser: req.session.adminUser || null,
            offers: offerData.offers,
            currentPage: offerData.currentPage,
            totalPages: offerData.totalPages,
            totalOffers: offerData.totalOffers,
            search: offerData.search,
            currentType: type,
            products,
            categories,
            error: req.query.error || offerData.searchError || null,
            success: req.query.success || null
        });
    } catch (error) {
        console.error("offerController getOffersPage error:", error);
        return next(error);
    }
};

/**
 * Fetch a single Offer by ID for editing
 */
export const getOfferById = async (req, res) => {
    try {
        const { id } = req.params;
        const offer = await offerService.getOfferById(id);
        return res.status(HTTP_STATUS.OK).json({
            success: true,
            offer
        });
    } catch (error) {
        console.error("offerController getOfferById error:", error);
        return res.status(HTTP_STATUS.NOT_FOUND).json({
            success: false,
            message: error.message || "Offer not found."
        });
    }
};

/**
 * Create a new Offer (product, category, or referral)
 */
export const postCreateOffer = async (req, res) => {
    try {
        const newOffer = await offerService.createOffer(req.body);
        return res.status(HTTP_STATUS.CREATED).json({
            success: true,
            message: "Privilege offer configured and activated successfully.",
            offer: newOffer
        });
    } catch (error) {
        console.error("offerController postCreateOffer error:", error);
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: error.message || "Failed to configure privilege offer."
        });
    }
};

/**
 * Update an existing Offer (product, category, or referral)
 */
export const putUpdateOffer = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedOffer = await offerService.updateOffer(id, req.body);
        return res.status(HTTP_STATUS.OK).json({
            success: true,
            message: "Privilege offer updated and product pricing reconciled successfully.",
            offer: updatedOffer
        });
    } catch (error) {
        console.error("offerController putUpdateOffer error:", error);
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: error.message || "Failed to update privilege offer."
        });
    }
};

/**
 * Toggle Offer activation state
 */
export const postToggleOffer = async (req, res) => {
    try {
        const { id } = req.params;
        const updated = await offerService.toggleOfferStatus(id);
        return res.status(HTTP_STATUS.OK).json({
            success: true,
            message: `Offer "${updated.name}" is now ${updated.isActive ? "active" : "inactive"}.`,
            isActive: updated.isActive
        });
    } catch (error) {
        console.error("offerController postToggleOffer error:", error);
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: error.message || "Failed to alter offer state."
        });
    }
};

/**
 * Decommission (delete) Offer
 */
export const postDeleteOffer = async (req, res) => {
    try {
        const { id } = req.params;
        await offerService.deleteOffer(id);
        return res.status(HTTP_STATUS.OK).json({
            success: true,
            message: "Privilege offer decommissioned successfully."
        });
    } catch (error) {
        console.error("offerController postDeleteOffer error:", error);
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: error.message || "Failed to decommission offer."
        });
    }
};

export default {
    getOffersPage,
    getOfferById,
    postCreateOffer,
    putUpdateOffer,
    postToggleOffer,
    postDeleteOffer
};

