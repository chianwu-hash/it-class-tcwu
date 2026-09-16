import { supabase } from './auth.js';

const DEFAULT_STORAGE_PREFIX = 'it-class-tcwu:class-card';
const STYLE_ID = 'class-card-auth-style';

function normalizeDigits(value, maxLength = null) {
    const digits = String(value ?? '').replace(/\D/g, '');
    return maxLength ? digits.slice(0, maxLength) : digits;
}

function seatLabel(value) {
    const number = Number.parseInt(normalizeDigits(value), 10);
    return Number.isFinite(number) ? String(number).padStart(2, '0') : '';
}

function makeProfileId(courseId, classCode, seatNo) {
    return `${courseId}:${classCode}:${seatLabel(seatNo)}`;
}

function safeJsonParse(value, fallback = null) {
    try {
        return value ? JSON.parse(value) : fallback;
    } catch {
        return fallback;
    }
}

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        .class-card-nav{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        .class-card-pill{display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:7px 13px;border-radius:999px;border:2px solid #99f6e4;background:#ecfeff;color:#0f766e;font-size:14px;font-weight:900;box-shadow:0 3px 0 rgba(13,148,136,.12)}
        .class-card-pill strong{color:#134e4a}
        .class-card-button{min-height:40px;border:2px solid #facc15;border-bottom-width:4px;border-radius:999px;background:#fef9c3;color:#713f12;padding:7px 13px;font-size:14px;font-weight:900;cursor:pointer;font-family:inherit;box-shadow:0 3px 0 rgba(202,138,4,.16)}
        .class-card-button:hover,.class-card-button:focus-visible{background:#fde68a;outline:3px solid #fef08a;outline-offset:2px}
        .class-card-button.secondary{border-color:#99f6e4;background:#fff;color:#0f766e;box-shadow:0 3px 0 rgba(13,148,136,.12)}
        .class-card-overlay{position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,.35);padding:20px}
        .class-card-panel{width:min(520px,100%);border:4px solid #99f6e4;border-radius:28px;background:#fffdf7;padding:24px;box-shadow:0 24px 60px rgba(15,23,42,.25);color:#123b36}
        .class-card-panel h2{margin:0 0 8px;font-size:30px;line-height:1.2;font-weight:900;color:#134e4a}
        .class-card-panel p{margin:0 0 16px;font-size:17px;font-weight:800;line-height:1.7;color:#49645d}
        .class-card-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:18px 0}
        .class-card-grid label{display:block;font-size:15px;font-weight:900;color:#0f766e}
        .class-card-grid.two-fields label{grid-column:auto}
        .class-card-grid input{box-sizing:border-box;width:100%;margin-top:6px;border:3px solid #5eead4;border-radius:14px;background:#fff;padding:10px 12px;font:900 24px/1.1 inherit;color:#0f172a;letter-spacing:.08em}
        .class-card-grid input:focus{outline:5px solid #fde047;outline-offset:2px;border-color:#0f766e}
        .class-card-actions{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:18px}
        .class-card-submit{border:0;border-bottom:5px solid #0f766e;border-radius:16px;background:#14b8a6;color:white;padding:12px 18px;font-size:18px;font-weight:900;font-family:inherit;cursor:pointer}
        .class-card-cancel{border:2px solid #cbd5e1;border-radius:16px;background:white;color:#475569;padding:10px 16px;font-size:16px;font-weight:900;font-family:inherit;cursor:pointer}
        .class-card-message{min-height:24px;margin-top:12px!important;font-size:16px!important;font-weight:900!important;color:#b45309!important}
        .class-card-message.ok{color:#047857!important}
        .class-card-google-hidden #nav-auth-bar>#auth-status,.class-card-google-hidden #nav-auth-bar>#login-btn,.class-card-google-hidden #nav-auth-bar>#logout-btn,.class-card-google-hidden #nav-auth-bar>#reset-progress-btn{display:none!important}
        @media(max-width:760px){.class-card-panel{padding:20px}.class-card-grid{grid-template-columns:1fr}.class-card-panel h2{font-size:26px}.class-card-nav{width:100%;justify-content:flex-start}.class-card-pill,.class-card-button{font-size:13px}}
    `;
    document.head.appendChild(style);
}

async function loadFallbackRoster(url) {
    if (!url) return [];
    try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) return [];
        const data = await response.json();
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.warn('class-card fallback roster load failed', error);
        return [];
    }
}

function findFallbackIdentity(roster, { courseId, classCode, seatNo, birthdayCode }) {
    const normalizedSeat = Number.parseInt(seatNo, 10);
    const found = roster.find(item => String(item.courseId || courseId) === courseId
        && normalizeDigits(item.classCode) === classCode
        && Number.parseInt(item.seatNo, 10) === normalizedSeat
        && normalizeDigits(item.birthdayCode, 4) === birthdayCode);
    if (!found) return null;
    return {
        type: 'class-card',
        source: 'sample-roster',
        courseId,
        profileId: makeProfileId(courseId, classCode, normalizedSeat),
        classCode,
        seatNo: normalizedSeat,
        seatLabel: seatLabel(normalizedSeat),
        displayName: found.displayName || '三年級同學',
        studentCode: found.studentCode || `${classCode}${seatLabel(normalizedSeat)}`,
        birthdayCode
    };
}

function normalizeRpcIdentity(data, { courseId, classCode, seatNo, birthdayCode }) {
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    const normalizedSeat = Number.parseInt(row.seat_no ?? seatNo, 10);
    return {
        type: 'class-card',
        source: 'rpc',
        courseId: row.course_id || courseId,
        profileId: row.profile_id || makeProfileId(row.course_id || courseId, row.class_code || classCode, normalizedSeat),
        classCode: row.class_code || classCode,
        seatNo: normalizedSeat,
        seatLabel: seatLabel(normalizedSeat),
        displayName: row.display_name || '三年級同學',
        studentCode: row.student_code || `${row.class_code || classCode}${seatLabel(normalizedSeat)}`,
        birthdayCode
    };
}

export function initClassCardAuth({
    courseId,
    mode = 'preview',
    fallbackRosterUrl = null,
    verifyStrategy = 'rpc-first',
    storagePrefix = DEFAULT_STORAGE_PREFIX,
    onIdentityChanged = null
} = {}) {
    if (!courseId) throw new Error('initClassCardAuth requires courseId');
    ensureStyle();

    const storageKey = `${storagePrefix}:${courseId}:v1`;
    let identity = safeJsonParse(window.localStorage?.getItem(storageKey), null);
    let fallbackRosterPromise = null;

    function emitChanged(nextIdentity, { reload = false } = {}) {
        if (typeof onIdentityChanged === 'function') onIdentityChanged(nextIdentity);
        window.dispatchEvent(new CustomEvent('class-card:identity-changed', { detail: { identity: nextIdentity } }));
        if (reload) window.location.reload();
    }

    function saveIdentity(nextIdentity, { reload = false } = {}) {
        identity = nextIdentity;
        if (nextIdentity) {
            window.localStorage?.setItem(storageKey, JSON.stringify(nextIdentity));
        } else {
            window.localStorage?.removeItem(storageKey);
        }
        renderNav();
        emitChanged(identity, { reload });
    }

    function labelText() {
        if (!identity) return mode === 'required' ? '先輸入課堂身分' : '課堂身分卡';
        return `課堂身分：${identity.classCode}-${identity.seatLabel} ${identity.displayName}`;
    }

    function renderNav() {
        const authBar = document.getElementById('nav-auth-bar');
        if (!authBar) return;
        document.body.classList.add('class-card-google-hidden');
        let container = document.getElementById('class-card-nav');
        if (!container) {
            container = document.createElement('div');
            container.id = 'class-card-nav';
            container.className = 'class-card-nav';
            authBar.appendChild(container);
        }
        container.innerHTML = identity ? `
            <span class="class-card-pill" title="這不是 Google 登入，是本節課的課堂身分卡。"><i class="fa-solid fa-id-card"></i><strong>${labelText()}</strong></span>
            <button type="button" class="class-card-button secondary" data-class-card-clear>登出身分</button>
        ` : `
            <button type="button" class="class-card-button" data-class-card-open><i class="fa-solid fa-id-card"></i> ${labelText()}</button>
        `;
    }

    function ensurePanel() {
        let overlay = document.getElementById('class-card-overlay');
        if (overlay) return overlay;
        overlay = document.createElement('div');
        overlay.id = 'class-card-overlay';
        overlay.className = 'class-card-overlay hidden';
        overlay.innerHTML = `
            <section class="class-card-panel" role="dialog" aria-modal="true" aria-labelledby="class-card-title">
                <h2 id="class-card-title">課堂身分卡</h2>
                <p>這不是 Google 登入，只是讓這台電腦知道現在是哪位同學。請輸入班級座號和生日四碼。</p>
                <form id="class-card-form" autocomplete="off">
                    <div class="class-card-grid two-fields">
                        <label>班級座號，例如 30730
                            <input id="class-card-code" name="studentCode" inputmode="numeric" pattern="[0-9]*" maxlength="5" required>
                        </label>
                        <label>生日四碼
                            <input id="class-card-birthday" name="birthdayCode" inputmode="numeric" pattern="[0-9]*" maxlength="4" required placeholder="例如 0423">
                        </label>
                    </div>
                    <div class="class-card-actions">
                        <button type="submit" class="class-card-submit">確認身分</button>
                        <button type="button" class="class-card-cancel" data-class-card-close>先不用</button>
                    </div>
                    <p id="class-card-message" class="class-card-message" role="status"></p>
                </form>
            </section>
        `;
        document.body.appendChild(overlay);
        return overlay;
    }

    function openPanel() {
        const overlay = ensurePanel();
        overlay.classList.remove('hidden');
        const codeInput = document.getElementById('class-card-code');
        const birthdayInput = document.getElementById('class-card-birthday');
        if (identity) {
            codeInput.value = identity.studentCode || `${identity.classCode || ''}${identity.seatLabel || ''}`;
            birthdayInput.value = '';
        }
        window.setTimeout(() => codeInput?.focus(), 0);
    }

    function closePanel() {
        document.getElementById('class-card-overlay')?.classList.add('hidden');
    }

    async function verifyIdentity(payload) {
        async function verifyWithFallback() {
            fallbackRosterPromise ||= loadFallbackRoster(fallbackRosterUrl);
            const roster = await fallbackRosterPromise;
            return findFallbackIdentity(roster, { courseId, ...payload });
        }

        if (verifyStrategy === 'fallback-first') {
            const fallbackIdentity = await verifyWithFallback();
            if (fallbackIdentity) return fallbackIdentity;
        }

        const rpcPayload = {
            p_course_id: courseId,
            p_class_code: payload.classCode,
            p_seat_no: payload.seatNo,
            p_birthday_code: payload.birthdayCode
        };
        try {
            const { data, error } = await supabase.rpc('verify_class_card_identity', rpcPayload);
            if (!error && data) return normalizeRpcIdentity(data, { courseId, ...payload });
            if (error && error.code !== 'PGRST202') console.warn('verify_class_card_identity failed', error);
        } catch (error) {
            console.warn('verify_class_card_identity unavailable', error);
        }

        if (verifyStrategy !== 'fallback-first') {
            return verifyWithFallback();
        }
        return null;
    }

    async function submitForm(form) {
        const message = document.getElementById('class-card-message');
        const submit = form.querySelector('[type="submit"]');
        const studentCode = normalizeDigits(form.elements.studentCode.value, 5);
        const payload = {
            classCode: studentCode.slice(0, 3),
            seatNo: Number.parseInt(studentCode.slice(3), 10),
            birthdayCode: normalizeDigits(form.elements.birthdayCode.value, 4)
        };
        if (!/^\d{5}$/.test(studentCode) || !/^\d{3}$/.test(payload.classCode) || !Number.isFinite(payload.seatNo) || payload.seatNo < 1 || payload.seatNo > 99 || !/^\d{4}$/.test(payload.birthdayCode)) {
            message.textContent = '請檢查班級座號五碼和生日四碼。';
            message.classList.remove('ok');
            return;
        }
        submit.disabled = true;
        message.textContent = '正在確認課堂身分卡...';
        message.classList.remove('ok');
        const nextIdentity = await verifyIdentity(payload);
        submit.disabled = false;
        if (!nextIdentity) {
            message.textContent = '找不到這張身分卡，請檢查班級、座號和生日四碼。';
            return;
        }
        message.textContent = `找到：${nextIdentity.classCode}-${nextIdentity.seatLabel} ${nextIdentity.displayName}`;
        message.classList.add('ok');
        saveIdentity(nextIdentity, { reload: true });
    }

    document.addEventListener('click', event => {
        if (event.target.closest('[data-class-card-open]')) {
            event.preventDefault();
            openPanel();
            return;
        }
        if (event.target.closest('[data-class-card-clear]')) {
            event.preventDefault();
            closePanel();
            saveIdentity(null, { reload: true });
            return;
        }
        if (event.target.closest('[data-class-card-close]')) {
            event.preventDefault();
            closePanel();
        }
    });

    document.addEventListener('submit', event => {
        if (event.target?.id !== 'class-card-form') return;
        event.preventDefault();
        void submitForm(event.target);
    });

    window.addEventListener('course-navbar:rendered', renderNav);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderNav, { once: true });
    } else {
        renderNav();
    }

    // A sample-roster identity may remain in storage after that student has
    // been added to the real class-card table. Upgrade it automatically so
    // cloud progress can be loaded and saved without asking the child to
    // enter the same card again.
    if (identity?.source !== 'rpc' && identity?.birthdayCode) {
        queueMicrotask(async () => {
            const upgradedIdentity = await verifyIdentity({
                classCode: identity.classCode,
                seatNo: identity.seatNo,
                birthdayCode: identity.birthdayCode
            });
            if (upgradedIdentity?.source === 'rpc') {
                saveIdentity(upgradedIdentity, { reload: true });
            }
        });
    }

    return {
        getIdentity: () => identity,
        hasIdentity: () => Boolean(identity),
        open: openPanel,
        clear: () => saveIdentity(null, { reload: true }),
        storageKey,
        mode
    };
}
