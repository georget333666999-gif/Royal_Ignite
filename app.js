const express = require("express");
const path = require("path");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const googleAuthRoutes = require("./USER/routes/googleAuthRoutes");
const passport = require("./config/passport");

const userRoutes = require("./USER/routes/userRoutes");
const adminRoutes = require("./ADMIN/routes/adminRoutes");

const app = express();


// ========================================
// View Engine Configuration
// ========================================

app.set("view engine", "ejs");

app.set("views", [
    path.join(__dirname, "ADMIN/views"),
    path.join(__dirname, "USER/views")
]);


// ========================================
// Built-in Middleware
// ========================================

app.use(express.json());

app.use(
    express.urlencoded({
        extended: true
    })
);


// ========================================
// Static Files
// ========================================

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


// ========================================
// Cache Control Middleware (Prevents BFCache / back-button showing cached auth/protected pages)
// ========================================

app.use((req, res, next) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    next();
});


// ========================================
// Session Configurations
// ========================================

const userSession = session({
    name: "user.sid",
    secret: process.env.SESSION_SECRET || "user_session_secret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,
        collectionName: "user_sessions"
    }),
    cookie: {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24
    }
});

const adminSession = session({
    name: "admin.sid",
    secret: process.env.SESSION_SECRET || "admin_session_secret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,
        collectionName: "admin_sessions"
    }),
    cookie: {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24
    }
});

// Admin routes session middleware
app.use("/admin", adminSession);

// User routes session middleware
app.use((req, res, next) => {
    if (req.originalUrl.startsWith("/admin")) {
        return next();
    }
    userSession(req, res, next);
});

// ========================================
// Passport Configuration
// ========================================

app.use(passport.initialize());

app.use(passport.session()); 

// ========================================
// Routes Configuration
// ========================================
app.use("/auth", googleAuthRoutes);

app.use("/admin", adminRoutes);

app.use("/user", userRoutes);

// ========================================
// Home / Index Landing Route
// ========================================

const User = require("./models/userModel");

app.get("/", async (req, res) => {
    let isUserLoggedIn = Boolean(req.session && req.session.isUserLoggedIn && req.session.userId);
    let userId = req.session ? req.session.userId : null;

    if (isUserLoggedIn && userId) {
        try {
            const user = await User.findById(userId);
            if (!user || user.isBlocked) {
                req.session.destroy(() => {
                    res.clearCookie("user.sid");
                    return res.redirect("/user/login?error=" + encodeURIComponent("Your account has been blocked."));
                });
                return;
            }
        } catch (err) {
            console.error("Home route user check error:", err);
        }
    }

    res.render("index", {
        isUserLoggedIn,
        userId
    });
});

module.exports = app;