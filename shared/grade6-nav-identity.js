// Shared roster label: grade 6 keeps its compact code; quiz pages show class/seat/name.
// instead of the raw email, with class/seat/name and email as the hover title.
// Read-only: uses the same self-enrollment RPC as my-tree.html. Teachers or accounts
// outside the roster keep the email that navbar-auth.js already shows.
import { supabase, resolveSession } from './auth.js';
import { onTestIdentityChange } from './test-identity-state.mjs?v=20261030-identity-sync';

const SCHOOL_YEAR = 115;
let cached = { userId: null, email: null, identity: null };
let pending = null, rerun = false, generation = 0, expanded = false, listening = false, provided = false, lookupRequired = false;
let fallbackRequired = false;
const observed = new Map();

function hasRosterLabel(row) {
    return Boolean(row?.class_code && row?.display_name && Number.isInteger(Number(row.seat_no)) && Number(row.seat_no) >= 1);
}

function restoreCachedEmail() {
    const el = document.getElementById('auth-status');
    if (cached.email && el?.title?.endsWith('\n' + cached.email)) {
        el.textContent = cached.email;
        el.removeAttribute('title');
    }
}
onTestIdentityChange(({userId}) => {
    if (cached.userId && cached.userId !== userId) return;
    restoreCachedEmail();
    generation++;
    cached = {userId:null, email:null, identity:null};
    fallbackRequired = false;
    // Page-provided labels must wait for a fresh page RPC, not a competing roster read.
    if (!provided) refresh();
});

// Quiz pages already receive the caller's roster row from their own RPC; they hand it
// over here so the navbar does not issue a second enrollment request per page view.
// Partial past-exam snapshots may opt into the existing self-enrollment lookup.
export function provideNavIdentity({ userId, email, row, lookupIfIncomplete = false }) {
    if (!userId || !email) return;
    if (row?.email?.toLowerCase() !== email.toLowerCase()) row = null;
    const sameUser = cached.userId === userId && cached.email === email;
    // A partial snapshot must not erase an already verified self-enrollment row.
    if (lookupIfIncomplete && !hasRosterLabel(row) && sameUser && hasRosterLabel(cached.identity)) row = cached.identity;
    if (sameUser) restoreCachedEmail();
    generation++;
    cached = { userId, email, identity: row || null };
    fallbackRequired = lookupIfIncomplete && !hasRosterLabel(row);
    paint();
    if (fallbackRequired) refresh();
}

async function loadIdentity() {
    const token = generation;
    const session = await resolveSession();
    if (token !== generation) { rerun = true; return; }
    const user = session?.user;
    if (!user) { cached = { userId: null, email: null, identity: null }; fallbackRequired = false; return; }
    const sameUser = cached.userId === user.id && cached.email === (user.email || '');
    if (sameUser && !fallbackRequired) return cached;
    // Only the current page's incomplete identity can opt a provided navbar in.
    if (provided && (!fallbackRequired || !sameUser)) return;
    let row = null;
    try {
        const { data, error } = await supabase.rpc('get_my_student_enrollment', { p_school_year: SCHOOL_YEAR });
        if (!error) row = Array.isArray(data) ? data[0] : data;
    } catch { /* 名冊暫時讀不到時保留登入信箱，不影響登入與作答。 */ }
    const latest = await resolveSession();
    if (token !== generation || latest?.user?.id !== user.id) { rerun = true; return; }
    if (row?.email?.toLowerCase() !== user.email?.toLowerCase()) row = null;
    cached = { userId: user.id, email: user.email || '', identity: row || null };
    fallbackRequired = false;
    return cached;
}

function paint() {
    const el = document.getElementById('auth-status');
    const { email, identity } = cached;
    if (!el || !identity || !email) return;
    const seat = String(identity.seat_no).padStart(2, '0');
    if (!hasRosterLabel(identity)) return;
    const title = `${identity.class_code} 班 ${seat} 號 ${identity.display_name}\n${email}`;
    // Only replace this user's raw email or the label we already painted for this
    // same roster row. A late navbar initializer may switch compact/full format.
    // Never overwrite "未登入" or a different account's label.
    if (el.textContent.trim() !== email && el.title !== title) return;
    const short = expanded ? `${identity.class_code} 班 ${Number(identity.seat_no)} 號 ${identity.display_name}`
        : `${identity.student_code || identity.class_code + seat} ${identity.display_name}`;
    el.textContent = short;
    el.title = title;
}

function refresh() {
    if (pending) { rerun = true; return pending; }
    pending = loadIdentity().then(paint).catch(() => {}).finally(() => {
        pending = null;
        if (rerun) { rerun = false; refresh(); }
    });
    return pending;
}

export function initGrade6NavIdentity({ expanded: fullLabel = false, provided: pageProvided = false, lookup = false } = {}) {
    expanded = fullLabel;
    // A page whose own RPC has no enrollment (e.g. partner practice) opts into
    // this same cached lookup. A later navbar import must not turn it off again.
    lookupRequired ||= lookup;
    provided = pageProvided && !lookupRequired;
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
        if (text === '未登入') { generation++; cached = { userId: null, email: null, identity: null }; fallbackRequired = false; return; }
        if (cached.identity && text === cached.email) paint();
        else if (text.includes('@') && text !== cached.email) refresh();
      });
      observer.observe(el, { childList: true, characterData: true, subtree: true });
      observed.set(el, observer);
    }
    refresh();
}
