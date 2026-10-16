import userService from "../../services/user/userService.js";
import { sendOtpEmail } from "../../utils/sendEmail.js";
import { HTTP_STATUS, RESPONSE_MESSAGES } from "../../constants/index.js";

/**
 * Render Signup Page
 */
const getSignup = (req, res) => {
    try {
        return res.status(HTTP_STATUS.OK).render("signup", {
            error: req.query.error || null,
            formData: {}
        });
    } catch (err) {
        console.error("getSignup error:", err);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(RESPONSE_MESSAGES.AUTH.SIGNUP_PAGE_ERROR);
    }
};

/**
 * Handle User Signup
 */
const postSignup = async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;

        const user = await userService.createUser({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
            password
        });

        const otp = await userService.createOTP(user._id);

        // Send OTP to user's real email
        await sendOtpEmail(user.email, otp.otpCode, "signup", user.name);

        req.session.otpUserId = user._id.toString();
        req.session.otpSuccessMessage = RESPONSE_MESSAGES.AUTH.SIGNUP_SUCCESS;

        req.session.save((saveErr) => {
            if (saveErr) {
                console.error("Session save error during signup:", saveErr);
            }
            res.redirect("/user/verify-otp");
        });
    } catch (error) {
        console.error("Signup error:", error);

        if (error.code === 11000) {
            return res.status(HTTP_STATUS.BAD_REQUEST).render("signup", {
                error: RESPONSE_MESSAGES.AUTH.EMAIL_PHONE_EXISTS,
                formData: req.body
            });
        }

        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render("signup", {
            error: RESPONSE_MESSAGES.COMMON.SOMETHING_WENT_WRONG,
            formData: req.body
        });
    }
};

/**
 * Render Login Page
 */
const getLogin = (req, res) => {
    try {
        let successMessage = null;
        if (req.query.verified === "true") {
            successMessage = RESPONSE_MESSAGES.AUTH.VERIFIED_SUCCESS;
        } else if (req.query.reset === "true") {
            successMessage = RESPONSE_MESSAGES.AUTH.PASSWORD_RESET_SUCCESS;
        }

        return res.status(HTTP_STATUS.OK).render("login", {
            error: req.query.error || null,
            success: successMessage,
            redirect: req.query.redirect || "",
            formData: {}
        });
    } catch (err) {
        console.error("getLogin error:", err);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(RESPONSE_MESSAGES.AUTH.LOGIN_PAGE_ERROR);
    }
};

const handleUnverifiedLogin = async (req, res, result) => {
    try {
        const otp = await userService.createOTP(result.userId);
        await sendOtpEmail(result.userEmail, otp.otpCode, "signup", result.userName || "Customer");
        req.session.otpUserId = result.userId.toString();
        req.session.otpSuccessMessage = RESPONSE_MESSAGES.AUTH.UNVERIFIED_LOGIN;

        req.session.save((saveErr) => {
            if (saveErr) {
                console.error("Session save error for unverified user:", saveErr);
            }
            res.redirect("/user/verify-otp");
        });
    } catch (err) {
        console.error("handleUnverifiedLogin error:", err);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render("login", {
            error: RESPONSE_MESSAGES.AUTH.UNVERIFIED_SEND_ERROR,
            formData: { email: result.userEmail }
        });
    }
};

const establishUserSession = (req, res, user) => {
    try {
        req.session.userId = user._id.toString();
        req.session.isUserLoggedIn = true;

        const target = req.body.redirect || req.query.redirect || "/";
        const redirectUrl = (typeof target === "string" && target.startsWith("/") && !target.startsWith("//")) ? target : "/";

        req.session.save((saveErr) => {
            if (saveErr) {
                console.error("Session save error during login:", saveErr);
            }
            res.redirect(redirectUrl);
        });
    } catch (err) {
        console.error("establishUserSession error:", err);
        res.redirect("/");
    }
};

/**
 * Handle User Login
 */
const postLogin = async (req, res) => {
    try {
        const { email, password, redirect } = req.body;
        const result = await userService.loginUser(email, password);

        if (!result.success) {
            if (result.isUnverified && result.userId) {
                return await handleUnverifiedLogin(req, res, result);
            }

            return res.status(HTTP_STATUS.UNAUTHORIZED).render("login", {
                error: result.message,
                redirect: redirect || req.query.redirect || "",
                formData: { email }
            });
        }

        establishUserSession(req, res, result.user);
    } catch (error) {
        console.error("Login error:", error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render("login", {
            error: RESPONSE_MESSAGES.COMMON.SOMETHING_WENT_WRONG,
            redirect: req.body.redirect || req.query.redirect || "",
            formData: { email: req.body.email }
        });
    }
};

/**
 * Handle User Logout
 */
const logout = (req, res) => {
    try {
        const finishLogout = () => {
            req.session.destroy((error) => {
                if (error) {
                    console.error("Logout error:", error);
                    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(RESPONSE_MESSAGES.AUTH.UNABLE_TO_LOGOUT);
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
    } catch (err) {
        console.error("logout error:", err);
        return res.redirect("/user/login");
    }
};

export {
    getSignup,
    postSignup,
    getLogin,
    postLogin,
    logout
};

export default {
    getSignup,
    postSignup,
    getLogin,
    postLogin,
    logout
};
