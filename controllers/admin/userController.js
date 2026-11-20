import mongoose from "mongoose";
import userService from "../../services/admin/userService.js";
import { HTTP_STATUS, RESPONSE_MESSAGES } from "../../constants/index.js";

// Helper to construct query string preserving search, status, limit & page
const buildRedirectQuery = (body = {}, extraParams = {}) => {
    try {
        const query = new URLSearchParams();
        if (body.search) query.set("search", body.search);
        if (body.status) query.set("status", body.status);
        if (body.limit) query.set("limit", body.limit);
        query.set("page", body.page || 1);
        for (const [key, value] of Object.entries(extraParams)) {
            if (value) query.set(key, value);
        }
        return query.toString();
    } catch {
        return "";
    }
};

const isJsonRequest = (req) => {
    try {
        if (req?.query?.format === "json") return true;
        if (req?.xhr) return true;
        const acceptHeader = req?.headers?.accept;
        return Boolean(acceptHeader && acceptHeader.includes("application/json"));
    } catch {
        return false;
    }
};

const parseUserQueryParams = (query = {}) => {
    try {
        return {
            search: query.search || "",
            statusFilter: query.status || "all",
            page: Number(query.page) || 1,
            limit: Number(query.limit) || 4
        };
    } catch {
        return { search: "", statusFilter: "all", page: 1, limit: 4 };
    }
};

// Get User List
const getUserList = async (req, res) => {
    const isJson = isJsonRequest(req);
    try {
        const { search, statusFilter, page, limit } = parseUserQueryParams(req.query);
        const result = await userService.getUsers(search, statusFilter, page, limit);

        const responseData = {
            ...result,
            search: result.search,
            statusFilter,
            error: req.query.error || result.searchError || null,
            success: req.query.success || null
        };

        if (isJson) {
            return res.status(HTTP_STATUS.OK).json({ success: true, ...responseData });
        }

        return res.status(HTTP_STATUS.OK).render("users/userList", responseData);
    } catch (error) {
        console.error("Error loading users:", error);
        if (isJson) {
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: RESPONSE_MESSAGES.USER.LOAD_ERROR });
        }
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(RESPONSE_MESSAGES.USER.LOAD_ERROR);
    }
};

// Block User
const blockUser = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).send(RESPONSE_MESSAGES.USER.INVALID_ID);
        }

        const user = await userService.blockUser(id);
        if (!user) {
            return res.status(HTTP_STATUS.NOT_FOUND).send(RESPONSE_MESSAGES.USER.NOT_FOUND);
        }

        res.redirect(`/admin/users?${buildRedirectQuery(req.body, { success: `Customer "${user.name}" has been blocked successfully.` })}`);
    } catch (error) {
        console.error("Error blocking user:", error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(RESPONSE_MESSAGES.USER.BLOCK_ERROR);
    }
};

// Unblock User
const unblockUser = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).send(RESPONSE_MESSAGES.USER.INVALID_ID);
        }

        const user = await userService.unblockUser(id);
        if (!user) {
            return res.status(HTTP_STATUS.NOT_FOUND).send(RESPONSE_MESSAGES.USER.NOT_FOUND);
        }

        res.redirect(`/admin/users?${buildRedirectQuery(req.body, { success: `Customer "${user.name}" has been unblocked successfully.` })}`);
    } catch (error) {
        console.error("Error unblocking user:", error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(RESPONSE_MESSAGES.USER.UNBLOCK_ERROR);
    }
};

export {
    getUserList,
    blockUser,
    unblockUser
};

export default {
    getUserList,
    blockUser,
    unblockUser
};