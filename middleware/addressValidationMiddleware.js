const addressService = require("../USER/services/addressService");

// Helper to validate common address fields
const checkAddressFields = (body) => {
    const { fullName, phone, addressLine, city, state, pincode, addressType } = body;

    const trimmedName = (fullName || "").trim();
    const trimmedPhone = (phone || "").trim();
    const trimmedAddress = (addressLine || "").trim();
    const trimmedCity = (city || "").trim();
    const trimmedState = (state || "").trim();
    const trimmedPincode = (pincode || "").trim();
    const trimmedType = (addressType || "").trim();

    if (!trimmedName || !trimmedPhone || !trimmedAddress || !trimmedCity || !trimmedState || !trimmedPincode) {
        return "All address fields are required.";
    }

    if (trimmedName.length < 2 || trimmedName.length > 50 || !/^[a-zA-Z\s]{2,50}$/.test(trimmedName)) {
        return "Full name must be between 2 and 50 characters and contain only letters and spaces.";
    }

    if (!/^[6-9]\d{9}$/.test(trimmedPhone) || /^(\d)\1{9}$/.test(trimmedPhone)) {
        return "Please enter a valid 10-digit mobile number starting with 6-9.";
    }

    if (trimmedAddress.length < 5 || trimmedAddress.length > 200 || !/[a-zA-Z0-9]/.test(trimmedAddress)) {
        return "Address must be between 5 and 200 characters and contain valid street or building details.";
    }

    if (trimmedCity.length < 2 || trimmedCity.length > 50 || !/^[a-zA-Z\s.'-]{2,50}$/.test(trimmedCity)) {
        return "City must be between 2 and 50 characters and contain only letters and spaces.";
    }

    if (trimmedState.length < 2 || trimmedState.length > 50 || !/^[a-zA-Z\s.'-]{2,50}$/.test(trimmedState)) {
        return "State must be between 2 and 50 characters and contain only letters and spaces.";
    }

    if (!/^[1-9][0-9]{5}$/.test(trimmedPincode)) {
        return "Pincode must be a valid 6-digit postal code (cannot start with 0).";
    }

    if (trimmedType && !["Home", "Work", "Other"].includes(trimmedType)) {
        return "Please select a valid address type (Home, Work, or Other).";
    }

    return null;
};

// ========================================
// Add Address Validation
// ========================================
const validateAddAddress = (req, res, next) => {
    if (!req.body.country) req.body.country = "India";
    if (!req.body.addressType) req.body.addressType = "Home";

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
    if (!req.body.addressType) req.body.addressType = "Home";

    const error = checkAddressFields(req.body);
    if (error) {
        const address = await addressService.getAddressById(req.params.id, req.session.userId);
        return res.status(400).render("editAddress", {
            address: {
                ...(address ? (address.toObject ? address.toObject() : address) : {}),
                ...req.body,
                _id: req.params.id
            },
            error
        });
    }

    next();
};

module.exports = {
    validateAddAddress,
    validateEditAddress
};
