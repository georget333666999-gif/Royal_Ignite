const mongoose = require("mongoose");
const userService = require("../services/userService");

// Helper to construct query string preserving search, status, limit & page
const buildRedirectQuery = (body = {}, extraParams = {}) => {
    const query = new URLSearchParams();
    if (body.search) query.set("search", body.search);
    if (body.status) query.set("status", body.status);
    if (body.limit) query.set("limit", body.limit);
    query.set("page", body.page || 1);
    for (const [key, value] of Object.entries(extraParams)) {
        if (value) query.set(key, value);
    }
    return query.toString();
};

// Get User List
const getUserList = async (req, res) => {
    try {
        const search = req.query.search || "";
        const statusFilter = req.query.status || "all";
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 4;

        const result = await userService.getUsers(
            search,
            statusFilter,
            page,
            limit
        );

        // Dynamic JSON response for live search and filter updates
        if (req.query.format === "json" || req.xhr || req.headers.accept?.includes("application/json")) {
            return res.json({
                success: true,
                users: result.users,
                search,
                statusFilter,
                limit: result.limit,
                currentPage: result.currentPage,
                totalPages: result.totalPages,
                totalUsers: result.totalUsers,
                totalCustomers: result.totalCustomers,
                activeUsers: result.activeUsers,
                blockedUsers: result.blockedUsers,
                inactiveUsers: result.inactiveUsers
            });
        }

        res.render("users/userList", {
            users: result.users,
            search,
            statusFilter,
            limit: result.limit,
            currentPage: result.currentPage,
            totalPages: result.totalPages,
            totalUsers: result.totalUsers,
            totalCustomers: result.totalCustomers,
            activeUsers: result.activeUsers,
            blockedUsers: result.blockedUsers,
            inactiveUsers: result.inactiveUsers,
            error: req.query.error || null,
            success: req.query.success || null
        });
    } catch (error) {
        console.error("Error loading users:", error);
        if (req.query.format === "json" || req.xhr || req.headers.accept?.includes("application/json")) {
            return res.status(500).json({ success: false, message: "Unable to load users" });
        }
        res.status(500).send("Unable to load users");
    }
};

// Block User
const blockUser = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).send("Invalid user ID");
        }

        const user = await userService.blockUser(id);
        if (!user) {
            return res.status(404).send("User not found");
        }

        res.redirect(`/admin/users?${buildRedirectQuery(req.body, { success: `Customer "${user.name}" has been blocked successfully.` })}`);
    } catch (error) {
        console.error("Error blocking user:", error);
        res.status(500).send("Unable to block user");
    }
};

// Unblock User
const unblockUser = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).send("Invalid user ID");
        }

        const user = await userService.unblockUser(id);
        if (!user) {
            return res.status(404).send("User not found");
        }

        res.redirect(`/admin/users?${buildRedirectQuery(req.body, { success: `Customer "${user.name}" has been unblocked successfully.` })}`);
    } catch (error) {
        console.error("Error unblocking user:", error);
        res.status(500).send("Unable to unblock user");
    }
};

module.exports = {
    getUserList,
    blockUser,
    unblockUser
};