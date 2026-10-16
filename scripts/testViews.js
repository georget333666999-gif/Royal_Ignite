import app from "../app.js";

const viewsToTest = [
    // Admin views
    { name: "auth/login", data: { error: null, email: "" } },
    { name: "dashboard", data: { totalUsers: 5, totalProducts: 12, totalCategories: 4 } },
    { name: "analytics", data: { totalUsers: 5, totalProducts: 12, totalCategories: 4 } },
    { name: "auth/forgotPassword", data: { error: null } },
    { name: "auth/verifyOtp", data: { error: null, success: null } },
    { name: "auth/resetPassword", data: { error: null } },
    { name: "auth/resetSuccess", data: {} },
    { name: "users/userList", data: {
        users: [], search: "", statusFilter: "all", limit: 4, currentPage: 1, totalPages: 1,
        totalUsers: 0, totalCustomers: 0, activeUsers: 0, blockedUsers: 0, inactiveUsers: 0,
        error: null, success: null
    }},
    { name: "categories/categoryList", data: {
        categories: [], search: "", statusFilter: "all", limit: 5, currentPage: 1, totalPages: 1,
        totalMatching: 0, totalCategories: 0, activeCategories: 0, unlistedCategories: 0, deletedCategories: 0,
        error: null, success: null
    }},
    { name: "products/productList", data: {
        products: [], categories: [], search: "", categoryId: "", statusFilter: "all", limit: 6, currentPage: 1, totalPages: 1,
        totalMatching: 0, totalProducts: 0, activeProducts: 0, unlistedProducts: 0, outOfStockProducts: 0, deletedProducts: 0,
        error: null, success: null
    }},
    { name: "products/productForm", data: {
        mode: "add", product: {}, categories: [], error: null, success: null
    }},
    { name: "orders/orderList", data: {
        pageTitle: "Order Management — ROYAL IGNITE Admin",
        adminUser: { username: "Administrator", role: "Super Admin" },
        orders: [
            {
                orderId: "RYL-20261013-8472",
                createdAt: new Date(),
                orderStatus: "Placed",
                paymentMethod: "COD",
                paymentStatus: "Pending",
                pricing: { totalAmount: 9999 },
                shippingAddress: {
                    fullName: "Lord Collector",
                    phone: "9876543210"
                },
                user: {
                    name: "Lord Collector",
                    email: "collector@example.com",
                    phone: "9876543210"
                },
                items: [
                    {
                        name: "The Sovereign",
                        quantity: 1,
                        price: 9999,
                        lineTotal: 9999
                    }
                ]
            }
        ],
        totalOrders: 1,
        totalPages: 1,
        currentPage: 1,
        limit: 10,
        search: "",
        status: "all",
        sort: "newest",
        stats: {
            totalOrdersCount: 1,
            pendingCount: 1,
            processingCount: 0,
            shippedCount: 0,
            outForDeliveryCount: 0,
            deliveredCount: 0,
            cancelledCount: 0,
            returnedCount: 0,
            grossRevenue: 9999
        },
        error: null,
        success: null
    }},
    { name: "orders/orderDetails", data: {
        pageTitle: "Order #RYL-20261013-8472 — ROYAL IGNITE Admin",
        adminUser: { username: "Administrator", role: "Super Admin" },
        order: {
            orderId: "RYL-20261013-8472",
            createdAt: new Date(),
            orderStatus: "Placed",
            paymentMethod: "COD",
            paymentStatus: "Pending",
            deliveredAt: null,
            cancelledAt: null,
            returnedAt: null,
            cancellationReason: null,
            returnReason: null,
            shippingAddress: {
                fullName: "Lord Collector",
                phone: "9876543210",
                addressLine: "Estate 4B",
                city: "Mumbai",
                state: "Maharashtra",
                pincode: "400001",
                country: "India",
                addressType: "Home"
            },
            user: {
                name: "Lord Collector",
                email: "collector@example.com",
                phone: "9876543210",
                isBlocked: false,
                createdAt: new Date()
            },
            pricing: {
                subtotal: 9999,
                discount: 0,
                shippingFee: 0,
                totalAmount: 9999
            },
            items: [
                {
                    product: "654321654321654321654321",
                    name: "The Sovereign",
                    categoryName: "Sterling Silver",
                    quantity: 1,
                    price: 9999,
                    lineTotal: 9999,
                    status: "Placed",
                    image: "/uploads/monarch_lighter.png"
                }
            ]
        },
        error: null,
        success: null
    }},
    { name: "inventory/inventoryList", data: {
        pageTitle: "Vault & Stock Governance — ROYAL IGNITE Admin",
        adminUser: { username: "Administrator", role: "Super Admin" },
        products: [
            {
                _id: "654321654321654321654321",
                name: "The Sovereign",
                category: { _id: "cat1", name: "Sterling Silver" },
                regularPrice: 12500,
                salePrice: 9999,
                stock: 8,
                images: ["/uploads/monarch_lighter.png"]
            }
        ],
        categories: [
            { _id: "cat1", name: "Sterling Silver" }
        ],
        metrics: {
            totalProducts: 1,
            totalUnits: 8,
            healthyStockCount: 1,
            lowStockCount: 0,
            outOfStockCount: 0
        },
        totalMatching: 1,
        totalPages: 1,
        currentPage: 1,
        limit: 10,
        search: "",
        categoryId: "all",
        stockFilter: "all",
        sort: "stock_asc",
        error: null,
        success: null
    }},
    // User views
    { name: "index", data: { isUserLoggedIn: false, userId: null } },
    { name: "login", data: { error: null, success: null, formData: {} } },
    { name: "signup", data: { error: null, formData: {} } },
    { name: "verifyOtp", data: { error: null, success: null, remainingSeconds: 60, isExpired: false } },
    { name: "forgotPassword", data: { error: null, success: null } },
    { name: "resetPassword", data: { error: null, remainingSeconds: 60, isExpired: false } },
    { name: "profile", data: { user: { name: "Test", email: "test@example.com", phone: "1234567890", isVerified: true, profileImage: null }, addresses: [], success: null, error: null } },
    { name: "editProfile", data: { user: { name: "Test", email: "test@example.com", phone: "1234567890" }, error: null, success: null } },
    { name: "changePassword", data: { user: {}, error: null, success: null } },
    { name: "changeEmail", data: { error: null, currentEmail: "test@example.com", newEmail: "" } },
    { name: "verifyEmailOtp", data: { pendingEmail: "test@example.com", error: null } },
    { name: "addresses", data: { addresses: [], error: null, success: null } },
    { name: "addAddress", data: { error: null, formData: {} } },
    { name: "editAddress", data: { address: { _id: "123", fullName: "Test", phone: "9876543210", addressLine: "Street 1", city: "City", state: "State", pincode: "123456", country: "India", addressType: "Home", isDefault: false }, error: null } },
    { name: "shop", data: { pageTitle: "The Collection", isUserLoggedIn: false, userId: null, user: null, products: [], categories: [], totalProducts: 0, totalPages: 1, currentPage: 1, limit: 9, totalActiveProducts: 0, search: "", category: "", minPrice: "", maxPrice: "", sort: "newest", inStockOnly: false } },
    { name: "productDetails", data: {
        pageTitle: "Test Product",
        isUserLoggedIn: false,
        userId: null,
        user: null,
        product: {
            _id: "654321654321654321654321",
            name: "The Sovereign",
            description: "Sterling silver luxury lighter",
            category: { _id: "111111111111111111111111", name: "Sterling Silver" },
            regularPrice: 12500,
            salePrice: 9999,
            effectivePrice: 9999,
            hasDiscount: true,
            discountAmount: 2501,
            discountPercent: 20,
            stock: 10,
            images: ["/uploads/monarch_lighter.png", "/uploads/hero_lighter.png", "/uploads/heritage_lighter.png"]
        },
        relatedProducts: []
    }},
    { name: "cart", data: {
        pageTitle: "Your Atelier Bag",
        isUserLoggedIn: true,
        userId: "12345",
        user: { name: "Lord Collector", email: "collector@example.com" },
        cart: {
            items: [],
            itemCount: 0,
            subtotal: 0,
            courierCost: 0,
            totalPrice: 0,
            hasBlockingIssues: false,
            blockingReasons: []
        },
        error: null,
        success: null
    }},
    { name: "wishlist", data: {
        pageTitle: "Your Wishlist Vault — ROYAL IGNITE",
        isUserLoggedIn: true,
        userId: "12345",
        user: { name: "Lord Collector", email: "collector@example.com" },
        wishlist: { count: 1, products: [] },
        products: [
            {
                _id: "654321654321654321654321",
                name: "The Sovereign",
                description: "Sterling silver luxury lighter",
                category: { _id: "111111111111111111111111", name: "Sterling Silver" },
                regularPrice: 12500,
                salePrice: 9999,
                effectivePrice: 9999,
                hasDiscount: true,
                discountPercent: 20,
                stock: 10,
                isOutOfStock: false,
                primaryImage: "/uploads/monarch_lighter.png"
            }
        ],
        count: 1,
        error: null,
        success: null
    }},
    { name: "checkout", data: {
        pageTitle: "Atelier Checkout — ROYAL IGNITE",
        isUserLoggedIn: true,
        userId: "12345",
        user: { name: "Lord Collector", email: "collector@example.com" },
        cart: { itemCount: 1 },
        items: [
            {
                productId: "654321654321654321654321",
                name: "The Sovereign",
                categoryName: "Sterling Silver",
                images: ["/uploads/monarch_lighter.png"],
                price: 9999,
                regularPrice: 12500,
                quantity: 1,
                lineTotal: 9999
            }
        ],
        addresses: [
            {
                _id: "addr123",
                fullName: "Lord Collector",
                phone: "9876543210",
                addressLine: "Estate 4B",
                city: "Mumbai",
                state: "Maharashtra",
                pincode: "400001",
                country: "India",
                addressType: "Home",
                isDefault: true
            }
        ],
        selectedAddress: {
            _id: "addr123",
            fullName: "Lord Collector",
            phone: "9876543210",
            addressLine: "Estate 4B",
            city: "Mumbai",
            state: "Maharashtra",
            pincode: "400001",
            country: "India",
            addressType: "Home",
            isDefault: true
        },
        financials: {
            subtotal: 9999,
            regularTotal: 12500,
            savings: 2501,
            courierFee: 0,
            tax: 0,
            totalAmount: 9999
        },
        error: null,
        success: null
    }},
    { name: "orderSuccess", data: {
        pageTitle: "Acquisition Confirmed — ROYAL IGNITE",
        isUserLoggedIn: true,
        userId: "12345",
        user: { name: "Lord Collector", email: "collector@example.com" },
        order: {
            orderId: "RYL-20261013-8472",
            createdAt: new Date(),
            pricing: { totalAmount: 9999 },
            shippingAddress: {
                fullName: "Lord Collector",
                phone: "9876543210",
                addressLine: "Estate 4B",
                city: "Mumbai",
                state: "Maharashtra",
                pincode: "400001"
            },
            items: [
                {
                    name: "The Sovereign",
                    quantity: 1,
                    price: 9999,
                    lineTotal: 9999,
                    image: "/uploads/monarch_lighter.png"
                }
            ]
        }
    }},
    { name: "orderList", data: {
        pageTitle: "Your Acquired Editions — ROYAL IGNITE",
        isUserLoggedIn: true,
        userId: "12345",
        user: { name: "Lord Collector", email: "collector@example.com" },
        orders: [
            {
                orderId: "RYL-20261013-8472",
                createdAt: new Date(),
                orderStatus: "Placed",
                paymentMethod: "COD",
                pricing: { totalAmount: 9999 },
                items: [
                    {
                        name: "The Sovereign",
                        quantity: 1,
                        price: 9999,
                        lineTotal: 9999,
                        status: "Placed",
                        image: "/uploads/monarch_lighter.png"
                    }
                ]
            }
        ],
        totalOrders: 1,
        totalPages: 1,
        currentPage: 1,
        search: "",
        status: "all",
        error: null,
        success: null
    }},
    { name: "orderDetails", data: {
        pageTitle: "Order #RYL-20261013-8472 — ROYAL IGNITE",
        isUserLoggedIn: true,
        userId: "12345",
        user: { name: "Lord Collector", email: "collector@example.com" },
        order: {
            _id: "order123",
            orderId: "RYL-20261013-8472",
            createdAt: new Date(),
            orderStatus: "Placed",
            paymentMethod: "COD",
            paymentStatus: "Pending",
            deliveredAt: null,
            cancelledAt: null,
            returnedAt: null,
            cancellationReason: null,
            returnReason: null,
            shippingAddress: {
                fullName: "Lord Collector",
                phone: "9876543210",
                addressLine: "Estate 4B",
                city: "Mumbai",
                state: "Maharashtra",
                pincode: "400001",
                country: "India",
                addressType: "Home"
            },
            pricing: {
                subtotal: 9999,
                discount: 0,
                shippingFee: 0,
                tax: 0,
                totalAmount: 9999
            },
            items: [
                {
                    _id: "item123",
                    product: { _id: "prod123", name: "The Sovereign" },
                    name: "The Sovereign",
                    categoryName: "Sterling Silver",
                    quantity: 1,
                    price: 9999,
                    lineTotal: 9999,
                    status: "Placed",
                    image: "/uploads/monarch_lighter.png"
                }
            ]
        },
        error: null,
        success: null
    }},
    { name: "gasLighters", data: {
        pageTitle: "The Gas Collection — Haute Briquet & Precision Flame | ROYAL IGNITE",
        isUserLoggedIn: false,
        userId: null,
        user: null,
        category: { name: "Gas Lighters" },
        products: [
            { _id: "1", name: "The Apex", description: "Two distinct ceramic nozzles...", regularPrice: 4200, salePrice: 3500, effectivePrice: 3500, images: ["/uploads/gas/apex_lighter.jpg"], editionTag: "CORE", flameTag: "DUAL CERAMIC JET", specs: "ALLOY / TORCH" },
            { _id: "2", name: "The Titan", description: "Forged in solid brass...", regularPrice: 18000, salePrice: 15500, effectivePrice: 15500, images: ["/uploads/gas/titan_lighter.jpg"], editionTag: "LIMITED TO 250", flameTag: "BILLET BRASS", specs: "BRASS / ENGINE-TURNED" },
            { _id: "3", name: "The Vanguard", description: "Single-action angular...", regularPrice: 7500, salePrice: 6000, effectivePrice: 6000, images: ["/uploads/gas/vanguard_lighter.jpg"], editionTag: "PRECISION", flameTag: "ANGULAR JET", specs: "GUNMETAL / TORCH" },
            { _id: "4", name: "The Vertex", description: "Ultra-slim sterling...", regularPrice: 12500, salePrice: 9999, effectivePrice: 9999, images: ["/uploads/gas/vertex_lighter.jpg"], editionTag: "SLIMLINE", flameTag: "STERLING", specs: "STERLING / LINEAR" },
            { _id: "5", name: "The Orion", description: "An elliptical vintage...", regularPrice: 9500, salePrice: null, effectivePrice: 9500, images: ["/uploads/gas/orion_lighter.jpg"], editionTag: "HEIRLOOM", flameTag: "FILIGREE", specs: "ROSE GOLD / BUTANE" },
            { _id: "6", name: "The Eclipse", description: "Dual-finish chrome...", regularPrice: 6000, salePrice: 5400, effectivePrice: 5400, images: ["/uploads/gas/eclipse_lighter.jpg"], editionTag: "PROTOTYPE", flameTag: "DUAL CHROME", specs: "CHROME & OBSIDIAN" }
        ],
        activeSort: "curated"
    }},
    { name: "electricLighters", data: {
        pageTitle: "The Electric Collection — Pure Resonance & Dual-Arc Plasma | ROYAL IGNITE",
        isUserLoggedIn: false,
        userId: null,
        user: null,
        category: { name: "Electric Lighters" },
        products: [
            { _id: "1", name: "The Aether", description: "Chiseled from aerospace grade 5...", regularPrice: 22500, salePrice: 18990, effectivePrice: 18990, images: ["/uploads/electric/aether_lighter.jpg"], editionTag: "FLAGSHIP EDITION", subTag: "01 / DUAL-ARC PLASMA", specs: "TITANIUM / 42KHZ" },
            { _id: "2", name: "The Tether", description: "Architectural monolithic geometry...", regularPrice: 14900, salePrice: 12500, effectivePrice: 12500, images: ["/uploads/electric/tether_lighter.jpg"], editionTag: "DUAL VOLTAGE CERAMIC CORE", subTag: "02 / RESONANCE", specs: "MATTE DLC CHROME" },
            { _id: "3", name: "The Zenith", description: "Pocket-form obsidian chassis...", regularPrice: 10500, salePrice: 8900, effectivePrice: 8900, images: ["/uploads/electric/zenith_lighter.jpg"], editionTag: "POCKET SLIMLINE", subTag: "03 / LINEAR ARC", specs: "OBSIDIAN ALLOY" },
            { _id: "4", name: "The Solis", description: "Pure columnar geometry...", regularPrice: 12800, salePrice: 10500, effectivePrice: 10500, images: ["/uploads/electric/solis_lighter.jpg"], editionTag: "MINIMALIST COLUMN", subTag: "04 / RADIAL IGNITION", specs: "BRUSHED STERLING" },
            { _id: "5", name: "The Lumina", description: "Biomorphic organic contour...", regularPrice: 16500, salePrice: 14200, effectivePrice: 14200, images: ["/uploads/electric/lumina_lighter.jpg"], editionTag: "SCULPTURAL EDITION", subTag: "05 / ERGONOMICS", specs: "MIRROR BRONZE" },
            { _id: "6", name: "The Halo", description: "Centerless portal induction...", regularPrice: 19500, salePrice: 16800, effectivePrice: 16800, images: ["/uploads/electric/halo_lighter.jpg"], editionTag: "CIRCULAR INDUCTION COIL", subTag: "06 / TESLA CORE", specs: "INDUCTION COIL" }
        ],
        activeSort: "curated"
    }},
    { name: "fuelLighters", data: {
        pageTitle: "The Fuel Collection — Mechanical Heritage & Organic Flame | ROYAL IGNITE",
        isUserLoggedIn: false,
        userId: null,
        user: null,
        category: { name: "Fuel Lighters" },
        products: [
            { _id: "1", name: "The Heritage 1924", description: "Machined from a solid billet...", regularPrice: 10500, salePrice: 8900, effectivePrice: 8900, images: ["/uploads/fuel/heritage_1924.jpg"], editionTag: "ARCHIVAL FLAGSHIP", subTag: "01 / MECHANICAL PATENT", specs: "SOLID NAVAL BRASS / DUAL WICK" },
            { _id: "2", name: "The Chesterfield 1920", description: "Archival 1920s mechanical lift-arm petrol lighter...", regularPrice: 7800, salePrice: 6500, effectivePrice: 6500, images: ["/uploads/fuel/chesterfield_front.jpg", "/uploads/fuel/chesterfield_flame.jpg"], editionTag: "ARCHIVAL LIFT-ARM", subTag: "02 / 1920s AUTOMATON", specs: "925 STERLING & 18K ROSE GOLD / SPRING SNUFFER" },
            { _id: "3", name: "The Commander", description: "Antiqued gunmetal bronze...", regularPrice: 6000, salePrice: 4999, effectivePrice: 4999, images: ["/uploads/fuel/commander_closed.jpg", "/uploads/fuel/commander_open.jpg"], editionTag: "TRENCH CLASSIC", subTag: "03 / FIELD TRENCH", specs: "GUNMETAL / CHIMNEY" },
            { _id: "4", name: "The Monarch Sovereign", description: "Triple-plated in 24K gold...", regularPrice: 17000, salePrice: 14500, effectivePrice: 14500, images: ["/uploads/fuel/monarch_sovereign.png"], editionTag: "IMPERIAL EDITION", subTag: "04 / 24K ROYAL REGALIA", specs: "24K GOLD / ACANTHUS" },
            { _id: "6", name: "The Aurelius Imperial", description: "Hand-crafted petrol fluid lighter with sunburst guilloché...", regularPrice: 6200, salePrice: 5400, effectivePrice: 5400, images: ["/uploads/fuel/aurelius_imperial_front.jpg", "/uploads/fuel/aurelius_imperial_angle.jpg"], editionTag: "HAUTE HOROLOGY", subTag: "06 / SUNBURST GUILLOCHÉ", specs: "OBSIDIAN TITANIUM / 18K GOLD" }
        ],
        activeSort: "curated"
    }},
    { name: "refillsAndCare", data: {
        pageTitle: "Refills & Care — Preserve The Flame | ROYAL IGNITE",
        isUserLoggedIn: false,
        userId: null,
        user: null,
        category: { name: "Refills & Care" },
        products: [
            { _id: "1", name: "The Collector's Care Kit", description: "An uncompromising suite of maintenance accoutrements...", regularPrice: 14500, salePrice: 12500, effectivePrice: 12500, images: ["/uploads/care/collector_care_kit.jpg"], editionTag: "MAHOGANY VAULT EDITION", subTag: "01 / COMPLETE VAULT", specs: "HONDURAN MAHOGANY / 7 ATELIER TOOLS" },
            { _id: "2", name: "The Butane Essence", description: "Near-zero-impurity isobutane propellant...", regularPrice: 4200, salePrice: 3600, effectivePrice: 3600, images: ["/uploads/care/butane_essence.jpg"], editionTag: "APOTHECARY FLUID", subTag: "02 / 99.999% PURITY", specs: "AMBER GLASS / SOLID BRASS NOZZLE" },
            { _id: "3", name: "The Travel Capsule", description: "Billet-machined aeronautical aluminum capsule...", regularPrice: 5800, salePrice: 4900, effectivePrice: 4900, images: ["/uploads/care/travel_capsule.jpg"], editionTag: "EXPEDITION EDC", subTag: "03 / HERMETIC POCKET", specs: "AEROSPACE ALLOY / VITON O-RINGS" },
            { _id: "4", name: "The Restoration Vault", description: "Comprehensive archival preservation chest...", regularPrice: 18500, salePrice: 16200, effectivePrice: 16200, images: ["/uploads/care/restoration_vault.jpg"], editionTag: "HEIRLOOM CHEST", subTag: "04 / MASTER ARCHIVAL", specs: "WALNUT / WATCHMAKER CALIBER" },
            { _id: "5", name: "The Archival Flints & Wick Set", description: "Rare-earth pyrophoric flints engineered for crisp spark...", regularPrice: 2200, salePrice: 1800, effectivePrice: 1800, images: ["/uploads/care/flints_cartridge.jpg"], editionTag: "PRECISION CONSUMABLE", subTag: "05 / ARCHIVAL CONSUMABLE", specs: "PYROPHORIC RARE-EARTH / EGYPTIAN COTTON" },
            { _id: "6", name: "Haute Jewelers Rouge & Microfiber", description: "Micro-abrasive polishing compound formulated specifically...", regularPrice: 2800, salePrice: 2400, effectivePrice: 2400, images: ["/uploads/care/jewelers_rouge.jpg"], editionTag: "SURFACE PRESERVATION", subTag: "06 / POLISH & LUSTER", specs: "NON-ABRASIVE ROUGE / DENSE MICROFIBER" }
        ],
        activeSort: "curated"
    }}
];

let failed = false;
let completed = 0;

viewsToTest.forEach(({ name, data }) => {
    app.render(name, data, (err, html) => {
        if (err) {
            console.error(`[FAIL] View "${name}":`, err.message);
            failed = true;
        } else {
            console.log(`[OK] View "${name}" rendered (${html.length} chars)`);
        }
        completed++;
        if (completed === viewsToTest.length) {
            if (failed) {
                console.error("Some views failed to render!");
                process.exit(1);
            } else {
                console.log("All views rendered successfully!");
                process.exit(0);
            }
        }
    });
});
