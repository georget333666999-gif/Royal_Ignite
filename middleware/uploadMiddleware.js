import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import User from "../models/userModel.js";
import { HTTP_STATUS } from "../constants/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure disk storage for user profile photos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "../public/uploads/profile"));
    },
    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname);
        const filename = `profile-${req.session.userId}-${Date.now()}${extension}`;
        cb(null, filename);
    }
});

// Validate image file formats
const fileFilter = (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Only JPG, PNG and WEBP images are allowed."));
    }
};

export const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 2 * 1024 * 1024 // 2MB limit
    }
});

/**
 * Middleware wrapper to handle profile image uploads with proper error handling
 */
export const handleProfileUpload = (req, res, next) => {
    try {
        upload.single("profileImage")(req, res, async (err) => {
            if (err) {
                let errorMessage = "Failed to upload image.";
                if (err.code === "LIMIT_FILE_SIZE") {
                    errorMessage = "Image size exceeds 2MB limit. Please choose a smaller image.";
                } else if (err.message) {
                    errorMessage = err.message;
                }

                try {
                    const user = await User.findById(req.session.userId).select("-password");
                    return res.status(HTTP_STATUS.BAD_REQUEST).render("editProfile", {
                        user: user || {},
                        error: errorMessage,
                        success: null
                    });
                } catch (error) {
                    return res.status(HTTP_STATUS.BAD_REQUEST).render("editProfile", {
                        user: {},
                        error: errorMessage,
                        success: null
                    });
                }
            }
            next();
        });
    } catch (err) {
        console.error("handleProfileUpload error:", err);
        return next(err);
    }
};

// Configure disk storage for product catalog images
const productStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "../public/uploads/products"));
    },
    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname).toLowerCase() || ".webp";
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `product-${uniqueSuffix}${extension}`);
    }
});

export const productUpload = multer({
    storage: productStorage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit per image
    }
});

export default {
    upload,
    handleProfileUpload,
    productUpload
};