import User from "../../models/userModel.js";
import Cart from "../../models/cartModel.js";
import Wishlist from "../../models/wishlistModel.js";
import Offer from "../../models/offerModel.js";
import Category from "../../models/categoryModel.js";
import Product from "../../models/productModel.js";
import productService from "../../services/user/productService.js";
import wishlistService from "../../services/user/wishlistService.js";
import { HTTP_STATUS, RESPONSE_MESSAGES } from "../../constants/index.js";
import { getAuthenticatedUserId, resolveRequestUser, handleBlockedUser } from "../../utils/authSession.js";
import { sanitizeSearchQuery } from "../../utils/searchValidation.js";

// Controller to handle public Product Listing / Shop
export const getProductList = async (req, res, next) => {
    try {
        // 1. Session & Auth Check
        const userId = getAuthenticatedUserId(req);
        const isUserLoggedIn = Boolean(userId);
        let currentUser = null;

        if (isUserLoggedIn) {
            currentUser = await resolveRequestUser(req, User);
            if (!currentUser || currentUser.isBlocked) {
                return handleBlockedUser(req, res);
            }
        }

        // 2. Query Parameters Extraction
        const {
            search = "",
            category = "",
            minPrice = "",
            maxPrice = "",
            sort = "newest",
            inStockOnly = "false",
            page = "1",
            limit = "9"
        } = req.query;

        const searchValidation = sanitizeSearchQuery(search);
        const cleanSearch = searchValidation.value;
        const cleanCategory = typeof category === "string" ? category.trim() : "";
        const cleanSort = typeof sort === "string" ? sort.trim() : "newest";

        // 3. Fetch products, categories, and wishlist IDs in parallel
        const [data, wishlistProductIds] = await Promise.all([
            productService.getShopProducts({
                search: cleanSearch,
                category: cleanCategory,
                minPrice: minPrice !== "" ? Number(minPrice) : undefined,
                maxPrice: maxPrice !== "" ? Number(maxPrice) : undefined,
                sort: cleanSort,
                inStockOnly: inStockOnly === "true" || inStockOnly === true,
                page: parseInt(page, 10) || 1,
                limit: parseInt(limit, 10) || 9
            }),
            isUserLoggedIn ? wishlistService.getWishlistProductIds(userId) : Promise.resolve([])
        ]);

        // 4. Return JSON if requested via AJAX
        if (req.xhr || req.query.format === "json" || req.headers.accept?.includes("application/json")) {
            return res.status(HTTP_STATUS.OK).json({
                success: true,
                ...data,
                wishlistProductIds,
                searchError: searchValidation.error,
                query: {
                    search: cleanSearch,
                    category: cleanCategory,
                    minPrice,
                    maxPrice,
                    sort: cleanSort,
                    inStockOnly
                }
            });
        }

        // 5. Render Shop Page
        return res.status(HTTP_STATUS.OK).render("shop", {
            pageTitle: "Curated Timepieces & Luxury Lighters — Royal Ignite",
            isUserLoggedIn,
            userId,
            user: currentUser,
            products: data.products,
            categories: data.categories,
            totalProducts: data.totalProducts,
            totalPages: data.totalPages,
            currentPage: data.currentPage,
            limit: data.limit,
            totalActiveProducts: data.totalActiveProducts,
            wishlistProductIds,
            // Active filters for preserving state in UI & links
            search: cleanSearch,
            category: data.selectedCategoryId || cleanCategory,
            minPrice: minPrice !== "" ? Number(minPrice) : "",
            maxPrice: maxPrice !== "" ? Number(maxPrice) : "",
            sort: cleanSort,
            inStockOnly: inStockOnly === "true" || inStockOnly === true,
            errorMessage: req.query.error || req.query.errorMessage || req.session?.errorMessage || searchValidation.error || null
        });
    } catch (err) {
        console.error("User productController getProductList error:", err);
        return next(err);
    }
};

// Controller to handle public Product Details

export const getProductDetails = async (req, res, next) => {
    const isAjax = Boolean(req.xhr || req.query.format === "json" || req.headers.accept?.includes("application/json"));
    try {
        const { id } = req.params;

        // 1. Session & Auth Check
        const userId = getAuthenticatedUserId(req);
        const isUserLoggedIn = Boolean(userId);
        let currentUser = null;

        if (isUserLoggedIn) {
            currentUser = await resolveRequestUser(req, User);
            if (!currentUser || currentUser.isBlocked) {
                return handleBlockedUser(req, res);
            }
        }

        // 2. Fetch product by ID
        const result = await productService.getProductDetailsById(id);

        // Redirect to listing if product is blocked, unlisted, or unavailable
        if (!result || result.unavailable || !result.product) {
            const redirectReason = result?.reason || RESPONSE_MESSAGES.PRODUCT.UNAVAILABLE_BANNER;
            if (isAjax) {
                return res.status(HTTP_STATUS.NOT_FOUND).json({
                    success: false,
                    unavailable: true,
                    message: redirectReason,
                    redirect: `/products?error=${encodeURIComponent(redirectReason)}`
                });
            }
            return res.redirect(`/products?error=${encodeURIComponent(redirectReason)}`);
        }

        const product = result.product;

        // Ensure products under Refills & Care only have 1 single image (remove side profile)
        const catNameStr = (product.category?.name || "").toLowerCase();
        if (catNameStr.includes("refill") || catNameStr.includes("care")) {
            if (Array.isArray(product.images) && product.images.length > 1) {
                product.images = [product.images[0]];
            }
        }

        // 3. Fetch related products, cart membership, and wishlist in parallel
        const [relatedProducts, existingCart, existingWishlist] = await Promise.all([
            productService.getRelatedProducts(product._id, product.category?._id, 4),
            isUserLoggedIn ? Cart.findOne({ user: userId, "items.product": product._id }).select("_id").lean() : Promise.resolve(null),
            isUserLoggedIn ? Wishlist.findOne({ user: userId }).select("products").lean() : Promise.resolve(null)
        ]);

        const isInCart = Boolean(existingCart);
        let isInWishlist = false;
        let userWishlistIds = [];
        if (existingWishlist && Array.isArray(existingWishlist.products)) {
            userWishlistIds = existingWishlist.products.map((p) => p.toString());
            isInWishlist = userWishlistIds.includes(product._id.toString());
        }

        // 4. Return JSON if requested via AJAX
        if (isAjax) {
            return res.status(HTTP_STATUS.OK).json({
                success: true,
                product,
                relatedProducts,
                isInCart,
                isInWishlist,
                userWishlistIds
            });
        }

        // 5. Render Product Details Page
        return res.status(HTTP_STATUS.OK).render("productDetails", {
            pageTitle: `${product.name} — ROYAL IGNITE`,
            isUserLoggedIn,
            userId,
            user: currentUser,
            product,
            relatedProducts,
            isInCart,
            isInWishlist,
            userWishlistIds,
            error: req.query.error || null,
            success: req.query.success || null
        });
    } catch (err) {
        console.error("User productController getProductDetails error:", err);
        const redirectReason = RESPONSE_MESSAGES.PRODUCT.UNAVAILABLE_BANNER;
        if (isAjax) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                unavailable: true,
                message: redirectReason,
                redirect: `/products?error=${encodeURIComponent(redirectReason)}`
            });
        }
        return res.redirect(`/products?error=${encodeURIComponent(redirectReason)}`);
    }
};

// ============================================================================
// Bespoke Editorial Collection Pages (Gas, Electric, Fuel, Refills & Care)
// ============================================================================

const GAS_EDITORIAL_META = {
    "The Apex": { editionTag: "SIGNATURE SERIES", flameTag: "DUAL CERAMIC JET — 1,300°C", specs: "AEROSPACE GRADE ALLOY / DUAL-JET TORCH", order: 1 },
    "The Titan": { editionTag: "LIMITED TO 250 PIECES", flameTag: "HEAVYWEIGHT BILLET BRASS", specs: "SOLID BRASS / ENGINE-TURNED PATTERN", order: 2 },
    "The Vanguard": { editionTag: "PRECISION ENGINEERING", flameTag: "ANGULAR JET TORCH", specs: "GUNMETAL FINISH / BLUE TORCH FLAME", order: 3 },
    "The Vertex": { editionTag: "SLIMLINE LUXURY", flameTag: "STERLING COLUMNAR", specs: "925 STERLING SILVER / LINEAR BURNER", order: 4 },
    "The Orion": { editionTag: "THE HEIRLOOM EDITION", flameTag: "HAND-CHASED FILIGREE", specs: "ANTIQUE ROSE GOLD / FLUID BUTANE RESERVOIR", order: 5 },
    "The Eclipse": { editionTag: "ATELIER PROTOTYPE", flameTag: "DUAL-FINISH CHROME", specs: "MIRROR CHROME & SATIN OBSIDIAN", order: 6 }
};
const GAS_DEFAULT_META = { editionTag: "ATELIER EDITION", flameTag: "PRECISION BUTANE JET", specs: "PRECISION ALLOY / TORCH FLAME", order: 99 };

const ELECTRIC_EDITORIAL_META = {
    "The Aether": { editionTag: "FLAGSHIP EDITION", subTag: "01 / DUAL-ARC PLASMA", specs: "GRADE 5 TITANIUM / 42,000 HZ PULSE FREQUENCY / USB-C FAST CHARGE", order: 1 },
    "The Tether": { editionTag: "DUAL VOLTAGE CERAMIC CORE", subTag: "02 / RESONANCE", specs: "MATTE DLC CHROME / DUAL VOLTAGE CERAMIC CORE", order: 2 },
    "The Zenith": { editionTag: "POCKET SLIMLINE", subTag: "03 / LINEAR ARC", specs: "OBSIDIAN ALLOY / LINEAR PLASMA BLADE", order: 3 },
    "The Solis": { editionTag: "MINIMALIST COLUMN", subTag: "04 / RADIAL IGNITION", specs: "BRUSHED STERLING & ALUMINUM / COLUMNAR PROFILE", order: 4 },
    "The Lumina": { editionTag: "SCULPTURAL EDITION", subTag: "05 / ERGONOMICS", specs: "MIRROR BRONZE / ERGONOMIC DUAL ARC", order: 5 },
    "The Halo": { editionTag: "CIRCULAR INDUCTION COIL", subTag: "06 / TESLA CORE", specs: "CIRCULAR INDUCTION COIL / TESLA CORE / VOLCANIC SLATE", order: 6 }
};
const ELECTRIC_DEFAULT_META = { editionTag: "PLASMA EDITION", subTag: "DUAL-ARC MODULE", specs: "TITANIUM ALLOY / SOLID-STATE POWER", order: 99 };

const FUEL_EDITORIAL_META = {
    "The Heritage 1924": { editionTag: "ARCHIVAL FLAGSHIP", subTag: "01 / MECHANICAL PATENT", specs: "SOLID NAVAL BRASS / DUAL COTTON WICK", order: 1 },
    "The Chesterfield 1920": { editionTag: "ARCHIVAL LIFT-ARM", subTag: "02 / 1920s AUTOMATON", specs: "925 STERLING & 18K ROSE GOLD / SPRING SNUFFER", order: 2 },
    "The Chesterfield": { editionTag: "ARCHIVAL LIFT-ARM", subTag: "02 / 1920s AUTOMATON", specs: "925 STERLING & 18K ROSE GOLD / SPRING SNUFFER", order: 2 },
    "The Baronet": { editionTag: "ARCHIVAL LIFT-ARM", subTag: "02 / 1920s AUTOMATON", specs: "925 STERLING & 18K ROSE GOLD / SPRING SNUFFER", order: 2 },
    "The Commander": { editionTag: "TRENCH CLASSIC", subTag: "03 / FIELD TRENCH CHIMNEY", specs: "GUNMETAL BRONZE / WINDPROOF CHIMNEY", order: 3 },
    "The Monarch Sovereign": { editionTag: "IMPERIAL EDITION", subTag: "04 / 24K ROYAL REGALIA", specs: "24K GOLD PLATED / HAND-CHASED ACANTHUS", order: 4 },
    "The Aeronaut": { editionTag: "STREAMLINE ART DECO", subTag: "05 / ART DECO MODERNE", specs: "NICKEL SILVER / HORIZONTAL FLINT ROLLER", order: 5 },
    "The Aurelius Imperial": { editionTag: "HAUTE HOROLOGY", subTag: "06 / SUNBURST GUILLOCHÉ", specs: "OBSIDIAN TITANIUM / 18K GOLD GUILLOCHÉ CHASSIS", order: 6 },
    "The Black Watch": { editionTag: "HAUTE HOROLOGY", subTag: "06 / SUNBURST GUILLOCHÉ", specs: "OBSIDIAN TITANIUM / 18K GOLD GUILLOCHÉ CHASSIS", order: 6 }
};
const FUEL_DEFAULT_META = { editionTag: "VINTAGE EDITION", subTag: "MECHANICAL FLUID WICK", specs: "SOLID BRASS / FLINT ROLLER", order: 99 };

const CARE_EDITORIAL_META = {
    "The Collector's Care Kit": { editionTag: "COMPLETE ATELIER SUITE", subTag: "01 / TOTAL RESTORATION", specs: "SOLID MAHOGANY VAULT / 8 RESTORATION INSTRUMENTS", order: 1 },
    "The Butane Essence": { editionTag: "ZERO IMPURITY FORMULA", subTag: "02 / FUEL ESSENCE", specs: "250ML CYLINDER / MULTI-NOZZLE ADAPTER", order: 2 },
    "The Travel Capsule": { editionTag: "POCKET EDC CANISTER", subTag: "03 / TRAVEL ESSENTIAL", specs: "ANODIZED ALUMINUM / SAFETY RELIEF VALVE", order: 3 },
    "The Restoration Vault": { editionTag: "HOROLOGY GRADE", subTag: "04 / PRECISION TOOLS", specs: "SOLID WALNUT / HOROLOGY BRASS INSTRUMENTS", order: 4 },
    "The Pure Petroleum Fluid": { editionTag: "ZERO-CARBON FUEL", subTag: "05 / PETROL FLUID ESSENCE", specs: "150ML BRASS FLACON / HIGH-PURITY DISTILLATE", order: 5 },
    "Haute Jewelers Rouge & Microfiber": { editionTag: "PRECIOUS METAL CARE", subTag: "06 / MIRROR LUSTER", specs: "200G ATELIER PASTE / DENSE MICROFIBER CLOTH", order: 6 }
};
const CARE_DEFAULT_META = { editionTag: "ATELIER ESSENTIAL", subTag: "MAINTENANCE & CARE", specs: "GENUINE ATELIER ACCESSORY", order: 99 };

const sortCollectionProducts = (products, sort) => {
    if (sort === "price_asc") {
        products.sort((a, b) => a.effectivePrice - b.effectivePrice);
    } else if (sort === "price_desc") {
        products.sort((a, b) => b.effectivePrice - a.effectivePrice);
    } else if (sort === "name_asc") {
        products.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === "name_desc") {
        products.sort((a, b) => b.name.localeCompare(a.name));
    } else if (sort === "newest") {
        products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else {
        products.sort((a, b) => a.order - b.order);
    }
};

const renderCollectionPage = async (req, res, next, config) => {
    try {
        const userId = getAuthenticatedUserId(req);
        const isUserLoggedIn = Boolean(userId);
        let currentUser = null;

        if (isUserLoggedIn) {
            currentUser = await resolveRequestUser(req, User);
            if (!currentUser || currentUser.isBlocked) {
                return handleBlockedUser(req, res);
            }
        }

        const { sort = "curated" } = req.query;

        const category = await Category.findOne({
            name: { $regex: config.categoryRegex },
            isDeleted: false,
            isListed: true
        }).lean();

        if (!category) {
            return res.redirect("/products");
        }

        const now = new Date();
        const [productsRaw, activeCategoryOffer, wishlistProductIds] = await Promise.all([
            Product.find({ category: category._id, isDeleted: false, isListed: true })
                .populate("category", "name")
                .populate("appliedOffer")
                .lean(),
            Offer.findOne({
                offerType: "category",
                category: category._id,
                isActive: true,
                isDeleted: false,
                startDate: { $lte: now },
                endDate: { $gte: now }
            }).lean(),
            (isUserLoggedIn && config.withWishlist !== false)
                ? wishlistService.getWishlistProductIds(userId)
                : Promise.resolve([])
        ]);

        const products = productsRaw.map((p) => {
            if (!p.appliedOffer && activeCategoryOffer) {
                p.appliedOffer = activeCategoryOffer;
            }
            const meta = config.editorialMeta[p.name] || config.defaultMeta;
            const mapped = {
                ...p,
                effectivePrice: p.salePrice || p.regularPrice,
                editionTag: meta.editionTag,
                specs: meta.specs,
                order: meta.order
            };
            if (meta.flameTag) mapped.flameTag = meta.flameTag;
            if (meta.subTag) mapped.subTag = meta.subTag;
            if (config.singleImageFallback) {
                mapped.images = (Array.isArray(p.images) && p.images.length > 0)
                    ? [p.images[0]]
                    : ["/uploads/care/collector_care_kit.jpg"];
            }
            return mapped;
        });

        sortCollectionProducts(products, sort);

        if (req.xhr || req.query.format === "json" || req.headers.accept?.includes("application/json")) {
            const jsonPayload = { success: true, products, category, sort };
            if (config.withWishlist !== false) jsonPayload.wishlistProductIds = wishlistProductIds;
            return res.status(HTTP_STATUS.OK).json(jsonPayload);
        }

        const renderPayload = {
            pageTitle: config.pageTitle,
            isUserLoggedIn,
            userId,
            user: currentUser,
            category,
            products,
            activeSort: sort,
            activeCategoryOffer
        };
        if (config.withWishlist !== false) renderPayload.wishlistProductIds = wishlistProductIds;

        return res.status(HTTP_STATUS.OK).render(config.viewName, renderPayload);
    } catch (err) {
        console.error(`User productController ${config.viewName} error:`, err);
        return next(err);
    }
};

export const getGasLightersPage = (req, res, next) => renderCollectionPage(req, res, next, {
    categoryRegex: /^gas\s*lighters$/i,
    viewName: "gasLighters",
    pageTitle: "The Gas Collection — Haute Briquet & Precision Flame | ROYAL IGNITE",
    editorialMeta: GAS_EDITORIAL_META,
    defaultMeta: GAS_DEFAULT_META
});

export const getElectricLightersPage = (req, res, next) => renderCollectionPage(req, res, next, {
    categoryRegex: /^electric\s*lighters$/i,
    viewName: "electricLighters",
    pageTitle: "The Electric Collection — Pure Resonance & Dual-Arc Plasma | ROYAL IGNITE",
    editorialMeta: ELECTRIC_EDITORIAL_META,
    defaultMeta: ELECTRIC_DEFAULT_META
});

export const getFuelLightersPage = (req, res, next) => renderCollectionPage(req, res, next, {
    categoryRegex: /^fuel\s*lighters$/i,
    viewName: "fuelLighters",
    pageTitle: "The Fuel Collection — Mechanical Heritage & Organic Flame | ROYAL IGNITE",
    editorialMeta: FUEL_EDITORIAL_META,
    defaultMeta: FUEL_DEFAULT_META
});

export const getRefillsAndCarePage = (req, res, next) => renderCollectionPage(req, res, next, {
    categoryRegex: /^refills?\s*(and|&)\s*care$/i,
    viewName: "refillsAndCare",
    pageTitle: "Preserve The Flame — Refills & Atelier Care | ROYAL IGNITE",
    editorialMeta: CARE_EDITORIAL_META,
    defaultMeta: CARE_DEFAULT_META,
    singleImageFallback: true,
    withWishlist: false
});

export default {
    getProductList,
    getProductDetails,
    getGasLightersPage,
    getElectricLightersPage,
    getFuelLightersPage,
    getRefillsAndCarePage
};


