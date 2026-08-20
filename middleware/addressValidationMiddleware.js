const addressService = require("../USER/services/addressService");

// ========================================
// Add Address Validation
// ========================================

const validateAddAddress = (req, res, next) => {
    const {
        fullName,
        phone,
        addressLine,
        city,
        state,
        pincode,
        country
    } = req.body;

    if (!fullName || !phone || !addressLine || !city || !state || !pincode || !country) {
        return res.status(400).render("addAddress", {
            error: "All address fields are required.",
            formData: req.body
        });
    }

    if (fullName.trim().length < 2) {
        return res.status(400).render("addAddress", {
            error: "Please enter a valid name.",
            formData: req.body
        });
    }

    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone.trim())) {
        return res.status(400).render("addAddress", {
            error: "Please enter a valid 10-digit phone number.",
            formData: req.body
        });
    }

    const pincodeRegex = /^[0-9]{6}$/;
    if (!pincodeRegex.test(pincode.trim())) {
        return res.status(400).render("addAddress", {
            error: "Please enter a valid 6-digit pincode.",
            formData: req.body
        });
    }

    next();
};

// ========================================
// Edit Address Validation
// ========================================

const validateEditAddress = async (req, res, next) => {
    const {
        fullName,
        phone,
        addressLine,
        city,
        state,
        pincode,
        country
    } = req.body;

    let address = null;

    const getAddress = async () => {
        if (!address) {
            address = await addressService.getAddressById(
                req.params.id,
                req.session.userId
            );
        }
        return address;
    };

    if (!fullName || !phone || !addressLine || !city || !state || !pincode || !country) {
        return res.status(400).render("editAddress", {
            address: await getAddress(),
            error: "All address fields are required."
        });
    }

    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone.trim())) {
        return res.status(400).render("editAddress", {
            address: await getAddress(),
            error: "Please enter a valid 10-digit phone number."
        });
    }

    const pincodeRegex = /^[0-9]{6}$/;
    if (!pincodeRegex.test(pincode.trim())) {
        return res.status(400).render("editAddress", {
            address: await getAddress(),
            error: "Please enter a valid 6-digit pincode."
        });
    }

    next();
};

module.exports = {
    validateAddAddress,
    validateEditAddress
};
