// Grade 6 navbar: show the signed-in student's roster identity (e.g. "60930 測試學生")
// instead of the raw email, with class/seat/name and email as the hover title.
// Read-only: uses the same self-enrollment RPC as my-tree.html. Teachers or accounts
// outside the roster keep the email that navbar-auth.js already shows.
import { supabase, resolveSession } from './auth.js';

const SCHOOL_YEAR = 115;
let cached = { userId: null, email: null, identity: null };
let pending = null;

async function loadIdentity() {
    const session = await resolveSession();
    const user = session?.user;
    if (!user) { cached = { userId: null, email: null, identity: null }; return cached; }
    if (cached.userId === user.id) return cached;
    const { data, error } = await supabase.rpc('get_my_student_enrollment', { p_school_year: SCHOOL_YEAR });
    if (error) console.warn('grade6 navbar identity unavailable', error);
    const row = Array.isArray(data) ? data[0] : data;
    cached = { userId: user.id, email: user.email || '', identity: row || null };
    return cached;
}

function paint() {
    const el = document.getElementById('auth-status');
    const { email, identity } = cached;
    // Only replace the email navbar-auth.js wrote for this same user; never "未登入" or another account.
    if (!el || !identity || !email || el.textContent.trim() !== email) return;
    const seat = String(identity.seat_no).padStart(2, '0');
    const short = `${identity.student_code || identity.class_code + seat} ${identity.display_name}`;
    el.textContent = short;
    el.title = `${identity.class_code} 班 ${seat} 號 ${identity.display_name}\n${email}`;
}

function refresh() {
    pending = pending || loadIdentity().then(paint).catch(error => console.warn('grade6 navbar identity unavailable', error)).finally(() => { pending = null; });
    return pending;
}

export function initGrade6NavIdentity() {
    const el = document.getElementById('auth-status');
    if (!el) return;
    // navbar-auth.js rewrites the status on every auth change; re-apply after it does.
    new MutationObserver(() => {
        const text = el.textContent.trim();
        if (cached.identity && text === cached.email) paint();
        else if (text.includes('@') && text !== cached.email) refresh();
    }).observe(el, { childList: true, characterData: true, subtree: true });
    refresh();
}
