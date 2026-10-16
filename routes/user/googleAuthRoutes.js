import express from "express";
import passport from "../../config/passport.js";
import { redirectIfUserLoggedIn } from "../../middleware/userMiddleware.js";

const router = express.Router();

// Start Google OAuth Authentication Flow
router.get(
    "/google",
    redirectIfUserLoggedIn,
    passport.authenticate("google", {
        scope: ["profile", "email"],
        prompt: "select_account"
    })
);

// Google OAuth Callback
 
router.get("/google/callback", (req, res, next) => {
    try {
        passport.authenticate("google", (err, user, info) => {
            if (err) {
                console.error("Google OAuth error:", err);
                const errorMsg = err.message || "Google authentication encountered an unexpected error.";
                return res.redirect("/user/login?error=" + encodeURIComponent(errorMsg));
            }

            if (!user) {
                const message = info?.message || "Google sign-in was cancelled or could not be completed.";
                return res.redirect("/user/login?error=" + encodeURIComponent(message));
            }

            req.logIn(user, (loginErr) => {
                if (loginErr) {
                    console.error("Passport logIn error:", loginErr);
                    return res.redirect("/user/login?error=" + encodeURIComponent("Failed to establish login session."));
                }

                req.session.userId = user._id.toString();
                req.session.isUserLoggedIn = true;

                req.session.save((saveErr) => {
                    if (saveErr) {
                        console.error("Session save error after Google auth:", saveErr);
                    }
                    console.log(`[GOOGLE AUTH] Successfully authenticated: ${user.email}`);
                    return res.redirect("/");
                });
            });
        })(req, res, next);
    } catch (error) {
        console.error("Google OAuth callback exception:", error);
        return res.redirect("/user/login?error=" + encodeURIComponent("Google authentication failed."));
    }
});

export default router;