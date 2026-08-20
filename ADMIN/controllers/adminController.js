const adminService = require("../services/adminService");

const showLoginPage = (req, res) => {
    res.render("auth/login");
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).render("auth/login", {
                error: "Email and password are required",
                email
            });
        }

        const admin = await adminService.loginAdmin(
            email,
            password
        );

        req.session.userId = admin._id;
        req.session.isAdmin = true;

        return res.redirect("/admin/dashboard");

    } catch (error) {
        return res.status(401).render("auth/login", {
            error: error.message,
            email: req.body.email
        });
    }
};

module.exports = {
    showLoginPage,
    login
};