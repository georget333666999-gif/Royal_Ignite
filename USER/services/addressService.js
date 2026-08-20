const Address = require("../../models/addressModel");

// ========================================
// Create Address
// ========================================

const createAddress = async ({
    userId,
    fullName,
    phone,
    addressLine,
    city,
    state,
    pincode,
    country,
    isDefault
}) => {

    // ------------------------------------
    // If this is the first address,
    // automatically make it default
    // ------------------------------------

    const existingAddress = await Address.findOne({
        userId
    });

    const shouldBeDefault =
        !existingAddress || isDefault === true;

    // ------------------------------------
    // If this address is default,
    // remove default from existing ones
    // ------------------------------------

    if (shouldBeDefault) {

        await Address.updateMany(
            {
                userId
            },
            {
                $set: {
                    isDefault: false
                }
            }
        );

    }

    // ------------------------------------
    // Create address
    // ------------------------------------

    const address = await Address.create({

        userId,

        fullName: fullName.trim(),

        phone: phone.trim(),

        addressLine: addressLine.trim(),

        city: city.trim(),

        state: state.trim(),

        pincode: pincode.trim(),

        country: country.trim(),

        isDefault: shouldBeDefault

    });

    return address;
};


// ========================================
// Get User Addresses
// ========================================

const getUserAddresses = async (userId) => {

    return await Address.find({
        userId
    }).sort({
        isDefault: -1,
        createdAt: -1
    });
};

// ========================================
// Get Single Address
// ========================================

const getAddressById = async (addressId, userId) => {

    return await Address.findOne({
        _id: addressId,
        userId
    });

};


// ========================================
// Update Address
// ========================================

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
        isDefault
    }
) => {

    const address = await Address.findOne({
        _id: addressId,
        userId
    });

    if (!address) {
        return null;
    }

    // If this address is being made default,
    // remove default from all other addresses.

    if (isDefault === true) {

        await Address.updateMany(
            {
                userId,
                _id: {
                    $ne: addressId
                }
            },
            {
                $set: {
                    isDefault: false
                }
            }
        );

    }

    address.fullName = fullName.trim();
    address.phone = phone.trim();
    address.addressLine = addressLine.trim();
    address.city = city.trim();
    address.state = state.trim();
    address.pincode = pincode.trim();
    address.country = country.trim();
    address.isDefault = isDefault;

    await address.save();

    return address;
};


// ========================================
// Delete Address
// ========================================

const deleteAddress = async (
    addressId,
    userId
) => {

    const address = await Address.findOne({
        _id: addressId,
        userId
    });

    if (!address) {
        return null;
    }

    const wasDefault = address.isDefault;

    await Address.deleteOne({
        _id: addressId,
        userId
    });

    // If the deleted address was the default,
    // make the newest remaining address default.

    if (wasDefault) {

        const nextAddress =
            await Address.findOne({
                userId
            }).sort({
                createdAt: -1
            });

        if (nextAddress) {

            nextAddress.isDefault = true;

            await nextAddress.save();

        }

    }

    return true;
};


// ========================================
// Set Default Address
// ========================================

const setDefaultAddress = async (
    addressId,
    userId
) => {

    const address = await Address.findOne({
        _id: addressId,
        userId
    });

    if (!address) {
        return null;
    }

    await Address.updateMany(
        {
            userId
        },
        {
            $set: {
                isDefault: false
            }
        }
    );

    address.isDefault = true;

    await address.save();

    return address;
};

module.exports = {
    createAddress,
    getUserAddresses,
    getAddressById,
    updateAddress,
    deleteAddress,
    setDefaultAddress
};