import express from "express";
import homeController from "../../controllers/user/homeController.js";

const router = express.Router();

// Landing / Home page
router.get("/", homeController.getHomePage);

// Legacy redirect aliases
router.get(["/changepassword", "/change-password"], (req, res, next) => {
    try {
        res.redirect("/user/profile/change-password");
    } catch (error) {
        next(error);
    }
});

router.all("/logout", (req, res, next) => {
    try {
        res.redirect("/user/logout");
    } catch (error) {
        next(error);
    }
});

export default router;
