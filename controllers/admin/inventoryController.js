import inventoryService from "../../services/admin/inventoryService.js";
import { HTTP_STATUS, RESPONSE_MESSAGES } from "../../constants/index.js";

const isJsonRequest = (req) => {
    try {
        if (req?.query?.format === "json" || req?.body?.format === "json") return true;
        if (req?.xhr) return true;
        const acceptHeader = req?.headers?.accept;
        return Boolean(acceptHeader && acceptHeader.includes("application/json"));
    } catch {
        return false;
    }
};

/**
 * Render Inventory / Stock Management Page
 */
export const getInventoryPage = async (req, res, next) => {
    const isJson = isJsonRequest(req);
    try {
        const {
            search = "",
            category = "all",
            stockFilter = "all",
            sort = "stock_asc",
            page = "1",
            limit = "10"
        } = req.query;

        const data = await inventoryService.getInventoryItems({
            search,
            categoryId: category,
            stockFilter,
            sort,
            page: parseInt(page, 10) || 1,
            limit: parseInt(limit, 10) || 10
        });

        if (isJson) {
            return res.status(HTTP_STATUS.OK).json({
                success: true,
                ...data
            });
        }

        res.set({
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        });

        return res.status(HTTP_STATUS.OK).render("inventory/inventoryList", {
            pageTitle: "Vault & Stock Governance — ROYAL IGNITE Admin",
            adminUser: req.session?.adminUser || { username: "Administrator", role: "Super Admin" },
            products: data.products,
            categories: data.categories,
            metrics: data.metrics,
            totalMatching: data.totalMatching,
            totalPages: data.totalPages,
            currentPage: data.currentPage,
            limit: data.limit,
            search: data.search,
            categoryId: data.categoryId,
            stockFilter: data.stockFilter,
            sort: data.sort,
            error: req.query.error || null,
            success: req.query.success || null
        });
    } catch (err) {
        console.error("inventoryController getInventoryPage error:", err);
        if (isJson) {
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: err.message || RESPONSE_MESSAGES.COMMON.SOMETHING_WENT_WRONG
            });
        }
        return next(err);
    }
};

/**
 * Adjust or set stock quantity directly
 */
export const postUpdateStock = async (req, res, next) => {
    const isJson = isJsonRequest(req);
    try {
        const { id } = req.params;
        const { stock, mode = "set" } = req.body;

        if (stock === undefined || stock === null || stock === "") {
            const message = RESPONSE_MESSAGES.INVENTORY.INVALID_STOCK;
            if (isJson) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message });
            }
            return res.redirect((req.headers.referer || "/admin/inventory") + `?error=` + encodeURIComponent(message));
        }

        const result = await inventoryService.updateProductStock(id, stock, mode);

        if (isJson) {
            return res.status(HTTP_STATUS.OK).json(result);
        }

        const redirectUrl = req.headers.referer || "/admin/inventory";
        const cleanUrl = redirectUrl.split("?")[0];
        return res.redirect(`${cleanUrl}?success=` + encodeURIComponent(result.message));
    } catch (err) {
        console.error("inventoryController postUpdateStock error:", err);
        const message = err.message || RESPONSE_MESSAGES.COMMON.SOMETHING_WENT_WRONG;
        if (isJson) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message
            });
        }
        const redirectUrl = req.headers.referer || "/admin/inventory";
        const cleanUrl = redirectUrl.split("?")[0];
        return res.redirect(`${cleanUrl}?error=` + encodeURIComponent(message));
    }
};

export default {
    getInventoryPage,
    postUpdateStock
};
