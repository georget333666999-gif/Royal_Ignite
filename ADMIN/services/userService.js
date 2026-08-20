const User = require("../../models/userModel");

const escapeRegex = (value) => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// Get Users with Status Filter & Counts
const getUsers = async (search = "", statusFilter = "all", page = 1, limit = 4) => {
    const filter = {
        isAdmin: false
    };

    const trimmedSearch = search.trim();
    if (trimmedSearch) {
        const safeSearch = escapeRegex(trimmedSearch);
        const searchRegex = new RegExp(safeSearch, "i");
        filter.$or = [
            { name: searchRegex },
            { email: searchRegex },
            { phone: searchRegex }
        ];
    }

    if (statusFilter === "active") {
        filter.isBlocked = false;
    } else if (statusFilter === "blocked") {
        filter.isBlocked = true;
    } else if (statusFilter === "inactive") {
        filter.isVerified = false;
    }

    // Counts for Top Metric Cards
    const totalCustomers = await User.countDocuments({ isAdmin: false });
    const activeUsers = await User.countDocuments({ isAdmin: false, isBlocked: false });
    const blockedUsers = await User.countDocuments({ isAdmin: false, isBlocked: true });
    const inactiveUsers = await User.countDocuments({ isAdmin: false, isVerified: false });

    const totalUsers = await User.countDocuments(filter);
    const totalPages = Math.ceil(totalUsers / limit) || 1;
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const skip = (currentPage - 1) * limit;

    const users = await User.find(filter)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    return {
        users,
        totalCustomers,
        activeUsers,
        blockedUsers,
        inactiveUsers,
        totalUsers,
        totalPages,
        currentPage,
        limit
    };
};

const blockUser = async (userId) => {
    return await User.findOneAndUpdate(
        { _id: userId, isAdmin: false },
        { $set: { isBlocked: true } },
        { new: true }
    );
};

const unblockUser = async (userId) => {
    return await User.findOneAndUpdate(
        { _id: userId, isAdmin: false },
        { $set: { isBlocked: false } },
        { new: true }
    );
};

module.exports = {
    getUsers,
    blockUser,
    unblockUser
};