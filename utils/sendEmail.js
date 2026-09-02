const nodemailer = require("nodemailer");

// Create reusable transporter
const createTransporter = () => {
    return nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
};

/**
 * Send an OTP verification email with a sleek HTML template
 * @param {string} to - Recipient email address
 * @param {string} otpCode - 6-digit OTP code
 * @param {string} [purpose="Verification"] - Purpose description (e.g., 'Account Signup', 'Password Reset', 'Email Verification')
 * @param {string} [userName="Valued Customer"] - User's name if available
 */
const sendOtpEmail = async (to, otpCode, purpose = "Account Verification", userName = "User") => {
    try {
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.warn(
                "\n⚠️  [EMAIL CONFIG WARNING]: EMAIL_USER or EMAIL_PASS is missing in .env!\n" +
                `Fallback Terminal OTP for ${to}: ${otpCode}\n`
            );
            return { success: true, simulated: true };
        }

        const transporter = createTransporter();

        const subjectMap = {
            "Account Verification": "Your Verification Code",
            "signup": "Welcome! Verify Your Email",
            "reset-password": "Password Reset OTP",
            "admin_password_reset": "Admin Password Reset OTP",
            "email-change": "Verify Your New Email Address"
        };

        const subject = subjectMap[purpose] || `${purpose} OTP Code`;

        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${subject}</title>
            <style>
                body {
                    margin: 0;
                    padding: 0;
                    background-color: #0f1117;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                    color: #ffffff;
                }
                .container {
                    max-width: 520px;
                    margin: 40px auto;
                    background: #181b24;
                    border: 1px solid #2d3243;
                    border-radius: 16px;
                    padding: 36px 30px;
                    text-align: center;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                }
                .logo {
                    font-size: 22px;
                    font-weight: 700;
                    letter-spacing: 2px;
                    color: #d4af37;
                    text-transform: uppercase;
                    margin-bottom: 24px;
                }
                .title {
                    font-size: 22px;
                    font-weight: 600;
                    color: #ffffff;
                    margin-bottom: 12px;
                }
                .subtitle {
                    font-size: 14px;
                    color: #9ca3af;
                    line-height: 1.6;
                    margin-bottom: 28px;
                }
                .otp-box {
                    background: linear-gradient(135deg, #1f2430 0%, #151821 100%);
                    border: 1px solid #3b4256;
                    border-radius: 12px;
                    padding: 20px;
                    margin: 20px 0;
                    display: inline-block;
                    letter-spacing: 8px;
                    font-size: 32px;
                    font-weight: 700;
                    color: #d4af37;
                    font-family: 'Courier New', Courier, monospace;
                }
                .expiry-note {
                    font-size: 13px;
                    color: #e5a93c;
                    margin-top: 10px;
                    margin-bottom: 24px;
                }
                .footer {
                    font-size: 12px;
                    color: #6b7280;
                    margin-top: 30px;
                    border-top: 1px solid #262b3a;
                    padding-top: 20px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="logo">LUXURY LIGHTERS</div>
                <div class="title">${subject}</div>
                <p class="subtitle">Hello ${userName},<br>Use the verification code below to complete your <strong>${purpose}</strong> request.</p>
                
                <div class="otp-box">${otpCode}</div>
                
                <p class="expiry-note">⏱️ This code is valid for <strong>5 minutes</strong>. Do not share it with anyone.</p>
                
                <div class="footer">
                    If you did not request this verification code, you can safely ignore this email.<br>
                    &copy; ${new Date().getFullYear()} Luxury Lighters. All rights reserved.
                </div>
            </div>
        </body>
        </html>
        `;

        const mailOptions = {
            from: `"Luxury Lighters" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            text: `Your OTP for ${purpose} is: ${otpCode}. It expires in 5 minutes.`,
            html: htmlContent
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`[EMAIL SENT] OTP delivered to ${to} (Message ID: ${info.messageId})`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error(`[EMAIL ERROR] Failed to send OTP to ${to}:`, error.message);
        return { success: false, error: error.message };
    }
};

module.exports = {
    sendOtpEmail
};
