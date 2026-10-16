import Address from "../../models/addressModel.js";

/**
 * Create a new user address
 */
const createAddress = async ({
    userId,
    fullName,
    phone,
    addressLine,
    city,
    state,
    pincode,
    country,
    addressType,
    isDefault
}) => {
    try {
        // If this is the user's first address, automatically make it default
        const existingAddress = await Address.findOne({ userId });
        const shouldBeDefault = !existingAddress || isDefault === true;

        // If this address is default, remove default flag from existing ones
        if (shouldBeDefault) {
            await Address.updateMany({ userId }, { $set: { isDefault: false } });
        }

        const address = await Address.create({
            userId,
            fullName: fullName.trim(),
            phone: phone.trim(),
            addressLine: addressLine.trim(),
            city: city.trim(),
            state: state.trim(),
            pincode: pincode.trim(),
            country: (country || "India").trim(),
            addressType: addressType || "Home",
            isDefault: shouldBeDefault
        });

        return address;
    } catch (error) {
        console.error("createAddress error:", error);
        throw error;
    }
};

/**
 * Get all addresses for a specific user
 */
const getUserAddresses = async (userId) => {
    try {
        return await Address.find({ userId }).sort({
            isDefault: -1,
            createdAt: -1
        });
    } catch (error) {
        console.error("getUserAddresses error:", error);
        throw error;
    }
};

/**
 * Get single address by ID and user ID
 */
const getAddressById = async (addressId, userId) => {
    try {
        return await Address.findOne({ _id: addressId, userId });
    } catch (error) {
        console.error("getAddressById error:", error);
        throw error;
    }
};

/**
 * Update an existing address
 */
const updateAddress = async (
    addressId,
    userId,
    {
        fullName,
        phone,
        addressLine,
        city,
        state,
        pincode,
        country,
        addressType,
        isDefault
    }
) => {
    try {
        const address = await Address.findOne({ _id: addressId, userId });
        if (!address) {
            return null;
        }

        // If setting as default, unset default for all other user addresses
        if (isDefault === true) {
            await Address.updateMany(
                { userId, _id: { $ne: addressId } },
                { $set: { isDefault: false } }
            );
        }

        address.fullName = fullName.trim();
        address.phone = phone.trim();
        address.addressLine = addressLine.trim();
        address.city = city.trim();
        address.state = state.trim();
        address.pincode = pincode.trim();
        address.country = (country || "India").trim();
        if (addressType) {
            address.addressType = addressType;
        }
        address.isDefault = isDefault;

        await address.save();
        return address;
    } catch (error) {
        console.error("updateAddress error:", error);
        throw error;
    }
};

/**
 * Delete an address and promote the newest remaining address to default if needed
 */
const deleteAddress = async (addressId, userId) => {
    try {
        const address = await Address.findOne({ _id: addressId, userId });
        if (!address) {
            return null;
        }

        const wasDefault = address.isDefault;
        await Address.deleteOne({ _id: addressId, userId });

        if (wasDefault) {
            const nextAddress = await Address.findOne({ userId }).sort({ createdAt: -1 });
            if (nextAddress) {
                nextAddress.isDefault = true;
                await nextAddress.save();
            }
        }

        return true;
    } catch (error) {
        console.error("deleteAddress error:", error);
        throw error;
    }
};

/**
 * Set an address as the default address
 */
const setDefaultAddress = async (addressId, userId) => {
    try {
        const address = await Address.findOne({ _id: addressId, userId });
        if (!address) {
            return null;
        }

        await Address.updateMany({ userId }, { $set: { isDefault: false } });
        address.isDefault = true;
        await address.save();

        return address;
    } catch (error) {
        console.error("setDefaultAddress error:", error);
        throw error;
    }
};

export {
    createAddress,
    getUserAddresses,
    getAddressById,
    updateAddress,
    deleteAddress,
    setDefaultAddress
};

export default {
    createAddress,
    getUserAddresses,
    getAddressById,
    updateAddress,
    deleteAddress,
    setDefaultAddress
};