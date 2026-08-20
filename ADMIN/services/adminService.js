const bcrypt = require("bcryptjs");
const User = require("../../models/userModel");

const loginAdmin = async (email, password) => {
    const admin = await User.findOne({
        email: email.toLowerCase(),
        isAdmin: true
    });

    if (!admin) {
        throw new Error("Invalid email or password");
    }

    if (admin.isBlocked) {
        throw new Error("Your account has been blocked");
    }

    const isPasswordMatch = await bcrypt.compare(
        password,
        admin.password
    );

    if (!isPasswordMatch) {
        throw new Error("Invalid email or password");
    }

    return admin;
};

module.exports = {
    loginAdmin
};