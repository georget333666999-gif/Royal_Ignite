/**
 * Application Constants
 */
import { RESPONSE_MESSAGES, MESSAGES } from "./responseMessages.js";

export const ROLES = Object.freeze({
    ADMIN: "admin",
    USER: "user"
});

export const SESSION = Object.freeze({
    USER_COOKIE: "user.sid",
    ADMIN_COOKIE: "admin.sid",
    ONE_DAY_MS: 1000 * 60 * 60 * 24
});

export const OTP = Object.freeze({
    EXPIRY_MINUTES: 10,
    RESEND_COOLDOWN_SECONDS: 30,
    PURPOSES: {
        SIGNUP: "signup",
        RESET_PASSWORD: "reset-password",
        EMAIL_CHANGE: "email-change",
        ADMIN_PASSWORD_RESET: "admin_password_reset"
    }
});

export const HTTP_STATUS = Object.freeze({
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NO_CONTENT: 204,
    MOVED_PERMANENTLY: 301,
    FOUND: 302,
    SEE_OTHER: 303,
    NOT_MODIFIED: 304,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    CONFLICT: 409,
    GONE: 410,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    NOT_IMPLEMENTED: 501,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503
});

export const STATUS_CODES = HTTP_STATUS;

export const CART = Object.freeze({
    MAX_QUANTITY_PER_ITEM: 5
});

export { RESPONSE_MESSAGES, MESSAGES };

export default {
    ROLES,
    SESSION,
    OTP,
    HTTP_STATUS,
    STATUS_CODES,
    CART,
    RESPONSE_MESSAGES,
    MESSAGES
};
