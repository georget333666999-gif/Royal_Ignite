import PDFDocument from "pdfkit";

/**
 * Renders an official haute horlogerie invoice PDF directly into an Express response stream.
 * @param {Object} order - Full populated order document
 * @param {import("express").Response} res - Express response stream
 */
export const renderInvoicePDF = (order, res) => {
    const doc = new PDFDocument({
        size: "A4",
        margin: 40,
        info: {
            Title: `Invoice ${order.orderId} - ROYAL IGNITE`,
            Author: "Royal Ignite Haute Briquet Atelier"
        }
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
        "Content-Disposition",
        `attachment; filename="Invoice-${order.orderId}.pdf"`
    );

    doc.pipe(res);

    // Styling constants
    const GOLD = "#C59B4E";
    const DARK = "#121216";
    const GRAY = "#5A5A65";
    const LIGHT_GRAY = "#EEEEF0";

    // Top Brand Header
    doc.rect(40, 40, 515, 80).fill(DARK);

    doc.fillColor("#FFFFFF")
        .font("Helvetica-Bold")
        .fontSize(22)
        .text("ROYAL IGNITE", 60, 58, { characterSpacing: 2 });

    doc.fillColor(GOLD)
        .font("Helvetica")
        .fontSize(9)
        .text("HAUTE ATELIER & PRECISION FLAME HORLOGERIE", 60, 84, { characterSpacing: 1.5 });

    doc.fillColor("#FFFFFF")
        .font("Helvetica-Bold")
        .fontSize(12)
        .text("OFFICIAL PROVENANCE INVOICE", 340, 68, { align: "right" });

    // Invoice Meta Block
    let y = 140;
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(10);
    doc.text("ORDER REFERENCE:", 40, y);
    doc.font("Helvetica").text(order.orderId, 160, y);

    doc.font("Helvetica-Bold").text("INVOICE DATE:", 340, y);
    doc.font("Helvetica").text(
        new Date(order.createdAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "long",
            year: "numeric"
        }),
        430,
        y
    );

    y += 18;
    doc.font("Helvetica-Bold").text("ORDER STATUS:", 40, y);
    doc.font("Helvetica").text(order.orderStatus.toUpperCase(), 160, y);

    doc.font("Helvetica-Bold").text("PAYMENT MODE:", 340, y);
    const paymentLabel = order.paymentMethod === "Razorpay" ? "Online Payment (Razorpay)" : (order.paymentMethod === "Wallet" ? "Digital Wallet" : "Cash on Delivery (COD)");
    doc.font("Helvetica").text(paymentLabel, 430, y);

    // Divider
    y += 24;
    doc.strokeColor(GOLD).lineWidth(1).moveTo(40, y).lineTo(555, y).stroke();

    // Sold By & Shipped To Columns
    y += 15;
    doc.fillColor(GOLD).font("Helvetica-Bold").fontSize(10).text("ATELIER HEADQUARTERS", 40, y);
    doc.text("DELIVERY DESTINATION", 300, y);

    y += 15;
    doc.fillColor(DARK).font("Helvetica").fontSize(9);
    doc.text("Royal Ignite Luxury Atelier Pvt. Ltd.", 40, y);
    doc.text(order.shippingAddress.fullName, 300, y);

    y += 13;
    doc.text("The Palladium Pavilion, Level 4", 40, y);
    doc.text(order.shippingAddress.addressLine, 300, y);

    y += 13;
    doc.text("Senapati Bapat Marg, Lower Parel", 40, y);
    doc.text(
        `${order.shippingAddress.city}, ${order.shippingAddress.state} — ${order.shippingAddress.pincode}`,
        300,
        y
    );

    y += 13;
    doc.text("Mumbai, Maharashtra 400013, India", 40, y);
    doc.text(`Contact: ${order.shippingAddress.phone}`, 300, y);

    // Table Header
    y += 35;
    doc.rect(40, y, 515, 24).fill(DARK);
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(9);
    doc.text("#", 50, y + 7);
    doc.text("CREATION SPECIFICATION", 80, y + 7);
    doc.text("STATUS", 290, y + 7);
    doc.text("QTY", 370, y + 7);
    doc.text("UNIT PRICE", 420, y + 7);
    doc.text("TOTAL", 500, y + 7);

    // Table Rows
    y += 24;
    let index = 1;
    doc.font("Helvetica").fontSize(9);

    for (const item of order.items) {
        const rowBg = index % 2 === 0 ? LIGHT_GRAY : "#FFFFFF";
        doc.rect(40, y, 515, 24).fill(rowBg);

        doc.fillColor(DARK);
        doc.text(String(index).padStart(2, "0"), 50, y + 7);
        doc.text(item.name, 80, y + 7, { width: 200, ellipsis: true });
        doc.text(item.status, 290, y + 7);
        doc.text(String(item.quantity), 370, y + 7);
        doc.text(`INR ${Number(item.price).toLocaleString("en-IN")}`, 420, y + 7);
        doc.text(`INR ${Number(item.lineTotal).toLocaleString("en-IN")}`, 490, y + 7);

        y += 24;
        index++;
    }

    // Ledger Summary Block
    y += 15;
    const subtotal = order.pricing?.subtotal || order.pricing?.totalAmount || 0;
    const discount = order.pricing?.discount || 0;
    const total = order.pricing?.totalAmount || 0;

    doc.fillColor(GRAY).font("Helvetica").fontSize(9);
    doc.text("BAG SUBTOTAL:", 360, y);
    doc.fillColor(DARK).text(`INR ${Number(subtotal).toLocaleString("en-IN")}`, 470, y, { align: "right" });

    if (discount > 0) {
        y += 15;
        doc.fillColor(GRAY).text("ATELIER COURTESY DISCOUNT:", 310, y);
        doc.fillColor(GOLD).text(`- INR ${Number(discount).toLocaleString("en-IN")}`, 470, y, { align: "right" });
    }

    y += 15;
    doc.fillColor(GRAY).text("INSURED AIR COURIER:", 360, y);
    doc.fillColor(DARK).text("COMPLIMENTARY", 470, y, { align: "right" });

    y += 15;
    doc.fillColor(GRAY).text("TAXES & DUTIES:", 360, y);
    doc.fillColor(DARK).text("INCLUDED", 470, y, { align: "right" });

    y += 18;
    doc.rect(340, y, 215, 28).fill(DARK);
    doc.fillColor(GOLD).font("Helvetica-Bold").fontSize(11).text("TOTAL PAYABLE:", 355, y + 9);
    doc.fillColor("#FFFFFF").text(`INR ${Number(total).toLocaleString("en-IN")}`, 450, y + 9, { align: "right" });

    // Authenticity Certification Footer
    y = 730;
    doc.strokeColor(GOLD).lineWidth(0.75).moveTo(40, y).lineTo(555, y).stroke();
    y += 12;

    doc.fillColor(GOLD)
        .font("Helvetica-Bold")
        .fontSize(8)
        .text("ROYAL IGNITE SEAL OF PROVENANCE & AUTHENTICITY", 40, y, { align: "center", characterSpacing: 1.5 });

    y += 12;
    doc.fillColor(GRAY)
        .font("Helvetica")
        .fontSize(7.5)
        .text(
            "Each creation is handcrafted to horological micrometer tolerances. Serial numbers registered in the Master Registry. For ignition concierge service, visit royalignite.com",
            40,
            y,
            { align: "center" }
        );

    doc.end();
};

export default {
    renderInvoicePDF
};
