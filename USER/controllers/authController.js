const userService = require("../services/userService");

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
        // Generate OTP
        // -------------------------------

        const otp = await userService.createOTP(
            user._id
        );


        /*
         * TEMPORARY:
         * We will connect an email service later.
         *
         * For development, display the OTP
         * in the terminal.
         */

        console.log(
            `OTP for ${user.email}: ${otp.otpCode}`
        );


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
// OTP Verification Page
// ========================================

const getVerifyOTP = (req, res) => {

    if (!req.session.otpUserId) {

        return res.redirect("/user/signup");

    }


    res.render("verifyOtp", {
        error: null
    });

};


// ========================================
// Verify OTP
// ========================================

const postVerifyOTP = async (req, res) => {

    try {

        const userId = req.session.otpUserId;

        const { otpCode } = req.body;


        if (!userId) {

            return res.redirect("/user/signup");

        }


        const result =
            await userService.verifyOTP(
                userId,
                otpCode.trim()
            );


        if (!result.success) {

            return res.status(400).render(
                "verifyOtp",
                {
                    error: result.message
                }
            );

        }


        // OTP verified successfully

        delete req.session.otpUserId;


        res.redirect("/user/login");


    } catch (error) {

        console.error(
            "OTP verification error:",
            error
        );

        res.status(500).render(
            "verifyOtp",
            {
                error:
                    "Something went wrong. Please try again."
            }
        );

    }

};

// ========================================
// Login Page
// ========================================

const getLogin = (req, res) => {

    res.render("login", {
        error: null,
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
// Resend OTP
// ========================================

const resendOTP = async (req, res) => {

    try {

        const userId = req.session.otpUserId;


        if (!userId) {

            return res.status(400).render(
                "verifyOtp",
                {
                    error:
                        "Signup session expired. Please sign up again."
                }
            );

        }


        const result =
            await userService.resendOTP(userId);


        if (!result.success) {

            return res.status(400).render(
                "verifyOtp",
                {
                    error: result.message
                }
            );

        }


        res.redirect("/user/verify-otp");


    } catch (error) {

        console.error(
            "Resend OTP error:",
            error
        );

        res.status(500).render(
            "verifyOtp",
            {
                error:
                    "Unable to resend OTP. Please try again."
            }
        );

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

        res.clearCookie("connect.sid");

        res.redirect("/user/login");

    });
};


// ========================================
// Forgot Password Page
// ========================================

const getForgotPassword = (req, res) => {

    res.render("forgotPassword", {
        error: null,
        success: null
    });

};


// ========================================
// Forgot Password Form
// ========================================

const postForgotPassword = async (req, res) => {

    try {

        const { email } = req.body;

        const result =
            await userService.forgotPassword(email);

        if (!result.success) {

            return res.status(400).render(
                "forgotPassword",
                {
                    error: result.message,
                    success: null
                }
            );

        }


        // Store userId in session for reset
        req.session.resetUserId =
            result.userId.toString();

        res.redirect("/user/reset-password");


    } catch (error) {

        console.error(
            "Forgot password error:",
            error
        );

        res.status(500).render(
            "forgotPassword",
            {
                error:
                    "Something went wrong. Please try again.",
                success: null
            }
        );

    }

};


// ========================================
// Reset Password Page
// ========================================

const getResetPassword = (req, res) => {

    if (!req.session.resetUserId) {

        return res.redirect(
            "/user/forgot-password"
        );

    }

    res.render("resetPassword", {
        error: null
    });

};


// ========================================
// Reset Password Form
// ========================================

const postResetPassword = async (req, res) => {

    try {

        const userId = req.session.resetUserId;

        const {
            otpCode,
            newPassword,
            confirmPassword
        } = req.body;


        if (!userId) {

            return res.redirect(
                "/user/forgot-password"
            );

        }


        const result =
            await userService.resetPassword(
                userId,
                otpCode.trim(),
                newPassword
            );


        if (!result.success) {

            return res.status(400).render(
                "resetPassword",
                {
                    error: result.message
                }
            );

        }


        // Clean up session
        delete req.session.resetUserId;

        res.redirect("/user/login");


    } catch (error) {

        console.error(
            "Reset password error:",
            error
        );

        res.status(500).render(
            "resetPassword",
            {
                error:
                    "Something went wrong. Please try again."
            }
        );

    }

};


module.exports = {
    getSignup,
    postSignup,
    getVerifyOTP,
    postVerifyOTP,
    resendOTP,
    getLogin,
    postLogin,
    logout,
    getForgotPassword,
    postForgotPassword,
    getResetPassword,
    postResetPassword
};
