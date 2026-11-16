import express from "express";
import salesReportController from "../../controllers/admin/salesReportController.js";

const router = express.Router();

router.get("/reports/sales", salesReportController.getSalesReportPage);
router.get("/reports/sales/pdf", salesReportController.downloadSalesReportPDF);
router.get("/reports/sales/excel", salesReportController.downloadSalesReportExcel);

export default router;

