import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import Order from "../../models/orderModel.js";

/**
 * Resolve start and end Date objects based on chosen period or custom range
 */
export const resolveDateRange = (period = "daily", startDate = null, endDate = null) => {
    const now = new Date();
    let start, end;

    switch (period) {
        case "daily": {
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
            end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
            break;
        }
        case "weekly": {
            start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            start.setHours(0, 0, 0, 0);
            end = new Date(now);
            end.setHours(23, 59, 59, 999);
            break;
        }
        case "monthly": {
            start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            break;
        }
        case "yearly": {
            start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
            end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
            break;
        }
        case "custom": {
            if (startDate) {
                start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
            } else {
                start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            }
            if (endDate) {
                end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
            } else {
                end = new Date(now);
                end.setHours(23, 59, 59, 999);
            }
            break;
        }
        default: {
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
            end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
            break;
        }
    }

    return { start, end };
};

/**
 * Fetch aggregated sales report metrics and detailed orders
 */
export const getSalesReportData = async ({ period = "daily", startDate = null, endDate = null, page = 1, limit = 20 } = {}) => {
    try {
        const { start, end } = resolveDateRange(period, startDate, endDate);

        const filter = {
            createdAt: { $gte: start, $lte: end },
            orderStatus: { $ne: "Cancelled" }
        };

        const currentPage = Math.max(1, parseInt(page, 10) || 1);
        const pageLimit = Math.max(1, parseInt(limit, 10) || 20);
        const skip = (currentPage - 1) * pageLimit;

        // Aggregate overall KPIs for this period (unpaginated)
        const [aggregateKPI] = await Order.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalSalesCount: { $sum: 1 },
                    totalOrderAmount: { $sum: "$pricing.subtotal" },
                    totalCouponDiscount: { $sum: "$pricing.couponDiscount" },
                    totalProductDiscount: { $sum: "$pricing.discount" },
                    totalNetRevenue: { $sum: "$pricing.totalAmount" }
                }
            }
        ]);

        const summary = {
            totalSalesCount: aggregateKPI ? aggregateKPI.totalSalesCount : 0,
            totalOrderAmount: aggregateKPI ? aggregateKPI.totalOrderAmount : 0,
            totalCouponDiscount: aggregateKPI ? aggregateKPI.totalCouponDiscount : 0,
            totalProductDiscount: aggregateKPI ? aggregateKPI.totalProductDiscount : 0,
            totalDiscount: aggregateKPI ? (aggregateKPI.totalCouponDiscount + aggregateKPI.totalProductDiscount) : 0,
            totalNetRevenue: aggregateKPI ? aggregateKPI.totalNetRevenue : 0
        };

        const [orders, totalOrdersCount] = await Promise.all([
            Order.find(filter)
                .populate("user", "name email phone")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(pageLimit)
                .lean(),
            Order.countDocuments(filter)
        ]);

        return {
            period,
            startDate: start,
            endDate: end,
            summary,
            orders,
            currentPage,
            totalPages: Math.ceil(totalOrdersCount / pageLimit) || 1,
            totalOrdersCount
        };
    } catch (error) {
        console.error("salesReportService getSalesReportData error:", error);
        throw error;
    }
};

/**
 * Fetch all matching orders without pagination for PDF / Excel export
 */
export const getAllSalesReportOrders = async ({ period = "daily", startDate = null, endDate = null } = {}) => {
    try {
        const { start, end } = resolveDateRange(period, startDate, endDate);

        const filter = {
            createdAt: { $gte: start, $lte: end },
            orderStatus: { $ne: "Cancelled" }
        };

        const [aggregateKPI] = await Order.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalSalesCount: { $sum: 1 },
                    totalOrderAmount: { $sum: "$pricing.subtotal" },
                    totalCouponDiscount: { $sum: "$pricing.couponDiscount" },
                    totalProductDiscount: { $sum: "$pricing.discount" },
                    totalNetRevenue: { $sum: "$pricing.totalAmount" }
                }
            }
        ]);

        const summary = {
            totalSalesCount: aggregateKPI ? aggregateKPI.totalSalesCount : 0,
            totalOrderAmount: aggregateKPI ? aggregateKPI.totalOrderAmount : 0,
            totalCouponDiscount: aggregateKPI ? aggregateKPI.totalCouponDiscount : 0,
            totalProductDiscount: aggregateKPI ? aggregateKPI.totalProductDiscount : 0,
            totalDiscount: aggregateKPI ? (aggregateKPI.totalCouponDiscount + aggregateKPI.totalProductDiscount) : 0,
            totalNetRevenue: aggregateKPI ? aggregateKPI.totalNetRevenue : 0
        };

        const orders = await Order.find(filter)
            .populate("user", "name email phone")
            .sort({ createdAt: -1 })
            .lean();

        return {
            period,
            startDate: start,
            endDate: end,
            summary,
            orders
        };
    } catch (error) {
        console.error("salesReportService getAllSalesReportOrders error:", error);
        throw error;
    }
};

/**
 * Generate PDF Sales Report (Requirement e)
 */
export const generatePDFReport = async (reportData, res) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });

    const filename = `Royal_Ignite_Sales_Report_${reportData.period}_${Date.now()}.pdf`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/pdf");

    doc.pipe(res);

    // Header Branding
    doc.rect(0, 0, doc.page.width, 80).fill("#0E0E12");
    doc.fillColor("#F6BD64")
        .fontSize(20)
        .font("Helvetica-Bold")
        .text("ROYAL IGNITE", 40, 24, { characterSpacing: 2 });
    doc.fillColor("#A1A1AA")
        .fontSize(10)
        .font("Helvetica")
        .text("ATELIER SALES & FINANCIAL DOSSIER", 40, 48, { characterSpacing: 1 });

    const dateRangeStr = `${reportData.startDate.toLocaleDateString("en-IN")} — ${reportData.endDate.toLocaleDateString("en-IN")}`;
    doc.fillColor("#FFFFFF")
        .fontSize(10)
        .text(`Period: ${reportData.period.toUpperCase()} (${dateRangeStr})`, doc.page.width - 240, 34, { width: 200, align: "right" });

    doc.moveDown(4);

    // Summary KPI Box
    const startY = 100;
    doc.rect(40, startY, doc.page.width - 80, 75).fillAndStroke("#18181B", "#27272A");

    doc.fillColor("#A1A1AA").fontSize(8).font("Helvetica-Bold");
    doc.text("TOTAL ACQUISITIONS", 55, startY + 12);
    doc.text("ORDER AMOUNT (GROSS)", 175, startY + 12);
    doc.text("COUPON DEDUCTIONS", 305, startY + 12);
    doc.text("TOTAL DISCOUNTS", 415, startY + 12);
    doc.text("NET REVENUE", 495, startY + 12);

    doc.fillColor("#FFFFFF").fontSize(13).font("Helvetica-Bold");
    doc.text(`${reportData.summary.totalSalesCount}`, 55, startY + 30);
    doc.text(`INR ${Number(reportData.summary.totalOrderAmount).toLocaleString("en-IN")}`, 175, startY + 30);

    doc.fillColor("#10B981");
    doc.text(`- INR ${Number(reportData.summary.totalCouponDiscount).toLocaleString("en-IN")}`, 305, startY + 30);

    doc.fillColor("#F59E0B");
    doc.text(`- INR ${Number(reportData.summary.totalDiscount).toLocaleString("en-IN")}`, 415, startY + 30);

    doc.fillColor("#F6BD64").fontSize(14);
    doc.text(`INR ${Number(reportData.summary.totalNetRevenue).toLocaleString("en-IN")}`, 495, startY + 29);

    doc.fillColor("#71717A").fontSize(8).font("Helvetica");
    doc.text("All completed & active acquisitions (excluding cancellations)", 55, startY + 54);

    // Table Header
    let tableY = startY + 95;
    doc.rect(40, tableY, doc.page.width - 80, 22).fill("#27272A");
    doc.fillColor("#F4F4F5").fontSize(8).font("Helvetica-Bold");

    doc.text("ORDER ID", 46, tableY + 6);
    doc.text("DATE", 135, tableY + 6);
    doc.text("CUSTOMER", 195, tableY + 6);
    doc.text("PAYMENT", 295, tableY + 6);
    doc.text("GROSS", 370, tableY + 6, { align: "right", width: 45 });
    doc.text("COUPON", 425, tableY + 6, { align: "right", width: 45 });
    doc.text("NET AMOUNT", 480, tableY + 6, { align: "right", width: 65 });

    tableY += 24;

    // Table Rows
    doc.font("Helvetica").fontSize(7.5);
    reportData.orders.forEach((ord, index) => {
        if (tableY > doc.page.height - 60) {
            doc.addPage();
            tableY = 40;
            doc.rect(40, tableY, doc.page.width - 80, 22).fill("#27272A");
            doc.fillColor("#F4F4F5").fontSize(8).font("Helvetica-Bold");
            doc.text("ORDER ID", 46, tableY + 6);
            doc.text("DATE", 135, tableY + 6);
            doc.text("CUSTOMER", 195, tableY + 6);
            doc.text("PAYMENT", 295, tableY + 6);
            doc.text("GROSS", 370, tableY + 6, { align: "right", width: 45 });
            doc.text("COUPON", 425, tableY + 6, { align: "right", width: 45 });
            doc.text("NET AMOUNT", 480, tableY + 6, { align: "right", width: 65 });
            tableY += 24;
            doc.font("Helvetica").fontSize(7.5);
        }

        const isEven = index % 2 === 0;
        doc.rect(40, tableY, doc.page.width - 80, 18).fill(isEven ? "#0F0F12" : "#18181B");

        doc.fillColor("#F6BD64").text(ord.orderId, 46, tableY + 4);
        doc.fillColor("#D4D4D8").text(new Date(ord.createdAt).toLocaleDateString("en-IN"), 135, tableY + 4);

        const custName = ord.shippingAddress?.fullName || ord.user?.name || "Client";
        doc.fillColor("#E4E4E7").text(custName.slice(0, 16), 195, tableY + 4);

        const payInfo = `${ord.paymentMethod} (${ord.orderStatus})`;
        doc.fillColor("#A1A1AA").text(payInfo.slice(0, 15), 295, tableY + 4);

        const gross = Number(ord.pricing?.subtotal || ord.pricing?.totalAmount || 0);
        const cpn = Number(ord.pricing?.couponDiscount || 0);
        const net = Number(ord.pricing?.totalAmount || 0);

        doc.fillColor("#D4D4D8").text(`INR ${gross.toLocaleString("en-IN")}`, 370, tableY + 4, { align: "right", width: 45 });
        doc.fillColor(cpn > 0 ? "#10B981" : "#71717A").text(cpn > 0 ? `- ${cpn}` : "0", 425, tableY + 4, { align: "right", width: 45 });
        doc.fillColor("#FFFFFF").font("Helvetica-Bold").text(`INR ${net.toLocaleString("en-IN")}`, 480, tableY + 4, { align: "right", width: 65 });
        doc.font("Helvetica");

        tableY += 19;
    });

    // Footer note
    doc.fillColor("#71717A")
        .fontSize(7)
        .text(`Generated on ${new Date().toLocaleString("en-IN")} • Confidential Royal Ignite Atelier Record`, 40, doc.page.height - 30, { align: "center", width: doc.page.width - 80 });

    doc.end();
};

/**
 * Generate Excel (.xlsx) Sales Report (Requirement e)
 */
export const generateExcelReport = async (reportData, res) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Royal Ignite Luxury Atelier";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Sales Report", {
        views: [{ showGridLines: true }]
    });

    // Title Row
    sheet.mergeCells("A1:G1");
    const titleCell = sheet.getCell("A1");
    titleCell.value = "ROYAL IGNITE — SALES & FINANCIAL REPORT";
    titleCell.font = { name: "Arial", size: 16, bold: true, color: { argb: "FFF6BD64" } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0E0E12" } };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };
    sheet.getRow(1).height = 36;

    // Subtitle / Date Range Row
    sheet.mergeCells("A2:G2");
    const subCell = sheet.getCell("A2");
    subCell.value = `Period: ${reportData.period.toUpperCase()} (${reportData.startDate.toLocaleDateString("en-IN")} — ${reportData.endDate.toLocaleDateString("en-IN")}) | Generated: ${new Date().toLocaleString("en-IN")}`;
    subCell.font = { name: "Arial", size: 10, italic: true, color: { argb: "FFA1A1AA" } };
    subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF18181B" } };
    subCell.alignment = { vertical: "middle", horizontal: "center" };
    sheet.getRow(2).height = 22;

    // Blank row
    sheet.addRow([]);

    // KPI Summary Header
    sheet.addRow(["KPI METRIC", "VALUE"]);
    sheet.getRow(4).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF27272A" } };

    const kpiRows = [
        ["Total Acquisitions (Count)", reportData.summary.totalSalesCount],
        ["Gross Order Amount", reportData.summary.totalOrderAmount],
        ["Coupon Deductions", -reportData.summary.totalCouponDiscount],
        ["Catalog Discounts", -reportData.summary.totalProductDiscount],
        ["Total Overall Deductions", -reportData.summary.totalDiscount],
        ["Net Revenue Generated", reportData.summary.totalNetRevenue]
    ];

    kpiRows.forEach((r) => {
        const added = sheet.addRow(r);
        added.font = { name: "Arial", size: 10 };
        added.getCell(1).font = { bold: true };
    });

    sheet.addRow([]); // Blank spacer

    // Detailed Table Headers
    const headerRow = sheet.addRow([
        "Order ID",
        "Date",
        "Customer Name",
        "Customer Email",
        "Payment Method",
        "Status",
        "Gross Subtotal (₹)",
        "Coupon Discount (₹)",
        "Net Amount Paid (₹)"
    ]);

    headerRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD48833" } };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    headerRow.height = 26;

    // Detailed Orders Data
    reportData.orders.forEach((ord) => {
        const custName = ord.shippingAddress?.fullName || ord.user?.name || "Client";
        const custEmail = ord.user?.email || "—";
        const gross = Number(ord.pricing?.subtotal || ord.pricing?.totalAmount || 0);
        const cpn = Number(ord.pricing?.couponDiscount || 0);
        const net = Number(ord.pricing?.totalAmount || 0);

        const row = sheet.addRow([
            ord.orderId,
            new Date(ord.createdAt).toLocaleDateString("en-IN"),
            custName,
            custEmail,
            ord.paymentMethod,
            ord.orderStatus,
            gross,
            cpn,
            net
        ]);

        row.font = { name: "Arial", size: 9.5 };
        row.getCell(7).numFmt = "₹#,##0";
        row.getCell(8).numFmt = "₹#,##0";
        row.getCell(9).numFmt = "₹#,##0";
    });

    // Auto-fit column widths
    sheet.columns.forEach((col) => {
        let maxLen = 14;
        col.eachCell({ includeEmpty: true }, (cell) => {
            const val = cell.value ? cell.value.toString() : "";
            if (val.length > maxLen) maxLen = Math.min(val.length + 3, 40);
        });
        col.width = maxLen;
    });

    const filename = `Royal_Ignite_Sales_Report_${reportData.period}_${Date.now()}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
};

export default {
    resolveDateRange,
    getSalesReportData,
    getAllSalesReportOrders,
    generatePDFReport,
    generateExcelReport
};
