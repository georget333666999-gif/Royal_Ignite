import salesReportService from "../../services/admin/salesReportService.js";
import { HTTP_STATUS } from "../../constants/index.js";

/**
 * Render sales report page
 */
export const getSalesReportPage = async (req, res, next) => {
    try {
        const { period = "daily", startDate = "", endDate = "", page = 1 } = req.query;

        const reportData = await salesReportService.getSalesReportData({
            period,
            startDate: startDate || null,
            endDate: endDate || null,
            page,
            limit: 15
        });

        return res.status(HTTP_STATUS.OK).render("admin/reports/salesReport", {
            pageTitle: "Sales & Financial Reports — ROYAL IGNITE Admin",
            adminUser: req.session.adminUser || null,
            period: reportData.period,
            startDate: startDate,
            endDate: endDate,
            resolvedStartDate: reportData.startDate,
            resolvedEndDate: reportData.endDate,
            summary: reportData.summary,
            orders: reportData.orders,
            currentPage: reportData.currentPage,
            totalPages: reportData.totalPages,
            totalOrdersCount: reportData.totalOrdersCount
        });
    } catch (error) {
        console.error("salesReportController getSalesReportPage error:", error);
        return next(error);
    }
};

/**
 * Download sales report as PDF
 */
export const downloadSalesReportPDF = async (req, res, next) => {
    try {
        const { period = "daily", startDate = "", endDate = "" } = req.query;

        const reportData = await salesReportService.getAllSalesReportOrders({
            period,
            startDate: startDate || null,
            endDate: endDate || null
        });

        await salesReportService.generatePDFReport(reportData, res);
    } catch (error) {
        console.error("salesReportController downloadSalesReportPDF error:", error);
        return next(error);
    }
};

/**
 * Download sales report as Excel spreadsheet (.xlsx)
 */
export const downloadSalesReportExcel = async (req, res, next) => {
    try {
        const { period = "daily", startDate = "", endDate = "" } = req.query;

        const reportData = await salesReportService.getAllSalesReportOrders({
            period,
            startDate: startDate || null,
            endDate: endDate || null
        });

        await salesReportService.generateExcelReport(reportData, res);
    } catch (error) {
        console.error("salesReportController downloadSalesReportExcel error:", error);
        return next(error);
    }
};

export default {
    getSalesReportPage,
    downloadSalesReportPDF,
    downloadSalesReportExcel
};

