import mongoose from "mongoose";

/**
 * Validate product input fields and image requirements
 */
export const validateProductInput = ({
    name,
    description,
    category,
    regularPrice,
    salePrice,
    stock,
    images = []
} = {}) => {
    try {
        const errors = [];

        // Title validation
        if (!name || typeof name !== "string" || name.trim().length === 0) {
            errors.push("Product title is required.");
        } else {
            const trimmed = name.trim();
            if (trimmed.length < 2) {
                errors.push("Product title must be at least 2 characters long.");
            } else if (trimmed.length > 120) {
                errors.push("Product title cannot exceed 120 characters.");
            }
        }

        // Description validation
        if (!description || typeof description !== "string" || description.trim().length === 0) {
            errors.push("Product description is required.");
        } else {
            const trimmedDesc = description.trim();
            if (trimmedDesc.length < 10) {
                errors.push("Product description should be at least 10 characters long.");
            } else if (trimmedDesc.length > 3000) {
                errors.push("Product description cannot exceed 3000 characters.");
            }
        }

        // Category validation
        if (!category || !mongoose.Types.ObjectId.isValid(category)) {
            errors.push("A valid product category must be selected.");
        }

        // Regular price validation
        const regPriceNum = Number(regularPrice);
        if (isNaN(regPriceNum) || regPriceNum <= 0) {
            errors.push("Regular price must be a valid number greater than 0.");
        }

        // Sale price validation
        if (salePrice !== undefined && salePrice !== null && salePrice !== "") {
            const salePriceNum = Number(salePrice);
            if (isNaN(salePriceNum) || salePriceNum < 0) {
                errors.push("Sale price must be a valid non-negative number.");
            } else if (salePriceNum > regPriceNum) {
                errors.push("Sale price cannot be greater than the regular price.");
            }
        }

        // Stock validation
        const stockNum = Number(stock);
        if (isNaN(stockNum) || stockNum < 0 || !Number.isInteger(stockNum)) {
            errors.push("Stock must be a valid whole number (0 or greater).");
        }

        // Images count validation (Requirement: minimum 3 images)
        if (!Array.isArray(images) || images.length < 3) {
            errors.push("A minimum of 3 product images are required.");
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    } catch (error) {
        console.error("validateProductInput error:", error);
        return {
            isValid: false,
            errors: ["Invalid product input format."]
        };
    }
};

export default {
    validateProductInput
};
