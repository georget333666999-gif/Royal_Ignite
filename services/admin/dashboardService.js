import Order from "../../models/orderModel.js";
import Product from "../../models/productModel.js";
import Category from "../../models/categoryModel.js";
import User from "../../models/userModel.js";
import Wallet from "../../models/walletModel.js";

/**
 * Get top 10 best-selling products
 */
export const getTop10Products = async () => {
    try {
        const topProducts = await Order.aggregate([
            { $match: { orderStatus: { $ne: "Cancelled" } } },
            { $unwind: "$items" },
            { $match: { "items.status": { $ne: "Cancelled" } } },
            {
                $group: {
                    _id: "$items.product",
                    productId: { $first: "$items.product" },
                    name: { $first: "$items.name" },
                    image: { $first: "$items.image" },
                    categoryName: { $first: "$items.categoryName" },
                    unitPrice: { $first: "$items.price" },
                    totalSold: { $sum: "$items.quantity" },
                    totalRevenue: { $sum: "$items.lineTotal" }
                }
            },
            { $sort: { totalSold: -1, totalRevenue: -1 } },
            { $limit: 10 }
        ]);

        return topProducts;
    } catch (error) {
        console.error("dashboardService getTop10Products error:", error);
        return [];
    }
};

/**
 * Get top 10 best-selling categories
 */
export const getTop10Categories = async () => {
    try {
        const topCategories = await Order.aggregate([
            { $match: { orderStatus: { $ne: "Cancelled" } } },
            { $unwind: "$items" },
            { $match: { "items.status": { $ne: "Cancelled" } } },
            {
                $group: {
                    _id: "$items.categoryName",
                    categoryName: { $first: "$items.categoryName" },
                    totalSold: { $sum: "$items.quantity" },
                    totalRevenue: { $sum: "$items.lineTotal" },
                    orderCount: { $sum: 1 }
                }
            },
            { $sort: { totalSold: -1, totalRevenue: -1 } },
            { $limit: 10 }
        ]);

        return topCategories;
    } catch (error) {
        console.error("dashboardService getTop10Categories error:", error);
        return [];
    }
};

/**
 * Get top 10 best-selling brands and collections
 */
export const getTop10Brands = async () => {
    try {
        const topBrands = await Order.aggregate([
            { $match: { orderStatus: { $ne: "Cancelled" } } },
            { $unwind: "$items" },
            { $match: { "items.status": { $ne: "Cancelled" } } },
            {
                $project: {
                    name: "$items.name",
                    quantity: "$items.quantity",
                    lineTotal: "$items.lineTotal",
                    categoryName: "$items.categoryName",
                    brand: {
                        $concat: [
                            "Royal ",
                            {
                                $cond: {
                                    if: { $regexMatch: { input: "$items.name", regex: /Heritage/i } },
                                    then: "Heritage Edition",
                                    else: {
                                        $cond: {
                                            if: { $regexMatch: { input: "$items.name", regex: /Sovereign/i } },
                                            then: "Sovereign Atelier",
                                            else: {
                                                $cond: {
                                                    if: { $regexMatch: { input: "$items.name", regex: /Solis/i } },
                                                    then: "Solis Arc",
                                                    else: {
                                                        $cond: {
                                                            if: { $regexMatch: { input: "$items.name", regex: /Chesterfield/i } },
                                                            then: "Chesterfield Prestige",
                                                            else: {
                                                                $cond: {
                                                                    if: { $regexMatch: { input: "$items.name", regex: /Commander/i } },
                                                                    then: "Commander Signature",
                                                                    else: "$items.categoryName"
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: "$brand",
                    brandName: { $first: "$brand" },
                    totalSold: { $sum: "$quantity" },
                    totalRevenue: { $sum: "$lineTotal" }
                }
            },
            { $sort: { totalSold: -1, totalRevenue: -1 } },
            { $limit: 10 }
        ]);

        return topBrands;
    } catch (error) {
        console.error("dashboardService getTop10Brands error:", error);
        return [];
    }
};

/**
 * Get chart data filtered by period (yearly, monthly, weekly)
 */
export const getChartData = async (filter = "monthly") => {
    try {
        const now = new Date();
        const nonCancelled = { orderStatus: { $ne: "Cancelled" } };

        if (filter === "yearly") {
            const currentYear = now.getFullYear();
            const startOfYear = new Date(currentYear, 0, 1);
            const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59, 999);

            const results = await Order.aggregate([
                {
                    $match: {
                        ...nonCancelled,
                        createdAt: { $gte: startOfYear, $lte: endOfYear }
                    }
                },
                {
                    $group: {
                        _id: { $month: "$createdAt" },
                        totalRevenue: { $sum: "$pricing.totalAmount" },
                        orderCount: { $sum: 1 }
                    }
                }
            ]);

            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const labels = monthNames;
            const revenues = new Array(12).fill(0);
            const orderCounts = new Array(12).fill(0);

            results.forEach((r) => {
                const monthIdx = r._id - 1;
                if (monthIdx >= 0 && monthIdx < 12) {
                    revenues[monthIdx] = r.totalRevenue;
                    orderCounts[monthIdx] = r.orderCount;
                }
            });

            return { filter, labels, revenues, orderCounts };
        } else if (filter === "weekly") {
            const days = 7;
            const startOfWeek = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
            startOfWeek.setHours(0, 0, 0, 0);

            const results = await Order.aggregate([
                {
                    $match: {
                        ...nonCancelled,
                        createdAt: { $gte: startOfWeek, $lte: now }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                        },
                        totalRevenue: { $sum: "$pricing.totalAmount" },
                        orderCount: { $sum: 1 }
                    }
                }
            ]);

            const resultMap = new Map(results.map((r) => [r._id, r]));
            const labels = [];
            const revenues = [];
            const orderCounts = [];

            for (let i = days - 1; i >= 0; i--) {
                const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
                const dateKey = d.toISOString().slice(0, 10);
                const label = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" });
                labels.push(label);

                const dataPoint = resultMap.get(dateKey);
                revenues.push(dataPoint ? dataPoint.totalRevenue : 0);
                orderCounts.push(dataPoint ? dataPoint.orderCount : 0);
            }

            return { filter, labels, revenues, orderCounts };
        } else {
            // "monthly" by default (Days of the current month)
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth();
            const startOfMonth = new Date(currentYear, currentMonth, 1);
            const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
            const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

            const results = await Order.aggregate([
                {
                    $match: {
                        ...nonCancelled,
                        createdAt: { $gte: startOfMonth, $lte: endOfMonth }
                    }
                },
                {
                    $group: {
                        _id: { $dayOfMonth: "$createdAt" },
                        totalRevenue: { $sum: "$pricing.totalAmount" },
                        orderCount: { $sum: 1 }
                    }
                }
            ]);

            const resultMap = new Map(results.map((r) => [r._id, r]));
            const labels = [];
            const revenues = [];
            const orderCounts = [];

            for (let day = 1; day <= daysInMonth; day++) {
                labels.push(`Day ${day}`);
                const dataPoint = resultMap.get(day);
                revenues.push(dataPoint ? dataPoint.totalRevenue : 0);
                orderCounts.push(dataPoint ? dataPoint.orderCount : 0);
            }

            return { filter, labels, revenues, orderCounts };
        }
    } catch (error) {
        console.error("dashboardService getChartData error:", error);
        return { filter, labels: [], revenues: [], orderCounts: [] };
    }
};

/**
 * Generate ledger summary book
 */
export const getLedgerBookSummary = async () => {
    try {
        const [orderAggregation, walletAggregation] = await Promise.all([
            Order.aggregate([
                { $match: { orderStatus: { $ne: "Cancelled" } } },
                {
                    $group: {
                        _id: null,
                        totalCredit: { $sum: "$pricing.totalAmount" },
                        totalGrossSales: { $sum: "$pricing.subtotal" },
                        totalDiscounts: { $sum: "$pricing.discount" },
                        totalCouponDeductions: { $sum: "$pricing.couponDiscount" },
                        count: { $sum: 1 }
                    }
                }
            ]),
            Wallet.aggregate([
                { $unwind: "$transactions" },
                {
                    $group: {
                        _id: "$transactions.type",
                        totalAmount: { $sum: "$transactions.amount" },
                        count: { $sum: 1 }
                    }
                }
            ])
        ]);

        const orderStats = orderAggregation[0] || {
            totalCredit: 0,
            totalGrossSales: 0,
            totalDiscounts: 0,
            totalCouponDeductions: 0,
            count: 0
        };

        let walletCredits = 0;
        let walletDebits = 0;
        walletAggregation.forEach((w) => {
            if (w._id === "credit") walletCredits = w.totalAmount;
            if (w._id === "debit") walletDebits = w.totalAmount;
        });

        // Recent ledger transaction log
        const recentOrders = await Order.find({ orderStatus: { $ne: "Cancelled" } })
            .select("orderId createdAt paymentMethod pricing.totalAmount orderStatus")
            .sort({ createdAt: -1 })
            .limit(15)
            .lean();

        return {
            totalGrossRevenue: orderStats.totalGrossSales,
            totalNetSales: orderStats.totalCredit,
            totalDiscountsGiven: orderStats.totalDiscounts + orderStats.totalCouponDeductions,
            couponDeductions: orderStats.totalCouponDeductions,
            walletCreditsIssued: walletCredits,
            walletSettlementsUsed: walletDebits,
            ordersCount: orderStats.count,
            recentEntries: recentOrders
        };
    } catch (error) {
        console.error("dashboardService getLedgerBookSummary error:", error);
        throw error;
    }
};

/**
 * Get Real-Time Dashboard KPI Cards & Activity
 */
export const getLiveDashboardMetrics = async () => {
    try {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        const [
            todayOrdersAgg,
            pendingOrdersCount,
            totalUsersCount,
            totalProductsCount,
            totalCategoriesCount,
            recentOrders
        ] = await Promise.all([
            Order.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startOfToday, $lte: endOfToday },
                        orderStatus: { $ne: "Cancelled" }
                    }
                },
                {
                    $group: {
                        _id: null,
                        revenue: { $sum: "$pricing.totalAmount" },
                        count: { $sum: 1 }
                    }
                }
            ]),
            Order.countDocuments({ orderStatus: { $in: ["Placed", "Processing", "Shipped"] } }),
            User.countDocuments({ isAdmin: false }),
            Product.countDocuments({ isDeleted: false }),
            Category.countDocuments({ isDeleted: false }),
            Order.find()
                .populate("user", "name email")
                .sort({ createdAt: -1 })
                .limit(8)
                .lean()
        ]);

        const todayRevenue = todayOrdersAgg[0] ? todayOrdersAgg[0].revenue : 0;
        const todayOrdersCount = todayOrdersAgg[0] ? todayOrdersAgg[0].count : 0;

        return {
            todayRevenue,
            todayOrdersCount,
            pendingOrdersCount,
            totalUsers: totalUsersCount,
            totalProducts: totalProductsCount,
            totalCategories: totalCategoriesCount,
            recentOrders
        };
    } catch (error) {
        console.error("dashboardService getLiveDashboardMetrics error:", error);
        throw error;
    }
};

export default {
    getTop10Products,
    getTop10Categories,
    getTop10Brands,
    getChartData,
    getLedgerBookSummary,
    getLiveDashboardMetrics
};

