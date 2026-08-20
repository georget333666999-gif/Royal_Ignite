const mongoose = require("mongoose");

const userService = require("../services/userService");


// ========================================
// Get User List
// ========================================

const getUserList = async (req, res) => {

    try {

        const search = req.query.search || "";

        let page = Number(req.query.page);

        if (!Number.isInteger(page) || page < 1) {
            page = 1;
        }

        const result = await userService.getUsers(
            search,
            page,
            2
        );

        res.render("users/userList", {
            users: result.users,
            search,
            currentPage: result.currentPage,
            totalPages: result.totalPages,
            totalUsers: result.totalUsers
        });

    } catch (error) {

        console.error("Error loading users:", error);

        res.status(500).send("Unable to load users");
    }
};


// ========================================
// Block User
// ========================================

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
        const page = req.body.page || 1;

        const query = new URLSearchParams();

        if (search) {
            query.set("search", search);
        }

        query.set("page", page);

        res.redirect(`/admin/users?${query.toString()}`);

    } catch (error) {

        console.error("Error blocking user:", error);

        res.status(500).send("Unable to block user");
    }
};


// ========================================
// Unblock User
// ========================================

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
        const page = req.body.page || 1;

        const query = new URLSearchParams();

        if (search) {
            query.set("search", search);
        }

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