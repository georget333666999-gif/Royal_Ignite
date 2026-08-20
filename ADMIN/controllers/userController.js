const mongoose = require("mongoose");
const userService = require("../services/userService");

// Get User List
const getUserList = async (req, res) => {
    try {
        const search = req.query.search || "";
        const statusFilter = req.query.status || "all";
        let page = Number(req.query.page) || 1;
        let limit = Number(req.query.limit) || 4;

        const result = await userService.getUsers(
            search,
            statusFilter,
            page,
            limit
        );

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
        res.status(500).send("Unable to load users");
    }
};

// Get Single User Data (JSON for Edit Modal)
const getEditUser = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid user ID" });
        }

        const user = await userService.getUserById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Post Update User
const postEditUser = async (req, res) => {
    const { id } = req.params;
    const { name, email, phone, search, status, limit, page } = req.body;

    const query = new URLSearchParams();
    if (search) query.set("search", search);
    if (status) query.set("status", status);
    if (limit) query.set("limit", limit);
    if (page) query.set("page", page);

    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            query.set("error", "Invalid user ID");
            return res.redirect(`/admin/users?${query.toString()}`);
        }

        await userService.updateUser(id, { name, email, phone });
        query.set("success", "User updated successfully");
        res.redirect(`/admin/users?${query.toString()}`);
    } catch (error) {
        query.set("error", error.message);
        res.redirect(`/admin/users?${query.toString()}`);
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

        const search = req.body.search || "";
        const status = req.body.status || "all";
        const limit = req.body.limit || 4;
        const page = req.body.page || 1;

        const query = new URLSearchParams();
        if (search) query.set("search", search);
        if (status) query.set("status", status);
        if (limit) query.set("limit", limit);
        query.set("page", page);

        res.redirect(`/admin/users?${query.toString()}`);
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

        const search = req.body.search || "";
        const status = req.body.status || "all";
        const limit = req.body.limit || 4;
        const page = req.body.page || 1;

        const query = new URLSearchParams();
        if (search) query.set("search", search);
        if (status) query.set("status", status);
        if (limit) query.set("limit", limit);
        query.set("page", page);

        res.redirect(`/admin/users?${query.toString()}`);
    } catch (error) {
        console.error("Error unblocking user:", error);
        res.status(500).send("Unable to unblock user");
    }
};

module.exports = {
    getUserList,
    getEditUser,
    postEditUser,
    blockUser,
    unblockUser
};