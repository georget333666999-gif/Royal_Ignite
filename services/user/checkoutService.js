import Order from "../../models/orderModel.js";
import Cart from "../../models/cartModel.js";
import Product from "../../models/productModel.js";
import cartService from "./cartService.js";
import addressService from "./addressService.js";
import { RESPONSE_MESSAGES } from "../../constants/index.js";

/**
 * Get aggregated checkout information (Cart items, delivery addresses, pricing totals)
 * @param {string} userId
 * @returns {Promise<Object>}
 */
export const getCheckoutDetails = async (userId) => {
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

        return {
            isEmpty: false,
            hasBlockingIssues: false,
            cart: cartData,
            items: cartData.items,
            addresses,
            selectedAddress,
            financials: {
                catalogTotal: regularTotal,
                regularTotal,
                subtotal: cartData.subtotal,
                savings,
                courierFee: 0,
                tax: 0,
                totalAmount: cartData.totalPrice
            }
        };
    } catch (error) {
        console.error("checkoutService getCheckoutDetails error:", error);
        throw error;
    }
};

/**
 * Place Order with Cash on Delivery (COD)
 * Decrements inventory atomically and clears the user's cart
 * @param {Object} param0
 * @param {string} param0.userId
 * @param {string} param0.addressId
 * @param {string} [param0.paymentMethod="COD"]
 * @returns {Promise<Object>}
 */
export const placeOrder = async ({ userId, addressId, paymentMethod = "COD" }) => {
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

        // 5. Build order items snapshot
        const orderItems = cartData.items.map((item) => ({
            product: item.productId,
            name: item.name,
            image: (item.images && item.images[0]) || "/uploads/hero_lighter.png",
            categoryName: item.categoryName || "Exclusive Edition",
            price: item.price,
            regularPrice: item.regularPrice || item.price,
            quantity: item.quantity,
            lineTotal: item.lineTotal,
            status: "Placed"
        }));

        const regularTotal = cartData.items.reduce(
            (acc, item) => acc + (item.regularPrice || item.price) * item.quantity,
            0
        );
        const savings = Math.max(0, regularTotal - cartData.subtotal);

        const pricing = {
            subtotal: cartData.subtotal,
            discount: savings,
            tax: 0,
            shippingFee: 0,
            totalAmount: cartData.totalPrice
        };

        const uniqueOrderId = Order.generateOrderId();

        // 6. Persist order
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
            paymentMethod: "COD",
            paymentStatus: "Pending",
            pricing,
            orderStatus: "Placed"
        });

        // 7. Clear the user's cart
        await Cart.updateOne({ user: userId }, { $set: { items: [] } });

        return newOrder;
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
            $or: [{ orderId: orderIdentifier }]
        };

        // If it's a valid ObjectId, search by _id too
        if (orderIdentifier.match(/^[0-9a-fA-F]{24}$/)) {
            query.$or.push({ _id: orderIdentifier });
        }

        return await Order.findOne(query).populate("items.product");
    } catch (error) {
        console.error("checkoutService getOrderByIdentifier error:", error);
        throw error;
    }
};

export default {
    getCheckoutDetails,
    placeOrder,
    getOrderByIdentifier
};
