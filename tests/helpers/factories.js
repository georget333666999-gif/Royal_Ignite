import User from "../../models/userModel.js";
import Category from "../../models/categoryModel.js";
import Product from "../../models/productModel.js";
import Cart from "../../models/cartModel.js";
import Coupon from "../../models/couponModel.js";
import Wallet from "../../models/walletModel.js";
import Address from "../../models/addressModel.js";

/**
 * Seed a test user
 */
export const createTestUser = async (overrides = {}) => {
    const randomHex = Math.random().toString(36).substring(2, 8);
    const defaults = {
        name: `Test User ${randomHex}`,
        email: `tester_${randomHex}@example.com`,
        phone: `9876${Math.floor(100000 + Math.random() * 900000)}`,
        password: "$2a$10$abcdefghijklmnopqrstuvwxyz123456", // mock hash
        isVerified: true,
        isBlocked: false,
        isAdmin: false,
        referralCode: `RYL${randomHex.toUpperCase()}`
    };
    return await User.create({ ...defaults, ...overrides });
};

/**
 * Seed a test category
 */
export const createTestCategory = async (overrides = {}) => {
    const randomHex = Math.random().toString(36).substring(2, 8);
    const defaults = {
        name: `Atelier Category ${randomHex}`,
        description: "Exquisite handcrafted ignition tools",
        isListed: true,
        isDeleted: false
    };
    return await Category.create({ ...defaults, ...overrides });
};

/**
 * Seed a test product
 */
export const createTestProduct = async (overrides = {}) => {
    const randomHex = Math.random().toString(36).substring(2, 8);
    let categoryId = overrides.category;
    if (!categoryId) {
        const cat = await createTestCategory();
        categoryId = cat._id;
    }
    const defaults = {
        name: `Royal Lighter ${randomHex}`,
        description: "Engineered with brushed sterling silver and radial microswitch.",
        category: categoryId,
        regularPrice: 5000,
        salePrice: 5000,
        baseSalePrice: 5000,
        stock: 50,
        images: ["/uploads/test_lighter.png"],
        isListed: true,
        isDeleted: false
    };
    return await Product.create({ ...defaults, ...overrides });
};

/**
 * Seed a test address
 */
export const createTestAddress = async (userId, overrides = {}) => {
    const defaults = {
        userId,
        fullName: "Test Customer",
        phone: "9876543210",
        addressLine: "42 Atelier Boulevard",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
        country: "India",
        addressType: "Home",
        isDefault: true
    };
    return await Address.create({ ...defaults, ...overrides });
};

/**
 * Seed a user cart with products
 */
export const createTestCart = async (userId, items = []) => {
    return await Cart.create({
        user: userId,
        items
    });
};

/**
 * Seed a test coupon
 */
export const createTestCoupon = async (overrides = {}) => {
    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);

    const defaults = {
        code: `COUPON_${randomHex}`,
        description: "Test Promotional Privilege Code",
        discountType: "percentage",
        discountValue: 10, // 10%
        minPurchase: 0,
        maxDiscount: null,
        expiryDate: futureDate,
        usageLimit: null,
        usedCount: 0,
        usedUsers: [],
        isActive: true,
        isDeleted: false
    };
    return await Coupon.create({ ...defaults, ...overrides });
};

/**
 * Seed or retrieve user wallet
 */
export const createTestWallet = async (userId, initialBalance = 0) => {
    return await Wallet.create({
        user: userId,
        balance: initialBalance,
        transactions: []
    });
};
