import express from "express";
import productController from "../../controllers/user/productController.js";
import { HTTP_STATUS } from "../../constants/index.js";

const router = express.Router();

// Public Product Listing with search, pagination, sort, and category/price filtering
router.get("/products", productController.getProductList);

// Public Product Details page with zoomable images, highlights, and stock control

router.get("/products/:id", productController.getProductDetails);

const handleRedirect = (target) => (req, res, next) => {
    try {
        const queryString = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
        res.redirect(HTTP_STATUS.MOVED_PERMANENTLY, `${target}${queryString}`);
    } catch (error) {
        next(error);
    }
};

// Bespoke Fuel Lighters Landing Page
router.get("/fuel-lighters", productController.getFuelLightersPage);
router.get("/category/fuel-lighters", handleRedirect("/fuel-lighters"));

// Bespoke Gas Lighters Landing Page
router.get("/gas-lighters", productController.getGasLightersPage);
router.get("/category/gas-lighters", handleRedirect("/gas-lighters"));

// Bespoke Electric Lighters Landing Page
router.get("/electric-lighters", productController.getElectricLightersPage);
router.get("/category/electric-lighters", handleRedirect("/electric-lighters"));

// Bespoke Refills and Care Landing Page
router.get("/refills-and-care", productController.getRefillsAndCarePage);
router.get("/category/refills-and-care", handleRedirect("/refills-and-care"));
router.get("/category/refills", handleRedirect("/refills-and-care"));

// Friendly alias: /shop redirects with query preservation
router.get("/shop", handleRedirect("/products"));

export default router;
