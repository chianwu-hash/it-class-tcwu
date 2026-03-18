import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export const SUPABASE_URL = "https://upxgyusodibaqcrocdzj.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_VhqRaRCR5m4VRuCqTMXToA_XgeCgl5j";
export const TEACHER_EMAILS = ["chianwu@gmail.com"];
export const AUTH_STORAGE_KEY = "sb-upxgyusodibaqcrocdzj-auth-token";
export const LOGIN_RETURN_KEY = "post_login_redirect";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage
    }
});

export function isTeacher(session) {
    const email = session?.user?.email?.toLowerCase() || "";
    return TEACHER_EMAILS.includes(email);
}

export function getHomeRedirectUrl() {
    return `${window.location.origin}/index.html`;
}

export function getAdminRedirectUrl() {
    return `${window.location.origin}/admin-progress.html`;
}

export function requireHttpForAuth() {
    if (window.location.protocol !== "file:") {
        return true;
    }

    window.alert("請改用 http://localhost:3000 或正式站開啟，登入功能不支援直接開檔。");
    return false;
}

export function storeLoginReturn(target = window.location.href) {
    window.localStorage.setItem(LOGIN_RETURN_KEY, target);
}

export function consumePendingRedirect(fallbackUrl = getHomeRedirectUrl()) {
    const target = window.localStorage.getItem(LOGIN_RETURN_KEY);
    if (!target) return false;

    window.localStorage.removeItem(LOGIN_RETURN_KEY);
    if (target !== window.location.href && target !== fallbackUrl) {
        window.location.replace(target);
        return true;
    }

    return false;
}

export async function signInWithGoogle({ redirectTo = getHomeRedirectUrl(), returnTo = null } = {}) {
    if (!requireHttpForAuth()) {
        return { data: null, error: new Error("Auth requires http/https") };
    }

    if (returnTo) {
        storeLoginReturn(returnTo);
    }

    return supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
            redirectTo,
            queryParams: { prompt: "select_account" }
        }
    });
}

export function beginCentralizedLogin({ returnTo = window.location.href, entryPath = "/index.html?login=1" } = {}) {
    if (!requireHttpForAuth()) {
        return false;
    }

    storeLoginReturn(returnTo);
    window.location.href = `${window.location.origin}${entryPath}`;
    return true;
}

export async function signOutAndReload() {
    await supabase.auth.signOut();
    window.location.reload();
}

export async function getSession() {
    const { data, error } = await supabase.auth.getSession();
    return {
        session: data?.session ?? null,
        error: error ?? null
    };
}

function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function readStoredSession() {
    try {
        const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed[0] ?? null;
        }
        return parsed;
    } catch {
        return null;
    }
}

export async function resolveSession() {
    for (let attempt = 0; attempt < 2; attempt += 1) {
        const { session } = await getSession();
        if (session) return session;
        if (attempt === 0) {
            await delay(150);
        }
    }

    const stored = readStoredSession();
    if (stored?.access_token && stored?.refresh_token) {
        const { data: setData } = await supabase.auth.setSession({
            access_token: stored.access_token,
            refresh_token: stored.refresh_token
        });
        if (setData?.session) {
            return setData.session;
        }
    }

    const { data: refreshData } = await supabase.auth.refreshSession();
    return refreshData?.session ?? null;
}
