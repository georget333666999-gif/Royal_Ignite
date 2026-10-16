/**
 * Standard Application Response Messages Enum
 */
export const RESPONSE_MESSAGES = Object.freeze({
    AUTH: Object.freeze({
        LOGIN_SUCCESS: "Logged in successfully.",
        LOGOUT_SUCCESS: "Logged out successfully.",
        SIGNUP_SUCCESS: "Account created successfully! A 6-digit verification code has been sent to your email.",
        VERIFIED_SUCCESS: "Account verified successfully! You can now log in.",
        PASSWORD_RESET_SUCCESS: "Password reset successfully! You can now log in with your new password.",
        PASSWORD_CHANGED_SUCCESS: "Password changed successfully.",
        INVALID_CREDENTIALS: "Invalid email or password.",
        EMAIL_PASSWORD_REQUIRED: "Email and password are required.",
        ACCOUNT_BLOCKED: "Your account has been blocked.",
        ACCOUNT_UNVERIFIED: "Please verify your account first.",
        UNVERIFIED_LOGIN: "Your account is not verified yet. A fresh verification code has been sent to your email.",
        UNVERIFIED_SEND_ERROR: "Unable to send verification code. Please try again.",
        UNAUTHORIZED: "Please sign in to continue.",
        SESSION_EXPIRED: "Your session has expired. Please sign in again.",
        USER_ALREADY_EXISTS: "User already exists.",
        EMAIL_PHONE_EXISTS: "Email or phone number already exists.",
        EMAIL_IN_USE: "This email address is already in use.",
        NEW_EMAIL_DIFFERENT: "New email must be different from current email.",
        CURRENT_PASSWORD_INCORRECT: "Current password is incorrect.",
        PASSWORD_MISMATCH: "Passwords do not match.",
        GOOGLE_ACCOUNT_REGISTERED: "This account is registered with Google Sign-In. Please sign in directly using Google.",
        GOOGLE_PASSWORD_CHANGE_DISABLED: "Password change is disabled for accounts authenticated with Google Sign-In.",
        GOOGLE_EMAIL_CHANGE_DISABLED: "Email change is disabled for accounts registered with Google Sign-In.",
        LOCAL_PASSWORD_NOT_SET: "This account does not have a local password set.",
        NO_ACCOUNT_WITH_EMAIL: "No account found with this email.",
        USER_NOT_FOUND: "User not found.",
        UNABLE_TO_LOGOUT: "Unable to logout.",
        SIGNUP_PAGE_ERROR: "Error rendering signup page.",
        LOGIN_PAGE_ERROR: "Error rendering login page.",
        ADMIN_LOGIN_PAGE_ERROR: "Error rendering admin login page.",
        ADMIN_FORGOT_PASSWORD_ERROR: "Error rendering forgot password page.",
        ADMIN_RESET_SUCCESS: "Password reset successfully."
    }),

    OTP: Object.freeze({
        ENTER_CODE: "Please enter the 6-digit OTP code.",
        EXACT_6_DIGITS: "OTP must be exactly 6 digits.",
        INVALID_CODE: "Invalid OTP code. Please check and try again.",
        EXPIRED: "OTP has expired. Please click 'Resend Code' to get a new code.",
        EXPIRED_OR_NOT_FOUND: "OTP expired or not found. Please click 'Resend Code'.",
        EXPIRED_GET_FRESH: "Your OTP has expired. Please click 'Resend Code' to get a fresh code.",
        VERIFIED_SUCCESS: "Verification successful.",
        RESEND_SUCCESS: "A new verification code has been dispatched to your email.",
        ADMIN_RESEND_SUCCESS: "A fresh OTP code has been sent to your email.",
        SIGNUP_SESSION_EXPIRED: "Signup session expired. Please sign up again.",
        USER_ALREADY_VERIFIED: "User is already verified.",
        EMAIL_CHANGE_VERIFIED: "Email changed successfully."
    }),

    PRODUCT: Object.freeze({
        FETCH_SUCCESS: "Products retrieved successfully.",
        NOT_FOUND: "Product not found.",
        UNAVAILABLE: "Product is no longer listed or has been removed.",
        CATEGORY_UNAVAILABLE: "Product category is no longer listed or has been removed.",
        DOES_NOT_EXIST: "Product does not exist.",
        INVALID_ID: "Invalid product identifier.",
        UNAVAILABLE_BANNER: "This masterpiece is currently unavailable or has been unlisted.",
        CREATED_SUCCESS: "Product added successfully.",
        UPDATED_SUCCESS: "Product updated successfully.",
        DELETED_SUCCESS: "Product moved to deleted items.",
        RESTORED_SUCCESS: "Product restored successfully.",
        LOAD_ERROR: "Unable to load products.",
        FORM_ERROR: "Failed to open product form.",
        EDIT_FORM_ERROR: "Failed to open product edit page.",
        MIN_IMAGES_REQUIRED: "A minimum of 3 product images are required."
    }),

    CATEGORY: Object.freeze({
        FETCH_SUCCESS: "Categories retrieved successfully.",
        NOT_FOUND: "Category not found.",
        ALREADY_EXISTS: "A category with this name already exists.",
        CREATED_SUCCESS: "Category added successfully.",
        UPDATED_SUCCESS: "Category updated successfully.",
        DELETED_SUCCESS: "Category moved to deleted categories.",
        RESTORED_SUCCESS: "Category restored successfully.",
        LOAD_ERROR: "Unable to load categories."
    }),

    CART: Object.freeze({
        ADDED_SUCCESS: "Creation added to your atelier bag successfully.",
        ALREADY_IN_CART: "Already added to cart",
        REMOVED_SUCCESS: "Item removed from your bag.",
        REMOVED_SUCCESS_ATELIER: "Item removed from your atelier bag.",
        QUANTITY_UPDATED: "Quantity updated successfully.",
        EMPTY_CART: "Your bag is currently empty.",
        OUT_OF_STOCK: "Selected quantity exceeds available inventory.",
        EXCEEDS_STOCK: "Item cannot exceed available stock.",
        MAX_QUANTITY_EXCEEDED: "Selected quantity exceeds the limit of 5 pieces per order.",
        AUTH_REQUIRED: "Please sign in to acquire pieces for your bag.",
        CHECKOUT_BLOCKED: "Please resolve out-of-stock or unavailable items before proceeding to checkout.",
        CHECKOUT_RESERVED: "All pieces are in stock and reserved for checkout."
    }),

    WISHLIST: Object.freeze({
        ADDED_SUCCESS: "Piece added to your wishlist.",
        REMOVED_SUCCESS: "Piece removed from your wishlist.",
        ALREADY_IN_WISHLIST: "Piece is already saved in your wishlist.",
        NOT_IN_WISHLIST: "Piece not found in your wishlist.",
        MOVED_TO_CART: "Piece successfully moved to your shopping bag.",
        AUTH_REQUIRED: "Please sign in to manage your wishlist.",
        EMPTY_WISHLIST: "Your wishlist vault is currently empty."
    }),

    CHECKOUT: Object.freeze({
        ADDRESS_REQUIRED: "Please select or provide a delivery address to complete your checkout.",
        EMPTY_BAG: "Your atelier bag is currently empty.",
        ITEMS_BLOCKED: "Please resolve unavailable or out-of-stock creations before completing checkout.",
        STOCK_EXCEEDED: "Selected quantity exceeds currently available inventory in the atelier.",
        AUTH_REQUIRED: "Please sign in to proceed with checkout.",
        COD_LIMIT_EXCEEDED: "Cash on delivery is not applicable for orders exceeding ₹50,000."
    }),

    ORDER: Object.freeze({
        PLACED_SUCCESS: "Order placed successfully! Your atelier piece has been reserved.",
        NOT_FOUND: "Order could not be located in our archives.",
        CANCEL_SUCCESS: "Order cancelled successfully.",
        CANCEL_ITEM_SUCCESS: "Piece removed and order adjusted successfully.",
        RETURN_REQUESTED: "Return requested successfully. Atelier verification pending.",
        RETURN_REASON_REQUIRED: "A reason is mandatory to request a return.",
        CANNOT_CANCEL: "This order has already progressed beyond the cancellation stage.",
        CANNOT_RETURN: "This creation cannot be returned at this stage.",
        STATUS_UPDATED: "Order fulfillment status updated successfully.",
        INVALID_STATUS: "Invalid order status specified."
    }),

    INVENTORY: Object.freeze({
        STOCK_UPDATED_SUCCESS: "Product inventory stock updated successfully.",
        INVALID_STOCK: "Stock quantity must be a non-negative number.",
        PRODUCT_NOT_FOUND: "Product could not be found in the inventory vault."
    }),

    ADDRESS: Object.freeze({
        ADDED_SUCCESS: "Address added successfully!",
        UPDATED_SUCCESS: "Address updated successfully!",
        DELETED_SUCCESS: "Address deleted successfully.",
        DEFAULT_UPDATED: "Default address updated successfully.",
        NOT_FOUND: "Address not found.",
        LIMIT_REACHED: "You can add a maximum of 10 addresses.",
        FETCH_ERROR: "Unable to load addresses.",
        PAGE_RENDER_ERROR: "Error rendering add address page."
    }),

    USER: Object.freeze({
        LOAD_ERROR: "Unable to load users.",
        NOT_FOUND: "User not found.",
        INVALID_ID: "Invalid user ID.",
        BLOCK_ERROR: "Unable to block user.",
        UNBLOCK_ERROR: "Unable to unblock user.",
        PROFILE_UPDATED: "Profile updated successfully.",
        NAME_REQUIRED: "Name is required.",
        PHONE_INVALID: "Please enter a valid 10-digit mobile number.",
        FETCH_ERROR: "Unable to load profile data."
    }),

    COMMON: Object.freeze({
        SUCCESS: "Operation completed successfully.",
        SERVER_ERROR: "Internal Server Error",
        SOMETHING_WENT_WRONG: "Something went wrong. Please try again.",
        UNAUTHORIZED: "Authentication required.",
        FORBIDDEN: "Access denied.",
        NOT_FOUND: "Not found.",
        BAD_REQUEST: "Invalid request.",
        VALIDATION_ERROR: "Validation error occurred.",
        PAGE_NOT_FOUND: "404 - Page Not Found"
    })
});

export const MESSAGES = RESPONSE_MESSAGES;
export default RESPONSE_MESSAGES;
