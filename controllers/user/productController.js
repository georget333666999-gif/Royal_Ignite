import User from "../../models/userModel.js";
import Cart from "../../models/cartModel.js";
import Wishlist from "../../models/wishlistModel.js";
import Offer from "../../models/offerModel.js";
import productService from "../../services/user/productService.js";
import wishlistService from "../../services/user/wishlistService.js";
import { HTTP_STATUS, RESPONSE_MESSAGES } from "../../constants/index.js";
import { getAuthenticatedUserId, handleBlockedUser } from "../../utils/authSession.js";

// Controller to handle public Product Listing / Shop
export const getProductList = async (req, res, next) => {
    try {
        // 1. Session & Auth Check
        const userId = getAuthenticatedUserId(req);
        const isUserLoggedIn = Boolean(userId);
        let currentUser = null;

        if (isUserLoggedIn) {
            currentUser = await User.findById(userId);
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

        // 3. Fetch products and categories via service
        const data = await productService.getShopProducts({
            search: typeof search === "string" ? search.trim() : "",
            category: typeof category === "string" ? category.trim() : "",
            minPrice: minPrice !== "" ? Number(minPrice) : undefined,
            maxPrice: maxPrice !== "" ? Number(maxPrice) : undefined,
            sort: typeof sort === "string" ? sort.trim() : "newest",
            inStockOnly: inStockOnly === "true" || inStockOnly === true,
            page: parseInt(page, 10) || 1,
            limit: parseInt(limit, 10) || 9
        });

        const wishlistProductIds = isUserLoggedIn ? await wishlistService.getWishlistProductIds(userId) : [];

        // 4. Return JSON if requested via AJAX
        if (req.xhr || req.query.format === "json" || req.headers.accept?.includes("application/json")) {
            return res.status(HTTP_STATUS.OK).json({
                success: true,
                ...data,
                wishlistProductIds,
                query: {
                    search,
                    category,
                    minPrice,
                    maxPrice,
                    sort,
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
            search: search.trim(),
            category: data.selectedCategoryId || category.trim(),
            minPrice: minPrice !== "" ? Number(minPrice) : "",
            maxPrice: maxPrice !== "" ? Number(maxPrice) : "",
            sort: sort.trim(),
            inStockOnly: inStockOnly === "true" || inStockOnly === true,
            errorMessage: req.query.error || req.query.errorMessage || req.session?.errorMessage || null
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
            currentUser = await User.findById(userId);
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

        // 3. Fetch related products from category
        const relatedProducts = await productService.getRelatedProducts(
            product._id,
            product.category?._id,
            4
        );

        // Check if product is already in user's cart and wishlist
        let isInCart = false;
        let isInWishlist = false;
        let userWishlistIds = [];
        if (isUserLoggedIn) {
            const [existingCart, existingWishlist] = await Promise.all([
                Cart.findOne({ user: userId, "items.product": product._id }),
                Wishlist.findOne({ user: userId })
            ]);
            isInCart = Boolean(existingCart);
            if (existingWishlist && Array.isArray(existingWishlist.products)) {
                userWishlistIds = existingWishlist.products.map(p => p.toString());
                isInWishlist = userWishlistIds.includes(product._id.toString());
            }
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

// Controller to handle bespoke Gas Lighters editorial landing page

export const getGasLightersPage = async (req, res, next) => {
    try {
        // 1. Session & Auth Check
        const userId = getAuthenticatedUserId(req);
        const isUserLoggedIn = Boolean(userId);
        let currentUser = null;

        if (isUserLoggedIn) {
            currentUser = await User.findById(userId);
            if (!currentUser || currentUser.isBlocked) {
                return handleBlockedUser(req, res);
            }
        }

        const { sort = "curated" } = req.query;

        // 2. Fetch the Gas Lighters category
        const Category = (await import("../../models/categoryModel.js")).default;
        const Product = (await import("../../models/productModel.js")).default;

        const gasCategory = await Category.findOne({
            name: { $regex: /^gas\s*lighters$/i },
            isDeleted: false,
            isListed: true
        }).lean();

        if (!gasCategory) {
            return res.redirect("/products");
        }

        // 3. Fetch products under Gas Lighters
        const productsQuery = {
            category: gasCategory._id,
            isDeleted: false,
            isListed: true
        };

        const now = new Date();
        const [gasProductsRaw, activeCategoryOffer] = await Promise.all([
            Product.find(productsQuery)
                .populate("category", "name")
                .populate("appliedOffer")
                .lean(),
            Offer.findOne({
                offerType: "category",
                category: gasCategory._id,
                isActive: true,
                isDeleted: false,
                startDate: { $lte: now },
                endDate: { $gte: now }
            }).lean()
        ]);

        let gasProducts = gasProductsRaw.map((p) => {
            if (!p.appliedOffer && activeCategoryOffer) {
                p.appliedOffer = activeCategoryOffer;
            }
            return p;
        });

        // Specific editorial specs & metadata for the 6 models
        const editorialMeta = {
            "The Apex": {
                editionTag: "SIGNATURE SERIES",
                flameTag: "DUAL CERAMIC JET — 1,300°C",
                specs: "AEROSPACE GRADE ALLOY / DUAL-JET TORCH",
                order: 1
            },
            "The Titan": {
                editionTag: "LIMITED TO 250 PIECES",
                flameTag: "HEAVYWEIGHT BILLET BRASS",
                specs: "SOLID BRASS / ENGINE-TURNED PATTERN",
                order: 2
            },
            "The Vanguard": {
                editionTag: "PRECISION ENGINEERING",
                flameTag: "ANGULAR JET TORCH",
                specs: "GUNMETAL FINISH / BLUE TORCH FLAME",
                order: 3
            },
            "The Vertex": {
                editionTag: "SLIMLINE LUXURY",
                flameTag: "STERLING COLUMNAR",
                specs: "925 STERLING SILVER / LINEAR BURNER",
                order: 4
            },
            "The Orion": {
                editionTag: "THE HEIRLOOM EDITION",
                flameTag: "HAND-CHASED FILIGREE",
                specs: "ANTIQUE ROSE GOLD / FLUID BUTANE RESERVOIR",
                order: 5
            },
            "The Eclipse": {
                editionTag: "ATELIER PROTOTYPE",
                flameTag: "DUAL-FINISH CHROME",
                specs: "MIRROR CHROME & SATIN OBSIDIAN",
                order: 6
            }
        };

        // Attach editorial metadata
        gasProducts = gasProducts.map((p) => {
            const meta = editorialMeta[p.name] || {
                editionTag: "ATELIER EDITION",
                flameTag: "PRECISION BUTANE JET",
                specs: "PRECISION ALLOY / TORCH FLAME",
                order: 99
            };
            return {
                ...p,
                effectivePrice: p.salePrice || p.regularPrice,
                editionTag: meta.editionTag,
                flameTag: meta.flameTag,
                specs: meta.specs,
                order: meta.order
            };
        });

        // 4. Sort handling
        if (sort === "price_asc") {
            gasProducts.sort((a, b) => a.effectivePrice - b.effectivePrice);
        } else if (sort === "price_desc") {
            gasProducts.sort((a, b) => b.effectivePrice - a.effectivePrice);
        } else if (sort === "name_asc") {
            gasProducts.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sort === "name_desc") {
            gasProducts.sort((a, b) => b.name.localeCompare(a.name));
        } else if (sort === "newest") {
            gasProducts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } else {
            // Default curated sequence matching editorial layout
            gasProducts.sort((a, b) => a.order - b.order);
        }

        const wishlistProductIds = isUserLoggedIn ? await wishlistService.getWishlistProductIds(userId) : [];

        // Return JSON if requested via AJAX
        if (req.xhr || req.query.format === "json" || req.headers.accept?.includes("application/json")) {
            return res.status(HTTP_STATUS.OK).json({
                success: true,
                products: gasProducts,
                category: gasCategory,
                sort,
                wishlistProductIds
            });
        }

        return res.status(HTTP_STATUS.OK).render("gasLighters", {
            pageTitle: "The Gas Collection — Haute Briquet & Precision Flame | ROYAL IGNITE",
            isUserLoggedIn,
            userId,
            user: currentUser,
            category: gasCategory,
            products: gasProducts,
            activeSort: sort,
            wishlistProductIds,
            activeCategoryOffer
        });
    } catch (err) {
        console.error("User productController getGasLightersPage error:", err);
        return next(err);
    }
};

// Controller to handle bespoke Electric Lighters editorial landing page
 
export const getElectricLightersPage = async (req, res, next) => {
    try {
        // 1. Session & Auth Check
        const userId = getAuthenticatedUserId(req);
        const isUserLoggedIn = Boolean(userId);
        let currentUser = null;

        if (isUserLoggedIn) {
            currentUser = await User.findById(userId);
            if (!currentUser || currentUser.isBlocked) {
                return handleBlockedUser(req, res);
            }
        }

        const { sort = "curated" } = req.query;

        // 2. Fetch the Electric Lighters category
        const Category = (await import("../../models/categoryModel.js")).default;
        const Product = (await import("../../models/productModel.js")).default;

        const electricCategory = await Category.findOne({
            name: { $regex: /^electric\s*lighters$/i },
            isDeleted: false,
            isListed: true
        }).lean();

        if (!electricCategory) {
            return res.redirect("/products");
        }

        // 3. Fetch products under Electric Lighters
        const productsQuery = {
            category: electricCategory._id,
            isDeleted: false,
            isListed: true
        };

        const now = new Date();
        const [electricProductsRaw, activeCategoryOffer] = await Promise.all([
            Product.find(productsQuery)
                .populate("category", "name")
                .populate("appliedOffer")
                .lean(),
            Offer.findOne({
                offerType: "category",
                category: electricCategory._id,
                isActive: true,
                isDeleted: false,
                startDate: { $lte: now },
                endDate: { $gte: now }
            }).lean()
        ]);

        let electricProducts = electricProductsRaw.map((p) => {
            if (!p.appliedOffer && activeCategoryOffer) {
                p.appliedOffer = activeCategoryOffer;
            }
            return p;
        });

        // Specific editorial specs & metadata for the 6 electric models
        const editorialMeta = {
            "The Aether": {
                editionTag: "FLAGSHIP EDITION",
                subTag: "01 / DUAL-ARC PLASMA",
                specs: "GRADE 5 TITANIUM / 42,000 HZ PULSE FREQUENCY / USB-C FAST CHARGE",
                order: 1
            },
            "The Tether": {
                editionTag: "DUAL VOLTAGE CERAMIC CORE",
                subTag: "02 / RESONANCE",
                specs: "MATTE DLC CHROME / DUAL VOLTAGE CERAMIC CORE",
                order: 2
            },
            "The Zenith": {
                editionTag: "POCKET SLIMLINE",
                subTag: "03 / LINEAR ARC",
                specs: "OBSIDIAN ALLOY / LINEAR PLASMA BLADE",
                order: 3
            },
            "The Solis": {
                editionTag: "MINIMALIST COLUMN",
                subTag: "04 / RADIAL IGNITION",
                specs: "BRUSHED STERLING & ALUMINUM / COLUMNAR PROFILE",
                order: 4
            },
            "The Lumina": {
                editionTag: "SCULPTURAL EDITION",
                subTag: "05 / ERGONOMICS",
                specs: "MIRROR BRONZE / ERGONOMIC DUAL ARC",
                order: 5
            },
            "The Halo": {
                editionTag: "CIRCULAR INDUCTION COIL",
                subTag: "06 / TESLA CORE",
                specs: "CIRCULAR INDUCTION COIL / TESLA CORE / VOLCANIC SLATE",
                order: 6
            }
        };

        // Attach editorial metadata
        electricProducts = electricProducts.map((p) => {
            const meta = editorialMeta[p.name] || {
                editionTag: "PLASMA EDITION",
                subTag: "DUAL-ARC MODULE",
                specs: "TITANIUM ALLOY / SOLID-STATE POWER",
                order: 99
            };
            return {
                ...p,
                effectivePrice: p.salePrice || p.regularPrice,
                editionTag: meta.editionTag,
                subTag: meta.subTag,
                specs: meta.specs,
                order: meta.order
            };
        });

        // 4. Sort handling
        if (sort === "price_asc") {
            electricProducts.sort((a, b) => a.effectivePrice - b.effectivePrice);
        } else if (sort === "price_desc") {
            electricProducts.sort((a, b) => b.effectivePrice - a.effectivePrice);
        } else if (sort === "name_asc") {
            electricProducts.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sort === "name_desc") {
            electricProducts.sort((a, b) => b.name.localeCompare(a.name));
        } else if (sort === "newest") {
            electricProducts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } else {
            // Default curated sequence matching editorial layout
            electricProducts.sort((a, b) => a.order - b.order);
        }

        const wishlistProductIds = isUserLoggedIn ? await wishlistService.getWishlistProductIds(userId) : [];

        // Return JSON if requested via AJAX
        if (req.xhr || req.query.format === "json" || req.headers.accept?.includes("application/json")) {
            return res.status(HTTP_STATUS.OK).json({
                success: true,
                products: electricProducts,
                category: electricCategory,
                sort,
                wishlistProductIds
            });
        }

        return res.status(HTTP_STATUS.OK).render("electricLighters", {
            pageTitle: "The Electric Collection — Pure Resonance & Dual-Arc Plasma | ROYAL IGNITE",
            isUserLoggedIn,
            userId,
            user: currentUser,
            category: electricCategory,
            products: electricProducts,
            activeSort: sort,
            wishlistProductIds,
            activeCategoryOffer
        });
    } catch (err) {
        console.error("User productController getElectricLightersPage error:", err);
        return next(err);
    }
};

// Controller to handle bespoke Fuel Lighters editorial landing page
export const getFuelLightersPage = async (req, res, next) => {
    try {
        // 1. Session & Auth Check
        const userId = getAuthenticatedUserId(req);
        const isUserLoggedIn = Boolean(userId);
        let currentUser = null;

        if (isUserLoggedIn) {
            currentUser = await User.findById(userId);
            if (!currentUser || currentUser.isBlocked) {
                return handleBlockedUser(req, res);
            }
        }

        const { sort = "curated" } = req.query;

        // 2. Fetch the Fuel Lighters category
        const Category = (await import("../../models/categoryModel.js")).default;
        const Product = (await import("../../models/productModel.js")).default;

        const fuelCategory = await Category.findOne({
            name: { $regex: /^fuel\s*lighters$/i },
            isDeleted: false,
            isListed: true
        }).lean();

        if (!fuelCategory) {
            return res.redirect("/products");
        }

        // 3. Fetch products under Fuel Lighters
        const productsQuery = {
            category: fuelCategory._id,
            isDeleted: false,
            isListed: true
        };

        const now = new Date();
        const [fuelProductsRaw, activeCategoryOffer] = await Promise.all([
            Product.find(productsQuery)
                .populate("category", "name")
                .populate("appliedOffer")
                .lean(),
            Offer.findOne({
                offerType: "category",
                category: fuelCategory._id,
                isActive: true,
                isDeleted: false,
                startDate: { $lte: now },
                endDate: { $gte: now }
            }).lean()
        ]);

        let fuelProducts = fuelProductsRaw.map((p) => {
            if (!p.appliedOffer && activeCategoryOffer) {
                p.appliedOffer = activeCategoryOffer;
            }
            return p;
        });

        // Specific editorial specs & metadata for the 6 fuel models
        const editorialMeta = {
            "The Heritage 1924": {
                editionTag: "ARCHIVAL FLAGSHIP",
                subTag: "01 / MECHANICAL PATENT",
                specs: "SOLID NAVAL BRASS / DUAL COTTON WICK",
                order: 1
            },
            "The Chesterfield 1920": {
                editionTag: "ARCHIVAL LIFT-ARM",
                subTag: "02 / 1920s AUTOMATON",
                specs: "925 STERLING & 18K ROSE GOLD / SPRING SNUFFER",
                order: 2
            },
            "The Chesterfield": {
                editionTag: "ARCHIVAL LIFT-ARM",
                subTag: "02 / 1920s AUTOMATON",
                specs: "925 STERLING & 18K ROSE GOLD / SPRING SNUFFER",
                order: 2
            },
            "The Baronet": {
                editionTag: "ARCHIVAL LIFT-ARM",
                subTag: "02 / 1920s AUTOMATON",
                specs: "925 STERLING & 18K ROSE GOLD / SPRING SNUFFER",
                order: 2
            },
            "The Commander": {
                editionTag: "TRENCH CLASSIC",
                subTag: "03 / FIELD TRENCH CHIMNEY",
                specs: "GUNMETAL BRONZE / WINDPROOF CHIMNEY",
                order: 3
            },
            "The Monarch Sovereign": {
                editionTag: "IMPERIAL EDITION",
                subTag: "04 / 24K ROYAL REGALIA",
                specs: "24K GOLD PLATED / HAND-CHASED ACANTHUS",
                order: 4
            },
            "The Aeronaut": {
                editionTag: "STREAMLINE ART DECO",
                subTag: "05 / ART DECO MODERNE",
                specs: "NICKEL SILVER / HORIZONTAL FLINT ROLLER",
                order: 5
            },
            "The Aurelius Imperial": {
                editionTag: "HAUTE HOROLOGY",
                subTag: "06 / SUNBURST GUILLOCHÉ",
                specs: "OBSIDIAN TITANIUM / 18K GOLD GUILLOCHÉ CHASSIS",
                order: 6
            },
            "The Black Watch": {
                editionTag: "HAUTE HOROLOGY",
                subTag: "06 / SUNBURST GUILLOCHÉ",
                specs: "OBSIDIAN TITANIUM / 18K GOLD GUILLOCHÉ CHASSIS",
                order: 6
            }
        };

        // Attach editorial metadata
        fuelProducts = fuelProducts.map((p) => {
            const meta = editorialMeta[p.name] || {
                editionTag: "VINTAGE EDITION",
                subTag: "MECHANICAL FLUID WICK",
                specs: "SOLID BRASS / FLINT ROLLER",
                order: 99
            };
            return {
                ...p,
                effectivePrice: p.salePrice || p.regularPrice,
                editionTag: meta.editionTag,
                subTag: meta.subTag,
                specs: meta.specs,
                order: meta.order
            };
        });

        // 4. Sort handling
        if (sort === "price_asc") {
            fuelProducts.sort((a, b) => a.effectivePrice - b.effectivePrice);
        } else if (sort === "price_desc") {
            fuelProducts.sort((a, b) => b.effectivePrice - a.effectivePrice);
        } else if (sort === "name_asc") {
            fuelProducts.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sort === "name_desc") {
            fuelProducts.sort((a, b) => b.name.localeCompare(a.name));
        } else if (sort === "newest") {
            fuelProducts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } else {
            // Default curated sequence matching editorial layout
            fuelProducts.sort((a, b) => a.order - b.order);
        }

        const wishlistProductIds = isUserLoggedIn ? await wishlistService.getWishlistProductIds(userId) : [];

        // Return JSON if requested via AJAX
        if (req.xhr || req.query.format === "json" || req.headers.accept?.includes("application/json")) {
            return res.status(HTTP_STATUS.OK).json({
                success: true,
                products: fuelProducts,
                category: fuelCategory,
                sort,
                wishlistProductIds
            });
        }

        return res.status(HTTP_STATUS.OK).render("fuelLighters", {
            pageTitle: "The Fuel Collection — Mechanical Heritage & Organic Flame | ROYAL IGNITE",
            isUserLoggedIn,
            userId,
            user: currentUser,
            category: fuelCategory,
            products: fuelProducts,
            activeSort: sort,
            wishlistProductIds,
            activeCategoryOffer
        });
    } catch (err) {
        console.error("User productController getFuelLightersPage error:", err);
        return next(err);
    }
};

// Controller to handle bespoke Refills and Care editorial landing page
 
export const getRefillsAndCarePage = async (req, res, next) => {
    try {
        // 1. Session & Auth Check
        const userId = getAuthenticatedUserId(req);
        const isUserLoggedIn = Boolean(userId);
        let currentUser = null;

        if (isUserLoggedIn) {
            currentUser = await User.findById(userId);
            if (!currentUser || currentUser.isBlocked) {
                return handleBlockedUser(req, res);
            }
        }

        const { sort = "curated" } = req.query;

        // 2. Fetch the Refills and Care category
        const Category = (await import("../../models/categoryModel.js")).default;
        const Product = (await import("../../models/productModel.js")).default;

        const careCategory = await Category.findOne({
            name: { $regex: /^refills?\s*(and|&)\s*care$/i },
            isDeleted: false,
            isListed: true
        }).lean();

        if (!careCategory) {
            return res.redirect("/products");
        }

        // 3. Fetch products under Refills and Care
        const productsQuery = {
            category: careCategory._id,
            isDeleted: false,
            isListed: true
        };

        const now = new Date();
        const [careProductsRaw, activeCategoryOffer] = await Promise.all([
            Product.find(productsQuery)
                .populate("category", "name")
                .populate("appliedOffer")
                .lean(),
            Offer.findOne({
                offerType: "category",
                category: careCategory._id,
                isActive: true,
                isDeleted: false,
                startDate: { $lte: now },
                endDate: { $gte: now }
            }).lean()
        ]);

        let careProducts = careProductsRaw.map((p) => {
            if (!p.appliedOffer && activeCategoryOffer) {
                p.appliedOffer = activeCategoryOffer;
            }
            return p;
        });

        // Specific editorial specs & metadata for Refills & Care
        const editorialMeta = {
            "The Collector's Care Kit": {
                editionTag: "COMPLETE ATELIER SUITE",
                subTag: "01 / TOTAL RESTORATION",
                specs: "SOLID MAHOGANY VAULT / 8 RESTORATION INSTRUMENTS",
                order: 1
            },
            "The Butane Essence": {
                editionTag: "ZERO IMPURITY FORMULA",
                subTag: "02 / FUEL ESSENCE",
                specs: "250ML CYLINDER / MULTI-NOZZLE ADAPTER",
                order: 2
            },
            "The Travel Capsule": {
                editionTag: "POCKET EDC CANISTER",
                subTag: "03 / TRAVEL ESSENTIAL",
                specs: "ANODIZED ALUMINUM / SAFETY RELIEF VALVE",
                order: 3
            },
            "The Restoration Vault": {
                editionTag: "HOROLOGY GRADE",
                subTag: "04 / PRECISION TOOLS",
                specs: "SOLID WALNUT / HOROLOGY BRASS INSTRUMENTS",
                order: 4
            },
            "The Pure Petroleum Fluid": {
                editionTag: "ZERO-CARBON FUEL",
                subTag: "05 / PETROL FLUID ESSENCE",
                specs: "150ML BRASS FLACON / HIGH-PURITY DISTILLATE",
                order: 5
            },
            "Haute Jewelers Rouge & Microfiber": {
                editionTag: "PRECIOUS METAL CARE",
                subTag: "06 / MIRROR LUSTER",
                specs: "200G ATELIER PASTE / DENSE MICROFIBER CLOTH",
                order: 6
            }
        };

        // Attach editorial metadata
        careProducts = careProducts.map((p) => {
            const meta = editorialMeta[p.name] || {
                editionTag: "ATELIER ESSENTIAL",
                subTag: "MAINTENANCE & CARE",
                specs: "GENUINE ATELIER ACCESSORY",
                order: 99
            };
            return {
                ...p,
                images: (Array.isArray(p.images) && p.images.length > 0) ? [p.images[0]] : ['/uploads/care/collector_care_kit.jpg'],
                effectivePrice: p.salePrice || p.regularPrice,
                editionTag: meta.editionTag,
                subTag: meta.subTag,
                specs: meta.specs,
                order: meta.order
            };
        });

        // 4. Sort handling
        if (sort === "price_asc") {
            careProducts.sort((a, b) => a.effectivePrice - b.effectivePrice);
        } else if (sort === "price_desc") {
            careProducts.sort((a, b) => b.effectivePrice - a.effectivePrice);
        } else if (sort === "name_asc") {
            careProducts.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sort === "name_desc") {
            careProducts.sort((a, b) => b.name.localeCompare(a.name));
        } else if (sort === "newest") {
            careProducts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } else {
            // Default curated sequence matching editorial layout
            careProducts.sort((a, b) => a.order - b.order);
        }

        // Return JSON if requested via AJAX
        if (req.xhr || req.query.format === "json" || req.headers.accept?.includes("application/json")) {
            return res.status(HTTP_STATUS.OK).json({
                success: true,
                products: careProducts,
                category: careCategory,
                sort
            });
        }

        return res.status(HTTP_STATUS.OK).render("refillsAndCare", {
            pageTitle: "Preserve The Flame — Refills & Atelier Care | ROYAL IGNITE",
            isUserLoggedIn,
            userId,
            user: currentUser,
            category: careCategory,
            products: careProducts,
            activeSort: sort,
            activeCategoryOffer
        });
    } catch (err) {
        console.error("User productController getRefillsAndCarePage error:", err);
        return next(err);
    }
};

export default {
    getProductList,
    getProductDetails,
    getGasLightersPage,
    getElectricLightersPage,
    getFuelLightersPage,
    getRefillsAndCarePage
};


