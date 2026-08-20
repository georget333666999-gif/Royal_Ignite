/* ========================================
   ROYAL IGNITE - Universal Form Validation JS
   ======================================== */

const Validation = {
    // Utility regex rules
    rules: {
        name: /^[a-zA-Z\s]{2,50}$/,
        email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        phone: /^[6-9]\d{9}$/,
        pincode: /^\d{6}$/,
        otp: /^\d{6}$/
    },

    showError(inputElement, message) {
        this.clearError(inputElement);
        inputElement.classList.add("input-error");

        const errorDiv = document.createElement("div");
        errorDiv.className = "js-error-message";
        errorDiv.style.color = "#E7000B";
        errorDiv.style.fontSize = "12px";
        errorDiv.style.marginTop = "4px";
        errorDiv.style.fontWeight = "500";
        errorDiv.innerText = message;

        inputElement.parentNode.appendChild(errorDiv);
    },

    clearError(inputElement) {
        inputElement.classList.remove("input-error");
        const existingError = inputElement.parentNode.querySelector(".js-error-message");
        if (existingError) {
            existingError.remove();
        }
    },

    validateInput(inputElement) {
        const type = inputElement.dataset.validate;
        const val = inputElement.value.trim();

        if (inputElement.required && !val) {
            this.showError(inputElement, "This field is required.");
            return false;
        }

        if (!val && !inputElement.required) {
            this.clearError(inputElement);
            return true;
        }

        if (type === "name" && !this.rules.name.test(val)) {
            this.showError(inputElement, "Name must contain only letters and be at least 2 characters.");
            return false;
        }

        if (type === "email" && !this.rules.email.test(val)) {
            this.showError(inputElement, "Please enter a valid email address.");
            return false;
        }

        if (type === "phone" && !this.rules.phone.test(val)) {
            this.showError(inputElement, "Please enter a valid 10-digit mobile number.");
            return false;
        }

        if (type === "pincode" && !this.rules.pincode.test(val)) {
            this.showError(inputElement, "Pincode must be exactly 6 digits.");
            return false;
        }

        if (type === "password" && val.length < 8) {
            this.showError(inputElement, "Password must be at least 8 characters long.");
            return false;
        }

        if (type === "confirmPassword") {
            const passwordInput = document.querySelector('input[data-validate="password"]') || document.getElementById('password') || document.getElementById('newPassword');
            if (passwordInput && val !== passwordInput.value.trim()) {
                this.showError(inputElement, "Passwords do not match.");
                return false;
            }
        }

        if (type === "otp" && !this.rules.otp.test(val)) {
            this.showError(inputElement, "OTP must be a valid 6-digit code.");
            return false;
        }

        this.clearError(inputElement);
        return true;
    },

    attachFormValidation(formElement) {
        if (!formElement) return;

        const inputs = formElement.querySelectorAll("input[data-validate], select[data-validate]");

        inputs.forEach(input => {
            input.addEventListener("blur", () => this.validateInput(input));
            input.addEventListener("input", () => this.clearError(input));
        });

        formElement.addEventListener("submit", (e) => {
            let isValid = true;
            inputs.forEach(input => {
                if (!this.validateInput(input)) {
                    isValid = false;
                }
            });

            if (!isValid) {
                e.preventDefault();
                e.stopPropagation();
            }
        });
    }
};

document.addEventListener("DOMContentLoaded", () => {
    const forms = document.querySelectorAll("form");
    forms.forEach(form => Validation.attachFormValidation(form));
});
