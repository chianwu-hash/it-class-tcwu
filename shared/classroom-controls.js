function resolveElement(target) {
    if (!target) return null;
    if (typeof target === "string") return document.querySelector(target);
    return target;
}

function resolveElements({ container, selector, explicitLinks }) {
    if (explicitLinks) return Array.from(explicitLinks);
    const root = resolveElement(container) || document;
    return Array.from(root.querySelectorAll(selector));
}

function getControlRow(data) {
    return Array.isArray(data) ? data[0] : data;
}

function formatControlError(error) {
    const parts = [error?.message, error?.code].filter(Boolean);
    return parts.length ? parts.join(" / ") : "unknown error";
}

function mergeMessages(messages) {
    return {
        loading: "正在確認狀態...",
        refreshing: "正在更新狀態...",
        open: "已開放。",
        locked: "尚未開放。",
        blockedClick: "目前尚未開放，請先完成目前任務。",
        loadError: "讀取狀態失敗，請稍後再按一次更新。",
        teacherOnly: "只有老師登入後可以開關。",
        opening: "正在開放...",
        closing: "正在關閉...",
        toggleError: (error) => `開關失敗：${formatControlError(error)}`,
        ...messages
    };
}

function setStatusIcon(iconElement, state) {
    if (!iconElement) return;
    const isOpen = state === "open";
    const isError = state === "error";
    iconElement.className = [
        "flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm",
        isOpen ? "text-emerald-600" : "",
        isError ? "text-red-600" : "",
        !isOpen && !isError ? "text-amber-600" : ""
    ].join(" ").trim();
    iconElement.innerHTML = isOpen
        ? '<i class="fa-solid fa-lock-open"></i>'
        : isError
            ? '<i class="fa-solid fa-triangle-exclamation"></i>'
            : '<i class="fa-solid fa-lock"></i>';
}

export function initClassroomLinkControl({
    supabase,
    isTeacher,
    grade,
    weekCode,
    controlKey,
    container,
    linkSelector = "a[target='_blank']",
    links = null,
    statusText,
    statusIcon,
    refreshButton,
    teacherToggleButton,
    messages = {},
    toggleButtonHtml = {},
    toggleButtonClasses = {}
}) {
    const root = resolveElement(container);
    const statusEl = resolveElement(statusText);
    const iconEl = resolveElement(statusIcon);
    const refreshBtn = resolveElement(refreshButton);
    const teacherBtn = resolveElement(teacherToggleButton);
    const text = mergeMessages(messages);
    const openButtonHtml = toggleButtonHtml.open ?? '<i class="fa-solid fa-lock"></i><span>關閉</span>';
    const lockedButtonHtml = toggleButtonHtml.locked ?? '<i class="fa-solid fa-lock-open"></i><span>開放</span>';
    const openButtonClasses = toggleButtonClasses.open ?? ["bg-rose-600", "hover:bg-rose-700"];
    const lockedButtonClasses = toggleButtonClasses.locked ?? ["bg-emerald-600", "hover:bg-emerald-700"];
    const disabledClasses = toggleButtonClasses.disabled ?? ["opacity-60"];
    const linkOriginalState = new WeakMap();

    let currentSession = null;
    let isEnabled = false;

    function getLinks() {
        const linkElements = resolveElements({ container: root, selector: linkSelector, explicitLinks: links });
        linkElements.forEach((link) => {
            if (linkOriginalState.has(link)) return;
            linkOriginalState.set(link, {
                hadCardHover: link.classList.contains("card-hover"),
                hadTabIndex: link.hasAttribute("tabindex"),
                tabIndex: link.getAttribute("tabindex")
            });
        });
        return linkElements;
    }

    function updateStatus(message, state = isEnabled ? "open" : "locked") {
        if (statusEl) statusEl.textContent = message;
        setStatusIcon(iconEl, state);
    }

    function setBusy(isBusy) {
        if (refreshBtn) refreshBtn.disabled = isBusy;
        if (teacherBtn) teacherBtn.disabled = isBusy;
        [refreshBtn, teacherBtn].forEach((button) => {
            disabledClasses.forEach((className) => button?.classList.toggle(className, isBusy));
        });
    }

    function updateTeacherControl(session) {
        const teacherVisible = Boolean(isTeacher?.(session));
        teacherBtn?.classList.toggle("hidden", !teacherVisible);
        teacherBtn?.classList.toggle("inline-flex", teacherVisible);
    }

    function applyState(enabled, message) {
        isEnabled = Boolean(enabled);
        getLinks().forEach((link) => {
            const original = linkOriginalState.get(link);
            link.classList.toggle("opacity-50", !isEnabled);
            link.classList.toggle("grayscale", !isEnabled);
            link.classList.toggle("cursor-not-allowed", !isEnabled);
            link.classList.toggle("card-hover", isEnabled && original?.hadCardHover);
            link.setAttribute("aria-disabled", isEnabled ? "false" : "true");
            if (isEnabled) {
                if (original?.hadTabIndex) {
                    link.setAttribute("tabindex", original.tabIndex);
                } else {
                    link.removeAttribute("tabindex");
                }
            } else {
                link.setAttribute("tabindex", "-1");
            }
        });

        if (teacherBtn) {
            openButtonClasses.forEach((className) => teacherBtn.classList.toggle(className, isEnabled));
            lockedButtonClasses.forEach((className) => teacherBtn.classList.toggle(className, !isEnabled));
            teacherBtn.innerHTML = isEnabled ? openButtonHtml : lockedButtonHtml;
        }

        updateStatus(message ?? (isEnabled ? text.open : text.locked), isEnabled ? "open" : "locked");
    }

    async function load({ userTriggered = false } = {}) {
        setBusy(true);
        updateStatus(userTriggered ? text.refreshing : text.loading, "locked");
        try {
            const { data, error } = await supabase.rpc("get_classroom_control", {
                p_grade: grade,
                p_week_code: weekCode,
                p_control_key: controlKey
            });
            if (error) throw error;
            applyState(Boolean(getControlRow(data)?.is_enabled));
        } catch (error) {
            console.error("Failed to load classroom control:", error);
            applyState(false, text.loadError);
            updateStatus(text.loadError, "error");
        } finally {
            setBusy(false);
        }
    }

    async function toggle() {
        if (!isTeacher?.(currentSession)) {
            updateStatus(text.teacherOnly, "error");
            return;
        }

        const nextState = !isEnabled;
        setBusy(true);
        updateStatus(nextState ? text.opening : text.closing, isEnabled ? "open" : "locked");
        try {
            const { data, error } = await supabase.rpc("admin_set_classroom_control", {
                p_grade: grade,
                p_week_code: weekCode,
                p_control_key: controlKey,
                p_is_enabled: nextState
            });
            if (error) throw error;
            applyState(Boolean(getControlRow(data)?.is_enabled));
        } catch (error) {
            console.error("Failed to update classroom control:", error);
            updateStatus(typeof text.toggleError === "function" ? text.toggleError(error) : text.toggleError, "error");
        } finally {
            setBusy(false);
        }
    }

    function handleSession(session) {
        currentSession = session;
        updateTeacherControl(session);
    }

    root?.addEventListener("click", (event) => {
        const link = event.target.closest(linkSelector);
        if (!link || !root.contains(link) || isEnabled) return;
        event.preventDefault();
        event.stopPropagation();
        updateStatus(text.blockedClick, "locked");
    });
    refreshBtn?.addEventListener("click", () => load({ userTriggered: true }));
    teacherBtn?.addEventListener("click", toggle);

    applyState(false);

    return {
        handleSession,
        load,
        toggle,
        applyState,
        get enabled() {
            return isEnabled;
        }
    };
}
