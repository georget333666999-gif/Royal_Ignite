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
router.get("/google/callback", redirectIfUserLoggedIn, (req, res, next) => {
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

                    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
                    res.set("Pragma", "no-cache");
                    res.set("Expires", "0");
                    return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Cache-Control" content="no-store, no-cache, must-revalidate">
    <title>Redirecting - ROYAL IGNITE</title>
    <script>
        if (window.history && window.history.replaceState) {
            window.history.replaceState(null, null, '/');
        }
        window.location.replace('/');
    </script>
</head>
<body>
    <script>
        window.location.replace('/');
    </script>
</body>
</html>`);
                });
            });
        })(req, res, next);
    } catch (error) {
        console.error("Google OAuth callback exception:", error);
        return res.redirect("/user/login?error=" + encodeURIComponent("Google authentication failed."));
    }
});

export default router;