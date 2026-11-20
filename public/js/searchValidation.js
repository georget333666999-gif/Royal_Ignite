/**
 * Shared client-side search bar validation across storefront and admin pages.
 * Handles empty, whitespace-only, overly long, and invalid-character queries
 * with inline error feedback and automatic whitespace trimming.
 */
(function () {
    const MAX_SEARCH_LENGTH = 100;
    const ALLOWED_PATTERN = /^[a-zA-Z0-9\s\-_@#&'.,/]+$/;
    const HAS_ALPHANUMERIC = /[a-zA-Z0-9]/;

    function injectStyles() {
        if (document.getElementById("ri-search-validation-styles")) return;

        const style = document.createElement("style");
        style.id = "ri-search-validation-styles";
        style.textContent = `
            .ri-search-anchor {
                position: relative !important;
            }
            .ri-search-input-invalid {
                border-color: #ef4444 !important;
                box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.18) !important;
            }
            .ri-search-error-popup {
                position: absolute;
                top: calc(100% + 6px);
                left: 0;
                z-index: 90;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 7px 12px;
                border-radius: 8px;
                font-size: 12px;
                font-weight: 500;
                line-height: 1.35;
                white-space: nowrap;
                max-width: min(360px, 88vw);
                white-space: normal;
                pointer-events: none;
                animation: riSearchErrFade 0.16s ease-out;
                background: #FEF2F2;
                color: #B91C1C;
                border: 1px solid #FECACA;
                box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
            }
            .ri-search-error-popup.is-dark {
                background: #231416;
                color: #FCA5A5;
                border: 1px solid rgba(239, 68, 68, 0.45);
                box-shadow: 0 10px 26px rgba(0, 0, 0, 0.55);
            }
            .ri-search-error-popup svg {
                flex-shrink: 0;
            }
            @keyframes riSearchErrFade {
                from {
                    opacity: 0;
                    transform: translateY(-4px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `;
        document.head.appendChild(style);
    }

    function isDarkSurface(el) {
        if (el.closest("[data-search-theme='dark']")) return true;
        if (el.closest("[data-search-theme='light']")) return false;
        const bg = window.getComputedStyle(document.body).backgroundColor || "";
        const match = bg.match(/\d+/g);
        if (!match || match.length < 3) return false;
        const r = Number(match[0]);
        const g = Number(match[1]);
        const b = Number(match[2]);
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        return luminance < 100;
    }

    function validateSearchValue(rawValue) {
        if (rawValue === "") {
            return { valid: false, message: "Please enter a search keyword." };
        }

        const trimmed = rawValue.trim();
        if (trimmed === "") {
            return { valid: false, message: "Search query cannot contain only spaces." };
        }

        if (trimmed.length > MAX_SEARCH_LENGTH) {
            return {
                valid: false,
                message: `Search query cannot exceed ${MAX_SEARCH_LENGTH} characters.`
            };
        }

        if (!ALLOWED_PATTERN.test(trimmed)) {
            return {
                valid: false,
                message: "Invalid characters detected. Use letters, numbers, or basic punctuation."
            };
        }

        if (!HAS_ALPHANUMERIC.test(trimmed)) {
            return {
                valid: false,
                message: "Please enter a valid search term containing letters or numbers."
            };
        }

        return { valid: true, value: trimmed };
    }

    function getAnchorContainer(input, form) {
        return (
            input.closest(".search-input-wrap") ||
            input.closest(".search-box-wrapper") ||
            input.closest(".search-box-form") ||
            input.closest(".order-search-form") ||
            form
        );
    }

    function clearSearchError(input, anchor) {
        input.classList.remove("ri-search-input-invalid");
        input.removeAttribute("aria-invalid");
        if (anchor) {
            const existing = anchor.querySelector(".ri-search-error-popup");
            if (existing) existing.remove();
        }
    }

    function showSearchError(input, anchor, message) {
        clearSearchError(input, anchor);
        if (!anchor) return;

        anchor.classList.add("ri-search-anchor");
        input.classList.add("ri-search-input-invalid");
        input.setAttribute("aria-invalid", "true");

        const popup = document.createElement("div");
        popup.className = "ri-search-error-popup" + (isDarkSurface(input) ? " is-dark" : "");
        popup.setAttribute("role", "alert");
        popup.setAttribute("aria-live", "polite");
        popup.innerHTML =
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">' +
            '<circle cx="12" cy="12" r="10"></circle>' +
            '<line x1="12" y1="8" x2="12" y2="12"></line>' +
            '<line x1="12" y1="16" x2="12.01" y2="16"></line>' +
            "</svg><span></span>";
        popup.querySelector("span").textContent = message;

        anchor.appendChild(popup);
    }

    function attachValidationToSearchInput(input) {
        const form = input.closest("form");
        if (!form || form.dataset.searchValidationBound === "true") return;

        form.dataset.searchValidationBound = "true";
        if (!input.getAttribute("maxlength")) {
            input.setAttribute("maxlength", String(MAX_SEARCH_LENGTH));
        }

        const anchor = getAnchorContainer(input, form);

        form.addEventListener("submit", function (event) {
            const result = validateSearchValue(input.value);
            if (!result.valid) {
                event.preventDefault();
                showSearchError(input, anchor, result.message);
                input.focus();
                return;
            }

            input.value = result.value;
            clearSearchError(input, anchor);
        });

        input.addEventListener("input", function () {
            clearSearchError(input, anchor);
        });

        input.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                clearSearchError(input, anchor);
            }
        });

        document.addEventListener("click", function (event) {
            if (!form.contains(event.target)) {
                clearSearchError(input, anchor);
            }
        });
    }

    function initSearchValidation() {
        injectStyles();
        const searchInputs = document.querySelectorAll(
            'form input[type="text"][name="search"], form input[type="search"][name="search"]'
        );
        searchInputs.forEach(attachValidationToSearchInput);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initSearchValidation);
    } else {
        initSearchValidation();
    }
})();
