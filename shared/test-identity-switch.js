import { supabase, getSession } from './auth.js';
import { publishTestIdentityChange } from './test-identity-state.mjs?v=20261030-identity-sync';

// SHA-256 of the teacher's own school test account (lower-case email). Only
// that account sees the switch; the trusted RPC rejects every other caller,
// so students never trigger a request from this module.
const TEST_ACCOUNT_SHA256 = 'b75a0f5c4c4131ed25d0305bbeec23ad0186392544c1c4b428aa33ce1cfdeaf2';
const GRADES = {
    grade3: { label: '三年級', home: '/grade3/115-1/index.html', classCode: '307' },
    grade4: { label: '土城四年級', home: '/grade4/115-1/index.html', classCode: '407' },
    grade6: { label: '六年級', home: '/grade6/115-1/index.html', classCode: '609' }
};

async function sha256Hex(text) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function gradeOfClass(classCode) {
    const key = `grade${String(classCode || '')[0]}`;
    if (!GRADES[key]) throw new Error('無法辨識測試年級。');
    return key;
}

// Mounted at the top of `container`, or right after `after` when one is given.
export async function initTestIdentitySwitch({ container = document.querySelector('main'), after = null } = {}) {
    if (!(after || container) || !globalThis.crypto?.subtle) return;
    const { session } = await getSession();
    const email = session?.user?.email?.trim().toLowerCase();
    if (!email || await sha256Hex(email) !== TEST_ACCOUNT_SHA256) return;

    const bar = document.createElement('section');
    bar.id = 'test-identity-switch';
    bar.setAttribute('aria-label', '教師測試身分切換');
    bar.className = 'mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50 px-5 py-3 font-bold text-amber-900';
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.textContent = '教師測試身分：讀取中…';
    const actions = document.createElement('div');
    actions.className = 'flex flex-wrap items-center gap-3';
    actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:.75rem';
    actions.setAttribute('role', 'group');
    actions.setAttribute('aria-label', '切換到其他測試身分');
    bar.append(status, actions);
    if (after) after.after(bar); else container.prepend(bar);

    const call = async (grade) => {
        const { data, error } = await supabase.rpc('switch_test_identity', { p_grade: grade });
        const row = Array.isArray(data) ? data[0] : data;
        if (error || !row) throw error || new Error('empty');
        return row;
    };

    let switching = false;
    const setDisabled = (disabled) => {
        actions.querySelectorAll('button').forEach(button => { button.disabled = disabled; });
    };
    const show = (row) => {
        const current = gradeOfClass(row.class_code);
        status.textContent = `教師測試身分：目前是${GRADES[current].label} ${row.class_code} 班 ${row.seat_no} 號 ${row.display_name}`;
        actions.replaceChildren();
        for (const [grade, identity] of Object.entries(GRADES)) {
            if (grade === current) continue;
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.grade = grade;
            button.className = 'rounded-full bg-amber-500 px-5 py-2 font-black text-white shadow hover:bg-amber-600 focus-visible:outline focus-visible:outline-4 focus-visible:outline-amber-300 disabled:cursor-wait disabled:opacity-60';
            button.textContent = `切到${identity.label}`;
            actions.append(button);
        }
    };

    actions.addEventListener('click', async (event) => {
        const button = event.target.closest('button[data-grade]');
        if (!button || !actions.contains(button) || switching) return;
        const next = button.dataset.grade;
        if (!GRADES[next]) return;
        switching = true;
        setDisabled(true);
        try {
            const row = await call(next);
            const active = (await getSession()).session;
            if (active?.user?.id !== session.user.id || row.class_code !== GRADES[next].classCode || Number(row.seat_no) !== 30)
                throw new Error('切換結果尚未確認。');
            publishTestIdentityChange(session.user.id);
            window.location.assign(GRADES[next].home);
        } catch {
            status.textContent = '教師測試身分：切換失敗或結果尚未確認，請重新整理確認目前身分後再試。';
            switching = false;
            setDisabled(false);
        }
    });

    try {
        show(await call(null));
    } catch {
        status.textContent = '教師測試身分：讀取失敗，請重新整理。';
    }
}
