import addressService from "../../services/user/addressService.js";
import User from "../../models/userModel.js";
import { HTTP_STATUS, RESPONSE_MESSAGES } from "../../constants/index.js";

/**
 * Render Add Address Page
 */
const getAddAddress = (req, res) => {
    try {
        return res.status(HTTP_STATUS.OK).render("addAddress", {
            error: null,
            formData: {}
        });
    } catch (err) {
        console.error("getAddAddress error:", err);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(RESPONSE_MESSAGES.ADDRESS.PAGE_RENDER_ERROR);
    }
};

/**
 * Handle Add Address Form Submission
 */
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
            isDefault: isDefault === "true" || isDefault === true
        });

        req.session.successMessage = RESPONSE_MESSAGES.ADDRESS.ADDED_SUCCESS;
        res.redirect("/user/addresses");
    } catch (error) {
        console.error("Add address error:", error);
        res.status(error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR).render("addAddress", {
            error: error.statusCode ? error.message : RESPONSE_MESSAGES.COMMON.SOMETHING_WENT_WRONG,
            formData: req.body
        });
    }
};

/**
 * Render User Address Book Page
 */
const getAddresses = async (req, res) => {
    try {
        const user = await User.findById(req.session.userId).select("-password");
        if (!user) {
            req.session.destroy(() => res.redirect("/user/login"));
            return;
        }

        const addresses = await addressService.getUserAddresses(req.session.userId);
        const success = req.session.successMessage || null;
        const error = req.session.errorMessage || null;
        delete req.session.successMessage;
        delete req.session.errorMessage;

        res.status(HTTP_STATUS.OK).render("addresses", {
            user,
            addresses,
            success,
            error
        });
    } catch (error) {
        console.error("Get addresses error:", error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(RESPONSE_MESSAGES.COMMON.SOMETHING_WENT_WRONG);
    }
};

/**
 * Render Edit Address Page
 */
const getEditAddress = async (req, res) => {
    try {
        const { id } = req.params;
        const address = await addressService.getAddressById(id, req.session.userId);

        if (!address) {
            req.session.errorMessage = RESPONSE_MESSAGES.ADDRESS.NOT_FOUND;
            return res.redirect("/user/addresses");
        }

        res.status(HTTP_STATUS.OK).render("editAddress", {
            address,
            error: null
        });
    } catch (error) {
        console.error("Get edit address error:", error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(RESPONSE_MESSAGES.COMMON.SOMETHING_WENT_WRONG);
    }
};

/**
 * Handle Edit Address Form Submission
 */
const postEditAddress = async (req, res) => {
    try {
        const { id } = req.params;
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

        const updated = await addressService.updateAddress(id, req.session.userId, {
            fullName,
            phone,
            addressLine,
            city,
            state,
            pincode,
            country,
            addressType,
            isDefault: isDefault === "true" || isDefault === true
        });

        if (!updated) {
            req.session.errorMessage = RESPONSE_MESSAGES.ADDRESS.NOT_FOUND;
            return res.redirect("/user/addresses");
        }

        req.session.successMessage = RESPONSE_MESSAGES.ADDRESS.UPDATED_SUCCESS;
        res.redirect("/user/addresses");
    } catch (error) {
        console.error("Edit address error:", error);
        res.status(error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR).render("editAddress", {
            address: { ...req.body, _id: req.params.id },
            error: error.statusCode ? error.message : RESPONSE_MESSAGES.COMMON.SOMETHING_WENT_WRONG
        });
    }
};

/**
 * Handle Delete Address
 */
const deleteAddress = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await addressService.deleteAddress(id, req.session.userId);

        if (!deleted) {
            req.session.errorMessage = RESPONSE_MESSAGES.ADDRESS.NOT_FOUND;
            return res.redirect("/user/addresses");
        }

        req.session.successMessage = RESPONSE_MESSAGES.ADDRESS.DELETED_SUCCESS;
        res.redirect("/user/addresses");
    } catch (error) {
        console.error("Delete address error:", error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(RESPONSE_MESSAGES.COMMON.SOMETHING_WENT_WRONG);
    }
};

/**
 * Set Address as Default
 */
const setDefaultAddress = async (req, res) => {
    try {
        const { id } = req.params;
        const updated = await addressService.setDefaultAddress(id, req.session.userId);

        if (!updated) {
            req.session.errorMessage = RESPONSE_MESSAGES.ADDRESS.NOT_FOUND;
            return res.redirect("/user/addresses");
        }

        req.session.successMessage = RESPONSE_MESSAGES.ADDRESS.DEFAULT_UPDATED;
        res.redirect("/user/addresses");
    } catch (error) {
        console.error("Set default address error:", error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(RESPONSE_MESSAGES.COMMON.SOMETHING_WENT_WRONG);
    }
};

export {
    getAddAddress,
    postAddAddress,
    getAddresses,
    getEditAddress,
    postEditAddress,
    deleteAddress,
    setDefaultAddress
};

export default {
    getAddAddress,
    postAddAddress,
    getAddresses,
    getEditAddress,
    postEditAddress,
    deleteAddress,
    setDefaultAddress
};