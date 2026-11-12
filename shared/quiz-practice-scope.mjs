import {presetOrdinal,grade3MathUnits} from './quiz-paper-display.mjs';

// Presentation only: never grants access, enables a paper, or rewrites history.
// Boundaries below come from the approved 115-1 textbook analysis receipts.
const rules={
 '115-1-hanlin-g3-math':{before:[1,2,3,4,5],after:[6,7,8,9]},
 '115-1-hanlin-g3-science':{before:[1,2],after:[3,4]},
};
const explicit=value=>['before','after','mixed'].includes(value)?value:null;
export function practiceScopeOptions(grade){return [
 ['after',Number(grade)===9?'本次範圍・第2次段考':'期末範圍'],
 ['before',Number(grade)===9?'前次範圍・第1次段考':'期中範圍'],['all','全部'],
];}
export function scopeRule(c={}){
 if(rules[c.course_id||c.id]){
  if(c.school_year!==undefined&&String(c.school_year)!=='115'||c.grade!==undefined&&Number(c.grade)!==3||c.volume!==undefined&&!String(c.volume).startsWith('3')||c.publisher!==undefined&&c.publisher!=='翰林')return null;
  return rules[c.course_id||c.id];
 }
 if(String(c.school_year)!=='115'||!String(c.volume).startsWith('3')||c.publisher!=='翰林')return null;
 return rules['115-1-hanlin-g3-'+({'數學':'math','自然':'science'}[c.subject]||'') ]||null;
}
export function unitPracticeScope(course,unit){
 if(explicit(unit.practice_scope))return unit.practice_scope;
 const rule=scopeRule(course);if(!rule)return 'unknown';const n=Number(unit.id);
 return rule.before.includes(n)?'before':rule.after.includes(n)?'after':'unknown';
}
export function paperPracticeScope(p,{past=false}={}){
 const c=p.catalog||p,marked=explicit(c.practice_scope);if(marked)return marked;
 if(past){const exam=Number(c.exam);return exam===1?'before':exam===2?'after':'unknown';}
 const rule=scopeRule(c);if(!rule)return 'unknown';
 let units=p.unit_ids;
 if(!Array.isArray(units)||!units.length){let n=presetOrdinal(p);if(!Number.isFinite(n)&&c.subject==='數學')n=grade3MathUnits.indexOf(c.unit||p.title)+1;units=Number.isFinite(n)&&n>0?[n]:[];}
 if(!units.length)return 'unknown';
 const parts=units.map(id=>unitPracticeScope({...c,course_id:c.course_id},{id}));
 if(parts.includes('unknown'))return 'unknown';
 return new Set(parts).size>1?'mixed':parts[0];
}
export const matchesPracticeScope=(classification,selected)=>selected==='all'||classification===selected||classification==='mixed';
export function practiceScopeBadge(classification,{past=false,grade=3}={}){
 if(classification==='mixed')return '含期中前內容';
 if(classification==='unknown')return '範圍待核對';
 if(Number(grade)===9)return classification==='before'?'第1次段考卷':'第2次段考卷';
 return classification==='before'?'期中範圍':past?'期末考古卷・依原卷範圍':'期末範圍';
}
