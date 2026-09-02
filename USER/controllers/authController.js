const userService = require("../services/userService");
const { sendOtpEmail } = require("../../utils/sendEmail");

// ========================================
// Signup Page
// ========================================

const getSignup = (req, res) => {

    res.render("signup", {
        error: null,
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

        console.log(
            `OTP for ${user.email}: ${otp.otpCode}`
        );

        // Send OTP to user's real email
        await sendOtpEmail(user.email, otp.otpCode, "signup", user.name);

        // Store user ID in session
        req.session.otpUserId = user._id.toString();


        res.redirect("/user/verify-otp");


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

    res.render("login", {
        error: req.query.error || null,
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
        // Redirect
        // -------------------------------

        res.redirect("/");


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

    req.session.destroy((error) => {

        if (error) {

            console.error(
                "Logout error:",
                error
            );

            return res.status(500).send(
                "Unable to logout."
            );
        }

        res.clearCookie("user.sid");

        res.redirect("/user/login");

    });
};


module.exports = {
    getSignup,
    postSignup,
    getLogin,
    postLogin,
    logout
};
