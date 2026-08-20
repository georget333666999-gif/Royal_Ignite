const userService = require("../services/userService");

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

module.exports = {
    getVerifyOTP,
    postVerifyOTP,
    resendOTP
};
