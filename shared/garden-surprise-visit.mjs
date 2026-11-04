// One draw per visit, independent of scene reloads and pet/home switching.
export function createSurpriseVisit(random = Math.random) {
 let checked = false;
 return {
  decide({petUnlocked, petMode, reduced, ready, decision}) {
   if (checked || !ready) return false;
   checked = true;
   return petUnlocked === true && petMode === 'rest' && !reduced && (typeof decision==='boolean'?decision:random()<.2);
  },
  get checked() { return checked; }
 };
}
