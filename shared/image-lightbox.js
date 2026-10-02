// Based on grade6/115-1/week01.html; no auth or progress dependencies.
export function initImageLightbox() {
    if (document.getElementById('lightbox')) return;
    document.body.insertAdjacentHTML('beforeend', `<div id="lightbox" class="image-lightbox hidden" role="dialog" aria-modal="true" aria-label="圖片放大檢視">
        <div class="image-lightbox-panel">
            <div class="image-lightbox-controls" aria-label="圖片縮放控制">
                <button id="lightbox-zoom-out" type="button" aria-label="縮小圖片">-</button>
                <span id="lightbox-scale" class="image-lightbox-scale">100%</span>
                <button id="lightbox-zoom-in" type="button" aria-label="放大圖片">+</button>
                <button id="lightbox-reset" type="button" aria-label="重設圖片縮放">重設</button>
                <button id="lightbox-center" type="button" aria-label="置中圖片">置中</button>
                <button id="lightbox-close" type="button" aria-label="關閉圖片燈箱">關閉</button>
            </div>
            <div id="lightbox-stage" class="image-lightbox-stage">
                <img id="lightbox-img" alt="圖卡放大" class="image-lightbox-img" draggable="false">
            </div>
            <p class="image-lightbox-hint">滾輪縮放・拖曳平移・雙擊放大・手機雙指縮放</p>
        </div>
    </div>`);
        const lightboxEl = document.getElementById("lightbox");
        const lightboxStage = document.getElementById("lightbox-stage");
        const lightboxImage = document.getElementById("lightbox-img");
        const lightboxScale = document.getElementById("lightbox-scale");
        const lightboxClose = document.getElementById("lightbox-close");
        const lightboxZoomOut = document.getElementById("lightbox-zoom-out");
        const lightboxZoomIn = document.getElementById("lightbox-zoom-in");
        const lightboxReset = document.getElementById("lightbox-reset");
        const lightboxCenter = document.getElementById("lightbox-center");
        let previousFocus = null;
        const lightboxPointers = new Map();
        const lightboxState = {
            scale: 1,
            x: 0,
            y: 0,
            dragging: false,
            lastX: 0,
            lastY: 0,
            initialPinchDistance: 0,
            initialPinchScale: 1,
            previousOverflow: ""
        };

        function applyLightboxTransform() {
            lightboxImage.style.transform = `translate(${lightboxState.x}px, ${lightboxState.y}px) scale(${lightboxState.scale})`;
            lightboxScale.textContent = `${Math.round(lightboxState.scale * 100)}%`;
            lightboxStage.classList.toggle("is-zoomed", lightboxState.scale > 1);
        }

        function setLightboxScale(nextScale) {
            lightboxState.scale = Math.max(1, Math.min(5, nextScale));
            if (lightboxState.scale <= 1) {
                lightboxState.x = 0;
                lightboxState.y = 0;
            }
            applyLightboxTransform();
        }

        function zoomLightboxBy(delta) {
            setLightboxScale(lightboxState.scale + delta);
        }

        function resetLightboxTransform() {
            lightboxState.scale = 1;
            lightboxState.x = 0;
            lightboxState.y = 0;
            applyLightboxTransform();
        }

        function getPointerDistance() {
            const pointers = Array.from(lightboxPointers.values());
            if (pointers.length < 2) return 0;
            return Math.hypot(pointers[0].x - pointers[1].x, pointers[0].y - pointers[1].y);
        }

        const openLightbox = function(src, altText = "圖卡放大") {
            previousFocus = document.activeElement;
            lightboxImage.src = src;
            lightboxImage.alt = altText;
            lightboxEl.setAttribute("aria-label", altText);
            lightboxState.previousOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";
            resetLightboxTransform();
            lightboxEl.classList.remove("hidden");
            lightboxClose.focus();
        };

        const closeLightbox = function() {
            lightboxEl.classList.add("hidden");
            lightboxImage.removeAttribute("src");
            previousFocus?.focus();
            lightboxPointers.clear();
            document.body.style.overflow = lightboxState.previousOverflow || "";
            lightboxState.previousOverflow = "";
            resetLightboxTransform();
        };

        lightboxEl.addEventListener("mousedown", (event) => {
            if (event.target === lightboxEl) closeLightbox();
        });

        [lightboxClose, lightboxZoomOut, lightboxZoomIn, lightboxReset, lightboxCenter].forEach((button) => {
            button.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
            });
        });
        lightboxClose.addEventListener("click", closeLightbox);
        lightboxZoomOut.addEventListener("click", () => zoomLightboxBy(-0.35));
        lightboxZoomIn.addEventListener("click", () => zoomLightboxBy(0.35));
        lightboxReset.addEventListener("click", resetLightboxTransform);
        lightboxCenter.addEventListener("click", () => {
            lightboxState.x = 0;
            lightboxState.y = 0;
            applyLightboxTransform();
        });

        lightboxStage.addEventListener("wheel", (event) => {
            if (lightboxEl.classList.contains("hidden")) return;
            event.preventDefault();
            zoomLightboxBy(event.deltaY > 0 ? -0.18 : 0.18);
        }, { passive: false });

        lightboxStage.addEventListener("dblclick", (event) => {
            event.preventDefault();
            if (lightboxState.scale > 1.05) {
                resetLightboxTransform();
            } else {
                setLightboxScale(2.2);
            }
        });

        lightboxStage.addEventListener("pointerdown", (event) => {
            if (lightboxEl.classList.contains("hidden")) return;
            lightboxStage.setPointerCapture?.(event.pointerId);
            lightboxPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

            if (lightboxPointers.size === 1) {
                lightboxState.dragging = true;
                lightboxState.lastX = event.clientX;
                lightboxState.lastY = event.clientY;
            } else if (lightboxPointers.size === 2) {
                lightboxState.dragging = false;
                lightboxState.initialPinchDistance = getPointerDistance();
                lightboxState.initialPinchScale = lightboxState.scale;
            }
        });

        lightboxStage.addEventListener("pointermove", (event) => {
            if (!lightboxPointers.has(event.pointerId)) return;
            event.preventDefault();
            lightboxPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

            if (lightboxPointers.size === 2) {
                const distance = getPointerDistance();
                if (lightboxState.initialPinchDistance > 0) {
                    setLightboxScale(lightboxState.initialPinchScale * distance / lightboxState.initialPinchDistance);
                }
                return;
            }

            if (!lightboxState.dragging || lightboxState.scale <= 1) return;
            lightboxState.x += event.clientX - lightboxState.lastX;
            lightboxState.y += event.clientY - lightboxState.lastY;
            lightboxState.lastX = event.clientX;
            lightboxState.lastY = event.clientY;
            applyLightboxTransform();
        });

        function endLightboxPointer(event) {
            lightboxPointers.delete(event.pointerId);
            if (lightboxPointers.size === 0) {
                lightboxState.dragging = false;
            } else if (lightboxPointers.size === 1) {
                const pointer = Array.from(lightboxPointers.values())[0];
                lightboxState.dragging = true;
                lightboxState.lastX = pointer.x;
                lightboxState.lastY = pointer.y;
            }
        }

        lightboxStage.addEventListener("pointerup", endLightboxPointer);
        lightboxStage.addEventListener("pointercancel", endLightboxPointer);

        document.addEventListener("keydown", (event) => {
            if (!lightboxEl.classList.contains("hidden") && event.key === "Tab") {
                const buttons = [...lightboxEl.querySelectorAll('button')];
                const index = buttons.indexOf(document.activeElement);
                event.preventDefault();
                buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
            }
            if (event.key === "Escape" && !lightboxEl.classList.contains("hidden")) closeLightbox();
        });

    document.querySelectorAll('[data-image-lightbox]').forEach(trigger => {
        trigger.addEventListener('click', event => {
            event.preventDefault();
            const image = trigger.querySelector('img');
            openLightbox(trigger.href || image.src, image.alt);
        });
    });
}
