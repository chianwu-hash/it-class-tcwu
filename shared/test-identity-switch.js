import { supabase, getSession } from './auth.js';

// SHA-256 of the teacher's own school test account (lower-case email). Only
// that account sees the switch; the trusted RPC rejects every other caller,
// so students never trigger a request from this module.
const TEST_ACCOUNT_SHA256 = 'b75a0f5c4c4131ed25d0305bbeec23ad0186392544c1c4b428aa33ce1cfdeaf2';
const GRADES = {
    grade3: { label: '三年級', home: '/grade3/115-1/index.html' },
    grade6: { label: '六年級', home: '/grade6/115-1/index.html' }
};

async function sha256Hex(text) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function gradeOfClass(classCode) {
    return String(classCode || '').startsWith('3') ? 'grade3' : 'grade6';
}

export async function initTestIdentitySwitch({ container = document.querySelector('main') } = {}) {
    if (!container || !globalThis.crypto?.subtle) return;
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
    const button = document.createElement('button');
    button.type = 'button';
    button.hidden = true;
    button.className = 'rounded-full bg-amber-500 px-5 py-2 font-black text-white shadow hover:bg-amber-600 focus-visible:outline focus-visible:outline-4 focus-visible:outline-amber-300 disabled:cursor-wait disabled:opacity-60';
    bar.append(status, button);
    container.prepend(bar);

    const call = async (grade) => {
        const { data, error } = await supabase.rpc('switch_test_identity', { p_grade: grade });
        const row = Array.isArray(data) ? data[0] : data;
        if (error || !row) throw error || new Error('empty');
        return row;
    };

    let target = null;
    const show = (row) => {
        const current = gradeOfClass(row.class_code);
        target = current === 'grade3' ? 'grade6' : 'grade3';
        status.textContent = `教師測試身分：目前是${GRADES[current].label} ${row.class_code} 班 ${row.seat_no} 號 ${row.display_name}`;
        button.textContent = `切到${GRADES[target].label}`;
        button.hidden = false;
    };

    button.addEventListener('click', async () => {
        if (!target) return;
        button.disabled = true;
        try {
            await call(target);
            window.location.assign(GRADES[target].home);
        } catch {
            status.textContent = '教師測試身分：切換失敗，身分沒有改變。請重新整理後再試。';
            button.disabled = false;
        }
    });

    try {
        show(await call(null));
    } catch {
        status.textContent = '教師測試身分：讀取失敗，請重新整理。';
    }
}
