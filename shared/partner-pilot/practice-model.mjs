// UI grouping only. Backend ownership and the reviewed semantic allocation remain authoritative.
export function practiceUnits(mine){
 const units=[],groups=new Map();
 for(const q of mine){
  const key=q.past?.group?`past:${q.past.group}`:`question:${q.id}`;
  let unit=groups.get(key);if(!unit){unit={key,past:!!q.past,questions:[]};groups.set(key,unit);units.push(unit);}
  unit.questions.push(q);
 }
 return units;
}
