/* ========================================
   ROYAL IGNITE - Universal Form Validation & Eye Password Toggle JS
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

        const targetParent = inputElement.closest(".password-wrap") || inputElement.parentNode;
        const errorDiv = document.createElement("div");
        errorDiv.className = "js-error-message";
        errorDiv.style.color = "#E7000B";
        errorDiv.style.fontSize = "12px";
        errorDiv.style.marginTop = "4px";
        errorDiv.style.fontWeight = "500";
        errorDiv.innerText = message;

        targetParent.appendChild(errorDiv);
    },

    clearError(inputElement) {
        inputElement.classList.remove("input-error");
        const targetParent = inputElement.closest(".password-wrap") || inputElement.parentNode;
        const existingError = targetParent.querySelector(".js-error-message");
        if (existingError) {
            existingError.remove();
        }
    },

    validators: {
        name: (val, rules) => !rules.name.test(val) ? "Name must contain only letters and be at least 2 characters." : null,
        email: (val, rules) => !rules.email.test(val) ? "Please enter a valid email address." : null,
        phone: (val, rules) => !rules.phone.test(val) ? "Please enter a valid 10-digit mobile number." : null,
        pincode: (val, rules) => !rules.pincode.test(val) ? "Pincode must be exactly 6 digits." : null,
        otp: (val, rules) => !rules.otp.test(val) ? "OTP must be a valid 6-digit code." : null,
        currentPassword: (val) => !val ? "Please enter your current password." : null,
        password: (val) => val.length < 8 ? "Password must be at least 8 characters long." : null,
        newPassword: (val) => val.length < 8 ? "Password must be at least 8 characters long." : null,
        confirmPassword: (val, rules, el) => {
            const form = el.closest("form");
            const targetPasswordInput = form 
                ? (form.querySelector('#newPassword') || form.querySelector('#password') || form.querySelector('input[name="newPassword"]') || form.querySelector('input[name="password"]') || form.querySelector('input[data-validate="password"]'))
                : null;
            return (targetPasswordInput && val !== targetPasswordInput.value.trim()) ? "Passwords do not match." : null;
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

        const validator = this.validators[type];
        if (validator) {
            const error = validator(val, this.rules, inputElement);
            if (error) {
                this.showError(inputElement, error);
                return false;
            }
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
    },

    // Eye Icons SVGs
    eyeOpenIcon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
    eyeClosedIcon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`,

    initPasswordToggles() {
        const passwordInputs = document.querySelectorAll('input[type="password"]');

        passwordInputs.forEach(input => {
            if (input.dataset.eyeAttached) return;
            input.dataset.eyeAttached = "true";

            // Ensure parent container is a password-wrap
            let wrapper = input.parentElement;
            if (!wrapper.classList.contains('password-wrap')) {
                wrapper = document.createElement('div');
                wrapper.className = 'password-wrap';
                wrapper.style.position = 'relative';
                wrapper.style.display = 'flex';
                wrapper.style.flexDirection = 'column';
                input.parentNode.insertBefore(wrapper, input);
                wrapper.appendChild(input);
            }

            // Create Eye Toggle Button
            const toggleBtn = document.createElement('button');
            toggleBtn.type = 'button';
            toggleBtn.className = 'toggle-password-btn';
            toggleBtn.setAttribute('aria-label', 'Toggle password visibility');
            toggleBtn.style.position = 'absolute';
            toggleBtn.style.right = '12px';
            toggleBtn.style.top = '12px';
            toggleBtn.style.background = 'none';
            toggleBtn.style.border = 'none';
            toggleBtn.style.cursor = 'pointer';
            toggleBtn.style.color = '#71717A';
            toggleBtn.style.display = 'flex';
            toggleBtn.style.alignItems = 'center';
            toggleBtn.style.justifyContent = 'center';
            toggleBtn.style.zIndex = '10';
            toggleBtn.innerHTML = this.eyeOpenIcon;

            input.style.paddingRight = '42px';
            wrapper.appendChild(toggleBtn);

            toggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const isPassword = input.type === 'password';
                input.type = isPassword ? 'text' : 'password';
                toggleBtn.innerHTML = isPassword ? this.eyeClosedIcon : this.eyeOpenIcon;
                toggleBtn.style.color = isPassword ? '#111111' : '#71717A';
            });
        });
    }
};

document.addEventListener("DOMContentLoaded", () => {
    Validation.initPasswordToggles();
    const forms = document.querySelectorAll("form");
    forms.forEach(form => Validation.attachFormValidation(form));
});
