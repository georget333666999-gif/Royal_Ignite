import Order from "../../models/orderModel.js";
import Cart from "../../models/cartModel.js";
import Product from "../../models/productModel.js";
import Offer from "../../models/offerModel.js";
import cartService from "./cartService.js";
import addressService from "./addressService.js";
import couponService from "./couponService.js";
import walletService from "./walletService.js";
import { RESPONSE_MESSAGES } from "../../constants/index.js";
import { invalidateUserBadgeCache } from "../../utils/cache.js";

/**
 * Get aggregated checkout information (Cart items, delivery addresses, pricing totals)
 * @param {string} userId
 * @param {Object} [appliedCoupon=null]
 * @returns {Promise<Object>}
 */
export const getCheckoutDetails = async (userId, appliedCoupon = null) => {
    try {
        const cartData = await cartService.getCart(userId);

        if (!cartData.items || cartData.items.length === 0) {
            return {
                isEmpty: true,
                message: RESPONSE_MESSAGES.CHECKOUT.EMPTY_BAG
            };
        }

        if (cartData.hasBlockingIssues) {
            return {
                hasBlockingIssues: true,
                blockingReasons: cartData.blockingReasons,
                cart: cartData
            };
        }

        const addresses = await addressService.getUserAddresses(userId);
        const selectedAddress = addresses.find((addr) => addr.isDefault) || addresses[0] || null;

        const regularTotal = cartData.regularTotal !== undefined
            ? cartData.regularTotal
            : cartData.items.reduce(
                (acc, item) => acc + (item.regularPrice || item.price) * item.quantity,
                0
            );
        const savings = cartData.savings !== undefined
            ? cartData.savings
            : Math.max(0, regularTotal - cartData.subtotal);

        let couponDiscount = 0;
        let couponCode = null;

        if (appliedCoupon && appliedCoupon.code) {
            try {
                const validation = await couponService.validateCoupon(
                    appliedCoupon.code,
                    userId,
                    cartData.subtotal
                );
                couponDiscount = validation.discountAmount;
                couponCode = validation.code;
            } catch {
                couponDiscount = 0;
                couponCode = null;
            }
        }

        const totalAmount = Math.max(0, cartData.totalPrice - couponDiscount);
        const userWallet = await walletService.getOrCreateWallet(userId);

        return {
            isEmpty: false,
            hasBlockingIssues: false,
            cart: cartData,
            items: cartData.items,
            addresses,
            selectedAddress,
            walletBalance: userWallet.balance,
            financials: {
                catalogTotal: regularTotal,
                regularTotal,
                subtotal: cartData.subtotal,
                savings,
                couponDiscount,
                couponCode,
                courierFee: 0,
                tax: 0,
                totalAmount
            }
        };
    } catch (error) {
        console.error("checkoutService getCheckoutDetails error:", error);
        throw error;
    }
};

/**
 * Shared order persistence logic for both Cart & Buy-Now flows
 */
const persistOrderRecord = async ({
    userId,
    address,
    items,
    subtotal,
    savings,
    paymentMethod,
    appliedCoupon,
    paymentStatus,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    clearCartOnSuccess = false,
    walletDescription = ""
}) => {
    let couponDiscount = 0;
    let couponCode = null;
    if (appliedCoupon && appliedCoupon.code) {
        try {
            const validation = await couponService.validateCoupon(
                appliedCoupon.code,
                userId,
                subtotal
            );
            couponDiscount = validation.discountAmount;
            couponCode = validation.code;
        } catch {
            couponDiscount = 0;
            couponCode = null;
        }
    }

    const totalPayable = Math.max(0, subtotal - couponDiscount);
    const uniqueOrderId = Order.generateOrderId();

    let resolvedPaymentStatus = paymentStatus;
    if (paymentMethod === "Wallet") {
        await walletService.debitWallet(userId, {
            amount: totalPayable,
            description: walletDescription || `Acquisition payment for order #${uniqueOrderId}`,
            source: "checkout_payment",
            orderId: uniqueOrderId
        });
        resolvedPaymentStatus = "Completed";
    }

    const isPaymentFailed = resolvedPaymentStatus === "Failed";
    const initialOrderStatus = isPaymentFailed ? "Pending" : "Placed";

    let remainingCouponDiscount = couponDiscount;
    const orderItems = items.map((item, index) => {
        let discountShare = 0;
        if (couponDiscount > 0 && subtotal > 0) {
            if (index === items.length - 1) {
                discountShare = Math.max(0, remainingCouponDiscount);
            } else {
                discountShare = Math.min(
                    remainingCouponDiscount,
                    Math.round((item.lineTotal / subtotal) * couponDiscount)
                );
                remainingCouponDiscount -= discountShare;
            }
        }
        const netRefundableAmount = Math.max(0, item.lineTotal - discountShare);

        return {
            product: item.productId || item.product,
            name: item.name,
            image: (item.images && item.images[0]) || item.image || "/uploads/hero_lighter.png",
            categoryName: item.categoryName || item.category?.name || "Exclusive Edition",
            price: item.price,
            regularPrice: item.regularPrice || item.price,
            quantity: item.quantity,
            lineTotal: item.lineTotal,
            discountShare,
            netRefundableAmount,
            status: initialOrderStatus
        };
    });

    const newOrder = await Order.create({
        orderId: uniqueOrderId,
        user: userId,
        items: orderItems,
        shippingAddress: {
            fullName: address.fullName,
            phone: address.phone,
            addressLine: address.addressLine,
            city: address.city,
            state: address.state,
            pincode: address.pincode,
            country: address.country || "India",
            addressType: address.addressType || "Home"
        },
        paymentMethod: paymentMethod === "Razorpay" ? "Razorpay" : (paymentMethod === "Wallet" ? "Wallet" : "COD"),
        paymentStatus: resolvedPaymentStatus || (paymentMethod === "Razorpay" || paymentMethod === "Wallet" ? "Completed" : "Pending"),
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        coupon: {
            code: couponCode,
            discountAmount: couponDiscount
        },
        pricing: {
            subtotal,
            discount: savings,
            couponDiscount,
            tax: 0,
            shippingFee: 0,
            totalAmount: totalPayable
        },
        orderStatus: initialOrderStatus
    });

    if (!isPaymentFailed) {
        const postOrderTasks = [];
        if (clearCartOnSuccess) {
            postOrderTasks.push(Cart.updateOne({ user: userId }, { $set: { items: [] } }).then(() => invalidateUserBadgeCache(userId)));
        }
        if (couponCode) {
            postOrderTasks.push(couponService.recordCouponUsage(couponCode, userId, newOrder._id));
        }
        if (postOrderTasks.length > 0) {
            await Promise.all(postOrderTasks);
        }
    }

    return newOrder;
};

/**
 * Place Order with Cash on Delivery (COD) or online gateways (Cart acquisition)
 * Decrements inventory atomically and clears the user's cart
 * @param {Object} param0
 * @param {string} param0.userId
 * @param {string} param0.addressId
 * @param {string} [param0.paymentMethod="COD"]
 * @returns {Promise<Object>}
 */
export const placeOrder = async ({
    userId,
    addressId,
    paymentMethod = "COD",
    appliedCoupon = null,
    paymentStatus = "Pending",
    razorpayOrderId = null,
    razorpayPaymentId = null,
    razorpaySignature = null
}) => {
    try {
        if (!addressId) {
            const err = new Error(RESPONSE_MESSAGES.CHECKOUT.ADDRESS_REQUIRED);
            err.code = "ADDRESS_REQUIRED";
            throw err;
        }

        // 1. Fetch and validate delivery address
        const address = await addressService.getAddressById(addressId, userId);
        if (!address) {
            const err = new Error(RESPONSE_MESSAGES.ADDRESS.NOT_FOUND);
            err.code = "ADDRESS_NOT_FOUND";
            throw err;
        }

        // 2. Fetch and inspect cart items
        const cartData = await cartService.getCart(userId);
        if (!cartData.items || cartData.items.length === 0) {
            const err = new Error(RESPONSE_MESSAGES.CHECKOUT.EMPTY_BAG);
            err.code = "EMPTY_BAG";
            throw err;
        }

        if (cartData.hasBlockingIssues) {
            const err = new Error(
                cartData.blockingReasons?.[0] || RESPONSE_MESSAGES.CHECKOUT.ITEMS_BLOCKED
            );
            err.code = "ITEMS_BLOCKED";
            throw err;
        }

        // 3. Re-verify fresh stock in database before placement
        for (const item of cartData.items) {
            const liveProduct = await Product.findOne({
                _id: item.productId,
                isDeleted: false,
                isListed: true
            });

            if (!liveProduct) {
                const err = new Error(`"${item.name}" is no longer available. Please remove it from your bag to proceed.`);
                err.code = "PRODUCT_UNAVAILABLE";
                throw err;
            }

            if (liveProduct.stock < item.quantity) {
                const err = new Error(
                    `Only ${liveProduct.stock} units of "${liveProduct.name}" are available. Please adjust your quantity.`
                );
                err.code = "STOCK_EXCEEDED";
                throw err;
            }
        }

        // 4. Atomically decrement stock
        for (const item of cartData.items) {
            await Product.updateOne(
                { _id: item.productId },
                { $inc: { stock: -item.quantity } }
            );
        }

        const regularTotal = cartData.items.reduce(
            (acc, item) => acc + (item.regularPrice || item.price) * item.quantity,
            0
        );
        const savings = Math.max(0, regularTotal - cartData.subtotal);

        return await persistOrderRecord({
            userId,
            address,
            items: cartData.items,
            subtotal: cartData.subtotal,
            savings,
            paymentMethod,
            appliedCoupon,
            paymentStatus,
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature,
            clearCartOnSuccess: true
        });
    } catch (error) {
        console.error("checkoutService placeOrder error:", error);
        throw error;
    }
};

/**
 * Get single order details by Mongo _id or custom orderId
 * @param {string} orderIdentifier
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
export const getOrderByIdentifier = async (orderIdentifier, userId) => {
    try {
        const query = {
            user: userId,
            $or: [
                { orderId: orderIdentifier },
                { "paymentDetails.razorpayOrderId": orderIdentifier }
            ]
        };

        // If it's a valid ObjectId, search by _id too
        if (orderIdentifier && typeof orderIdentifier === "string" && orderIdentifier.match(/^[0-9a-fA-F]{24}$/)) {
            query.$or.push({ _id: orderIdentifier });
        }

        return await Order.findOne(query).populate("items.product");
    } catch (error) {
        console.error("checkoutService getOrderByIdentifier error:", error);
        throw error;
    }
};

const getProductPricing = (product, qty) => {
    const regularPrice = Number(product.regularPrice) || 0;
    const hasDiscount = Boolean(product.salePrice && product.salePrice > 0 && product.salePrice < regularPrice);
    const price = hasDiscount ? Number(product.salePrice) : regularPrice;
    const lineTotal = price * qty;
    const regularTotal = regularPrice * qty;
    return {
        regularPrice,
        price,
        lineTotal,
        regularTotal,
        savings: Math.max(0, regularTotal - lineTotal)
    };
};

/**
 * Get aggregated checkout details for a single "Buy Now" product without touching the cart
 * @param {string} userId
 * @param {string} productId
 * @param {number} [quantity=1]
 * @returns {Promise<Object>}
 */
export const getBuyNowCheckoutDetails = async (userId, productId, quantity = 1, appliedCoupon = null) => {
    try {
        const product = await Product.findOne({
            _id: productId,
            isDeleted: false,
            isListed: true
        }).populate("category").populate("appliedOffer");

        if (!product) {
            return {
                isEmpty: true,
                hasBlockingIssues: true,
                blockingReasons: ["Selected edition is currently unavailable."]
            };
        }

        const qty = Math.max(1, Math.min(parseInt(quantity, 10) || 1, 5));

        if (product.stock < 1) {
            return {
                isEmpty: true,
                hasBlockingIssues: true,
                blockingReasons: [`"${product.name}" is currently sold out.`]
            };
        }

        const effectiveQty = Math.min(qty, product.stock);
        const { regularPrice, price, lineTotal, regularTotal, savings } = getProductPricing(product, effectiveQty);

        const addresses = await addressService.getUserAddresses(userId);
        const selectedAddress = addresses.find((addr) => addr.isDefault) || addresses[0] || null;

        let couponDiscount = 0;
        let couponCode = null;
        if (appliedCoupon && appliedCoupon.code) {
            try {
                const validation = await couponService.validateCoupon(
                    appliedCoupon.code,
                    userId,
                    lineTotal
                );
                couponDiscount = validation.discountAmount;
                couponCode = validation.code;
            } catch {
                couponDiscount = 0;
                couponCode = null;
            }
        }

        const totalAmount = Math.max(0, lineTotal - couponDiscount);

        let appliedOffer = product.appliedOffer || null;
        if (!appliedOffer && (product.category || product._id)) {
            const now = new Date();
            const directOffer = await Offer.findOne({
                isActive: true,
                isDeleted: false,
                offerType: "product",
                product: product._id,
                startDate: { $lte: now },
                endDate: { $gte: now }
            }).lean();
            if (directOffer) {
                appliedOffer = directOffer;
            } else if (product.category) {
                const catId = product.category._id || product.category;
                const catOffer = await Offer.findOne({
                    isActive: true,
                    isDeleted: false,
                    offerType: "category",
                    category: catId,
                    startDate: { $lte: now },
                    endDate: { $gte: now }
                }).lean();
                if (catOffer) {
                    appliedOffer = catOffer;
                }
            }
        }

        const item = {
            productId: product._id,
            name: product.name,
            images: product.images,
            categoryName: product.category?.name || "Exclusive Edition",
            price,
            regularPrice,
            appliedOffer: appliedOffer,
            quantity: effectiveQty,
            lineTotal
        };

        const userWallet = await walletService.getOrCreateWallet(userId);

        return {
            isBuyNow: true,
            isEmpty: false,
            hasBlockingIssues: false,
            cart: {
                itemCount: effectiveQty,
                subtotal: lineTotal,
                totalPrice: totalAmount
            },
            items: [item],
            addresses,
            selectedAddress,
            walletBalance: userWallet.balance,
            financials: {
                catalogTotal: regularTotal,
                regularTotal,
                subtotal: lineTotal,
                savings,
                couponDiscount,
                couponCode,
                courierFee: 0,
                tax: 0,
                totalAmount
            }
        };
    } catch (error) {
        console.error("checkoutService getBuyNowCheckoutDetails error:", error);
        throw error;
    }
};

/**
 * Place Order for a single "Buy Now" item without modifying or clearing the user's cart
 * @param {Object} param0
 * @param {string} param0.userId
 * @param {string} param0.addressId
 * @param {string} param0.productId
 * @param {number} param0.quantity
 * @param {string} [param0.paymentMethod="COD"]
 * @param {Object} [param0.appliedCoupon=null]
 * @param {string} [param0.paymentStatus="Pending"]
 * @param {string} [param0.razorpayOrderId=null]
 * @param {string} [param0.razorpayPaymentId=null]
 * @param {string} [param0.razorpaySignature=null]
 * @returns {Promise<Object>}
 */
export const placeBuyNowOrder = async ({
    userId,
    addressId,
    productId,
    quantity = 1,
    paymentMethod = "COD",
    appliedCoupon = null,
    paymentStatus = "Pending",
    razorpayOrderId = null,
    razorpayPaymentId = null,
    razorpaySignature = null
}) => {
    try {
        if (!addressId) {
            const err = new Error(RESPONSE_MESSAGES.CHECKOUT.ADDRESS_REQUIRED);
            err.code = "ADDRESS_REQUIRED";
            throw err;
        }

        const address = await addressService.getAddressById(addressId, userId);
        if (!address) {
            const err = new Error(RESPONSE_MESSAGES.ADDRESS.NOT_FOUND);
            err.code = "ADDRESS_NOT_FOUND";
            throw err;
        }

        const product = await Product.findOne({
            _id: productId,
            isDeleted: false,
            isListed: true
        }).populate("category").populate("appliedOffer");

        if (!product) {
            const err = new Error("Selected creation is no longer available.");
            err.code = "PRODUCT_UNAVAILABLE";
            throw err;
        }

        const qty = Math.max(1, parseInt(quantity, 10) || 1);
        if (product.stock < qty) {
            const err = new Error(`Only ${product.stock} units available.`);
            err.code = "STOCK_EXCEEDED";
            throw err;
        }

        // Atomically decrement stock for this product only
        await Product.updateOne(
            { _id: productId },
            { $inc: { stock: -qty } }
        );

        const { regularPrice, price, lineTotal, savings } = getProductPricing(product, qty);

        const orderItem = {
            productId: product._id,
            name: product.name,
            image: (product.images && product.images[0]) || "/uploads/hero_lighter.png",
            categoryName: product.category?.name || "Exclusive Edition",
            price,
            regularPrice,
            quantity: qty,
            lineTotal
        };

        return await persistOrderRecord({
            userId,
            address,
            items: [orderItem],
            subtotal: lineTotal,
            savings,
            paymentMethod,
            appliedCoupon,
            paymentStatus,
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature,
            clearCartOnSuccess: false,
            walletDescription: `Acquisition payment for direct buy order`
        });
    } catch (error) {
        console.error("checkoutService placeBuyNowOrder error:", error);
        throw error;
    }
};

export default {
    getCheckoutDetails,
    getBuyNowCheckoutDetails,
    placeOrder,
    placeBuyNowOrder,
    getOrderByIdentifier
};
