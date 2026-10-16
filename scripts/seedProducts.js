
import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../config/database.js";
import Category from "../models/categoryModel.js";
import Product from "../models/productModel.js";

const seedData = async () => {
    try {
        await connectDB();
        console.log("Connected to MongoDB for seeding...");

        // 1. Clear existing products and categories if any
        await Product.deleteMany({});
        await Category.deleteMany({});
        console.log("Cleared existing products and categories.");

        // 2. Create the 4 Official Lighter Categories
        const categoriesData = [
            {
                name: "Fuel Lighters",
                description: "Vintage liquid fluid and petrol heirloom lighters featuring mechanical flint ignition and brass casing.",
                isListed: true,
                isDeleted: false
            },
            {
                name: "Gas Lighters",
                description: "High-precision butane gas torches, dual-jet windproof flames, and acoustic chime opening mechanisms.",
                isListed: true,
                isDeleted: false
            },
            {
                name: "Electric Lighters",
                description: "State-of-the-art dual-arc plasma and flameless electric lighters engineered with USB rechargeable titanium cells.",
                isListed: true,
                isDeleted: false
            },
            {
                name: "Refills and Care",
                description: "Triple-refined butane gas canisters, high-spark flint dispensers, cotton wicks, and atelier restoration kits.",
                isListed: true,
                isDeleted: false
            },
            {
                name: "Archived Collection (Hidden)",
                description: "Historical archival pieces that are not for public sale.",
                isListed: false, // Testing unlisted category rule
                isDeleted: false
            }
        ];

        const createdCategories = await Category.insertMany(categoriesData);
        console.log(`Created ${createdCategories.length} categories.`);

        const catMap = {};
        createdCategories.forEach((c) => {
            catMap[c.name] = c._id;
        });

        // 3. Create Products Across the 4 Categories
        const productsData = [
            // --- FUEL LIGHTERS (The 6 Bespoke Models matching the editorial collection) ---
            {
                name: "The Heritage 1924",
                description: "Machined from a solid billet of naval brass that develops a rich, personal patina over years of use. Traditional fluid fuel wick and flint roller mechanism.",
                category: catMap["Fuel Lighters"],
                regularPrice: 10500,
                salePrice: 8900,
                stock: 15,
                images: [
                    "/uploads/fuel/heritage_1924.jpg",
                    "/uploads/heritage_lighter.png",
                    "/uploads/monarch_lighter.png"
                ],
                isListed: true,
                isDeleted: false
            },
            {
                name: "The Chesterfield 1920",
                description: "Archival 1920s mechanical lift-arm petrol lighter crafted from solid 925 sterling silver with 18K rose gold fluted pinstripes and engine-turned barleycorn guilloché. Features a precision spring-loaded snuffer arm, knurled horizontal flint strike wheel, and dual-gasket fluid reservoir.",
                category: catMap["Fuel Lighters"],
                regularPrice: 7800,
                salePrice: 6500,
                stock: 20,
                images: [
                    "/uploads/fuel/chesterfield_front.jpg",
                    "/uploads/fuel/chesterfield_flame.jpg"
                ],
                isListed: true,
                isDeleted: false
            },
            {
                name: "The Commander",
                description: "Antiqued gunmetal bronze field trench lighter with knurled flint roller, removable chimney shield, and waterproof rubberized O-ring seal.",
                category: catMap["Fuel Lighters"],
                regularPrice: 6000,
                salePrice: 4999,
                stock: 25,
                images: [
                    "/uploads/fuel/commander_closed.jpg",
                    "/uploads/fuel/commander_open.jpg"
                ],
                isListed: true,
                isDeleted: false
            },
            {
                name: "The Monarch Sovereign",
                description: "Triple-plated in 24K yellow gold with hand-chased royal acanthus leaf filigree. Weighted fluid reservoir with velvet presentation vault.",
                category: catMap["Fuel Lighters"],
                regularPrice: 17000,
                salePrice: 14500,
                stock: 8,
                images: [
                    "/uploads/products/monarch/angle_front.jpg",
                    "/uploads/products/monarch/angle_side.jpg",
                    "/uploads/products/monarch/angle_top.jpg"
                ],
                isListed: true,
                isDeleted: false
            },
            {
                name: "The Aeronaut",
                description: "1930s streamline moderne profile crafted in mirror-polished nickel silver. Ergonomic horizontal strike wheel with soft-close cover.",
                category: catMap["Fuel Lighters"],
                regularPrice: 8500,
                salePrice: 7200,
                stock: 18,
                images: [
                    "/uploads/fuel/aeronaut_streamline.png",
                    "/uploads/heritage_lighter.png",
                    "/uploads/signature_lighter.png"
                ],
                isListed: true,
                isDeleted: false
            },
            {
                name: "The Aurelius Imperial",
                description: "Hand-crafted petrol fluid lighter with sunburst guilloché champagne gold plates set into a deep obsidian titanium chassis. Precision knurled strike wheel and sealed mechanical snuffer arm.",
                category: catMap["Fuel Lighters"],
                regularPrice: 6200,
                salePrice: 5400,
                stock: 22,
                images: [
                    "/uploads/fuel/aurelius_imperial_front.jpg",
                    "/uploads/fuel/aurelius_imperial_angle.jpg"
                ],
                isListed: true,
                isDeleted: false
            },

            // --- GAS LIGHTERS (The 6 Bespoke Models matching the editorial mockup) ---
            {
                name: "The Apex",
                description: "Two distinct ceramic nozzles deliver aerospace-grade ignition, housed in an alloy chassis calibrated for immediate ergonomic grip.",
                category: catMap["Gas Lighters"],
                regularPrice: 4200,
                salePrice: 3500,
                stock: 25,
                images: [
                    "/uploads/gas/apex_lighter.jpg"
                ],
                isListed: true,
                isDeleted: false
            },
            {
                name: "The Titan",
                description: "Forged in solid brass with an engine-turned grip. Knurled crown cap houses a high-pressure dual-jet burner.",
                category: catMap["Gas Lighters"],
                regularPrice: 18000,
                salePrice: 15500,
                stock: 12,
                images: [
                    "/uploads/gas/titan_lighter.jpg"
                ],
                isListed: true,
                isDeleted: false
            },
            {
                name: "The Vanguard",
                description: "A single-action angular ignite torch engineered for unpredictable winds. High-frequency click mechanism.",
                category: catMap["Gas Lighters"],
                regularPrice: 7500,
                salePrice: 6000,
                stock: 18,
                images: [
                    "/uploads/gas/vanguard_lighter.jpg"
                ],
                isListed: true,
                isDeleted: false
            },
            {
                name: "The Vertex",
                description: "Ultra-slim sterling columnar profile with integrated flint ignition and silent gas feed.",
                category: catMap["Gas Lighters"],
                regularPrice: 12500,
                salePrice: 9999,
                stock: 14,
                images: [
                    "/uploads/gas/vertex_lighter.jpg"
                ],
                isListed: true,
                isDeleted: false
            },
            {
                name: "The Orion",
                description: "An elliptical vintage-inspired silhouette with hand-chased filigree and acoustic spring-hinge cover.",
                category: catMap["Gas Lighters"],
                regularPrice: 9500,
                salePrice: null,
                stock: 8,
                images: [
                    "/uploads/gas/orion_lighter.jpg"
                ],
                isListed: true,
                isDeleted: false
            },
            {
                name: "The Eclipse",
                description: "Dual-finish chrome reflection chassis with dual high-altitude windproof jet flame.",
                category: catMap["Gas Lighters"],
                regularPrice: 6000,
                salePrice: 5400,
                stock: 20,
                images: [
                    "/uploads/gas/eclipse_lighter.jpg"
                ],
                isListed: true,
                isDeleted: false
            },

            // --- ELECTRIC LIGHTERS (The 6 Bespoke Models matching the editorial mockup) ---
            {
                name: "The Aether",
                description: "Chiseled from aerospace grade 5 titanium billet. Twin micro-transformers pulse at 42,000 Hz creating an impenetrable cross-arc plasma field impervious to any atmospheric condition.",
                category: catMap["Electric Lighters"],
                regularPrice: 22500,
                salePrice: 18990,
                stock: 10,
                images: [
                    "/uploads/electric/aether_lighter.jpg"
                ],
                isListed: true,
                isDeleted: false
            },
            {
                name: "The Tether",
                description: "Architectural monolithic geometry finished in matte DLC coating. Solid-state capacitive touch ignition sensor with haptic feedback vibration.",
                category: catMap["Electric Lighters"],
                regularPrice: 14900,
                salePrice: 12500,
                stock: 14,
                images: [
                    "/uploads/electric/tether_lighter.jpg"
                ],
                isListed: true,
                isDeleted: false
            },
            {
                name: "The Zenith",
                description: "Pocket-form obsidian chassis with linear plasma blade. Ultra-low latency ignition with ceramic insulation guard.",
                category: catMap["Electric Lighters"],
                regularPrice: 10500,
                salePrice: 8900,
                stock: 22,
                images: [
                    "/uploads/electric/zenith_lighter.jpg"
                ],
                isListed: true,
                isDeleted: false
            },
            {
                name: "The Solis",
                description: "Pure columnar geometry with radial micro-switch ignition. Machined from aircraft-grade brushed aluminum with tungsten arc emitters.",
                category: catMap["Electric Lighters"],
                regularPrice: 12800,
                salePrice: 10500,
                stock: 16,
                images: [
                    "/uploads/electric/solis_lighter.jpg"
                ],
                isListed: true,
                isDeleted: false
            },
            {
                name: "The Lumina",
                description: "Biomorphic organic contour cast in high-polish mirror bronze. Fluid form designed for seamless one-handed tactile operation.",
                category: catMap["Electric Lighters"],
                regularPrice: 16500,
                salePrice: 14200,
                stock: 12,
                images: [
                    "/uploads/electric/lumina_lighter.jpg"
                ],
                isListed: true,
                isDeleted: false
            },
            {
                name: "The Halo",
                description: "Centerless portal induction lighter. High-frequency circular magnetic field generates pure concentric thermal energy without exposed electrodes.",
                category: catMap["Electric Lighters"],
                regularPrice: 19500,
                salePrice: 16800,
                stock: 8,
                images: [
                    "/uploads/electric/halo_lighter.jpg"
                ],
                isListed: true,
                isDeleted: false
            },

            // --- REFILLS AND CARE (The 6 Bespoke Essentials matching the editorial showcase) ---
            {
                name: "The Collector's Care Kit",
                description: "The complete atelier suite for lighter preservation. Handcrafted mahogany presentation box containing triple-refined butane, organic wicks, high-spark flints, jewelers rouge polish, and brass micro-tools.",
                category: catMap["Refills and Care"],
                regularPrice: 5800,
                salePrice: 4800,
                stock: 20,
                images: [
                    "/uploads/care/collector_care_kit.jpg"
                ],
                isListed: true,
                isDeleted: false
            },
            {
                name: "The Butane Essence",
                description: "99.999% pure zero-impurity butane filtered 14 times. Protects microscopic burner nozzles from clogging and ensures a pure, odorless blue flame.",
                category: catMap["Refills and Care"],
                regularPrice: 1500,
                salePrice: 1200,
                stock: 60,
                images: [
                    "/uploads/care/butane_essence.jpg"
                ],
                isListed: true,
                isDeleted: false
            },
            {
                name: "The Travel Capsule",
                description: "Machined aluminum pocket refill canister with pressure-relief valve and knurled grip. Designed for seamless on-the-go butane replenishment.",
                category: catMap["Refills and Care"],
                regularPrice: 2200,
                salePrice: 1850,
                stock: 35,
                images: [
                    "/uploads/care/travel_capsule.jpg"
                ],
                isListed: true,
                isDeleted: false
            },
            {
                name: "The Restoration Vault",
                description: "Fine walnut horology preservation case housing precision brass screwdrivers, horology lubricating oils, cleaning solvents, and spare cotton coils.",
                category: catMap["Refills and Care"],
                regularPrice: 3800,
                salePrice: 3200,
                stock: 15,
                images: [
                    "/uploads/care/restoration_vault.jpg"
                ],
                isListed: true,
                isDeleted: false
            },
            {
                name: "The Pure Petroleum Fluid",
                description: "Factory-formulated odorless petroleum distillate subjected to multi-stage cold purification. Engineered specifically for vintage wick and mechanical fluid lighters to prevent carbon residue, protect chimneys, and deliver an instant, pure golden flame.",
                category: catMap["Refills and Care"],
                regularPrice: 950,
                salePrice: 750,
                stock: 80,
                images: [
                    "/uploads/care/petroleum_fluid.jpg"
                ],
                isListed: true,
                isDeleted: false
            },
            {
                name: "Haute Jewelers Rouge & Microfiber",
                description: "Formulated for precious metals including 24K gold plate, 925 sterling silver, and naval brass. Removes micro-scratches and restores deep mirror luster.",
                category: catMap["Refills and Care"],
                regularPrice: 1100,
                salePrice: 850,
                stock: 50,
                images: [
                    "/uploads/care/jewelers_rouge.jpg"
                ],
                isListed: true,
                isDeleted: false
            },

            // --- UNLISTED TEST CASES ---
            {
                name: "Hidden Vault Prototype (Unlisted Product)",
                description: "Should never be visible on user shop or search.",
                category: catMap["Gas Lighters"],
                regularPrice: 50000,
                salePrice: null,
                stock: 1,
                images: [
                    "/uploads/monarch_lighter.png",
                    "/uploads/hero_lighter.png",
                    "/uploads/heritage_lighter.png"
                ],
                isListed: false, // Must be hidden!
                isDeleted: false
            },
            {
                name: "Archived Relic (Under Unlisted Category)",
                description: "Should never be visible because its category is unlisted.",
                category: catMap["Archived Collection (Hidden)"],
                regularPrice: 35000,
                salePrice: null,
                stock: 2,
                images: [
                    "/uploads/heritage_lighter.png",
                    "/uploads/hero_lighter.png",
                    "/uploads/signature_lighter.png"
                ],
                isListed: true,
                isDeleted: false
            }
        ];

        const createdProducts = await Product.insertMany(productsData);
        console.log(`Created ${createdProducts.length} products successfully.`);
        console.log("Seeding completed successfully!");
        process.exit(0);
    } catch (err) {
        console.error("Seeding error:", err);
        process.exit(1);
    }
};

seedData();
