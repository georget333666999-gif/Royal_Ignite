const addressService = require("../USER/services/addressService");

// Helper to validate common address fields
const checkAddressFields = (body) => {
    const { fullName, phone, addressLine, city, state, pincode } = body;

    if (!fullName || !phone || !addressLine || !city || !state || !pincode) {
        return "All address fields are required.";
    }
    if (fullName.trim().length < 2) {
        return "Please enter a valid name.";
    }
    if (!/^[0-9]{10}$/.test(phone.trim())) {
        return "Please enter a valid 10-digit phone number.";
    }
    if (!/^[0-9]{6}$/.test(pincode.trim())) {
        return "Please enter a valid 6-digit pincode.";
    }
    return null;
};

// ========================================
// Add Address Validation
// ========================================
const validateAddAddress = (req, res, next) => {
    if (!req.body.country) req.body.country = "India";

    const error = checkAddressFields(req.body);
    if (error) {
        return res.status(400).render("addAddress", {
            error,
            formData: req.body
        });
    }

    next();
};

// ========================================
// Edit Address Validation
// ========================================
const validateEditAddress = async (req, res, next) => {
    if (!req.body.country) req.body.country = "India";

    const error = checkAddressFields(req.body);
    if (error) {
        const address = await addressService.getAddressById(req.params.id, req.session.userId);
        return res.status(400).render("editAddress", {
            address,
            error
        });
    }

    next();
};

module.exports = {
    validateAddAddress,
    validateEditAddress
};
