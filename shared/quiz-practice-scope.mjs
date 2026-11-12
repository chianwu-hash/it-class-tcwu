import {presetOrdinal,grade3MathUnits} from './quiz-paper-display.mjs';
import {reviewedPracticePapers} from './quiz-practice-scope-reviewed.mjs';

const reviewed=new Map(reviewedPracticePapers.map(p=>[p.id,p]));
function reviewedPaper(p){
 const fixed=reviewed.get(p.id),c=p.catalog;
 if(!fixed||p.generated||!c||p.version_id!==fixed.version_id||p.title!==fixed.title)return null;
 return Object.entries(fixed.catalog).every(([key,value])=>c[key]===value)?fixed:null;
}
export const paperPracticeScopeBasis=p=>reviewedPaper(p)?.basis||null;

// Presentation only: never grants access, enables a paper, or rewrites history.
// Boundaries below come from the approved 115-1 textbook analysis receipts.
const rules={
 '115-1-nani-g6-science':{before:[1,2],after:[3,4]},
 '115-1-kang-g6-en':{before:[1,2],after:[3,4]},
 '115-1-kang-g6-ch':{before:[1,2,3,4,5,6],after:[7,8,9,10,11,12]},
 '115-1-hanlin-g6-math':{before:[1,2,3,4],after:[5,6,7,8]},
 '115-1-hanlin-g3-math':{before:[1,2,3,4,5],after:[6,7,8,9]},
 '115-1-hanlin-g3-science':{before:[1,2],after:[3,4]},
 '115-1-kang-g3-ch':{before:[1,2,3,4,5,6],after:[7,8,9,10,11,12]},
};
const explicit=value=>['before','after','mixed'].includes(value)?value:null;
export function practiceScopeOptions(grade){return [
 ['after',Number(grade)===9?'本次範圍・第2次段考':'期末範圍'],
 ['before',Number(grade)===9?'前次範圍・第1次段考':'期中範圍'],['all','全部'],
];}
export function scopeRule(c={}){
 const six={
  '115-1-nani-g6-science':{publisher:'南一',subject:'自然'},
  '115-1-kang-g6-en':{publisher:'康軒',subject:'英語'},
  '115-1-kang-g6-ch':{publisher:'康軒',subject:'國語'},
  '115-1-hanlin-g6-math':{publisher:'翰林',subject:'數學'},
 }[c.course_id||c.id];
 if(six){
  if(c.school_year!==undefined&&String(c.school_year)!=='115'||c.grade!==undefined&&Number(c.grade)!==6||c.volume!==undefined&&c.volume!=='6年級上學期'||c.publisher!==undefined&&c.publisher!==six.publisher||c.subject!==undefined&&c.subject!==six.subject)return null;
  return rules[c.course_id||c.id];
 }
 if(rules[c.course_id||c.id]){
  const chinese=(c.course_id||c.id)==='115-1-kang-g3-ch';
  if(c.school_year!==undefined&&String(c.school_year)!=='115'||c.grade!==undefined&&Number(c.grade)!==3||c.volume!==undefined&&(chinese?c.volume!=='3年級上學期':!String(c.volume).startsWith('3'))||c.publisher!==undefined&&c.publisher!==(chinese?'康軒':'翰林'))return null;
  return rules[c.course_id||c.id];
 }
 if(String(c.school_year)==='115'&&c.volume==='3年級上學期'&&c.publisher==='康軒'&&c.subject==='國語'&&(c.grade===undefined||Number(c.grade)===3))return rules['115-1-kang-g3-ch'];
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
 const verified=reviewedPaper(p);if(verified)return verified.scope;
 const rule=scopeRule(c);if(!rule)return 'unknown';
 let units=p.unit_ids;
 if(!Array.isArray(units)||!units.length){
  if(c.publisher==='康軒'&&c.subject==='國語'){
   const label=String(c.unit||p.title||'');
   // A range title is not evidence for its first lesson alone.
   if(/[0-9零〇一二兩三四五六七八九十百]+\s*(?:課)?\s*[–—－~～至到-]\s*(?:第\s*)?[0-9零〇一二兩三四五六七八九十百]+\s*課/.test(label))return 'unknown';
   units=[...label.matchAll(/第\s*[0-9零〇一二兩三四五六七八九十百]+\s*課/g)].map(m=>presetOrdinal({catalog:{unit:m[0]}}));
  }else{let n=presetOrdinal(p);if(!Number.isFinite(n)&&c.subject==='數學')n=grade3MathUnits.indexOf(c.unit||p.title)+1;units=Number.isFinite(n)&&n>0?[n]:[];}
 }
 if(!units.length)return 'unknown';
 const parts=units.map(id=>unitPracticeScope({...c,course_id:c.course_id},{id}));
 if(parts.includes('unknown'))return 'unknown';
 return new Set(parts).size>1?'mixed':parts[0];
}
export const matchesPracticeScope=(classification,selected)=>selected==='all'||classification===selected||classification==='mixed';
export function practiceScopeBadge(classification,{past=false,grade=3,basis=null}={}){
 if(classification==='mixed')return '含期中前內容';
 if(classification==='unknown')return '範圍待核對';
 if(Number(grade)===9){const label=classification==='before'?'第1次段考卷':'第2次段考卷';return basis==='historical_reference'?label+'・歷年參考':label;}
 if(basis==='publisher_midterm'&&classification==='before')return '期中範圍・依書商分類';
 return classification==='before'?'期中範圍':past?'期末考古卷・依原卷範圍':'期末範圍';
}
