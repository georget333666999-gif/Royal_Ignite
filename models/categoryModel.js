import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Category name is required"],
            trim: true,
            minlength: [2, "Category name must be at least 2 characters"],
            maxlength: [50, "Category name cannot exceed 50 characters"]
        },
        description: {
            type: String,
            trim: true,
            maxlength: [500, "Description cannot exceed 500 characters"],
            default: ""
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

// Indexes for fast search and descending sort
categorySchema.index({ createdAt: -1 });
categorySchema.index({ isDeleted: 1, isListed: 1 });
categorySchema.index({ name: 1 });

const Category = mongoose.model("Category", categorySchema);
export default Category;
