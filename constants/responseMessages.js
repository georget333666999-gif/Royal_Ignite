/**
 * Standard Application Response Messages Enum
 */
export const RESPONSE_MESSAGES = Object.freeze({
    AUTH: Object.freeze({
        LOGIN_SUCCESS: "Welcome back! You have signed in successfully.",
        LOGOUT_SUCCESS: "You have been logged out successfully.",
        SIGNUP_SUCCESS: "Account created successfully! We sent a 6-digit verification code to your email.",
        VERIFIED_SUCCESS: "Account verified successfully! You can now log in.",
        PASSWORD_RESET_SUCCESS: "Password reset successfully! You can now log in with your new password.",
        PASSWORD_CHANGED_SUCCESS: "Your password has been updated successfully.",
        INVALID_CREDENTIALS: "The email or password you entered is incorrect. Please try again.",
        EMAIL_PASSWORD_REQUIRED: "Please enter both your email and password.",
        ACCOUNT_BLOCKED: "Your account is temporarily suspended. Please reach out to customer support for assistance.",
        ACCOUNT_UNVERIFIED: "Please verify your email address to continue.",
        UNVERIFIED_LOGIN: "Your account is not verified yet. We have sent a new verification code to your email.",
        UNVERIFIED_SEND_ERROR: "Unable to send verification code. Please try again in a few moments.",
        UNAUTHORIZED: "Please sign in to continue.",
        SESSION_EXPIRED: "Your session has expired. Please sign in again.",
        USER_ALREADY_EXISTS: "An account with this email address already exists.",
        EMAIL_PHONE_EXISTS: "An account with this email or phone number already exists.",
        EMAIL_IN_USE: "This email address is already in use by another account.",
        NEW_EMAIL_DIFFERENT: "Your new email address must be different from your current one.",
        CURRENT_PASSWORD_INCORRECT: "The current password you entered is incorrect.",
        PASSWORD_MISMATCH: "Passwords do not match. Please verify and try again.",
        GOOGLE_ACCOUNT_REGISTERED: "This account is registered using Google Sign-In. Please sign in with Google.",
        GOOGLE_PASSWORD_CHANGE_DISABLED: "Password change is not available for accounts authenticated with Google Sign-In.",
        GOOGLE_EMAIL_CHANGE_DISABLED: "Email change is not available for accounts registered with Google Sign-In.",
        LOCAL_PASSWORD_NOT_SET: "A password has not been created for this account.",
        NO_ACCOUNT_WITH_EMAIL: "We could not find an account registered with that email address.",
        USER_NOT_FOUND: "Account not found.",
        UNABLE_TO_LOGOUT: "Unable to log out at this moment. Please try again.",
        SIGNUP_PAGE_ERROR: "Error loading signup page. Please try again.",
        LOGIN_PAGE_ERROR: "Error loading login page. Please try again.",
        ADMIN_LOGIN_PAGE_ERROR: "Error rendering admin login page.",
        ADMIN_FORGOT_PASSWORD_ERROR: "Error rendering forgot password page.",
        ADMIN_RESET_SUCCESS: "Password reset successfully."
    }),

    OTP: Object.freeze({
        ENTER_CODE: "Please enter the 6-digit verification code.",
        EXACT_6_DIGITS: "The verification code must be exactly 6 digits.",
        INVALID_CODE: "The verification code you entered is invalid. Please check and try again.",
        EXPIRED: "The verification code has expired. Please click 'Resend Code' to receive a new one.",
        EXPIRED_OR_NOT_FOUND: "Verification code expired or not found. Please click 'Resend Code' for a fresh code.",
        EXPIRED_GET_FRESH: "Your verification code has expired. Please click 'Resend Code' to receive a fresh code.",
        VERIFIED_SUCCESS: "Verification successful.",
        RESEND_SUCCESS: "A fresh verification code has been sent to your email.",
        ADMIN_RESEND_SUCCESS: "A fresh OTP code has been sent to your email.",
        SIGNUP_SESSION_EXPIRED: "Your registration session timed out. Please sign up again.",
        USER_ALREADY_VERIFIED: "Your account is already verified. Please sign in.",
        EMAIL_CHANGE_VERIFIED: "Your email has been updated successfully."
    }),

    PRODUCT: Object.freeze({
        FETCH_SUCCESS: "Products retrieved successfully.",
        NOT_FOUND: "Item not found.",
        UNAVAILABLE: "This item is currently unavailable.",
        CATEGORY_UNAVAILABLE: "This collection is currently unavailable.",
        DOES_NOT_EXIST: "The requested item could not be found.",
        INVALID_ID: "Item not found.",
        UNAVAILABLE_BANNER: "This item is currently unavailable.",
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
        ADDED_SUCCESS: "Item added to your shopping bag.",
        ALREADY_IN_CART: "This item is already in your bag.",
        REMOVED_SUCCESS: "Item removed from your bag.",
        REMOVED_SUCCESS_ATELIER: "Item removed from your bag.",
        QUANTITY_UPDATED: "Quantity updated successfully.",
        EMPTY_CART: "Your bag is currently empty.",
        OUT_OF_STOCK: "The requested quantity is currently out of stock.",
        EXCEEDS_STOCK: "Quantity exceeds available stock.",
        MAX_QUANTITY_EXCEEDED: "You can purchase a maximum of 5 units of this item.",
        AUTH_REQUIRED: "Please sign in to add items to your bag.",
        CHECKOUT_BLOCKED: "Please remove sold-out or unavailable items from your bag to proceed.",
        CHECKOUT_RESERVED: "All items in your bag are ready for checkout."
    }),

    WISHLIST: Object.freeze({
        ADDED_SUCCESS: "Item saved to your wishlist.",
        REMOVED_SUCCESS: "Item removed from your wishlist.",
        ALREADY_IN_WISHLIST: "This item is already saved in your wishlist.",
        NOT_IN_WISHLIST: "Item not found in your wishlist.",
        MOVED_TO_CART: "Item successfully moved to your shopping bag.",
        AUTH_REQUIRED: "Please sign in to manage your wishlist.",
        EMPTY_WISHLIST: "Your wishlist is currently empty."
    }),

    CHECKOUT: Object.freeze({
        ADDRESS_REQUIRED: "Please select or provide a delivery address to complete your checkout.",
        EMPTY_BAG: "Your shopping bag is currently empty.",
        ITEMS_BLOCKED: "Please remove sold-out or unavailable items from your bag before checkout.",
        STOCK_EXCEEDED: "Some items in your bag exceed available stock. Please adjust quantities to proceed.",
        AUTH_REQUIRED: "Please sign in to proceed with checkout.",
        COD_LIMIT_EXCEEDED: "Cash on delivery is not available for orders exceeding ₹50,000."
    }),

    ORDER: Object.freeze({
        PLACED_SUCCESS: "Order placed successfully! We will prepare your items shortly.",
        NOT_FOUND: "Order not found.",
        CANCEL_SUCCESS: "Order cancelled successfully.",
        CANCEL_ITEM_SUCCESS: "Item removed from order successfully.",
        RETURN_REQUESTED: "Return request submitted successfully. We will notify you once approved.",
        RETURN_REASON_REQUIRED: "Please provide a reason to request a return.",
        CANNOT_CANCEL: "This order can no longer be cancelled as it is already being processed or dispatched.",
        CANNOT_RETURN: "This item is not eligible for return at this time.",
        STATUS_UPDATED: "Order fulfillment status updated successfully.",
        INVALID_STATUS: "Invalid order status specified."
    }),

    INVENTORY: Object.freeze({
        STOCK_UPDATED_SUCCESS: "Product inventory stock updated successfully.",
        INVALID_STOCK: "Stock quantity must be a non-negative number.",
        PRODUCT_NOT_FOUND: "Product could not be found."
    }),

    ADDRESS: Object.freeze({
        ADDED_SUCCESS: "Address added successfully!",
        UPDATED_SUCCESS: "Address updated successfully!",
        DELETED_SUCCESS: "Address removed successfully.",
        DEFAULT_UPDATED: "Default delivery address updated successfully.",
        NOT_FOUND: "Address not found.",
        DUPLICATE: "This address already exists in your saved addresses.",
        LIMIT_REACHED: "You can save up to 10 delivery addresses.",
        FETCH_ERROR: "Unable to load saved addresses. Please refresh.",
        PAGE_RENDER_ERROR: "Error opening address form."
    }),

    USER: Object.freeze({
        LOAD_ERROR: "Unable to load user details.",
        NOT_FOUND: "User not found.",
        INVALID_ID: "Invalid user details.",
        BLOCK_ERROR: "Unable to update account status.",
        UNBLOCK_ERROR: "Unable to update account status.",
        PROFILE_UPDATED: "Profile updated successfully.",
        NAME_REQUIRED: "Please enter your name.",
        PHONE_INVALID: "Please enter a valid 10-digit mobile number.",
        FETCH_ERROR: "Unable to load your profile details."
    }),

    COMMON: Object.freeze({
        SUCCESS: "Operation completed successfully.",
        SERVER_ERROR: "Internal Server Error",
        SOMETHING_WENT_WRONG: "Something went wrong. Please try again.",
        UNAUTHORIZED: "Please sign in to continue.",
        FORBIDDEN: "Access denied.",
        NOT_FOUND: "Item not found.",
        BAD_REQUEST: "Invalid request.",
        VALIDATION_ERROR: "Validation error occurred.",
        PAGE_NOT_FOUND: "404 - Page Not Found"
    })
});

export const MESSAGES = RESPONSE_MESSAGES;
export default RESPONSE_MESSAGES;
