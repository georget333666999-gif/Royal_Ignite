/* ========================================
   ROYAL IGNITE - Universal Form Validation & Eye Password Toggle JS
   ======================================== */

const Validation = {
    // Utility regex rules
    rules: {
        name: /^[a-zA-Z\s]{2,50}$/,
        email: /^[a-zA-Z0-9._%+-]+@([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/,
        phone: /^[6-9]\d{9}$/,
        pincode: /^[1-9][0-9]{5}$/,
        city: /^[a-zA-Z\s.'-]{2,50}$/,
        state: /^[a-zA-Z\s.'-]{2,50}$/,
        otp: /^\d{6}$/
    },

    commonDomainTypos: {
        "gmal.com": "gmail.com",
        "gamil.com": "gmail.com",
        "gmial.com": "gmail.com",
        "gmaill.com": "gmail.com",
        "gmai.com": "gmail.com",
        "gml.com": "gmail.com",
        "gmail.co": "gmail.com",
        "gemail.com": "gmail.com",
        "yaho.com": "yahoo.com",
        "yahooo.com": "yahoo.com",
        "yahu.com": "yahoo.com",
        "hotmial.com": "hotmail.com",
        "hotmai.com": "hotmail.com",
        "outlok.com": "outlook.com",
        "outluk.com": "outlook.com",
        "iclud.com": "icloud.com",
        "icld.com": "icloud.com"
    },

    showError(inputElement, message) {
        this.clearError(inputElement);
        inputElement.classList.add("input-error");

        const wrap = inputElement.closest(".password-wrap");
        const errorDiv = document.createElement("div");
        errorDiv.className = "js-error-message";
        errorDiv.style.color = "#f87171";
        errorDiv.style.fontSize = "12px";
        errorDiv.style.marginTop = "5px";
        errorDiv.style.fontWeight = "400";
        errorDiv.innerText = message;

        if (wrap) {
            wrap.parentNode.insertBefore(errorDiv, wrap.nextSibling);
        } else {
            inputElement.parentNode.appendChild(errorDiv);
        }
    },

    clearError(inputElement) {
        inputElement.classList.remove("input-error");
        const wrap = inputElement.closest(".password-wrap");
        const container = wrap ? wrap.parentNode : inputElement.parentNode;
        const existingError = container.querySelector(".js-error-message");
        if (existingError) {
            existingError.remove();
        }
    },

    checkPasswordStrength(val, el) {
        const form = el?.closest("form");
        const isLogin = form?.id?.toLowerCase().includes("login") ||
                        form?.action?.toLowerCase().includes("login");
        if (isLogin) {
            if (!val) return "Password is required.";
            return null;
        }

        if (val.length < 8) return "Password must be at least 8 characters long.";
        if (!/[a-zA-Z]/.test(val)) return "Password must contain at least one letter.";
        if (!/\d/.test(val)) return "Password must contain at least one number.";
        if (/^[^a-zA-Z0-9]+$/.test(val)) return "Password cannot consist only of symbols or underscores.";

        const currentPass = form?.querySelector('#currentPassword')?.value;
        if (currentPass && currentPass.trim() === val.trim()) {
            return "New password must be different from current password.";
        }

        return null;
    },

    validators: {
        name: (val, rules) => {
            const trimmed = val.trim();
            if (trimmed.length < 2 || trimmed.length > 50) return "Name must be between 2 and 50 characters.";
            if (!rules.name.test(trimmed)) return "Name must contain only letters and spaces.";
            return null;
        },
        email: (val, rules, el) => {
            if (!rules.email.test(val)) return "Please enter a valid email address (e.g., name@domain.com).";
            
            const domain = val.split("@")[1]?.toLowerCase();
            if (domain && Validation.commonDomainTypos[domain]) {
                return `Did you mean @${Validation.commonDomainTypos[domain]}? Please check your email domain.`;
            }

            const currentEmail = el?.dataset?.currentEmail;
            if (currentEmail && val.toLowerCase() === currentEmail.trim().toLowerCase()) {
                return "New email must be different from your current email.";
            }
            return null;
        },
        phone: (val, rules) => {
            const clean = val.trim();
            if (!rules.phone.test(clean)) return "Please enter a valid 10-digit mobile number starting with 6-9.";
            if (/^(\d)\1{9}$/.test(clean)) return "Please enter a valid, non-repetitive phone number.";
            return null;
        },
        addressLine: (val) => {
            const clean = val.trim();
            if (clean.length < 5) return "Address must be at least 5 characters long.";
            if (clean.length > 200) return "Address cannot exceed 200 characters.";
            if (!/[a-zA-Z0-9]/.test(clean)) return "Address must contain valid street or house details.";
            return null;
        },
        city: (val, rules) => {
            const clean = val.trim();
            if (clean.length < 2 || clean.length > 50) return "City must be between 2 and 50 characters.";
            if (!rules.city.test(clean)) return "City must contain only letters and spaces.";
            return null;
        },
        state: (val, rules) => {
            const clean = val.trim();
            if (clean.length < 2 || clean.length > 50) return "State must be between 2 and 50 characters.";
            if (!rules.state.test(clean)) return "State must contain only letters and spaces.";
            return null;
        },
        pincode: (val, rules) => {
            const clean = val.trim();
            if (!rules.pincode.test(clean)) return "Pincode must be a valid 6-digit postal code (cannot start with 0).";
            return null;
        },
        addressType: (val) => {
            if (!["Home", "Work", "Other"].includes(val)) return "Please select a valid address type.";
            return null;
        },
        otp: (val, _rules) => {
            const clean = val.trim();
            if (!clean) return "Please enter the 6-digit verification code.";
            if (!/^\d+$/.test(clean)) return "OTP must contain only numbers.";
            if (clean.length < 6) return `OTP must be exactly 6 digits (entered ${clean.length} of 6).`;
            if (clean.length > 6) return "OTP cannot exceed 6 digits.";
            return null;
        },
        currentPassword: (val) => !val ? "Please enter your current password." : null,
        password: (val, rules, el) => Validation.checkPasswordStrength(val, el),
        newPassword: (val, rules, el) => Validation.checkPasswordStrength(val, el),
        confirmPassword: (val, rules, el) => {
            const form = el.closest("form");
            const targetPasswordInput = form 
                ? (form.querySelector('#newPassword') || form.querySelector('#password') || form.querySelector('input[name="newPassword"]') || form.querySelector('input[name="password"]') || form.querySelector('input[data-validate="newPassword"]') || form.querySelector('input[data-validate="password"]'))
                : null;
            return (targetPasswordInput && val !== targetPasswordInput.value.trim()) ? "Passwords do not match." : null;
        }
    },

    getRequiredErrorMessage(inputElement, type) {
        if (type === "name") return "Full name is required.";
        if (type === "phone") return "Phone number is required.";
        if (type === "addressLine") return "Street address is required.";
        if (type === "city") return "City / Town is required.";
        if (type === "state") return "State is required.";
        if (type === "pincode") return "Pincode is required.";
        if (type === "addressType") return "Please select an address type.";
        if (type === "email") return "Email address is required.";
        if (type === "password" || type === "newPassword" || type === "currentPassword") return "Password is required.";
        if (type === "confirmPassword") return "Please confirm your password.";
        if (type === "otp") return "Please enter the 6-digit verification code.";
        return "This field is required.";
    },

    validateInput(inputElement) {
        const type = inputElement.dataset.validate;
        const val = inputElement.value.trim();

        if (inputElement.required && !val) {
            this.showError(inputElement, this.getRequiredErrorMessage(inputElement, type));
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

        const inputs = formElement.querySelectorAll("input[data-validate], select[data-validate], textarea[data-validate]");

        inputs.forEach(input => {
            input.addEventListener("blur", () => this.validateInput(input));
            input.addEventListener("input", () => {
                if (input.dataset.validate === "phone" || input.dataset.validate === "pincode" || input.dataset.validate === "otp") {
                    input.value = input.value.replace(/\D/g, "");
                }
                this.clearError(input);

                if (input.dataset.validate === "otp" && input.value.length === 6) {
                    this.validateInput(input);
                }

                if (input.id === "newPassword" || input.dataset.validate === "password" || input.dataset.validate === "newPassword") {
                    const confirmInput = formElement.querySelector('#confirmPassword') || formElement.querySelector('[data-validate="confirmPassword"]');
                    if (confirmInput && confirmInput.value) {
                        this.validateInput(confirmInput);
                    }
                }
            });

            if (input.dataset.validate === "otp") {
                input.addEventListener("paste", (e) => {
                    e.preventDefault();
                    const pasteData = (e.clipboardData || window.clipboardData).getData("text") || "";
                    const digits = pasteData.replace(/\D/g, "").slice(0, 6);
                    input.value = digits;
                    this.clearError(input);
                    if (digits.length === 6) {
                        this.validateInput(input);
                    }
                });
            }
            if (input.tagName === "SELECT") {
                input.addEventListener("change", () => this.validateInput(input));
            }
        });

        formElement.addEventListener("submit", (e) => {
            let isValid = true;
            let firstInvalid = null;
            inputs.forEach(input => {
                if (!this.validateInput(input)) {
                    isValid = false;
                    if (!firstInvalid) firstInvalid = input;
                }
            });

            if (!isValid) {
                e.preventDefault();
                e.stopPropagation();
                if (firstInvalid) {
                    firstInvalid.focus();
                }
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
                wrapper.style.alignItems = 'center';
                wrapper.style.width = '100%';
                input.parentNode.insertBefore(wrapper, input);
                wrapper.appendChild(input);
            }

            // Create Eye Toggle Button centered vertically at right edge
            const toggleBtn = document.createElement('button');
            toggleBtn.type = 'button';
            toggleBtn.className = 'toggle-password-btn';
            toggleBtn.setAttribute('aria-label', 'Toggle password visibility');
            toggleBtn.style.position = 'absolute';
            toggleBtn.style.right = '14px';
            toggleBtn.style.top = '50%';
            toggleBtn.style.transform = 'translateY(-50%)';
            toggleBtn.style.background = 'transparent';
            toggleBtn.style.border = 'none';
            toggleBtn.style.cursor = 'pointer';
            toggleBtn.style.color = '#8c857b';
            toggleBtn.style.display = 'flex';
            toggleBtn.style.alignItems = 'center';
            toggleBtn.style.justifyContent = 'center';
            toggleBtn.style.width = '24px';
            toggleBtn.style.height = '24px';
            toggleBtn.style.padding = '0';
            toggleBtn.style.margin = '0';
            toggleBtn.style.lineHeight = '0';
            toggleBtn.style.zIndex = '10';
            toggleBtn.innerHTML = this.eyeOpenIcon;

            input.style.paddingRight = '46px';
            wrapper.appendChild(toggleBtn);

            toggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const isPassword = input.type === 'password';
                input.type = isPassword ? 'text' : 'password';
                toggleBtn.innerHTML = isPassword ? this.eyeClosedIcon : this.eyeOpenIcon;
                toggleBtn.style.color = isPassword ? '#d48833' : '#8c857b';
            });
        });
    }
};

// Prevent cached auth or BFCache-restored pages from appearing stale on Back/Forward navigation
window.addEventListener("pageshow", (event) => {
    const navType = window.performance?.getEntriesByType?.("navigation")?.[0]?.type;
    const isBackForward = event.persisted || navType === "back_forward" || window.performance?.navigation?.type === 2;
    const isAuthPath = /\/(login|signup|forgot-password|verify-otp|reset-password)(\/|$)/.test(window.location.pathname);

    if (event.persisted || (isBackForward && isAuthPath)) {
        window.location.reload();
    }
});

document.addEventListener("DOMContentLoaded", () => {
    Validation.initPasswordToggles();
    const forms = document.querySelectorAll("form");
    forms.forEach(form => Validation.attachFormValidation(form));
});
