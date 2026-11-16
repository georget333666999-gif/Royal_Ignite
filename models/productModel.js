import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Product title is required"],
            trim: true,
            minlength: [2, "Product title must be at least 2 characters"],
            maxlength: [120, "Product title cannot exceed 120 characters"]
        },
        description: {
            type: String,
            required: [true, "Product description is required"],
            trim: true,
            maxlength: [3000, "Description cannot exceed 3000 characters"]
        },
        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
            required: [true, "Product category is required"]
        },
        regularPrice: {
            type: Number,
            required: [true, "Regular price is required"],
            min: [0, "Regular price must be greater than or equal to 0"]
        },
        salePrice: {
            type: Number,
            default: null,
            min: [0, "Sale price must be greater than or equal to 0"]
        },
        baseSalePrice: {
            type: Number,
            default: null,
            min: [0, "Base sale price must be greater than or equal to 0"]
        },
        appliedOffer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Offer",
            default: null
        },
        stock: {
            type: Number,
            required: [true, "Stock quantity is required"],
            min: [0, "Stock cannot be negative"],
            default: 0
        },
        images: {
            type: [String],
            required: [true, "Product images are required"],
            validate: {
                validator: function (val) {
                    return Array.isArray(val) && val.length >= 1;
                },
                message: "At least one product image is required."
            }
        },
        isListed: {
            type: Boolean,
            default: true
        },
        isDeleted: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
);

// Indexes for fast queries, category filtering, and descending sort
productSchema.index({ createdAt: -1 });
productSchema.index({ category: 1, isDeleted: 1 });
productSchema.index({ isDeleted: 1, isListed: 1 });
productSchema.index({ name: "text", description: "text" });

const Product = mongoose.model("Product", productSchema);
export default Product;
