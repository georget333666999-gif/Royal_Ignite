const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({

    destination: (req, file, cb) => {

        cb(
            null,
            path.join(
                __dirname,
                "../public/uploads/profile"
            )
        );

    },

    filename: (req, file, cb) => {

        const extension =
            path.extname(file.originalname);

        const filename =
            `profile-${req.session.userId}-${Date.now()}${extension}`;

        cb(null, filename);

    }

});

const fileFilter = (req, file, cb) => {

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (allowedTypes.includes(file.mimetype)) {

        cb(null, true);

    } else {

        cb(
            new Error(
                "Only JPG, PNG and WEBP images are allowed."
            )
        );

    }

};

const User = require("../models/userModel");

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 2 * 1024 * 1024
    }
});

const handleProfileUpload = (req, res, next) => {
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
                return res.status(400).render("editProfile", {
                    user: user || {},
                    error: errorMessage,
                    success: null
                });
            } catch (error) {
                return res.status(400).render("editProfile", {
                    user: {},
                    error: errorMessage,
                    success: null
                });
            }
        }
        next();
    });
};

module.exports = {
    upload,
    handleProfileUpload
};