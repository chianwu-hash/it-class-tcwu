// Only a change signal, never a roster or permission cache. RPCs remain authoritative.
const KEY = 'test-identity-change-115-v1';
const seen = new Map();
const listeners = new Set();
let channel = null;
const valid = value => value?.version === 1 && typeof value.userId === 'string'
    && value.userId.length > 0 && typeof value.revision === 'string' && value.revision.length > 0;
function stored() {
    try { const value = JSON.parse(globalThis.localStorage?.getItem(KEY) || 'null'); return valid(value) ? value : null; }
    catch { return null; }
}
export function testIdentityRevision(userId) {
    const value = stored();
    return value?.userId === userId ? value.revision : seen.get(userId) || '';
}
function receive(value) {
    if (!valid(value) || seen.get(value.userId) === value.revision) return;
    const latest = stored();
    if (latest?.userId === value.userId && latest.revision !== value.revision) return;
    seen.set(value.userId, value.revision);
    for (const listener of listeners) listener(value);
}
export function onTestIdentityChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
export function publishTestIdentityChange(userId) {
    if (!userId) throw new Error('尚未確認切換帳號。');
    const value = {version:1, userId, revision:crypto.randomUUID()};
    try { globalThis.localStorage?.setItem(KEY, JSON.stringify(value)); } catch { /* Broadcast/local delivery still works. */ }
    receive(value);
    try { channel?.postMessage(value); } catch { /* Optional browser feature. */ }
    return value.revision;
}
if (typeof window !== 'undefined') {
    const initial = stored();
    if (initial) seen.set(initial.userId, initial.revision);
    window.addEventListener('storage', event => {
        if (event.key !== KEY || !event.newValue) return;
        try { receive(JSON.parse(event.newValue)); } catch { /* Ignore malformed cross-tab messages. */ }
    });
    // BFCache restores the old module instance; recheck only on an actual revision change.
    window.addEventListener('pageshow', () => { const value = stored(); if (value) receive(value); });
    try {
        channel = new BroadcastChannel(KEY);
        channel.onmessage = event => receive(event.data);
    } catch { /* Storage events are sufficient when BroadcastChannel is unavailable. */ }
}
