import {
    beginCentralizedLogin,
    isTeacher,
    resolveSession,
    signOutAndReload,
    supabase
} from "./auth.js";

export function initNavbarAuth({
    onResetProgress = null,
    onSessionResolved = null
} = {}) {
    const authStatusEl = document.getElementById("auth-status");
    const adminBtn = document.getElementById("admin-btn");
    const loginBtn = document.getElementById("login-btn");
    const resetProgressBtn = document.getElementById("reset-progress-btn");
    const logoutBtn = document.getElementById("logout-btn");

    if (!authStatusEl && !loginBtn && !logoutBtn) {
        return;
    }

    let currentSession = null;

    function updateAuthUI(session) {
        currentSession = session;

        if (session?.user) {
            if (authStatusEl) {
                authStatusEl.textContent = session.user.email || "Google 使用者";
                authStatusEl.title = session.user.email || "Google 使用者";
            }
            loginBtn?.classList.add("hidden");
            logoutBtn?.classList.remove("hidden");
            adminBtn?.classList.toggle("hidden", !isTeacher(session));
            if (typeof onResetProgress === "function") {
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

        if (typeof onSessionResolved === "function") {
            onSessionResolved(session);
        }
    }

    async function signInWithGoogle() {
        beginCentralizedLogin({ returnTo: window.location.href });
    }

    async function signOutUser() {
        await signOutAndReload();
    }

    async function handleResetProgress() {
        if (typeof onResetProgress === "function") {
            await onResetProgress(currentSession);
        }
    }

    loginBtn?.addEventListener("click", signInWithGoogle);
    logoutBtn?.addEventListener("click", signOutUser);
    resetProgressBtn?.addEventListener("click", handleResetProgress);

    async function initialize() {
        const session = await resolveSession();
        updateAuthUI(session);

        supabase.auth.onAuthStateChange((_event, sessionState) => {
            updateAuthUI(sessionState);
        });
    }

    initialize();
}
