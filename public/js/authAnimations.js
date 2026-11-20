/* ==========================================================================
   ROYAL IGNITE — Luxury Auth Page Animations (Login / Signup / Recovery)
   1. Slow-Drifting Golden Embers Canvas
   2. Cursor-Tracking Gold Glass Card Sheen
   3. Tactile Sign-In Loading Spinner & Error Micro-Shake
   ========================================================================== */
(function () {
    "use strict";

    const prefersReducedMotion =
        window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const authWrapper = document.querySelector(".auth-wrapper");
    const goldCard = document.querySelector(".gold-card");

    // ----------------------------------------------------------------------
    // 1. Slow-Drifting Golden Embers Behind the Frosted Glass Card
    // ----------------------------------------------------------------------
    if (authWrapper && !prefersReducedMotion) {
        const canvas = document.createElement("canvas");
        canvas.className = "auth-embers-canvas";
        canvas.setAttribute("aria-hidden", "true");
        authWrapper.insertBefore(canvas, authWrapper.firstChild);

        const ctx = canvas.getContext("2d");
        if (ctx) {
            let width = 0;
            let height = 0;
            let rafId = null;
            let isPaused = false;

            const EMBER_COUNT = window.innerWidth < 640 ? 16 : 28;
            const embers = [];

            const resizeCanvas = () => {
                const dpr = Math.min(window.devicePixelRatio || 1, 2);
                width = authWrapper.clientWidth || window.innerWidth;
                height = authWrapper.clientHeight || window.innerHeight;
                canvas.width = Math.floor(width * dpr);
                canvas.height = Math.floor(height * dpr);
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            };

            const createEmber = (randomY) => ({
                x: Math.random() * width,
                y: randomY ? Math.random() * height : height + Math.random() * 40,
                radius: 0.9 + Math.random() * 1.9,
                speedY: 0.18 + Math.random() * 0.42,
                driftX: (Math.random() - 0.5) * 0.28,
                phase: Math.random() * Math.PI * 2,
                phaseSpeed: 0.012 + Math.random() * 0.018,
                maxAlpha: 0.18 + Math.random() * 0.34,
                hue: 34 + Math.random() * 12
            });

            resizeCanvas();
            for (let i = 0; i < EMBER_COUNT; i++) {
                embers.push(createEmber(true));
            }

            const render = () => {
                if (isPaused) return;
                ctx.clearRect(0, 0, width, height);

                for (let i = 0; i < embers.length; i++) {
                    const p = embers[i];
                    p.y -= p.speedY;
                    p.phase += p.phaseSpeed;
                    p.x += p.driftX + Math.sin(p.phase) * 0.18;

                    // Soft fade near bottom entry & top exit
                    const progress = 1 - p.y / height;
                    let alpha = p.maxAlpha;
                    if (progress < 0.15) alpha *= progress / 0.15;
                    else if (progress > 0.75) alpha *= Math.max(0, (1 - progress) / 0.25);

                    const twinkle = 0.72 + 0.28 * Math.sin(p.phase * 1.7);
                    const finalAlpha = Math.max(0, alpha * twinkle);

                    if (finalAlpha > 0.01) {
                        const glowRadius = p.radius * 3.4;
                        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowRadius);
                        grad.addColorStop(0, `hsla(${p.hue}, 92%, 78%, ${finalAlpha})`);
                        grad.addColorStop(0.45, `hsla(${p.hue}, 82%, 58%, ${finalAlpha * 0.42})`);
                        grad.addColorStop(1, `hsla(${p.hue}, 82%, 50%, 0)`);

                        ctx.fillStyle = grad;
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2);
                        ctx.fill();
                    }

                    if (p.y < -20 || p.x < -30 || p.x > width + 30) {
                        embers[i] = createEmber(false);
                    }
                }

                rafId = window.requestAnimationFrame(render);
            };

            window.addEventListener("resize", resizeCanvas, { passive: true });
            document.addEventListener("visibilitychange", () => {
                isPaused = document.hidden;
                if (!isPaused && !rafId) {
                    rafId = window.requestAnimationFrame(render);
                } else if (isPaused && rafId) {
                    window.cancelAnimationFrame(rafId);
                    rafId = null;
                }
            });

            rafId = window.requestAnimationFrame(render);
        }
    }

    // ----------------------------------------------------------------------
    // 2. Cursor-Tracking Gold Glass Sheen on .gold-card
    // ----------------------------------------------------------------------
    const supportsFinePointer =
        window.matchMedia && window.matchMedia("(pointer: fine)").matches;

    if (goldCard && supportsFinePointer && !prefersReducedMotion) {
        goldCard.addEventListener("mousemove", (e) => {
            const rect = goldCard.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            goldCard.style.setProperty("--mx", `${x.toFixed(1)}%`);
            goldCard.style.setProperty("--my", `${y.toFixed(1)}%`);
        });
    }

    // ----------------------------------------------------------------------
    // 3. Submit Loading Spinner & Validation Error Micro-Shake
    // ----------------------------------------------------------------------
    const triggerCardShake = () => {
        if (!goldCard || prefersReducedMotion) return;
        goldCard.classList.remove("has-error-shake");
        // Force reflow so repeat invalid clicks re-trigger smoothly
        void goldCard.offsetWidth;
        goldCard.classList.add("has-error-shake");
    };

    const form = goldCard ? goldCard.querySelector("form") : null;
    if (form) {
        form.addEventListener("submit", (e) => {
            if (e.defaultPrevented) {
                triggerCardShake();
                return;
            }

            const submitBtn = form.querySelector(".primary-btn[type='submit'], button[type='submit']");
            if (submitBtn && !submitBtn.classList.contains("is-loading")) {
                submitBtn.classList.add("is-loading");
                submitBtn.setAttribute("aria-busy", "true");
            }
        });
    }
})();
