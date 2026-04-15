import {
    beginCentralizedLogin,
    isTeacher,
    resolveSession,
    signOutAndReload,
    supabase
} from "./auth.js";

function getNavbarElements() {
    return {
        authStatusEl: document.getElementById("auth-status"),
        adminBtn: document.getElementById("admin-btn"),
        loginBtn: document.getElementById("login-btn"),
        resetProgressBtn: document.getElementById("reset-progress-btn"),
        logoutBtn: document.getElementById("logout-btn")
    };
}

export function initNavbarAuth({
    onResetProgress = null,
    onSessionResolved = null
} = {}) {
    const existingController = window.__navbarAuthController;
    if (existingController) {
        existingController.setOptions({ onResetProgress, onSessionResolved });
        existingController.refresh();
        return existingController.api;
    }

    let currentSession = null;
    let options = { onResetProgress, onSessionResolved };

    function setOptions(nextOptions) {
        options = {
            onResetProgress: nextOptions.onResetProgress ?? null,
            onSessionResolved: nextOptions.onSessionResolved ?? null
        };
    }

    function updateAuthUI(session) {
        currentSession = session;
        const {
            authStatusEl,
            adminBtn,
            loginBtn,
            resetProgressBtn,
            logoutBtn
        } = getNavbarElements();

        if (!authStatusEl && !loginBtn && !logoutBtn && !adminBtn && !resetProgressBtn) {
            return;
        }

        if (session?.user) {
            if (authStatusEl) {
                authStatusEl.textContent = session.user.email || "Google 使用者";
                authStatusEl.title = session.user.email || "Google 使用者";
            }
            loginBtn?.classList.add("hidden");
            logoutBtn?.classList.remove("hidden");
            adminBtn?.classList.toggle("hidden", !isTeacher(session));
            if (typeof options.onResetProgress === "function") {
                resetProgressBtn?.classList.remove("hidden");
            } else {
                resetProgressBtn?.classList.add("hidden");
            }
        } else {
            if (authStatusEl) {
                authStatusEl.textContent = "未登入";
                authStatusEl.title = "未登入";
            }
            loginBtn?.classList.remove("hidden");
            logoutBtn?.classList.add("hidden");
            adminBtn?.classList.add("hidden");
            resetProgressBtn?.classList.add("hidden");
        }

        if (typeof options.onSessionResolved === "function") {
            options.onSessionResolved(session);
        }
    }

    async function signInWithGoogle() {
        beginCentralizedLogin({ returnTo: window.location.href });
    }

    async function signOutUser() {
        await signOutAndReload();
    }

    async function handleResetProgress() {
        if (typeof options.onResetProgress === "function") {
            await options.onResetProgress(currentSession);
        }
    }

    async function handleClick(event) {
        const loginBtn = event.target.closest("#login-btn");
        if (loginBtn) {
            event.preventDefault();
            await signInWithGoogle();
            return;
        }

        const logoutBtn = event.target.closest("#logout-btn");
        if (logoutBtn) {
            event.preventDefault();
            await signOutUser();
            return;
        }

        const resetProgressBtn = event.target.closest("#reset-progress-btn");
        if (resetProgressBtn) {
            event.preventDefault();
            await handleResetProgress();
        }
    }

    async function refresh() {
        updateAuthUI(currentSession);
    }

    async function initialize() {
        const session = await resolveSession();
        updateAuthUI(session);

        supabase.auth.onAuthStateChange((_event, sessionState) => {
            updateAuthUI(sessionState);
        });
    }

    document.addEventListener("click", handleClick);
    window.addEventListener("course-navbar:rendered", refresh);

    const api = {
        refresh
    };

    window.__navbarAuthController = {
        setOptions,
        refresh,
        api
    };

    initialize();
    return api;
}
