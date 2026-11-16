import Razorpay from "razorpay";
import crypto from "crypto";

const getRazorpayKeyId = () => process.env.RAZORPAY_KEY_ID || "rzp_test_1DP5mmOlF5G5ag";
const getRazorpayKeySecret = () => process.env.RAZORPAY_KEY_SECRET || "rzp_secret_demo_token";

export const getRazorpayClient = () => {
    return new Razorpay({
        key_id: getRazorpayKeyId(),
        key_secret: getRazorpayKeySecret()
    });
};

export const verifyRazorpaySignature = (razorpayOrderId, razorpayPaymentId, razorpaySignature) => {
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        return false;
    }
    const secret = getRazorpayKeySecret();
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(`${razorpayOrderId}|${razorpayPaymentId}`);
    const generatedSignature = hmac.digest("hex");
    return generatedSignature === razorpaySignature;
};

export { getRazorpayKeyId, getRazorpayKeySecret };
export default getRazorpayClient;
