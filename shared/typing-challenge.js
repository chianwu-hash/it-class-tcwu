import {
    beginCentralizedLogin,
    getSession,
    isTeacher,
    signOutAndReload,
    supabase
} from "./auth.js";

export function initTypingChallenge({ weekCode, activityKey, levelsData, levelEncouragements }) {
    const maxLevel = levelsData.length;
    let currentSession = null;
    let highestUnlockedLevel = 1;

    const authStatusEl = document.getElementById("auth-status");
    const progressStatusEl = document.getElementById("progress-status");
    const progressDebugEl = document.getElementById("progress-debug");
    const adminBtn = document.getElementById("admin-btn");
    const loginBtn = document.getElementById("login-btn");
    const resetProgressBtn = document.getElementById("reset-progress-btn");
    const logoutBtn = document.getElementById("logout-btn");

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
    }

    function revealProgress(level, completed) {
        clearProgressDebug();
        highestUnlockedLevel = Math.max(1, Math.min(level, maxLevel));
        for (let i = 1; i <= highestUnlockedLevel; i += 1) {
            unlockLevel(i);
        }
        for (let i = 1; i < highestUnlockedLevel; i += 1) {
            markLevelAsCompleted(i);
        }

        if (completed) {
            markLevelAsCompleted(maxLevel);
            resetProgressBtn?.classList.remove("hidden");
            if (progressStatusEl) {
                progressStatusEl.textContent = "你已經把整套練習走完了，今天可以直接複習，或重新再練一次。";
            }
        } else if (highestUnlockedLevel > 1) {
            resetProgressBtn?.classList.add("hidden");
            if (progressStatusEl) {
                progressStatusEl.textContent = `已幫你接回上次的進度，這次從第 ${highestUnlockedLevel} 關繼續練習。`;
            }
            setTimeout(() => {
                document.getElementById(`block-level${highestUnlockedLevel}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 250);
        } else {
            resetProgressBtn?.classList.add("hidden");
            if (progressStatusEl) {
                progressStatusEl.textContent = "已登入成功，這次的練習過程會自動記錄下來。";
            }
        }
    }

    function updateAuthUI(session) {
        if (session?.user) {
            if (authStatusEl) {
                authStatusEl.textContent = session.user.email || "Google 使用者";
            }
            loginBtn?.classList.add("hidden");
            logoutBtn?.classList.remove("hidden");
            adminBtn?.classList.toggle("hidden", !isTeacher(session));
            return;
        }

        if (authStatusEl) {
            authStatusEl.textContent = "未登入";
        }
        if (progressStatusEl) {
            progressStatusEl.textContent = "尚未登入時，練習不會保存；登入後會自動記錄進度。";
        }
        clearProgressDebug();
        loginBtn?.classList.remove("hidden");
        resetProgressBtn?.classList.add("hidden");
        logoutBtn?.classList.add("hidden");
        adminBtn?.classList.add("hidden");
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
        updateAuthUI(currentSession);
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
                progressStatusEl.textContent = "進度暫時讀取不到，先照常練習，待會再試一次。";
            }
            showProgressDebug("loadProgress", error);
            return;
        }

        if (!data) {
            highestUnlockedLevel = 1;
            clearProgressDebug();
            if (progressStatusEl) {
                progressStatusEl.textContent = "第一次登入成功，先從第 1 關開始慢慢練。";
            }
            return;
        }

        revealProgress(data.current_level, data.completed);
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

    async function saveProgress(nextLevel, completed) {
        const user = await getActiveUser();
        if (!user) {
            if (progressStatusEl) {
                progressStatusEl.textContent = "目前沒有登入狀態，這次的練習不會保存，請先重新登入。";
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

        let lastError = null;

        for (let attempt = 1; attempt <= 2; attempt += 1) {
            const { error } = await supabase
                .from("student_progress")
                .upsert(payload, { onConflict: "user_id,week_code,activity_key" });

            if (error) {
                lastError = error;
                console.error(`saveProgress failed on attempt ${attempt}`, error, payload);
                continue;
            }

            const saved = await fetchSavedProgress(user.id);
            if (saved?.current_level === nextLevel && saved?.completed === completed) {
                highestUnlockedLevel = Math.max(highestUnlockedLevel, nextLevel);
                if (progressStatusEl) {
                    progressStatusEl.textContent = completed
                        ? "已幫你記下這次完整練習的進度，下次登入也會接著記得。"
                        : `已記下你的練習進度，下次可以從第 ${nextLevel} 關繼續。`;
                }
                if (completed) {
                    resetProgressBtn?.classList.remove("hidden");
                } else {
                    resetProgressBtn?.classList.add("hidden");
                }
                return true;
            }

            lastError = new Error("Saved state verification failed");
            console.error(`saveProgress verification failed on attempt ${attempt}`, saved, payload);
        }

        if (lastError) {
            console.error("saveProgress failed", lastError, payload);
            if (progressStatusEl) {
                progressStatusEl.textContent = "進度暫時沒有記錄成功，先不要關掉頁面，稍後再試一次。";
            }
            showProgressDebug("saveProgress", lastError, {
                next_level: nextLevel,
                completed,
                expected: payload,
                highest_unlocked: highestUnlockedLevel
            });
        }

        return false;
    }

    async function signInWithGoogle() {
        beginCentralizedLogin({ returnTo: window.location.href });
    }

    async function signOutUser() {
        await signOutAndReload();
    }

    async function resetProgress() {
        const user = await getActiveUser();
        if (!user) {
            if (progressStatusEl) {
                progressStatusEl.textContent = "目前沒有登入狀態，暫時不能重新開始練習。";
            }
            return;
        }

        const shouldReset = window.confirm("要重新開始練習嗎？這會把目前的進度重設回第 1 關。");
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
                progressStatusEl.textContent = "重新開始練習暫時失敗，請稍後再試一次。";
            }
            showProgressDebug("resetProgress", error, { user_id: user.id });
            return;
        }

        const saved = await fetchSavedProgress(user.id);
        if (saved) {
            console.error("resetProgress verification failed", saved);
            if (progressStatusEl) {
                progressStatusEl.textContent = "重新開始練習的驗證沒有成功，請再試一次。";
            }
            showProgressDebug("resetProgress verification", new Error("Progress row still exists after delete"), { saved });
            return;
        }

        clearProgressDebug();
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

    window.toggleFloatingKeyboard = function toggleFloatingKeyboard() {
        document.getElementById("floating-kb-panel")?.classList.toggle("hidden");
    };

    window.toggleFloatingPunctuation = function toggleFloatingPunctuation() {
        document.getElementById("floating-punc-panel")?.classList.toggle("hidden");
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

        const userVal = normalizeInput(inputEl.value);
        const targetVal = levelsData[levelIndex - 1]?.ans;
        const isLoggedIn = !!(await getActiveUser());

        if (userVal === targetVal) {
            msgEl.textContent = levelEncouragements[levelIndex] || "你有仔細檢查，也有慢慢修正，這一關練好了。";
            msgEl.className = "text-center font-black mt-4 min-h-12 text-base md:text-lg text-green-600 leading-relaxed animate-bounce";
            inputEl.classList.remove("shake", "border-red-400", "border-red-500", "border-orange-300", "border-pink-300", "border-cyan-300", "border-emerald-300", "border-purple-400");
            inputEl.classList.add("border-green-400", "bg-green-50", "text-green-800");
            inputEl.readOnly = true;

            const btnEl = document.getElementById(`btn-pinyin-${levelIndex}`);
            if (btnEl) {
                btnEl.style.display = "none";
            }

            if (levelIndex < maxLevel) {
                if (isLoggedIn) {
                    const didSave = await saveProgress(levelIndex + 1, false);
                    if (!didSave) {
                        msgEl.innerHTML = "⚠️ 你已經完成這一關了，但進度還沒記錄成功，請再按一次或稍後再試。";
                        msgEl.className = "text-center font-bold mt-4 h-6 text-sm text-amber-600";
                        inputEl.readOnly = false;
                        inputEl.classList.remove("border-green-400", "bg-green-50", "text-green-800");
                        inputEl.classList.add("border-amber-400", "bg-amber-50", "text-amber-800");
                        if (btnEl) {
                            btnEl.style.display = "";
                        }
                        return;
                    }
                } else if (progressStatusEl) {
                    progressStatusEl.textContent = "目前是未登入練習模式，這次的練習過程不會保存。";
                }

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

            if (isLoggedIn) {
                const didSave = await saveProgress(maxLevel, true);
                if (!didSave) {
                    msgEl.innerHTML = "⚠️ 你已經把最後一關完成了，但完整進度還沒記錄成功，請再按一次或稍後再試。";
                    msgEl.className = "text-center font-bold mt-4 h-6 text-sm text-amber-600";
                    inputEl.readOnly = false;
                    inputEl.classList.remove("border-green-400", "bg-green-50", "text-green-800");
                    inputEl.classList.add("border-amber-400", "bg-amber-50", "text-amber-800");
                    if (btnEl) {
                        btnEl.style.display = "";
                    }
                    return;
                }
            } else if (progressStatusEl) {
                progressStatusEl.textContent = "目前是未登入練習模式，這次完整練習的過程不會保存。";
            }

            triggerUltimateCelebration();
        } else {
            msgEl.innerHTML = "❌ 哎呀，有錯字或少打換行/標點喔！再檢查一下！";
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
        trophy.innerHTML = `
            <div class="text-[120px] mb-4 animate-bounce drop-shadow-[0_0_30px_rgba(250,204,21,1)]">🏆</div>
            <h2 class="text-5xl md:text-7xl font-black text-yellow-400 tracking-widest drop-shadow-[0_0_20px_rgba(250,204,21,0.8)] mb-4">一步一步完成所有關卡</h2>
            <p class="text-2xl text-white mt-4 font-bold">你真的把所有關卡一步一步完成了，現在回頭看，一定會發現自己比剛開始更進步了。</p>
            <button onclick="document.getElementById('celebration-overlay').remove()" class="mt-10 bg-yellow-500 hover:bg-yellow-400 text-yellow-900 font-black px-10 py-4 rounded-full text-2xl shadow-[0_0_20px_rgba(250,204,21,0.6)] transition transform hover:scale-110">帶著成果回到練習區</button>
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

    loginBtn?.addEventListener("click", signInWithGoogle);
    resetProgressBtn?.addEventListener("click", resetProgress);
    logoutBtn?.addEventListener("click", signOutUser);
    configureTypingInputs();

    async function initialize() {
        const { session } = await getSession();
        currentSession = session;
        updateAuthUI(currentSession);
        await loadProgress();

        supabase.auth.onAuthStateChange(async (_event, session) => {
            currentSession = session;
            updateAuthUI(currentSession);
            if (currentSession) {
                await loadProgress();
            }
        });
    }

    initialize();
}
