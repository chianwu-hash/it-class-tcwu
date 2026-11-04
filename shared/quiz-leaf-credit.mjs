export function leafCreditText(units) {
  const value = Number(units);
  if (!Number.isInteger(value) || value < 1) return '0 片葉子';
  const full = Math.floor(value / 2);
  return value % 2 ? full ? `${full} 片半葉子` : '半片葉子' : `${full} 片葉子`;
}
// Split authoritative contributions into whole leaves; keep incomplete half off-tree.
export function wholeQuizLeaves(awards) {
  const leaves = []; let pending = null;
  for (const award of awards || []) {
    const units = award.half_units ?? 2;
    if (!Number.isInteger(units) || units < 1 || units > 2000) throw new Error('獎勵累積資料格式不符，請重新讀取。');
    for (let i = 0; i < units; i++) {
      const half = {award, index:i};
      if (!pending) {pending=half;continue;}
      const same = pending.award.id === award.id;
      const sources = same ? [award] : [pending.award,award];
      const id = same && units === 2 ? award.id : `pair:${pending.award.id}:${pending.index}:${award.id}:${i}`;
      leaves.push({...award,id,title:sources.map(a=>a.title).join(' ＋ '),
        correct:same?award.correct:null,total:same?award.total:null,sources});
      pending=null;
    }
  }
  return {leaves,pendingHalf:Boolean(pending),pendingSource:pending?.award || null};
}
