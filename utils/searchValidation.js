/**
 * Shared server-side search query validation and regex escaping utilities
 */

export const MAX_SEARCH_LENGTH = 100;

const ALLOWED_SEARCH_PATTERN = /^[a-zA-Z0-9\s\-_@#&'.,/]+$/;
const HAS_ALPHANUMERIC = /[a-zA-Z0-9]/;

/**
 * Escapes special RegExp characters to prevent MongoDB $regex crashes and ReDoS
 * @param {string} [value=""]
 * @returns {string}
 */
export const escapeRegex = (value = "") => {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

/**
 * Validates and normalizes an incoming search query string.
 * Empty or whitespace-only queries normalize to an empty string without error
 * so direct listing URLs remain accessible, while malformed inputs return an error.
 *
 * @param {unknown} rawSearch
 * @returns {{ isValid: boolean, value: string, error: string | null }}
 */
export const sanitizeSearchQuery = (rawSearch) => {
    if (rawSearch === undefined || rawSearch === null) {
        return { isValid: true, value: "", error: null };
    }

    if (typeof rawSearch !== "string") {
        return { isValid: false, value: "", error: "Invalid search query format." };
    }

    const trimmed = rawSearch.trim();

    if (trimmed === "") {
        return { isValid: true, value: "", error: null };
    }

    if (trimmed.length > MAX_SEARCH_LENGTH) {
        return {
            isValid: false,
            value: "",
            error: `Search query cannot exceed ${MAX_SEARCH_LENGTH} characters.`
        };
    }

    if (!ALLOWED_SEARCH_PATTERN.test(trimmed)) {
        return {
            isValid: false,
            value: "",
            error: "Search contains invalid characters. Use letters, numbers, or basic punctuation."
        };
    }

    if (!HAS_ALPHANUMERIC.test(trimmed)) {
        return {
            isValid: false,
            value: "",
            error: "Please enter a valid search term containing letters or numbers."
        };
    }

    return { isValid: true, value: trimmed, error: null };
};

export default {
    MAX_SEARCH_LENGTH,
    escapeRegex,
    sanitizeSearchQuery
};
