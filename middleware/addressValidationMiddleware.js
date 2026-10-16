import addressService from "../services/user/addressService.js";
import { HTTP_STATUS } from "../constants/index.js";

const NAME_REGEX = /^[a-zA-Z\s]{2,50}$/;
const PHONE_REGEX = /^[6-9]\d{9}$/;
const PLACE_REGEX = /^[a-zA-Z\s.'-]{2,50}$/;
const PINCODE_REGEX = /^[1-9][0-9]{5}$/;
const VALID_TYPES = new Set(["Home", "Work", "Other"]);

const cleanStr = (val) => (val ? String(val).trim() : "");

const extractAddressFields = (body = {}) => ({
    name: cleanStr(body.fullName),
    phone: cleanStr(body.phone),
    address: cleanStr(body.addressLine),
    city: cleanStr(body.city),
    state: cleanStr(body.state),
    pincode: cleanStr(body.pincode),
    type: cleanStr(body.addressType)
});

const isInvalidPhone = (phone) => !PHONE_REGEX.test(phone) || /^(\d)\1{9}$/.test(phone);

const isInvalidAddressLine = (addr) => addr.length < 5 || addr.length > 200 || !/[a-zA-Z0-9]/.test(addr);

const hasMissingField = (f) => [f.name, f.phone, f.address, f.city, f.state, f.pincode].some((val) => !val);

const addressRules = [
    {
        isInvalid: (f) => hasMissingField(f),
        message: "All address fields are required."
    },
    {
        isInvalid: (f) => !NAME_REGEX.test(f.name),
        message: "Full name must be between 2 and 50 characters and contain only letters and spaces."
    },
    {
        isInvalid: (f) => isInvalidPhone(f.phone),
        message: "Please enter a valid 10-digit mobile number starting with 6-9."
    },
    {
        isInvalid: (f) => isInvalidAddressLine(f.address),
        message: "Address must be between 5 and 200 characters and contain valid street or building details."
    },
    {
        isInvalid: (f) => !PLACE_REGEX.test(f.city),
        message: "City must be between 2 and 50 characters and contain only letters and spaces."
    },
    {
        isInvalid: (f) => !PLACE_REGEX.test(f.state),
        message: "State must be between 2 and 50 characters and contain only letters and spaces."
    },
    {
        isInvalid: (f) => !PINCODE_REGEX.test(f.pincode),
        message: "Pincode must be a valid 6-digit postal code (cannot start with 0)."
    },
    {
        isInvalid: (f) => Boolean(f.type && !VALID_TYPES.has(f.type)),
        message: "Please select a valid address type (Home, Work, or Other)."
    }
];

const checkAddressFields = (body) => {
    const fields = extractAddressFields(body);
    const brokenRule = addressRules.find((rule) => rule.isInvalid(fields));
    return brokenRule ? brokenRule.message : null;
};

const applyAddressDefaults = (body) => {
    if (!body.country) body.country = "India";
    if (!body.addressType) body.addressType = "Home";
};

// ========================================
// Add Address Validation
// ========================================
export const validateAddAddress = (req, res, next) => {
    try {
        applyAddressDefaults(req.body);

        const error = checkAddressFields(req.body);
        if (error) {
            return res.status(HTTP_STATUS.BAD_REQUEST).render("addAddress", {
                error,
                formData: req.body
            });
        }

        next();
    } catch (err) {
        console.error("validateAddAddress error:", err);
        return next(err);
    }
};

// ========================================
// Edit Address Validation
// ========================================
export const validateEditAddress = async (req, res, next) => {
    try {
        applyAddressDefaults(req.body);

        const error = checkAddressFields(req.body);
        if (error) {
            const address = await addressService.getAddressById(req.params.id, req.session.userId);
            const addressData = address?.toObject ? address.toObject() : (address || {});
            return res.status(HTTP_STATUS.BAD_REQUEST).render("editAddress", {
                address: {
                    ...addressData,
                    ...req.body,
                    _id: req.params.id
                },
                error
            });
        }

        next();
    } catch (err) {
        console.error("validateEditAddress error:", err);
        return next(err);
    }
};

export default {
    validateAddAddress,
    validateEditAddress
};
