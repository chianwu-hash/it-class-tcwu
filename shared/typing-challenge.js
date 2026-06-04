import {
    getSession,
    getStoredAccessToken,
    isTeacher,
    SUPABASE_ANON_KEY,
    SUPABASE_URL,
    supabase
} from "./auth.js";

const DEFAULT_PROGRESS_MESSAGES = {
    completed: "你已經把整套練習走完了，今天可以直接複習，或重新再練一次。",
    resumed: (level) => `已幫你接回上次的進度，這次從第 ${level} 關繼續練習。`,
    firstLogin: "已登入成功，這次的練習過程會自動記錄下來。",
    unauthenticated: "請先登入 Google，才能開始打字闖關並記錄進度。",
    loadError: "進度暫時讀取不到，先照常練習，待會再試一次。",
    saveNoSession: "目前沒有登入狀態，請先登入後再開始闖關。",
    saveCompleted: "已幫你記下這次完整練習的進度，下次登入也會接著記得。",
    saveNextLevel: (level) => `已記下你的練習進度，下次可以從第 ${level} 關繼續。`,
    saveError: "進度暫時沒有記錄成功，先不要關掉頁面，稍後再試一次。",
    resetNoSession: "目前沒有登入狀態，暫時不能重新開始練習。",
    resetConfirm: "要重新開始練習嗎？這會把目前的進度重設回第 1 關。",
    resetError: "重新開始練習暫時失敗，請稍後再試一次。",
    resetVerificationError: "重新開始練習的驗證沒有成功，請再試一次。",
    loginRequired: "請先登入 Google，系統確認身分後才可以開始闖關。",
    noLoginLevelAdvance: "請先登入 Google，才能進入下一關。",
    noLoginCompleted: "請先登入 Google，才能完成並保存闖關結果。"
};

const DEFAULT_CELEBRATION_CONTENT = {
    title: "一步一步完成所有關卡",
    message: "你真的把所有關卡一步一步完成了，現在回頭看，一定會發現自己比剛開始更進步了。",
    buttonText: "帶著成果回到練習區",
    buttonHref: ""
};

function ensureTypingChallengeTextStyle() {
    if (document.getElementById("typing-challenge-text-style")) {
        return;
    }

    const style = document.createElement("style");
    style.id = "typing-challenge-text-style";
    style.textContent = `
        #typing-levels-container pre.select-none.pointer-events-none,
        #typing-levels-container div.select-none.pointer-events-none,
        #typing-levels-container input[id^="input-level"],
        #typing-levels-container textarea[id^="input-level"],
        #levels-container pre.select-none.pointer-events-none,
        #levels-container div.select-none.pointer-events-none,
        #levels-container input[id^="input-level"],
        #levels-container textarea[id^="input-level"] {
            font-family: inherit;
        }
    `;
    document.head.appendChild(style);
}

export function initTypingChallenge({
    weekCode,
    activityKey,
    levelsData,
    levelEncouragements,
    buildHint = null,
    getWrongAnswerHtml = null,
    progressMessages = {},
    celebrationContent = {},
    draftOptions = {},
    afterAuthUpdate = null
}) {
    ensureTypingChallengeTextStyle();

    const maxLevel = levelsData.length;
    let currentSession = null;
    let highestUnlockedLevel = 1;
    const messages = { ...DEFAULT_PROGRESS_MESSAGES, ...progressMessages };
    const celebration = { ...DEFAULT_CELEBRATION_CONTENT, ...celebrationContent };
    const SAVE_TIMEOUT_MS = 10000;
    const DRAFT_TIMEOUT_MS = 5000;
    const draftsEnabled = Boolean(draftOptions?.enabled);
    const draftStateByLevel = new Map();
    let draftLoadKey = "";

    const authStatusEl = document.getElementById("auth-status");
    const progressStatusEl = document.getElementById("progress-status");
    const progressDebugEl = document.getElementById("progress-debug");
    const adminBtn = document.getElementById("admin-btn");
    const loginBtn = document.getElementById("login-btn");
    let resetProgressBtn = document.getElementById("reset-progress-btn");
    const logoutBtn = document.getElementById("logout-btn");
    let progressCompleted = false;

    function getResetProgressBtn() {
        resetProgressBtn = document.getElementById("reset-progress-btn");
        return resetProgressBtn;
    }

    function setResetProgressVisible(visible) {
        const button = getResetProgressBtn();
        button?.classList.toggle("hidden", !visible);
    }

    function bindResetProgressButton() {
        const button = getResetProgressBtn();
        if (!button) {
            return;
        }
        button.removeEventListener("click", resetProgress);
        button.addEventListener("click", resetProgress);
    }

    function refreshResetProgressButton() {
        bindResetProgressButton();
        setResetProgressVisible(Boolean(currentSession?.user && progressCompleted));
    }

    function configureTypingInputs() {
        for (let level = 1; level <= maxLevel; level += 1) {
            const inputEl = document.getElementById(`input-level${level}`);
            if (!inputEl) {
                continue;
            }
            inputEl.setAttribute("autocomplete", "off");
            inputEl.setAttribute("autocorrect", "off");
            inputEl.setAttribute("autocapitalize", "off");
            inputEl.setAttribute("spellcheck", "false");
            inputEl.setAttribute("data-form-type", "other");
        }
    }

    function setTypingLocked(locked) {
        const container = document.getElementById("typing-levels-container") || document;
        container.querySelectorAll("input[id^='input-level'], textarea[id^='input-level']").forEach((inputEl) => {
            inputEl.disabled = locked;
            inputEl.classList.toggle("opacity-60", locked);
            inputEl.classList.toggle("cursor-not-allowed", locked);
        });
        container.querySelectorAll("button[onclick^='checkLevel']").forEach((buttonEl) => {
            buttonEl.disabled = locked;
            buttonEl.classList.toggle("opacity-60", locked);
            buttonEl.classList.toggle("cursor-not-allowed", locked);
        });
        syncAllDraftControls();
    }

    function getDraftControl(level) {
        return document.getElementById(`typing-draft-ctrl-${level}`);
    }

    function getDraftSaveButton(level) {
        return document.getElementById(`typing-draft-save-${level}`);
    }

    function getDraftRestoreButton(level) {
        return document.getElementById(`typing-draft-restore-${level}`);
    }

    function getDraftStatus(level) {
        return document.getElementById(`typing-draft-status-${level}`);
    }

    function formatDraftTime(value) {
        if (!value) {
            return "";
        }
        try {
            return new Date(value).toLocaleTimeString("zh-TW", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false
            });
        } catch (_error) {
            return "";
        }
    }

    function setDraftStatus(level, text, tone = "muted") {
        const statusEl = getDraftStatus(level);
        if (!statusEl) {
            return;
        }

        statusEl.textContent = text;
        statusEl.className = "text-xs font-bold";
        if (tone === "success") {
            statusEl.classList.add("text-emerald-700");
        } else if (tone === "warning") {
            statusEl.classList.add("text-amber-700");
        } else if (tone === "error") {
            statusEl.classList.add("text-red-600");
        } else {
            statusEl.classList.add("text-slate-500");
        }
    }

    function updateDraftControlFromState(level) {
        const state = draftStateByLevel.get(level);
        const restoreButton = getDraftRestoreButton(level);
        const savedTime = formatDraftTime(state?.saved_at);

        restoreButton?.classList.toggle("hidden", !state?.draft_text);
        setDraftStatus(
            level,
            state?.draft_text && savedTime ? `上次草稿：${savedTime}` : "尚未儲存草稿"
        );
        syncDraftControlState(level);
    }

    function syncDraftControlState(level) {
        if (!draftsEnabled) {
            return;
        }

        const control = getDraftControl(level);
        const inputEl = document.getElementById(`input-level${level}`);
        if (!control || !inputEl) {
            return;
        }

        const isCompleted = inputEl.readOnly;
        const isLocked = !currentSession?.user || inputEl.disabled || isCompleted;
        control.classList.toggle("hidden", isCompleted);
        [getDraftSaveButton(level), getDraftRestoreButton(level)].forEach((button) => {
            if (!button) {
                return;
            }
            button.disabled = isLocked;
            button.classList.toggle("opacity-50", isLocked);
            button.classList.toggle("cursor-not-allowed", isLocked);
        });
    }

    function syncAllDraftControls() {
        if (!draftsEnabled) {
            return;
        }
        for (let level = 1; level <= maxLevel; level += 1) {
            syncDraftControlState(level);
        }
    }

    function createDraftControls() {
        if (!draftsEnabled) {
            return;
        }

        for (let level = 1; level <= maxLevel; level += 1) {
            const inputEl = document.getElementById(`input-level${level}`);
            if (!inputEl || getDraftControl(level)) {
                continue;
            }

            const control = document.createElement("div");
            control.id = `typing-draft-ctrl-${level}`;
            control.className = "mb-4 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-left shadow-sm sm:flex-row sm:items-center sm:justify-between";
            control.innerHTML = `
                <div class="flex flex-wrap items-center gap-2">
                    <button type="button" id="typing-draft-save-${level}" class="rounded-lg bg-slate-700 px-3 py-2 text-sm font-black text-white transition hover:bg-slate-800">儲存草稿</button>
                    <button type="button" id="typing-draft-restore-${level}" class="hidden rounded-lg bg-indigo-600 px-3 py-2 text-sm font-black text-white transition hover:bg-indigo-700">回復上次草稿</button>
                </div>
                <span id="typing-draft-status-${level}" class="text-xs font-bold text-slate-500">尚未儲存草稿</span>
            `;
            inputEl.insertAdjacentElement("afterend", control);

            getDraftSaveButton(level)?.addEventListener("click", () => saveDraft(level));
            getDraftRestoreButton(level)?.addEventListener("click", () => restoreDraft(level));
            syncDraftControlState(level);
        }
    }

    function getDraftAccessToken() {
        return currentSession?.access_token ?? getStoredAccessToken();
    }

    async function requestDrafts({ method, query = {}, body = null, prefer = null }) {
        const accessToken = getDraftAccessToken();
        if (!accessToken) {
            return {
                data: null,
                error: { message: "No access token available", status: "no_token" }
            };
        }

        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), DRAFT_TIMEOUT_MS);
        const url = new URL(`${SUPABASE_URL}/rest/v1/typing_drafts`);
        Object.entries(query).forEach(([key, value]) => {
            url.searchParams.set(key, value);
        });

        try {
            const headers = {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${accessToken}`
            };
            if (body !== null) {
                headers["Content-Type"] = "application/json";
            }
            if (prefer) {
                headers.Prefer = prefer;
            }

            const response = await fetch(url.toString(), {
                method,
                signal: controller.signal,
                headers,
                body: body === null ? null : JSON.stringify(body)
            });

            if (response.ok) {
                if (response.status === 204) {
                    return { data: null, error: null };
                }
                const text = await response.text();
                return { data: text ? JSON.parse(text) : null, error: null };
            }

            return {
                data: null,
                error: {
                    message: await response.text(),
                    status: response.status,
                    statusText: response.statusText
                }
            };
        } catch (error) {
            return { data: null, error };
        } finally {
            window.clearTimeout(timeoutId);
        }
    }

    function getDraftBaseFilters(userId) {
        return {
            user_id: `eq.${userId}`,
            week_code: `eq.${weekCode}`,
            activity_key: `eq.${activityKey}`
        };
    }

    async function loadDraftsOnce() {
        if (!draftsEnabled || !currentSession?.user) {
            return;
        }

        const key = `${currentSession.user.id}:${weekCode}:${activityKey}`;
        if (draftLoadKey === key) {
            return;
        }
        draftLoadKey = key;

        const { data, error } = await requestDrafts({
            method: "GET",
            query: {
                select: "level_id,draft_text,saved_at",
                ...getDraftBaseFilters(currentSession.user.id)
            }
        });

        if (error) {
            draftLoadKey = "";
            console.warn("load typing drafts failed", error);
            for (let level = 1; level <= maxLevel; level += 1) {
                setDraftStatus(level, "草稿暫時讀取不到", "warning");
            }
            return;
        }

        draftStateByLevel.clear();
        (Array.isArray(data) ? data : []).forEach((row) => {
            draftStateByLevel.set(Number(row.level_id), row);
        });
        for (let level = 1; level <= maxLevel; level += 1) {
            updateDraftControlFromState(level);
        }
    }

    async function saveDraft(level) {
        const inputEl = document.getElementById(`input-level${level}`);
        const user = await getActiveUser();
        if (!draftsEnabled || !inputEl || !user) {
            return;
        }

        if (inputEl.disabled || inputEl.readOnly) {
            return;
        }

        const draftText = inputEl.value;
        if (!draftText.trim()) {
            setDraftStatus(level, "目前沒有內容可儲存", "warning");
            return;
        }

        const payload = {
            user_id: user.id,
            week_code: weekCode,
            activity_key: activityKey,
            level_id: level,
            draft_text: draftText,
            saved_at: new Date().toISOString()
        };

        setDraftStatus(level, "正在儲存草稿...", "muted");
        const { data, error } = await requestDrafts({
            method: "POST",
            query: {
                on_conflict: "user_id,week_code,activity_key,level_id"
            },
            body: payload,
            prefer: "resolution=merge-duplicates,return=representation"
        });

        if (error) {
            console.warn("save typing draft failed", error, payload);
            setDraftStatus(level, "草稿暫時沒有儲存成功", "error");
            return;
        }

        const saved = Array.isArray(data) ? data[0] : payload;
        draftStateByLevel.set(level, saved || payload);
        const savedTime = formatDraftTime(saved?.saved_at || payload.saved_at);
        getDraftRestoreButton(level)?.classList.remove("hidden");
        setDraftStatus(level, savedTime ? `草稿已儲存：${savedTime}` : "草稿已儲存", "success");
        syncDraftControlState(level);
    }

    function restoreDraft(level) {
        const inputEl = document.getElementById(`input-level${level}`);
        const state = draftStateByLevel.get(level);
        if (!inputEl || !state?.draft_text || inputEl.disabled || inputEl.readOnly) {
            return;
        }

        if (inputEl.value.trim()) {
            const shouldOverwrite = window.confirm("要用上次草稿覆蓋目前輸入的內容嗎？");
            if (!shouldOverwrite) {
                return;
            }
        }

        inputEl.value = state.draft_text;
        inputEl.focus();
        setDraftStatus(level, "已回復上次草稿", "success");
    }

    async function deleteDraft(level) {
        if (!draftsEnabled || !currentSession?.user) {
            return;
        }

        const { error } = await requestDrafts({
            method: "DELETE",
            query: {
                ...getDraftBaseFilters(currentSession.user.id),
                level_id: `eq.${level}`
            }
        });

        if (error) {
            console.warn("delete typing draft failed", error, { level });
            return;
        }

        draftStateByLevel.delete(level);
        updateDraftControlFromState(level);
    }

    async function deleteAllDraftsForActivity() {
        if (!draftsEnabled || !currentSession?.user) {
            return;
        }

        const { error } = await requestDrafts({
            method: "DELETE",
            query: getDraftBaseFilters(currentSession.user.id)
        });

        if (error) {
            console.warn("delete typing drafts failed", error);
            return;
        }

        draftStateByLevel.clear();
        draftLoadKey = "";
    }

    function clearProgressDebug() {
        if (!progressDebugEl) {
            return;
        }
        progressDebugEl.textContent = "";
        progressDebugEl.classList.add("hidden");
    }

    function formatProgressDebugValue(value) {
        if (value === null || value === undefined || value === "") {
            return "-";
        }
        if (typeof value === "object") {
            try {
                return JSON.stringify(value);
            } catch (_error) {
                return String(value);
            }
        }
        return String(value);
    }

    function showProgressDebug(context, error, extra = {}) {
        if (!progressDebugEl) {
            return;
        }
        const user = currentSession?.user;
        const lines = [
            `[${new Date().toLocaleString("zh-TW", { hour12: false })}] ${context}`,
            `message: ${formatProgressDebugValue(error?.message ?? error)}`,
            `code: ${formatProgressDebugValue(error?.code)}`,
            `status: ${formatProgressDebugValue(error?.status)}`,
            `details: ${formatProgressDebugValue(error?.details)}`,
            `hint: ${formatProgressDebugValue(error?.hint)}`,
            `user: ${formatProgressDebugValue(user?.email ?? user?.id)}`,
            `online: ${formatProgressDebugValue(navigator.onLine)}`,
            `week: ${weekCode}`,
            `activity: ${activityKey}`,
            `href: ${window.location.href}`
        ];

        Object.entries(extra).forEach(([key, value]) => {
            lines.push(`${key}: ${formatProgressDebugValue(value)}`);
        });

        progressDebugEl.textContent = lines.join("\n");
        progressDebugEl.classList.remove("hidden");
    }

    function normalizeInput(value) {
        return value
            .replace(/\r\n/g, "\n")
            .split("\n")
            .map((line) => line.trim())
            .join("\n")
            .replace(/[奬奨]/g, "獎")
            .replace(/説/g, "說");
    }

    function unlockLevel(level) {
        document.getElementById(`block-level${level}`)?.classList.remove("hidden");
    }

    function markLevelAsCompleted(level) {
        const inputEl = document.getElementById(`input-level${level}`);
        const msgEl = document.getElementById(`msg-level${level}`);
        const btnEl = document.getElementById(`btn-pinyin-${level}`);

        if (!inputEl || !msgEl) {
            return;
        }

        inputEl.readOnly = true;
        if (!inputEl.value) {
            inputEl.value = "這一關完成了";
        }
        inputEl.classList.remove("border-orange-300", "border-pink-300", "border-cyan-300", "border-emerald-300", "border-purple-400", "border-red-500", "shake");
        inputEl.classList.add("border-green-400", "bg-green-50", "text-green-800");
        msgEl.textContent = levelEncouragements[level] || "你把這一關練好了，下次可以接著後面繼續練習。";
        msgEl.className = "text-center font-bold mt-4 min-h-12 text-sm text-emerald-600 leading-relaxed";
        if (btnEl) {
            btnEl.style.display = "none";
        }
        syncDraftControlState(level);
    }

    function revealProgress(level, completed) {
        clearProgressDebug();
        progressCompleted = Boolean(completed);
        highestUnlockedLevel = Math.max(1, Math.min(level, maxLevel));
        for (let i = 1; i <= highestUnlockedLevel; i += 1) {
            unlockLevel(i);
        }
        for (let i = 1; i < highestUnlockedLevel; i += 1) {
            markLevelAsCompleted(i);
        }

        if (completed) {
            markLevelAsCompleted(maxLevel);
            setResetProgressVisible(true);
            if (progressStatusEl) {
                progressStatusEl.textContent = messages.completed;
            }
        } else if (highestUnlockedLevel > 1) {
            setResetProgressVisible(false);
            if (progressStatusEl) {
                progressStatusEl.textContent = messages.resumed(highestUnlockedLevel);
            }
            setTimeout(() => {
                document.getElementById(`block-level${highestUnlockedLevel}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 250);
        } else {
            setResetProgressVisible(false);
            if (progressStatusEl) {
                progressStatusEl.textContent = messages.firstLogin;
            }
        }
    }

    async function updateAuthUI(session) {
        if (session?.user) {
            if (authStatusEl) {
                authStatusEl.textContent = session.user.email || "Google 使用者";
            }
            loginBtn?.classList.add("hidden");
            logoutBtn?.classList.remove("hidden");
            adminBtn?.classList.toggle("hidden", !isTeacher(session));
        } else {
            if (authStatusEl) {
                authStatusEl.textContent = "未登入";
            }
            if (progressStatusEl) {
                progressStatusEl.textContent = messages.unauthenticated;
            }
            clearProgressDebug();
            loginBtn?.classList.remove("hidden");
            progressCompleted = false;
            draftStateByLevel.clear();
            draftLoadKey = "";
            for (let level = 1; level <= maxLevel; level += 1) {
                updateDraftControlFromState(level);
            }
            setResetProgressVisible(false);
            logoutBtn?.classList.add("hidden");
            adminBtn?.classList.add("hidden");
        }

        setTypingLocked(!session?.user);

        if (typeof afterAuthUpdate === "function") {
            await afterAuthUpdate(session);
        }
    }

    async function getActiveUser() {
        if (currentSession?.user) {
            return currentSession.user;
        }

        const { session, error } = await getSession();
        if (error) {
            console.error("getSession failed", error);
            showProgressDebug("getActiveUser", error);
            return null;
        }

        currentSession = session;
        await updateAuthUI(currentSession);
        return currentSession?.user ?? null;
    }

    async function loadProgress() {
        if (!currentSession?.user) {
            highestUnlockedLevel = 1;
            return;
        }

        const { data, error } = await supabase
            .from("student_progress")
            .select("current_level, completed")
            .eq("user_id", currentSession.user.id)
            .eq("week_code", weekCode)
            .eq("activity_key", activityKey)
            .maybeSingle();

        if (error) {
            if (progressStatusEl) {
                progressStatusEl.textContent = messages.loadError;
            }
            showProgressDebug("loadProgress", error);
            return;
        }

        if (!data) {
            highestUnlockedLevel = 1;
            progressCompleted = false;
            clearProgressDebug();
            if (progressStatusEl) {
                progressStatusEl.textContent = messages.firstLogin;
            }
            await loadDraftsOnce();
            return;
        }

        revealProgress(data.current_level, data.completed);
        await loadDraftsOnce();
    }

    async function fetchSavedProgress(userId) {
        const { data, error } = await supabase
            .from("student_progress")
            .select("current_level, completed")
            .eq("user_id", userId)
            .eq("week_code", weekCode)
            .eq("activity_key", activityKey)
            .maybeSingle();

        if (error) {
            console.error("fetchSavedProgress failed", error);
            showProgressDebug("fetchSavedProgress", error, { target_user: userId });
            return null;
        }

        return data;
    }

    async function saveProgressDirect(payload, accessToken) {
        if (!accessToken) {
            return {
                error: {
                    message: "No access token available",
                    status: "no_token"
                }
            };
        }

        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), SAVE_TIMEOUT_MS);
        const url = new URL(`${SUPABASE_URL}/rest/v1/student_progress`);
        url.searchParams.set("on_conflict", "user_id,week_code,activity_key");

        try {
            const response = await fetch(url.toString(), {
                method: "POST",
                signal: controller.signal,
                headers: {
                    apikey: SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                    Prefer: "resolution=merge-duplicates,return=minimal"
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                return { error: null };
            }

            return {
                error: {
                    message: await response.text(),
                    status: response.status,
                    statusText: response.statusText
                }
            };
        } catch (error) {
            return { error };
        } finally {
            window.clearTimeout(timeoutId);
        }
    }

    async function saveProgress(nextLevel, completed) {
        const user = await getActiveUser();
        if (!user) {
            if (progressStatusEl) {
                progressStatusEl.textContent = messages.saveNoSession;
            }
            showProgressDebug("saveProgress", new Error("No active session"), { next_level: nextLevel, completed });
            return false;
        }

        const payload = {
            user_id: user.id,
            week_code: weekCode,
            activity_key: activityKey,
            current_level: nextLevel,
            completed,
            updated_at: new Date().toISOString()
        };

        const accessToken = currentSession?.access_token ?? getStoredAccessToken();
        const { error } = await saveProgressDirect(payload, accessToken);

        if (!error) {
            clearProgressDebug();
            highestUnlockedLevel = Math.max(highestUnlockedLevel, nextLevel);
            if (progressStatusEl) {
                progressStatusEl.textContent = completed
                    ? messages.saveCompleted
                    : messages.saveNextLevel(nextLevel);
            }
            progressCompleted = Boolean(completed);
            if (completed) {
                setResetProgressVisible(true);
            } else {
                setResetProgressVisible(false);
            }
            return true;
        }

        console.error("saveProgress failed", error, payload);
        if (progressStatusEl) {
            progressStatusEl.textContent = messages.saveError;
        }
        showProgressDebug("saveProgress", error, {
            next_level: nextLevel,
            completed,
            expected: payload,
            highest_unlocked: highestUnlockedLevel
        });
        return false;
    }

    async function resetProgress() {
        const user = await getActiveUser();
        if (!user) {
            if (progressStatusEl) {
                progressStatusEl.textContent = messages.resetNoSession;
            }
            return;
        }

        const shouldReset = window.confirm(messages.resetConfirm);
        if (!shouldReset) {
            return;
        }

        const { error } = await supabase
            .from("student_progress")
            .delete()
            .eq("user_id", user.id)
            .eq("week_code", weekCode)
            .eq("activity_key", activityKey);

        if (error) {
            console.error("resetProgress failed", error);
            if (progressStatusEl) {
                progressStatusEl.textContent = messages.resetError;
            }
            showProgressDebug("resetProgress", error, { user_id: user.id });
            return;
        }

        const saved = await fetchSavedProgress(user.id);
        if (saved) {
            console.error("resetProgress verification failed", saved);
            if (progressStatusEl) {
                progressStatusEl.textContent = messages.resetVerificationError;
            }
            showProgressDebug("resetProgress verification", new Error("Progress row still exists after delete"), { saved });
            return;
        }

        clearProgressDebug();
        await deleteAllDraftsForActivity();
        window.location.reload();
    }

    window.togglePinyin = function togglePinyin(level) {
        const normalEl = document.getElementById(`text-normal-${level}`);
        const pinyinEl = document.getElementById(`text-pinyin-${level}`);
        const btnEl = document.getElementById(`btn-pinyin-${level}`);

        if (!normalEl || !pinyinEl || !btnEl) {
            return;
        }

        if (normalEl.classList.contains("hidden")) {
            normalEl.classList.remove("hidden");
            pinyinEl.classList.add("hidden");
            btnEl.innerHTML = "👀 看注音";
        } else {
            normalEl.classList.add("hidden");
            pinyinEl.classList.remove("hidden");
            btnEl.innerHTML = "🙈 隱藏注音";
        }
    };

    window.checkLevel = async function checkLevel(levelIndex) {
        const inputEl = document.getElementById(`input-level${levelIndex}`);
        const msgEl = document.getElementById(`msg-level${levelIndex}`);

        if (!inputEl || !msgEl) {
            return;
        }

        if (inputEl.readOnly) {
            msgEl.textContent = levelEncouragements[levelIndex] || "你把這一關練好了，下次可以接著後面繼續練習。";
            msgEl.className = "text-center font-black mt-4 min-h-12 text-base md:text-lg text-green-600 leading-relaxed";
            if (levelIndex < maxLevel) {
                confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
            } else {
                triggerUltimateCelebration();
            }
            return;
        }

        const user = await getActiveUser();
        if (!user) {
            msgEl.textContent = messages.loginRequired;
            msgEl.className = "text-center font-black mt-4 min-h-12 text-base md:text-lg text-amber-600 leading-relaxed";
            inputEl.classList.remove("shake");
            void inputEl.offsetWidth;
            inputEl.classList.add("shake");
            loginBtn?.focus();
            return;
        }

        const userVal = normalizeInput(inputEl.value);
        const targetVal = levelsData[levelIndex - 1]?.ans;

        if (userVal === targetVal) {
            msgEl.textContent = levelEncouragements[levelIndex] || "你有仔細檢查，也有慢慢修正，這一關練好了。";
            msgEl.className = "text-center font-black mt-4 min-h-12 text-base md:text-lg text-green-600 leading-relaxed animate-bounce";
            inputEl.classList.remove("shake", "border-red-400", "border-red-500", "border-orange-300", "border-pink-300", "border-cyan-300", "border-emerald-300", "border-purple-400");
            inputEl.classList.add("border-green-400", "bg-green-50", "text-green-800");
            inputEl.readOnly = true;
            syncDraftControlState(levelIndex);

            const btnEl = document.getElementById(`btn-pinyin-${levelIndex}`);
            if (btnEl) {
                btnEl.style.display = "none";
            }

            if (levelIndex < maxLevel) {
                const didSave = await saveProgress(levelIndex + 1, false);
                if (!didSave) {
                    msgEl.innerHTML = "⚠️ 你已經完成這一關了，但進度還沒記錄成功，請再按一次或稍後再試。";
                    msgEl.className = "text-center font-bold mt-4 h-6 text-sm text-amber-600";
                    inputEl.readOnly = false;
                    inputEl.classList.remove("border-green-400", "bg-green-50", "text-green-800");
                    inputEl.classList.add("border-amber-400", "bg-amber-50", "text-amber-800");
                    syncDraftControlState(levelIndex);
                    if (btnEl) {
                        btnEl.style.display = "";
                    }
                    return;
                }

                void deleteDraft(levelIndex);
                const nextBlock = document.getElementById(`block-level${levelIndex + 1}`);
                nextBlock?.classList.remove("hidden");
                setTimeout(() => {
                    nextBlock?.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 1200);
                setTimeout(() => {
                    confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
                }, 500);
                return;
            }

            const didSave = await saveProgress(maxLevel, true);
            if (!didSave) {
                msgEl.innerHTML = "⚠️ 你已經把最後一關完成了，但完整進度還沒記錄成功，請再按一次或稍後再試。";
                msgEl.className = "text-center font-bold mt-4 h-6 text-sm text-amber-600";
                inputEl.readOnly = false;
                inputEl.classList.remove("border-green-400", "bg-green-50", "text-green-800");
                inputEl.classList.add("border-amber-400", "bg-amber-50", "text-amber-800");
                syncDraftControlState(levelIndex);
                if (btnEl) {
                    btnEl.style.display = "";
                }
                return;
            }

            void deleteDraft(levelIndex);
            triggerUltimateCelebration();
        } else {
            const fallbackHint = typeof buildHint === "function"
                ? buildHint(userVal, targetVal, levelIndex)
                : null;
            msgEl.innerHTML = typeof getWrongAnswerHtml === "function"
                ? getWrongAnswerHtml({ levelIndex, userVal, targetVal, hint: fallbackHint })
                : (fallbackHint
                    ? `❌ 哎呀，還有一點點地方不一樣。<br>${fallbackHint}`
                    : "❌ 哎呀，有錯字或少打換行/標點喔！再檢查一下！");
            msgEl.className = "text-center font-bold mt-4 h-6 text-lg text-red-500";
            inputEl.classList.remove("border-green-400", "bg-green-50", "text-green-800");
            inputEl.classList.remove("shake");
            void inputEl.offsetWidth;
            inputEl.classList.add("shake", "border-red-500");
        }
    };

    function triggerUltimateCelebration() {
        document.getElementById("celebration-overlay")?.remove();

        const overlay = document.createElement("div");
        overlay.id = "celebration-overlay";
        overlay.className = "fixed inset-0 bg-black/85 z-50 flex flex-col items-center justify-center transition-opacity duration-1000 opacity-0";

        const trophy = document.createElement("div");
        const buttonHtml = celebration.buttonHref
            ? `<a href="${celebration.buttonHref}" class="inline-block mt-10 bg-yellow-500 hover:bg-yellow-400 text-yellow-900 font-black px-10 py-4 rounded-full text-2xl shadow-[0_0_20px_rgba(250,204,21,0.6)] transition transform hover:scale-110">${celebration.buttonText}</a>`
            : `<button onclick="document.getElementById('celebration-overlay').remove()" class="mt-10 bg-yellow-500 hover:bg-yellow-400 text-yellow-900 font-black px-10 py-4 rounded-full text-2xl shadow-[0_0_20px_rgba(250,204,21,0.6)] transition transform hover:scale-110">${celebration.buttonText}</button>`;

        trophy.innerHTML = `
            <div class="text-[120px] mb-4 animate-bounce drop-shadow-[0_0_30px_rgba(250,204,21,1)]">🏆</div>
            <h2 class="text-5xl md:text-7xl font-black text-yellow-400 tracking-widest drop-shadow-[0_0_20px_rgba(250,204,21,0.8)] mb-4">${celebration.title}</h2>
            <p class="text-2xl text-white mt-4 font-bold">${celebration.message}</p>
            ${buttonHtml}
        `;
        trophy.className = "text-center transform scale-0 transition-transform duration-1000";

        overlay.appendChild(trophy);
        document.body.appendChild(overlay);

        setTimeout(() => {
            overlay.classList.remove("opacity-0");
            trophy.classList.remove("scale-0");
            trophy.classList.add("scale-100");
        }, 100);

        const duration = 8000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

        function randomInRange(min, max) {
            return Math.random() * (max - min) + min;
        }

        const interval = setInterval(() => {
            const timeLeft = animationEnd - Date.now();
            if (timeLeft <= 0) {
                clearInterval(interval);
                return;
            }
            const particleCount = 50 * (timeLeft / duration);
            confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
            confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
        }, 250);
    }

    bindResetProgressButton();
    window.addEventListener("course-navbar:rendered", refreshResetProgressButton);
    configureTypingInputs();
    createDraftControls();

    async function initialize() {
        const { session } = await getSession();
        currentSession = session;
        await updateAuthUI(currentSession);
        await loadProgress();

        supabase.auth.onAuthStateChange(async (_event, session) => {
            currentSession = session;
            await updateAuthUI(currentSession);
            if (currentSession) {
                await loadProgress();
            }
        });
    }

    initialize();
}
