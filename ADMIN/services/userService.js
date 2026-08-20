const User = require("../../models/userModel");

const escapeRegex = (value) => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};


// ========================================
// Get Users
// ========================================

const getUsers = async (search = "", page = 1, limit = 2) => {

    const filter = {
        isAdmin: false
    };

    const trimmedSearch = search.trim();

    if (trimmedSearch) {

        const safeSearch = escapeRegex(trimmedSearch);

        const searchRegex = new RegExp(safeSearch, "i");

        filter.$or = [
            {
                name: searchRegex
            },
            {
                email: searchRegex
            },
            {
                phone: searchRegex
            }
        ];
    }

    const totalUsers = await User.countDocuments(filter);

    const totalPages = Math.ceil(totalUsers / limit);

    const currentPage =
        totalPages === 0
            ? 1
            : Math.min(page, totalPages);

    const skip = (currentPage - 1) * limit;

    const users = await User.find(filter)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    return {
        users,
        totalUsers,
        totalPages,
        currentPage
    };
};


// ========================================
// Block User
// ========================================

const blockUser = async (userId) => {

    return await User.findOneAndUpdate(
        {
            _id: userId,
            isAdmin: false
        },
        {
            $set: {
                isBlocked: true
            }
        },
        {
            new: true
        }
    );
};


// ========================================
// Unblock User
// ========================================

const unblockUser = async (userId) => {

    return await User.findOneAndUpdate(
        {
            _id: userId,
            isAdmin: false
        },
        {
            $set: {
                isBlocked: false
            }
        },
        {
            new: true
        }
    );
};


module.exports = {
    getUsers,
    blockUser,
    unblockUser
};