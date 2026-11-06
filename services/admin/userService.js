import User from "../../models/userModel.js";

const escapeRegex = (value) => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const statusFilterMap = {
    active: { isBlocked: false },
    blocked: { isBlocked: true },
    inactive: { isVerified: false }
};

const getStatusFilter = (status) => statusFilterMap[status] || {};

const getSearchFilter = (trimmedSearch) => {
    if (!trimmedSearch) return {};
    const tokens = trimmedSearch.split(/\s+/).filter(Boolean);
    const escapedTokens = tokens.map(escapeRegex);
    const phraseRegex = new RegExp(escapedTokens.join("\\s+"), "i");
    const tokenRegex = new RegExp(escapedTokens.map((t) => `(?=.*${t})`).join(""), "i");

    const compactLetters = trimmedSearch.replace(/[\s.]+/g, "");
    const compactRegex = compactLetters.length <= 6
        ? new RegExp(compactLetters.split("").map(escapeRegex).join("[\\s.]*"), "i")
        : phraseRegex;

    return {
        $or: [
            { name: phraseRegex },
            { name: tokenRegex },
            { name: compactRegex },
            { email: phraseRegex },
            { phone: phraseRegex }
        ]
    };
};

const fetchUserMetrics = async () => {
    try {
        const [totalCustomers, activeUsers, blockedUsers, inactiveUsers] = await Promise.all([
            User.countDocuments({ isAdmin: false }),
            User.countDocuments({ isAdmin: false, isBlocked: false }),
            User.countDocuments({ isAdmin: false, isBlocked: true }),
            User.countDocuments({ isAdmin: false, isVerified: false })
        ]);
        return { totalCustomers, activeUsers, blockedUsers, inactiveUsers };
    } catch (error) {
        console.error("fetchUserMetrics error:", error);
        throw error;
    }
};

const fetchUsersStandard = (filter, skip, limit) => {
    return User.find(filter)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
};

// Get Users with Status Filter & Counts
const getUsers = async (search = "", statusFilter = "all", page = 1, limit = 4) => {
    try {
        const trimmedSearch = search.trim();
        const filter = {
            isAdmin: false,
            ...getStatusFilter(statusFilter),
            ...getSearchFilter(trimmedSearch)
        };

        const [metrics, totalUsers] = await Promise.all([
            fetchUserMetrics(),
            User.countDocuments(filter)
        ]);

        const totalPages = Math.ceil(totalUsers / limit) || 1;
        const currentPage = Math.min(Math.max(1, page), totalPages);
        const skip = (currentPage - 1) * limit;

        const users = await fetchUsersStandard(filter, skip, limit);

        return {
            users,
            ...metrics,
            totalUsers,
            totalPages,
            currentPage,
            limit
        };
    } catch (error) {
        console.error("getUsers error:", error);
        throw error;
    }
};

// Get User by ID
const getUserById = async (userId) => {
    try {
        return await User.findOne({ _id: userId, isAdmin: false }).select("-password");
    } catch (error) {
        console.error("getUserById error:", error);
        throw error;
    }
};

const blockUser = async (userId) => {
    try {
        return await User.findOneAndUpdate(
            { _id: userId, isAdmin: false },
            { $set: { isBlocked: true } },
            { returnDocument: "after" }
        );
    } catch (error) {
        console.error("blockUser error:", error);
        throw error;
    }
};

const unblockUser = async (userId) => {
    try {
        return await User.findOneAndUpdate(
            { _id: userId, isAdmin: false },
            { $set: { isBlocked: false } },
            { returnDocument: "after" }
        );
    } catch (error) {
        console.error("unblockUser error:", error);
        throw error;
    }
};

export {
    getUsers,
    getUserById,
    blockUser,
    unblockUser
};

export default {
    getUsers,
    getUserById,
    blockUser,
    unblockUser
};