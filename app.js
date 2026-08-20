const express = require("express");
const path = require("path");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const authRoutes = require("./USER/routes/googleAuthRoutes");
const passport = require("./config/passport");

const userRoutes = require("./USER/routes/userRoutes");
const googleAuthRoutes = require("./USER/routes/googleAuthRoutes");
const adminRoutes = require("./ADMIN/routes/adminRoutes");
const adminMiddleware = require("./middleware/adminMiddleware");

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
// Session Configuration
// ========================================

app.use(
    session({
        secret: process.env.SESSION_SECRET,

        resave: false,

        saveUninitialized: false,

        store: MongoStore.create({
            mongoUrl: process.env.MONGO_URI
        }),

        cookie: {
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24
        }
    })
);

// ========================================
// Passport Configuration
// ========================================

app.use(passport.initialize());

app.use(passport.session()); 

// ========================================
// Admin Routes
// ========================================
app.use("/auth", googleAuthRoutes);

app.use("/admin", adminRoutes);

app.use("/user", userRoutes);

// ========================================
// Temporary Home Route
// ========================================

app.get("/", (req, res) => {
    res.render("home");
});


// ========================================
// Temporary Admin Dashboard
// ========================================

app.get(
    "/admin/dashboard",
    adminMiddleware,
    (req, res) => {
        res.send("Admin Dashboard - Login successful");
    }
);


module.exports = app;