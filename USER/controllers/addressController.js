const addressService = require("../services/addressService");
const User = require("../../models/userModel");

// ========================================
// Add Address Page
// ========================================

const getAddAddress = (req, res) => {

    res.render("addAddress", {
        error: null,
        formData: {}
    });

};

// ========================================
// Add Address
// ========================================

const postAddAddress = async (req, res) => {

    try {

        const {
            fullName,
            phone,
            addressLine,
            city,
            state,
            pincode,
            country,
            addressType,
            isDefault
        } = req.body;

        // --------------------------------
        // Create address
        // --------------------------------

        await addressService.createAddress({

            userId: req.session.userId,

            fullName,

            phone,

            addressLine,

            city,

            state,

            pincode,

            country,

            addressType,

            isDefault:
                isDefault === "true" ||
                isDefault === "on"

        });

        // --------------------------------
        // Redirect
        // --------------------------------

        req.session.successMessage = "New address added successfully.";
        res.redirect("/user/addresses");

    } catch (error) {

        console.error(
            "Add address error:",
            error
        );

        res.status(500).render(
            "addAddress",
            {
                error:
                    "Something went wrong. Please try again.",
                formData: req.body
            }
        );

    }

};


// ========================================
// Get Addresses
// ========================================

const getAddresses = async (req, res) => {

    try {

        const addresses =
            await addressService.getUserAddresses(
                req.session.userId
            );

        const user = await User.findById(req.session.userId).select("googleId");
        const success = req.session.successMessage || null;
        delete req.session.successMessage;

        res.render("addresses", {
            addresses,
            user,
            success
        });

    } catch (error) {

        console.error(
            "Get addresses error:",
            error
        );

        res.status(500).send(
            "Something went wrong."
        );

    }

};

// ========================================
// Edit Address Page
// ========================================

const getEditAddress = async (req, res) => {

    try {

        const address =
            await addressService.getAddressById(
                req.params.id,
                req.session.userId
            );

        if (!address) {

            return res.status(404).send(
                "Address not found."
            );

        }

        res.render("editAddress", {
            address,
            error: null
        });

    } catch (error) {

        console.error(
            "Get edit address error:",
            error
        );

        res.status(500).send(
            "Something went wrong."
        );

    }

};

// ========================================
// Update Address
// ========================================

const postEditAddress = async (req, res) => {

    try {

        const {
            fullName,
            phone,
            addressLine,
            city,
            state,
            pincode,
            country,
            addressType,
            isDefault
        } = req.body;

        const updatedAddress =
            await addressService.updateAddress(
                req.params.id,
                req.session.userId,
                {
                    fullName,
                    phone,
                    addressLine,
                    city,
                    state,
                    pincode,
                    country,
                    addressType,
                    isDefault:
                        isDefault === "true" ||
                        isDefault === "on"
                }
            );

        if (!updatedAddress) {

            return res.status(404).send(
                "Address not found."
            );

        }

        req.session.successMessage = "Address updated successfully.";
        res.redirect("/user/addresses");

    } catch (error) {

        console.error(
            "Update address error:",
            error
        );

        res.status(500).send(
            "Something went wrong."
        );

    }

};

// ========================================
// Delete Address
// ========================================

const deleteAddress = async (req, res) => {

    try {

        const deleted =
            await addressService.deleteAddress(
                req.params.id,
                req.session.userId
            );

        if (!deleted) {

            return res.status(404).send(
                "Address not found."
            );

        }

        req.session.successMessage = "Address deleted successfully.";
        res.redirect("/user/addresses");

    } catch (error) {

        console.error(
            "Delete address error:",
            error
        );

        res.status(500).send(
            "Something went wrong."
        );

    }

};

// ========================================
// Set Default Address
// ========================================

const setDefaultAddress = async (req, res) => {

    try {

        const address =
            await addressService.setDefaultAddress(
                req.params.id,
                req.session.userId
            );

        if (!address) {

            return res.status(404).send(
                "Address not found."
            );

        }

        req.session.successMessage = "Default address updated successfully.";
        res.redirect("/user/addresses");

    } catch (error) {

        console.error(
            "Set default address error:",
            error
        );

        res.status(500).send(
            "Something went wrong."
        );

    }

};

module.exports = {
    getAddAddress,
    postAddAddress,
    getAddresses,
    getEditAddress,
    postEditAddress,
    deleteAddress,
    setDefaultAddress
};