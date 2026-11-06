// Presentation only: persisted attempts, completion and awards remain server-owned.
export function hasAnswerDraft(q, raw) {
 if (typeof raw !== 'string' || !raw.trim()) return false;
 if (!q.past) return /^\d+$/.test(raw) && Number(raw) < q.options.length;
 let v; try { v = JSON.parse(raw); } catch { return false; }
 if (v === null || v === undefined) return false;
 if (q.past.kind === 'manual') return !!(v && typeof v === 'object' && (String(v.text || '').trim() || v.strokes?.length));
 if (q.past.answerFormat === 'math-v1') return !!(v && typeof v === 'object' && (String(v.answer || '').trim() || String(v.working || '').trim()));
 if (Array.isArray(v)) return v.length > 0;
 return typeof v === 'boolean' || typeof v === 'number' || (typeof v === 'string' && !!v.trim());
}
export function unsentQuestions(mine, drafts, versions, editing) {
 return mine.filter(q => (!q.attempts.length || editing.has(q.id)) &&
  versions.get(q.id) === q.attempts.length && hasAnswerDraft(q, drafts.get('answer-' + q.id)));
}
export function taskOutcome(room) {
 const e = room.exercise, graded = e.gradedTotal ?? e.total;
 return {graded, eligible: graded > 0 && e.correct * 100 >= graded * 60,
  needed: Math.max(0, Math.ceil((graded * 60 - e.correct * 100) / 100)),
  correctable: e.mine.filter(q => q.attempts.at(-1)?.correct === false),
  allReviewed: e.reviewOpen && e.reviewers.length === room.capacity};
}
export function rewardLabel(a) {
 return [a.leaves ? `${a.leaves} 片紀念葉` : '', a.flowers ? `${a.flowers} 朵紀念花` : ''].filter(Boolean).join('、');
}
export function createAwardTracker() {
 let identity = null, previous = null, pending = null;
 const seen = new Set(); // In-memory display dedup only; no progress/browser storage writes.
 return {
  update(room, viewer) {
   const id = JSON.stringify([room.id, viewer.id]), a = room.exercise.award;
   const key = a ? JSON.stringify([viewer.id, a.id]) : null;
   if (id !== identity) { identity = id; previous = key; pending = null; if (key) seen.add(key); return null; }
   if (!previous && key && a.earnedHere === true && room.exercise.finished && a.leaves + a.flowers > 0 && !seen.has(key)) {
    seen.add(key); pending = a;
   }
   previous = key;
   return pending;
  },
  dismiss() { pending = null; },
  replay(room,viewer) {const a=room.exercise.award;if(!room.exercise.finished||!a||a.leaves+a.flowers<=0)return null;identity=JSON.stringify([room.id,viewer.id]);previous=JSON.stringify([viewer.id,a.id]);seen.add(previous);pending={...a,replay:true};return pending;},
  clear() { identity = null; previous = null; pending = null; }
 };
}
