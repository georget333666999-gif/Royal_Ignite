/**
 * Lightweight in-memory sliding window rate limiter
 * Protects endpoints from brute-force dictionary attacks without external dependencies
 */
const attempts = new Map();

// Periodic cleanup every 10 minutes to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of attempts.entries()) {
        const valid = timestamps.filter((t) => now - t < 15 * 60 * 1000);
        if (valid.length === 0) {
            attempts.delete(key);
        } else {
            attempts.set(key, valid);
        }
    }
}, 10 * 60 * 1000).unref();

export const couponRateLimiter = (maxAttempts = 15, windowMs = 15 * 60 * 1000) => {
    return (req, res, next) => {
        const key = (req.ip || req.socket?.remoteAddress || req.headers["x-forwarded-for"] || "global").toString();
        const now = Date.now();
        const record = attempts.get(key) || [];
        const validAttempts = record.filter((timestamp) => now - timestamp < windowMs);

        if (validAttempts.length >= maxAttempts) {
            return res.status(429).json({
                success: false,
                message: "Too many coupon verification attempts. Please wait 15 minutes before trying again."
            });
        }

        validAttempts.push(now);
        attempts.set(key, validAttempts);
        next();
    };
};

export default { couponRateLimiter };
