// Use question instructions, never the accepted answer or the student's input.
const request=/(?:寫|填|標|拼|補)(?:出|上)?(?:正確的)?(注音|國字)/;
const mixed=/(?:國字\s*[或和與、及／/]\s*注音|注音\s*[或和與、及／/]\s*國字)/;
export function pastFieldInputAids(group,field){
 const own=String(field.text||'');
 const shared=[group.title,group.material,group.promptContent?.text].filter(Boolean).join(' ');
 const target=own.match(request)?.[1];
 let bopomofo=false;
 if(target)bopomofo=target==='注音';
 else if(/注音/.test(own)&&!/國字|(?:不用|不必|不需|無須|不要).*注音/.test(own))bopomofo=true;
 else if(mixed.test(shared)||/國字\s*注音/.test(shared)){
  // Older mixed groups mark the given character/phonetics with quotation
  // marks instead of repeating "write phonetics" beside each blank.
  const given=[...own.matchAll(/「([^」]+)」/g)].map(m=>m[1]);
  if(given.length===1&&/^\p{Script=Han}+$/u.test(given[0]))bopomofo=true;
 }
 else if(!/國字|注音/.test(own)){
  // Uniform phonetic groups may share instructions. Mixed groups need a
  // field-specific instruction; one field must not enable all its neighbours.
  bopomofo=!mixed.test(shared)&&shared.match(request)?.[1]==='注音'&&!/(?:寫|填|標|拼|補)(?:出|上)?(?:正確的)?國字/.test(shared);
 }
 return {bopomofo,punctuation:/標點/.test(String(group.material||'')+' '+own)};
}
