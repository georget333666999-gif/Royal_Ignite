import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("Starting ESM module verification...");

const modules = [
    "./app.js",
    "./controllers/admin/adminController.js",
    "./controllers/admin/userController.js",
    "./controllers/user/addressController.js",
    "./controllers/user/authController.js",
    "./controllers/user/otpController.js",
    "./controllers/user/passwordController.js",
    "./controllers/user/profileController.js",
    "./controllers/user/homeController.js",
    "./controllers/user/wishlistController.js",
    "./controllers/user/checkoutController.js",
    "./controllers/user/orderController.js",
    "./routes/index.js",
    "./routes/user/homeRoutes.js",
    "./routes/user/cartRoutes.js",
    "./routes/user/wishlistRoutes.js",
    "./routes/user/checkoutRoutes.js",
    "./routes/user/orderRoutes.js",
    "./routes/user/productRoutes.js",
    "./routes/user/authRoutes.js",
    "./routes/user/profileRoutes.js",
    "./routes/user/addressRoutes.js",
    "./routes/user/googleAuthRoutes.js",
    "./routes/user/userRoutes.js",
    "./routes/user/index.js",
    "./controllers/admin/orderController.js",
    "./controllers/admin/inventoryController.js",
    "./routes/admin/authRoutes.js",
    "./routes/admin/dashboardRoutes.js",
    "./routes/admin/userRoutes.js",
    "./routes/admin/categoryRoutes.js",
    "./routes/admin/productRoutes.js",
    "./routes/admin/orderRoutes.js",
    "./routes/admin/inventoryRoutes.js",
    "./routes/admin/adminRoutes.js",
    "./routes/admin/index.js",
    "./constants/index.js",
    "./services/admin/adminService.js",
    "./services/admin/userService.js",
    "./services/admin/orderService.js",
    "./services/admin/inventoryService.js",
    "./services/user/addressService.js",
    "./services/user/userService.js",
    "./services/user/wishlistService.js",
    "./services/user/checkoutService.js",
    "./services/user/orderService.js",
    "./models/wishlistModel.js",
    "./models/orderModel.js",
    "./middleware/addressValidationMiddleware.js",
    "./middleware/adminMiddleware.js",
    "./middleware/authValidationMiddleware.js",
    "./middleware/uploadMiddleware.js",
    "./middleware/userMiddleware.js",
    "./models/categoryModel.js",
    "./controllers/admin/categoryController.js",
    "./routes/admin/categoryRoutes.js",
    "./services/admin/categoryService.js",
    "./models/productModel.js",
    "./controllers/admin/productController.js",
    "./routes/admin/productRoutes.js",
    "./services/admin/productService.js",
    "./validators/productValidator.js",
    "./validators/categoryValidator.js",
    "./validators/authValidator.js",
    "./validators/addressValidator.js"
];

let failed = false;

for (const mod of modules) {
    try {
        const fullPath = path.resolve(__dirname, "..", mod);
        await import(pathToFileURL(fullPath).href);
        console.log(`[OK] ${mod}`);
    } catch (err) {
        console.error(`[FAIL] ${mod}:`, err);
        failed = true;
    }
}

if (failed) {
    console.error("Verification failed!");
    process.exit(1);
} else {
    console.log("All ESM modules loaded successfully!");
    process.exit(0);
}
