/**
 * Category input validation helper
 */
export const validateCategoryInput = ({ name, description = "" } = {}) => {
    try {
        const errors = [];

        if (!name || typeof name !== "string" || name.trim().length === 0) {
            errors.push("Category name is required.");
        } else {
            const trimmed = name.trim();
            if (trimmed.length < 2) {
                errors.push("Category name must be at least 2 characters long.");
            } else if (trimmed.length > 50) {
                errors.push("Category name cannot exceed 50 characters.");
            } else if (!/[a-zA-Z]/.test(trimmed)) {
                errors.push("Category name must contain at least one letter.");
            } else if (!/^[a-zA-Z0-9\s&/\-_',.]+$/.test(trimmed)) {
                errors.push("Category name contains invalid special characters.");
            }
        }

        if (description && typeof description === "string" && description.trim().length > 500) {
            errors.push("Description cannot exceed 500 characters.");
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    } catch (error) {
        console.error("validateCategoryInput error:", error);
        return {
            isValid: false,
            errors: ["Invalid category input format."]
        };
    }
};

export default {
    validateCategoryInput
};
