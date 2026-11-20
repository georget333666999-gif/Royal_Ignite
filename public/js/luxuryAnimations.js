/* ==========================================================================
   ROYAL IGNITE — Luxury Scroll Reveal & Subtle Motion Orchestrator
   Lightweight, GPU-Accelerated, Zero Dependencies
   ========================================================================== */
(function () {
    "use strict";

    const prefersReducedMotion =
        window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // 1. Scroll-Aware Frosted Header Elevation
    const header = document.querySelector(
        ".royal-header, .fuel-header, .gas-header, .elec-header, .care-header"
    );

    if (header) {
        let ticking = false;
        const updateHeaderState = () => {
            if (window.scrollY > 18) {
                header.classList.add("is-scrolled");
            } else {
                header.classList.remove("is-scrolled");
            }
            ticking = false;
        };

        window.addEventListener(
            "scroll",
            () => {
                if (!ticking) {
                    window.requestAnimationFrame(updateHeaderState);
                    ticking = true;
                }
            },
            { passive: true }
        );
        updateHeaderState();
    }

    if (prefersReducedMotion) {
        return;
    }

    // 2. Smooth Staggered Scroll Reveals via IntersectionObserver
    const revealSelectors = [
        ".fuel-section-header",
        ".gas-section-header",
        ".elec-section-header",
        ".care-section-header",
        ".fuel-card",
        ".gas-card",
        ".elec-card",
        ".care-card",
        ".product-card",
        ".feature-card",
        ".collection-row",
        ".fuel-anatomy-item",
        ".gas-anatomy-item",
        ".elec-anatomy-item",
        ".care-anatomy-item",
        ".fuel-spec-card",
        ".gas-spec-card",
        ".elec-spec-card",
        ".care-spec-card",
        ".fuel-ritual-card",
        ".gas-ritual-card",
        ".elec-ritual-card",
        ".care-ritual-card",
        ".wishlist-card",
        ".cart-item-card",
        ".cart-summary-card",
        ".checkout-section-card",
        ".checkout-summary-card",
        ".order-card",
        ".newsletter-grid"
    ];

    const revealElements = Array.from(document.querySelectorAll(revealSelectors.join(",")));

    if (revealElements.length > 0 && "IntersectionObserver" in window) {
        // Assign subtle column-based stagger delays within grids
        const gridGroups = new Map();
        revealElements.forEach((el) => {
            const parent = el.parentElement;
            if (!parent) return;
            const idx = gridGroups.get(parent) || 0;
            gridGroups.set(parent, idx + 1);
            const staggerDelay = Math.min((idx % 3) * 80, 200);
            el.style.transitionDelay = `${staggerDelay}ms`;
            el.classList.add("ri-reveal");
        });

        const observer = new IntersectionObserver(
            (entries, obs) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const target = entry.target;
                        target.classList.add("is-visible");
                        // Clear transition-delay after reveal so hover transitions stay instant
                        window.setTimeout(() => {
                            target.style.transitionDelay = "0ms";
                        }, 850);
                        obs.unobserve(target);
                    }
                });
            },
            {
                rootMargin: "0px 0px -45px 0px",
                threshold: 0.08
            }
        );

        revealElements.forEach((el) => observer.observe(el));
    }

    // 3. Subtle Magnetic Micro-Parallax on Primary Luxury Buttons (Desktop Pointer Only)
    const supportsFinePointer =
        window.matchMedia && window.matchMedia("(pointer: fine)").matches;

    if (supportsFinePointer) {
        const magneticButtons = document.querySelectorAll(
            ".btn-gold, .fuel-acquire-btn, .gas-acquire-btn, .elec-acquire-btn, .care-acquire-btn, .dt-btn-add-cart, .btn-checkout, .btn-place-order"
        );

        magneticButtons.forEach((btn) => {
            btn.addEventListener("mousemove", (e) => {
                const rect = btn.getBoundingClientRect();
                const relX = (e.clientX - rect.left) / rect.width - 0.5;
                const relY = (e.clientY - rect.top) / rect.height - 0.5;
                const moveX = relX * 5;
                const moveY = relY * 4 - 2.5;
                btn.style.transform = `translate3d(${moveX.toFixed(1)}px, ${moveY.toFixed(1)}px, 0)`;
            });

            btn.addEventListener("mouseleave", () => {
                btn.style.transform = "";
            });
        });
    }
})();
