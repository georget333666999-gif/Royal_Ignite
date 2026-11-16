import Category from "../models/categoryModel.js";
import Product from "../models/productModel.js";
import User from "../models/userModel.js";

export const adminMiddleware = async (req, res, next) => {
    try {
        if (!req.session?.userId || !req.session?.isAdmin) {
            return res.redirect("/admin/login");
        }

        try {
            const [categoriesCount, productsCount, usersCount] = await Promise.all([
                Category.countDocuments({ isDeleted: false }),
                Product.countDocuments({ isDeleted: false }),
                User.countDocuments({ isAdmin: false })
            ]);
            res.locals.sidebarCounts = {
                totalCategories: categoriesCount,
                totalProducts: productsCount,
                totalUsers: usersCount
            };
        } catch (_countErr) {
            res.locals.sidebarCounts = {
                totalCategories: 4,
                totalProducts: 25,
                totalUsers: 35
            };
        }

        next();
    } catch (err) {
        console.error("adminMiddleware error:", err);
        return res.redirect("/admin/login");
    }
};

export const redirectIfAdminLoggedIn = (req, res, next) => {
    try {
        if (req.session && req.session.userId && req.session.isAdmin) {
            return res.redirect("/admin/dashboard");
        }
        next();
    } catch (err) {
        console.error("redirectIfAdminLoggedIn error:", err);
        next();
    }
};

export default {
    adminMiddleware,
    redirectIfAdminLoggedIn
};
