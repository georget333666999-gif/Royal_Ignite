import "dotenv/config";

import path from "path";
import { fileURLToPath } from "url";

import express from "express";
import compression from "compression";
import session from "express-session";
import MongoStore from "connect-mongo";

import passport from "./config/passport.js";
import { SESSION, HTTP_STATUS, RESPONSE_MESSAGES } from "./constants/index.js";
import Cart from "./models/cartModel.js";
import Wishlist from "./models/wishlistModel.js";
import { getCache, setCache } from "./utils/cache.js";

import googleAuthRoutes from "./routes/user/googleAuthRoutes.js";
import homeRoutes from "./routes/user/homeRoutes.js";
import userRoutes from "./routes/user/userRoutes.js";
import productRoutes from "./routes/user/productRoutes.js";
import cartRoutes from "./routes/user/cartRoutes.js";
import wishlistRoutes from "./routes/user/wishlistRoutes.js";
import checkoutRoutes from "./routes/user/checkoutRoutes.js";
import orderRoutes from "./routes/user/orderRoutes.js";
import walletRoutes from "./routes/user/walletRoutes.js";
import adminRoutes from "./routes/admin/adminRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ========================================
// View Engine Configuration
// ========================================
app.set("view engine", "ejs");
app.set("views", [
    path.join(__dirname, "views"),
    path.join(__dirname, "views/user"),
    path.join(__dirname, "views/admin")
]);

// ========================================
// Global Middlewares
// ========================================
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
    express.static(path.join(__dirname, "public"), {
        etag: true,
        lastModified: true,
        setHeaders: (res, filePath) => {
            if (/\.(png|jpe?g|webp|gif|svg|ico|woff2?)$/i.test(filePath)) {
                res.setHeader("Cache-Control", "public, max-age=604800");
            } else {
                res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
            }
        }
    })
);

// Cache Control Middleware (Prevents BFCache from displaying cached auth/protected pages)
app.use((req, res, next) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.set("Surrogate-Control", "no-store");
    next();
});

// ========================================
// Session Configurations
// ========================================
const userSession = session({
    name: SESSION.USER_COOKIE,
    secret: process.env.SESSION_SECRET || "user_session_secret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,
        collectionName: "user_sessions",
        touchAfter: 24 * 3600
    }),
    cookie: {
        httpOnly: true,
        maxAge: SESSION.ONE_DAY_MS,
        sameSite: "lax"
    }
});

const adminSession = session({
    name: SESSION.ADMIN_COOKIE,
    secret: process.env.SESSION_SECRET || "admin_session_secret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,
        collectionName: "admin_sessions",
        touchAfter: 24 * 3600
    }),
    cookie: {
        httpOnly: true,
        maxAge: SESSION.ONE_DAY_MS,
        sameSite: "lax"
    }
});

// Route-scoped session & passport handling
const isAdminRoute = (req) => req.originalUrl.startsWith("/admin");

app.use("/admin", adminSession);
app.use((req, res, next) => isAdminRoute(req) ? next() : userSession(req, res, next));
app.use((req, res, next) => isAdminRoute(req) ? next() : passport.initialize()(req, res, next));
app.use((req, res, next) => isAdminRoute(req) ? next() : passport.session()(req, res, next));

// Global template locals for user session state & cached header badge counts
app.use(async (req, res, next) => {
    const loggedIn = !isAdminRoute(req) && Boolean(req.session?.isUserLoggedIn || req.session?.userId || req.user?._id);
    res.locals.isUserLoggedIn = loggedIn;
    res.locals.headerCartCount = 0;
    res.locals.headerWishlistCount = 0;

    const isHtmlGet = req.method === "GET" && !req.xhr && !req.headers.accept?.includes("application/json");
    if (loggedIn && isHtmlGet) {
        try {
            const uid = (req.session?.userId || req.user?._id || "").toString();
            if (uid) {
                const cacheKey = `user:badges:${uid}`;
                let counts = getCache(cacheKey);
                if (!counts) {
                    const [cartDoc, wishlistDoc] = await Promise.all([
                        Cart.findOne({ user: uid }).select("items.quantity").lean(),
                        Wishlist.findOne({ user: uid }).select("products").lean()
                    ]);
                    const cartCount = cartDoc && Array.isArray(cartDoc.items)
                        ? cartDoc.items.reduce((sum, item) => sum + (item.quantity || 0), 0)
                        : 0;
                    const wishlistCount = wishlistDoc && Array.isArray(wishlistDoc.products)
                        ? wishlistDoc.products.length
                        : 0;
                    counts = setCache(cacheKey, { cartCount, wishlistCount }, 20000);
                }
                res.locals.headerCartCount = counts.cartCount;
                res.locals.headerWishlistCount = counts.wishlistCount;
            }
        } catch (_badgeErr) {
            // Non-blocking fallback
        }
    }
    next();
});

// ========================================
// Route Mounting
// ========================================
app.use("/auth", googleAuthRoutes);
app.use("/admin", adminRoutes);
app.use("/user", userRoutes);
app.use("/", cartRoutes);
app.use("/", wishlistRoutes);
app.use("/", checkoutRoutes);
app.use("/", orderRoutes);
app.use("/", walletRoutes);
app.use("/", productRoutes);
app.use("/", homeRoutes);

// ========================================
// 404 Catch-All Middleware
// ========================================
app.use((req, res) => {
    res.status(HTTP_STATUS.NOT_FOUND).send(RESPONSE_MESSAGES.COMMON.PAGE_NOT_FOUND);
});

// ========================================
// Centralized Error Handler Middleware
// ========================================
app.use((err, req, res, next) => {
    console.error("[SERVER ERROR]", err);
    const status = err.status || HTTP_STATUS.INTERNAL_SERVER_ERROR;
    const message = process.env.NODE_ENV === "production" ? RESPONSE_MESSAGES.COMMON.INTERNAL_ERROR : err.message;

    if (req.xhr || req.headers.accept?.includes("application/json")) {
        return res.status(status).json({ success: false, message });
    }

    res.status(status).send(message);
});

export { app };
export default app;