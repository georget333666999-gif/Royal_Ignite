const addressService = require("../services/addressService");
const User = require("../../models/userModel");

// ========================================
// User Profile
// ========================================

const getProfile = async (req, res) => {

    try {

        // --------------------------------
        // Get logged-in user
        // --------------------------------

        const user = await User.findById(
            req.session.userId
        ).select("-password");

        if (!user) {

            req.session.destroy(() => {
                res.redirect("/user/login");
            });

            return;
        }


        // --------------------------------
        // Get user's addresses
        // --------------------------------

        const addresses =
            await addressService.getUserAddresses(
                req.session.userId
            );


        // --------------------------------
        // Render profile
        // --------------------------------

        res.render("profile", {
            user,
            addresses
        });

    } catch (error) {

        console.error(
            "Profile error:",
            error
        );

        res.status(500).send(
            "Something went wrong."
        );

    }

};
// ========================================
// Edit Profile Page
// ========================================

const getEditProfile = async (req, res) => {

    try {

        const user = await User.findById(
            req.session.userId
        ).select("-password");

        if (!user) {

            req.session.destroy(() => {
                res.redirect("/user/login");
            });

            return;
        }

        res.render("editProfile", {
            user,
            error: null,
            success: null
        });

    } catch (error) {

        console.error(
            "Get edit profile error:",
            error
        );

        res.status(500).send(
            "Something went wrong."
        );
    }
};

// ========================================
// Update Profile
// ========================================

const postEditProfile = async (req, res) => {

    try {

        const {
            name,
            phone
        } = req.body;

        // -------------------------------
        // Required Fields
        // -------------------------------

        if (!name || !phone) {

            const user = await User.findById(
                req.session.userId
            ).select("-password");

            return res.status(400).render(
                "editProfile",
                {
                    user,
                    error: "Name and phone are required.",
                    success: null
                }
            );
        }

        // -------------------------------
        // Name Validation
        // -------------------------------

        if (name.trim().length < 2) {

            const user = await User.findById(
                req.session.userId
            ).select("-password");

            return res.status(400).render(
                "editProfile",
                {
                    user,
                    error: "Name must contain at least 2 characters.",
                    success: null
                }
            );
        }

        // -------------------------------
        // Phone Validation
        // -------------------------------

        const phoneRegex = /^[0-9]{10}$/;

        if (!phoneRegex.test(phone.trim())) {

            const user = await User.findById(
                req.session.userId
            ).select("-password");

            return res.status(400).render(
                "editProfile",
                {
                    user,
                    error: "Please enter a valid 10-digit phone number.",
                    success: null
                }
            );
        }

        // -------------------------------
        // Update User
        // -------------------------------

        const updateData = {
            name: name.trim(),
            phone: phone.trim()
        };

        if (req.file) {

            updateData.imgUrl =
                `/uploads/profile/${req.file.filename}`;

        }

        const updatedUser = await User.findByIdAndUpdate(
            req.session.userId,
            {
                $set: updateData
            },
            {
                new: true,
                runValidators: true
            }
        ).select("-password");

        // -------------------------------
        // Redirect to Profile
        // -------------------------------

        res.redirect("/user/profile");

    } catch (error) {

        console.error(
            "Update profile error:",
            error
        );

        const user = await User.findById(
            req.session.userId
        ).select("-password");

        res.status(500).render(
            "editProfile",
            {
                user,
                error: "Something went wrong. Please try again.",
                success: null
            }
        );
    }
};

module.exports = {
    getProfile,
    getEditProfile,
    postEditProfile
};
