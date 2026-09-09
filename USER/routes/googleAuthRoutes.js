const express = require("express");
const passport = require("../../config/passport");
const { redirectIfUserLoggedIn } = require("../../middleware/userMiddleware");

const router = express.Router();


// ========================================
// Start Google Authentication
// ========================================

router.get(
    "/google",
    redirectIfUserLoggedIn,
    passport.authenticate("google", {
        scope: ["profile", "email"],
        prompt: "select_account"
    })
);


// ========================================
// Google OAuth Callback
// ========================================

router.get("/google/callback", (req, res, next) => {
    passport.authenticate("google", (err, user, info) => {
        if (err) {
            console.error("Google OAuth error:", err);
            const errorMsg = err.message || "Google authentication encountered an unexpected error.";
            return res.redirect("/user/login?error=" + encodeURIComponent(errorMsg));
        }

        if (!user) {
            const message = (info && info.message)
                ? info.message
                : "Google sign-in was cancelled or could not be completed.";
            return res.redirect("/user/login?error=" + encodeURIComponent(message));
        }

        // Establish passport login session
        req.logIn(user, (loginErr) => {
            if (loginErr) {
                console.error("Passport logIn error:", loginErr);
                return res.redirect("/user/login?error=" + encodeURIComponent("Failed to establish login session."));
            }

            // Sync user session details
            req.session.userId = user._id.toString();
            req.session.isUserLoggedIn = true;

            // Wait for session persistence before redirecting to prevent race condition
            req.session.save((saveErr) => {
                if (saveErr) {
                    console.error("Session save error after Google auth:", saveErr);
                }
                console.log(`[GOOGLE AUTH] Successfully authenticated: ${user.email}`);
                return res.redirect("/");
            });
        });
    })(req, res, next);
});

module.exports = router;                                                                                                                                                                                                                                     