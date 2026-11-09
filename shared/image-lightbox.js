// Based on grade6/115-1/week01.html; no auth or progress dependencies.
let imageLightboxController;
export function initImageLightbox({ root = document, selector = '[data-image-lightbox]', initialScale = 1, minScale = 1, zoomStep = 0.35, resolveImageSource = null } = {}) {
    if (document.getElementById('lightbox')) return imageLightboxController;
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
        const extraControls = document.createElement('div');
        extraControls.className = 'image-lightbox-extra';
        extraControls.hidden = true;
        lightboxStage.before(extraControls);
        const topbar = document.createElement('header');
        topbar.className = 'image-lightbox-topbar';
        lightboxStage.before(topbar);
        topbar.append(extraControls,lightboxClose.parentElement);
        let viewOptions = {}, loadGeneration = 0, settleLoad = null;
        const widthMode = () => viewOptions.fit === 'width';
        const snapshot = () => ({scale:lightboxState.scale,x:lightboxState.x,y:lightboxState.y,width:lightboxStage.clientWidth});
        let previousFocus = null;
        const lightboxPointers = new Map();
        const lightboxState = {
            scale: initialScale,
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
            viewOptions.onStateChange?.(snapshot());
        }

        function setLightboxScale(nextScale) {
            lightboxState.scale = Math.max(minScale, Math.min(5, nextScale));
            if (lightboxState.scale <= 1 && !widthMode()) {
                lightboxState.x = 0;
                lightboxState.y = 0;
            }
            applyLightboxTransform();
        }

        function zoomLightboxBy(delta) {
            setLightboxScale(lightboxState.scale + delta);
        }

        function resetLightboxTransform() {
            lightboxState.scale = widthMode() ? 1 : initialScale;
            lightboxState.x = 0;
            lightboxState.y = widthMode() ? (lightboxImage.clientHeight-lightboxStage.clientHeight)/2+12 : 0;
            applyLightboxTransform();
        }

        function getPointerDistance() {
            const pointers = Array.from(lightboxPointers.values());
            if (pointers.length < 2) return 0;
            return Math.hypot(pointers[0].x - pointers[1].x, pointers[0].y - pointers[1].y);
        }

        const openLightbox = function(src, altText = "圖卡放大", options = {}) {
            settleLoad?.(false);
            lightboxPointers.clear();
            const wasOpen = !lightboxEl.classList.contains('hidden');
            if (!wasOpen) previousFocus = document.activeElement;
            viewOptions = options;
            lightboxEl.classList.toggle('is-textbook',widthMode());
            lightboxReset.textContent = widthMode() ? '適合寬度' : '重設';
            lightboxReset.setAttribute('aria-label',widthMode() ? '適合螢幕寬度' : '重設圖片縮放');
            lightboxClose.textContent = widthMode() ? '回題目' : '關閉';
            lightboxClose.setAttribute('aria-label',options.closeLabel || '關閉圖片燈箱');
            lightboxClose.title = options.closeLabel || '關閉圖片燈箱';
            extraControls.replaceChildren(...(options.toolbar ? [options.toolbar] : []));
            extraControls.hidden = !options.toolbar;
            lightboxImage.alt = altText;
            lightboxEl.setAttribute("aria-label", altText);
            if (!wasOpen) lightboxState.previousOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";
            lightboxEl.classList.remove("hidden");
            lightboxImage.style.visibility = 'hidden';
            if (!wasOpen) lightboxClose.focus();
            const generation = ++loadGeneration;
            return new Promise(resolve => {
                settleLoad = resolve;
                lightboxImage.onload = () => {
                    if (generation !== loadGeneration) return resolve(false);
                    resetLightboxTransform();
                    if (options.state) {
                        const ratio = lightboxStage.clientWidth / (options.state.width || lightboxStage.clientWidth);
                        Object.assign(lightboxState,{scale:options.state.scale,x:options.state.x*ratio,y:options.state.y*ratio});
                        applyLightboxTransform();
                    }
                    lightboxImage.style.visibility = '';
                    resolve(true);
                };
                lightboxImage.onerror = () => resolve(false);
                lightboxImage.src = src;
            });
        };

        const closeLightbox = function() {
            if (lightboxEl.classList.contains('hidden')) return;
            const options = viewOptions;
            options.onStateChange?.(snapshot());
            settleLoad?.(false);
            settleLoad = null;
            ++loadGeneration;
            lightboxEl.classList.add("hidden");
            lightboxImage.removeAttribute("src");
            previousFocus?.focus();
            lightboxPointers.clear();
            document.body.style.overflow = lightboxState.previousOverflow || "";
            lightboxState.previousOverflow = "";
            viewOptions = {};
            extraControls.replaceChildren();
            extraControls.hidden = true;
            options.onClose?.();
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
        lightboxZoomOut.addEventListener("click", () => zoomLightboxBy(-zoomStep));
        lightboxZoomIn.addEventListener("click", () => zoomLightboxBy(zoomStep));
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
            if (lightboxState.scale > initialScale + 0.05) {
                resetLightboxTransform();
            } else {
                setLightboxScale(2.2);
            }
        });

        lightboxStage.addEventListener("pointerdown", (event) => {
            if (lightboxEl.classList.contains("hidden")) return;
            if (event.isTrusted) lightboxStage.setPointerCapture?.(event.pointerId);
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

            if (!lightboxState.dragging || (!widthMode() && lightboxState.scale <= 1)) return;
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
                const buttons = [...lightboxEl.querySelectorAll('button,select')].filter(n=>!n.disabled&&n.getClientRects().length);
                const index = buttons.indexOf(document.activeElement);
                event.preventDefault();
                buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
            }
            if (event.key === "Escape" && !lightboxEl.classList.contains("hidden")) closeLightbox();
        });

    // 事件代理支援逐題重繪及稍後才揭露的解析，不複製或另存授權網址。
    function prepareImages() {
        root.querySelectorAll(selector).forEach(trigger => {
            if (!trigger.matches('img')) return;
            trigger.tabIndex = 0;
            trigger.setAttribute('role', 'button');
            trigger.setAttribute('aria-label', `${trigger.alt || '題目圖片'}，點擊放大`);
            trigger.title = '點擊放大圖片';
        });
    }
    let activationGeneration = 0;
    async function activateImage(event) {
        const trigger = event.target.closest?.(selector);
        if (!trigger || !root.contains(trigger)) return;
        if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
        const image = trigger.matches('img') ? trigger : trigger.querySelector('img');
        if (!image?.src || !image.complete || !image.naturalWidth) return;
        event.preventDefault();
        // 選項中的圖片只開燈箱，不觸發 label 的選答行為。
        event.stopPropagation();
        trigger.focus();
        let source = trigger.matches('a') ? trigger.href : image.currentSrc || image.src;
        if (resolveImageSource) {
            const generation = ++activationGeneration;
            trigger.setAttribute('aria-busy', 'true');
            try {
                source = await resolveImageSource(image);
                if (generation !== activationGeneration || !root.contains(image)) return;
            } catch {
                trigger.title = '圖片目前無法開啟，請更新狀態後重試。'; return;
            } finally { trigger.removeAttribute('aria-busy'); }
        }
        openLightbox(source, image.alt || '圖片放大檢視');
    }
    prepareImages();
    root.addEventListener('click', activateImage, true);
    root.addEventListener('keydown', activateImage, true);
    const observer = new MutationObserver(prepareImages);
    observer.observe(root, { childList: true, subtree: true });
    imageLightboxController = {open:openLightbox,close:closeLightbox,getState:snapshot};
    return imageLightboxController;
}
