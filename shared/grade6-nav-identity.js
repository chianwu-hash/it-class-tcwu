// Shared roster label: grade 6 keeps its compact code; quiz pages show class/seat/name.
// instead of the raw email, with class/seat/name and email as the hover title.
// Read-only: uses the same self-enrollment RPC as my-tree.html. Teachers or accounts
// outside the roster keep the email that navbar-auth.js already shows.
import { supabase, resolveSession } from './auth.js';

const SCHOOL_YEAR = 115;
let cached = { userId: null, email: null, identity: null };
let pending = null, rerun = false, generation = 0, expanded = false, listening = false, provided = false;
const observed = new Map();

// Quiz pages already receive the caller's roster row from their own RPC; they hand it
// over here so the navbar does not issue a second enrollment request per page view.
export function provideNavIdentity({ userId, email, row }) {
    if (!userId || !email) return;
    if (row?.email?.toLowerCase() !== email.toLowerCase()) row = null;
    cached = { userId, email, identity: row || null };
    paint();
}

async function loadIdentity() {
    const token = generation;
    const session = await resolveSession();
    const user = session?.user;
    if (!user) { cached = { userId: null, email: null, identity: null }; return; }
    if (cached.userId === user.id && cached.email === (user.email || '')) return cached;
    if (provided) return;
    let row = null;
    try {
        const { data, error } = await supabase.rpc('get_my_student_enrollment', { p_school_year: SCHOOL_YEAR });
        if (!error) row = Array.isArray(data) ? data[0] : data;
    } catch { /* 名冊暫時讀不到時保留登入信箱，不影響登入與作答。 */ }
    const latest = await resolveSession();
    if (token !== generation || latest?.user?.id !== user.id) { rerun = true; return; }
    if (row?.email?.toLowerCase() !== user.email?.toLowerCase()) row = null;
    cached = { userId: user.id, email: user.email || '', identity: row || null };
    return cached;
}

function paint() {
    const el = document.getElementById('auth-status');
    const { email, identity } = cached;
    // Only replace the email navbar-auth.js wrote for this same user; never "未登入" or another account.
    if (!el || !identity || !email || el.textContent.trim() !== email) return;
    const seat = String(identity.seat_no).padStart(2, '0');
    if (!identity.class_code || !identity.display_name || !Number.isInteger(Number(identity.seat_no)) || Number(identity.seat_no) < 1) return;
    const short = expanded ? `${identity.class_code} 班 ${Number(identity.seat_no)} 號 ${identity.display_name}`
        : `${identity.student_code || identity.class_code + seat} ${identity.display_name}`;
    el.textContent = short;
    el.title = `${identity.class_code} 班 ${seat} 號 ${identity.display_name}\n${email}`;
}

function refresh() {
    if (pending) { rerun = true; return pending; }
    pending = loadIdentity().then(paint).catch(() => {}).finally(() => {
        pending = null;
        if (rerun) { rerun = false; refresh(); }
    });
    return pending;
}

export function initGrade6NavIdentity({ expanded: fullLabel = false, provided: pageProvided = false } = {}) {
    expanded = fullLabel;
    provided = pageProvided;
    if (!listening) {
        listening = true;
        window.addEventListener('course-navbar:rendered', () => initGrade6NavIdentity({ expanded, provided }));
    }
    for (const [node, observer] of observed) if (!node.isConnected) { observer.disconnect(); observed.delete(node); }
    const el = document.getElementById('auth-status');
    if (!el) return;
    // navbar-auth.js rewrites the status on every auth change; re-apply after it does.
    if (!observed.has(el)) {
      const observer = new MutationObserver(() => {
        const text = el.textContent.trim();
        if (text === '未登入') { generation++; cached = { userId: null, email: null, identity: null }; return; }
        if (cached.identity && text === cached.email) paint();
        else if (text.includes('@') && text !== cached.email) refresh();
      });
      observer.observe(el, { childList: true, characterData: true, subtree: true });
      observed.set(el, observer);
    }
    refresh();
}
