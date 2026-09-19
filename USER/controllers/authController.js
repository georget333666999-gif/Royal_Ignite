const userService = require("../services/userService");
const { sendOtpEmail } = require("../../utils/sendEmail");

// ========================================
// Signup Page
// ========================================

const getSignup = (req, res) => {

    res.render("signup", {
        error: req.query.error || null,
        formData: {}
    });

};


// ========================================
// Signup Form
// ========================================

const postSignup = async (req, res) => {

    try {

        const { name, email, phone, password } = req.body;


        // -------------------------------
        // Create User
        // -------------------------------

        const user = await userService.createUser({

            name: name.trim(),

            email: email.trim().toLowerCase(),

            phone: phone.trim(),

            password

        });


        // -------------------------------
        // Generate OTP & Send Email
        // -------------------------------

        const otp = await userService.createOTP(
            user._id
        );

        // Send OTP to user's real email
        await sendOtpEmail(user.email, otp.otpCode, "signup", user.name);

        // Store user ID and success message in session
        req.session.otpUserId = user._id.toString();
        req.session.otpSuccessMessage = "Account created successfully! A 6-digit verification code has been sent to your email.";

        req.session.save((saveErr) => {
            if (saveErr) {
                console.error("Session save error during signup:", saveErr);
            }
            res.redirect("/user/verify-otp");
        });


    } catch (error) {

        console.error("Signup error:", error);


        if (error.code === 11000) {

            return res.status(400).render("signup", {

                error:
                    "Email or phone number already exists.",

                formData: req.body

            });

        }


        res.status(500).render("signup", {

            error:
                "Something went wrong. Please try again.",

            formData: req.body

        });

    }

};


// ========================================
// Login Page
// ========================================

const getLogin = (req, res) => {
    let successMessage = null;
    if (req.query.verified === "true") {
        successMessage = "Account verified successfully! You can now log in.";
    } else if (req.query.reset === "true") {
        successMessage = "Password reset successfully! You can now log in with your new password.";
    }

    res.render("login", {
        error: req.query.error || null,
        success: successMessage,
        formData: {}
    });

};


// ========================================
// Login
// ========================================

const postLogin = async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;



        // -------------------------------
        // Login Service
        // -------------------------------

        const result =
            await userService.loginUser(
                email,
                password
            );


        if (!result.success) {

            // If user is registered but unverified, send a fresh OTP and redirect to verify page!
            if (result.isUnverified && result.userId) {
                const otp = await userService.createOTP(result.userId);
                await sendOtpEmail(result.userEmail, otp.otpCode, "signup", result.userName || "Customer");
                req.session.otpUserId = result.userId.toString();
                req.session.otpSuccessMessage = "Your account is not verified yet. A fresh verification code has been sent to your email.";
                return req.session.save((saveErr) => {
                    if (saveErr) {
                        console.error("Session save error for unverified user:", saveErr);
                    }
                    res.redirect("/user/verify-otp");
                });
            }

            return res.status(401).render("login", {

                error: result.message,

                formData: {
                    email
                }

            });

        }


        // -------------------------------
        // Create Login Session
        // -------------------------------

        req.session.userId =
            result.user._id.toString();

        req.session.isUserLoggedIn = true;


        // -------------------------------
        // Redirect (Wait for session save before redirect to prevent race condition)
        // -------------------------------

        req.session.save((saveErr) => {
            if (saveErr) {
                console.error("Session save error during login:", saveErr);
            }
            res.redirect("/");
        });


    } catch (error) {

        console.error(
            "Login error:",
            error
        );

        res.status(500).render("login", {

            error:
                "Something went wrong. Please try again.",

            formData: {
                email: req.body.email
            }

        });

    }

};


// ========================================
// Logout
// ========================================

const logout = (req, res) => {
    const finishLogout = () => {
        req.session.destroy((error) => {
            if (error) {
                console.error("Logout error:", error);
                return res.status(500).send("Unable to logout.");
            }

            res.clearCookie("user.sid", { path: "/" });
            return res.redirect("/user/login");
        });
    };

    if (typeof req.logout === "function") {
        req.logout((err) => {
            if (err) {
                console.error("Passport logout error:", err);
            }
            finishLogout();
        });
    } else {
        finishLogout();
    }
};


module.exports = {
    getSignup,
    postSignup,
    getLogin,
    postLogin,
    logout
};
