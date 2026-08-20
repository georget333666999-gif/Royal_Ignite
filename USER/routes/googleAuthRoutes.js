const express = require("express");
const passport = require("../../config/passport");

const router = express.Router();


// ========================================
// Start Google Authentication
// ========================================

router.get(
    "/google",
    passport.authenticate("google", {
        scope: ["profile", "email"]
    })
);


// ========================================
// Google OAuth Callback
// ========================================

router.get(
    "/google/callback",
    passport.authenticate("google", {
        failureRedirect: "/user/login"
    }),
    (req, res) => {

        // Google authentication successful

        req.session.userId = req.user._id.toString();

        req.session.isUserLoggedIn = true;

        res.redirect("/");
    }
);

module.exports = router;                                                                                                                                                                                                                                     