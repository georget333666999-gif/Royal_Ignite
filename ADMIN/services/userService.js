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

    let users;
    if (trimmedSearch) {
        const safeSearch = escapeRegex(trimmedSearch);
        // Prioritize names starting with search letter/query, then emails starting with search, then contains
        users = await User.aggregate([
            { $match: filter },
            {
                $addFields: {
                    searchPriority: {
                        $switch: {
                            branches: [
                                // Priority 1: Name starts with the search letter/term
                                {
                                    case: {
                                        $regexMatch: {
                                            input: "$name",
                                            regex: "^" + safeSearch,
                                            options: "i"
                                        }
                                    },
                                    then: 1
                                },
                                // Priority 2: Email starts with the search letter/term
                                {
                                    case: {
                                        $regexMatch: {
                                            input: "$email",
                                            regex: "^" + safeSearch,
                                            options: "i"
                                        }
                                    },
                                    then: 2
                                },
                                // Priority 3: Name contains search term
                                {
                                    case: {
                                        $regexMatch: {
                                            input: "$name",
                                            regex: safeSearch,
                                            options: "i"
                                        }
                                    },
                                    then: 3
                                }
                            ],
                            default: 4
                        }
                    }
                }
            },
            {
                $sort: {
                    searchPriority: 1,
                    name: 1,
                    createdAt: -1
                }
            },
            { $project: { password: 0 } },
            { $skip: skip },
            { $limit: limit }
        ]);
    } else {
        users = await User.find(filter)
            .select("-password")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
    }

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

// Get User by ID
const getUserById = async (userId) => {
    return await User.findOne({ _id: userId, isAdmin: false }).select("-password");
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
    getUserById,
    blockUser,
    unblockUser
};