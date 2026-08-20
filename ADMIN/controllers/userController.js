const mongoose = require("mongoose");
const userService = require("../services/userService");

// Get User List
const getUserList = async (req, res) => {
    try {
        const search = req.query.search || "";
        const statusFilter = req.query.status || "all";
        let page = Number(req.query.page) || 1;

        const result = await userService.getUsers(
            search,
            statusFilter,
            page,
            10
        );

        res.render("users/userList", {
            users: result.users,
            search,
            statusFilter,
            currentPage: result.currentPage,
            totalPages: result.totalPages,
            totalUsers: result.totalUsers,
            totalCustomers: result.totalCustomers,
            activeUsers: result.activeUsers,
            blockedUsers: result.blockedUsers,
            inactiveUsers: result.inactiveUsers
        });
    } catch (error) {
        console.error("Error loading users:", error);
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

        const search = req.body.search || "";
        const status = req.body.status || "all";
        const page = req.body.page || 1;

        const query = new URLSearchParams();
        if (search) query.set("search", search);
        if (status) query.set("status", status);
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
        const page = req.body.page || 1;

        const query = new URLSearchParams();
        if (search) query.set("search", search);
        if (status) query.set("status", status);
        query.set("page", page);

        res.redirect(`/admin/users?${query.toString()}`);
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