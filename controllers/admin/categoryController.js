import categoryService from "../../services/admin/categoryService.js";
import { validateCategoryInput } from "../../validators/categoryValidator.js";
import { HTTP_STATUS, RESPONSE_MESSAGES } from "../../constants/index.js";

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

const buildRedirectQuery = (query = {}, extraParams = {}) => {
    try {
        const params = new URLSearchParams();
        if (query.search) params.set("search", query.search);
        if (query.status) params.set("status", query.status);
        if (query.limit) params.set("limit", query.limit);
        if (query.page) params.set("page", query.page);
        for (const [key, value] of Object.entries(extraParams)) {
            if (value) params.set(key, value);
        }
        const str = params.toString();
        return str ? `?${str}` : "";
    } catch {
        return "";
    }
};

/**
 * Render category list with search, status filters, and pagination
 */
const getCategoryList = async (req, res) => {
    const isJson = isJsonRequest(req);
    try {
        const search = req.query.search || "";
        const statusFilter = req.query.status || "all";
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 5;

        const result = await categoryService.getCategories(search, statusFilter, page, limit);

        const responseData = {
            ...result,
            search,
            statusFilter,
            error: req.query.error || null,
            success: req.query.success || null
        };

        if (isJson) {
            return res.status(HTTP_STATUS.OK).json({ success: true, ...responseData });
        }

        return res.status(HTTP_STATUS.OK).render("categories/categoryList", responseData);
    } catch (error) {
        console.error("Error loading categories:", error);
        if (isJson) {
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: RESPONSE_MESSAGES.CATEGORY.LOAD_ERROR });
        }
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(RESPONSE_MESSAGES.CATEGORY.LOAD_ERROR);
    }
};

/**
 * Get category by ID (for prefilling edit modal)
 */
const getCategoryById = async (req, res) => {
    try {
        const { id } = req.params;
        const category = await categoryService.getCategoryById(id);
        if (!category) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: RESPONSE_MESSAGES.CATEGORY.NOT_FOUND });
        }
        return res.status(HTTP_STATUS.OK).json({ success: true, category });
    } catch (error) {
        console.error("Error fetching category:", error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: "Error fetching category" });
    }
};

// Add a new category
 
const addCategory = async (req, res) => {
    const isJson = isJsonRequest(req);
    try {
        const { name, description, isListed } = req.body;
        const validation = validateCategoryInput({ name, description });

        if (!validation.isValid) {
            const errorMessage = validation.errors.join(" ");
            if (isJson) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: errorMessage });
            }
            return res.redirect(`/admin/categories${buildRedirectQuery(req.query, { error: errorMessage })}`);
        }

        const category = await categoryService.addCategory({
            name,
            description,
            isListed: isListed === "true" || isListed === true || isListed === "on"
        });

        const successMessage = `Category "${category.name}" added successfully.`;
        if (isJson) {
            return res.status(HTTP_STATUS.CREATED).json({ success: true, message: successMessage, category });
        }
        return res.redirect(`/admin/categories${buildRedirectQuery(req.query, { success: successMessage })}`);
    } catch (error) {
        console.error("Error adding category:", error);
        const errorMessage = error.message || "Failed to add category";
        if (isJson) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: errorMessage });
        }
        return res.redirect(`/admin/categories${buildRedirectQuery(req.query, { error: errorMessage })}`);
    }
};

// Edit an existing category
 
async function editCategory(req, res) {
    const isJson = isJsonRequest(req);
    try {
        const { id } = req.params;
        const { name, description, isListed } = req.body;

        const validation = validateCategoryInput({ name, description });
        if (!validation.isValid) {
            const errorMessage = validation.errors.join(" ");
            if (isJson) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: errorMessage });
            }
            return res.redirect(`/admin/categories${buildRedirectQuery(req.query, { error: errorMessage })}`);
        }

        const updatedCategory = await categoryService.editCategory(id, {
            name,
            description,
            isListed: isListed === "true" || isListed === true || isListed === "on"
        });

        const successMessage = `Category "${updatedCategory.name}" updated successfully.`;
        if (isJson) {
            return res.status(HTTP_STATUS.OK).json({ success: true, message: successMessage, category: updatedCategory });
        }
        return res.redirect(`/admin/categories${buildRedirectQuery(req.query, { success: successMessage })}`);
    } catch (error) {
        console.error("Error updating category:", error);
        const errorMessage = error.message || "Failed to update category";
        if (isJson) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: errorMessage });
        }
        return res.redirect(`/admin/categories${buildRedirectQuery(req.query, { error: errorMessage })}`);
    }
}

// Soft delete category
 
const softDeleteCategory = async (req, res) => {
    const isJson = isJsonRequest(req);
    try {
        const { id } = req.params;
        const category = await categoryService.softDeleteCategory(id);
        const successMessage = `Category "${category.name}" moved to deleted categories.`;

        if (isJson) {
            return res.status(HTTP_STATUS.OK).json({ success: true, message: successMessage });
        }
        return res.redirect(`/admin/categories${buildRedirectQuery(req.query, { success: successMessage })}`);
    } catch (error) {
        console.error("Error deleting category:", error);
        const errorMessage = error.message || "Failed to delete category";
        if (isJson) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: errorMessage });
        }
        return res.redirect(`/admin/categories${buildRedirectQuery(req.query, { error: errorMessage })}`);
    }
};

// Restore soft-deleted category
const restoreCategory = async (req, res) => {
    const isJson = isJsonRequest(req);
    try {
        const { id } = req.params;
        const category = await categoryService.restoreCategory(id);
        const successMessage = `Category "${category.name}" restored successfully.`;

        if (isJson) {
            return res.status(HTTP_STATUS.OK).json({ success: true, message: successMessage });
        }
        return res.redirect(`/admin/categories${buildRedirectQuery(req.query, { success: successMessage })}`);
    } catch (error) {
        console.error("Error restoring category:", error);
        const errorMessage = error.message || "Failed to restore category";
        if (isJson) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: errorMessage });
        }
        return res.redirect(`/admin/categories${buildRedirectQuery(req.query, { error: errorMessage })}`);
    }
};

// Toggle Listed / Unlisted status
const toggleListCategory = async (req, res) => {
    const isJson = isJsonRequest(req);
    try {
        const { id } = req.params;
        const category = await categoryService.toggleListCategory(id);
        const statusText = category.isListed ? "listed (active)" : "unlisted";
        const successMessage = `Category "${category.name}" is now ${statusText}.`;

        if (isJson) {
            return res.status(HTTP_STATUS.OK).json({ success: true, message: successMessage, isListed: category.isListed });
        }
        return res.redirect(`/admin/categories${buildRedirectQuery(req.query, { success: successMessage })}`);
    } catch (error) {
        console.error("Error toggling category status:", error);
        const errorMessage = error.message || "Failed to toggle category status";
        if (isJson) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: errorMessage });
        }
        return res.redirect(`/admin/categories${buildRedirectQuery(req.query, { error: errorMessage })}`);
    }
};

export {
    getCategoryList,
    getCategoryById,
    addCategory,
    editCategory,
    softDeleteCategory,
    restoreCategory,
    toggleListCategory
};

export default {
    getCategoryList,
    getCategoryById,
    addCategory,
    editCategory,
    softDeleteCategory,
    restoreCategory,
    toggleListCategory
};
