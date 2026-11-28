import {presetOrdinal,grade3MathUnits} from './quiz-paper-display.mjs';
import {reviewedPracticePapers} from './quiz-practice-scope-reviewed.mjs';

const reviewed=new Map(reviewedPracticePapers.map(p=>[p.id,p]));
function reviewedPaper(p){
 const fixed=reviewed.get(p.id),c=p.catalog;
 if(!fixed||p.generated||!c||p.version_id!==fixed.version_id||p.title!==fixed.title)return null;
 return Object.entries(fixed.catalog).every(([key,value])=>c[key]===value)?fixed:null;
}
export const paperPracticeScopeBasis=p=>reviewedPaper(p)?.basis||(p.generated&&reviewedCourseRule(p.catalog)?.grade===9?'historical_reference':null);

// Presentation only: never grants access, enables a paper, or rewrites history.
// Boundaries below come from the approved 115-1 textbook analysis receipts.
const rules={
 '115-1-nani-g6-social':{before:[1,2],after:[3,4]},
 '115-1-nani-g6-science':{before:[1,2],after:[3,4]},
 '115-1-kang-g6-en':{before:[1,2],after:[3,4]},
 '115-1-kang-g6-ch':{before:[1,2,3,4,5,6],after:[7,8,9,10,11,12]},
 '115-1-hanlin-g6-math':{before:[1,2,3,4],after:[5,6,7,8]},
 '115-1-hanlin-g3-english':{before:[1,2],after:[3,4,5]},
 '115-1-kang-g3-so':{before:[1,2],after:[3,4]},
 '115-1-hanlin-g3-math':{before:[1,2,3,4,5],after:[6,7,8,9]},
 '115-1-hanlin-g3-science':{before:[1,2],after:[3,4]},
 '115-1-kang-g3-ch':{before:[1,2,3,4,5,6],after:[7,8,9,10,11,12]},
};
const explicit=value=>['before','after','mixed'].includes(value)?value:null;
// These boundaries come from reviewed textbook mappings and release receipts.
const reviewedCourses={
 '115-1-hanlin-g4-english':[4,'翰林','英語',[1,2]],
 '115-1-hanlin-g4-social':[4,'翰林','社會',[1,2],[3,4,5,6]],
 '115-1-kang-g4-chinese':[4,'康軒','國語',[1,2,3,4,5,6],[7,8,9,10,11,12]],
 '115-1-nani-g4-math':[4,'南一','數學',[1,2,3,4,5]],
 '115-1-nani-g4-science':[4,'南一','自然',[1,2]],
 '115-1-g9-hanlin-chinese':[9,'翰林','國文',[1,2,3,4,5,6]],
 '115-1-g9-hanlin-math':[9,'翰林','數學',[1,2,3]],
 '115-1-g9-hanlin-science':[9,'翰林','自然',[1,2,3,4,5,6,7,8,9,10,11]],
 '115-1-g9-kang-civics':[9,'康軒','公民',[3,4]],
 '115-1-g9-kang-geography':[9,'康軒','地理',[3,4]],
 '115-1-g9-kang-history':[9,'康軒','歷史',[2,3,4]],
 '115-1-g9-nani-english':[9,'南一','英語',[3,4,8]],
};
function reviewedCourseRule(c={}){
 const details=reviewedCourses[c.course_id||c.id];
 if(!details)return null;
 const [grade,publisher,subject,units,laterUnits=[]]=details;
 if(c.school_year!==undefined&&String(c.school_year)!=='115'||c.grade!==undefined&&Number(c.grade)!==grade||c.volume!==undefined&&c.volume!==grade+'年級上學期'||c.publisher!==undefined&&c.publisher!==publisher||c.subject!==undefined&&c.subject!==subject)return null;
 return {grade,before:grade===4?units:[],after:grade===9?units:laterUnits};
}
export function practiceScopeOptions(grade){return [
 ['after',Number(grade)===9?'本次範圍・第2次段考':'期末範圍'],
 ['before',Number(grade)===9?'前次範圍・第1次段考':'期中範圍'],['all','全部'],
];}
export function scopeRule(c={}){
 const courseId=c.course_id||c.id;
 const six={
  '115-1-nani-g6-social':{publisher:'南一',subject:'社會'},
  '115-1-nani-g6-science':{publisher:'南一',subject:'自然'},
  '115-1-kang-g6-en':{publisher:'康軒',subject:'英語'},
  '115-1-kang-g6-ch':{publisher:'康軒',subject:'國語'},
  '115-1-hanlin-g6-math':{publisher:'翰林',subject:'數學'},
 }[c.course_id||c.id];
 if(six){
  if(c.school_year!==undefined&&String(c.school_year)!=='115'||c.grade!==undefined&&Number(c.grade)!==6||c.volume!==undefined&&c.volume!=='6年級上學期'||c.publisher!==undefined&&c.publisher!==six.publisher||c.subject!==undefined&&c.subject!==six.subject)return null;
  return rules[c.course_id||c.id];
 }
 const gradeThree={
  '115-1-hanlin-g3-english':{publisher:'翰林',subject:'英語'},
  '115-1-kang-g3-so':{publisher:'康軒',subject:'社會'},
 }[courseId];
 if(gradeThree){
  if(c.school_year!==undefined&&String(c.school_year)!=='115'||c.grade!==undefined&&Number(c.grade)!==3||c.volume!==undefined&&c.volume!=='3年級上學期'||c.publisher!==undefined&&c.publisher!==gradeThree.publisher||c.subject!==undefined&&c.subject!==gradeThree.subject)return null;
  return rules[courseId];
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
 const rule=scopeRule(course)||reviewedCourseRule(course);if(!rule)return 'unknown';const n=Number(unit.id);
 return rule.before.includes(n)?'before':rule.after.includes(n)?'after':'unknown';
}
function catalogUnitIds(c){
 // The caller has already resolved the course. Parse every listed unit before falling back to named lessons.
 const label=String(c.unit||'').split('｜',1)[0].trim();
 const numbered=label.match(/^第\s*(.+?)\s*單元$/);
 const ids=numbered?.[1]||label;
 if(/^\d{1,2}(?:\s*、\s*\d{1,2})*$/.test(ids))return ids.split('、').map(Number);
 const range=numbered&&ids.match(/^(\d{1,2})\s*至\s*(\d{1,2})$/);
 if(!range)return null;
 const first=Number(range[1]),last=Number(range[2]);
 return last>=first?Array.from({length:last-first+1},(_,i)=>first+i):[];
}
export function paperPracticeScope(p,{past=false}={}){
 const c=p.catalog||p,marked=explicit(c.practice_scope);if(marked)return marked;
 if(past){const exam=Number(c.exam);return exam===1?'before':exam===2?'after':'unknown';}
 const verified=reviewedPaper(p);if(verified)return verified.scope;
 const rule=scopeRule(c)||(p.generated&&reviewedCourseRule(c));if(!rule)return 'unknown';
 let units=p.unit_ids;
 if(!Array.isArray(units)||!units.length){
  if(c.publisher==='康軒'&&c.subject==='國語'){
   const label=String(c.unit||p.title||'');
   // A range title is not evidence for its first lesson alone.
   if(/[0-9零〇一二兩三四五六七八九十百]+\s*(?:課)?\s*[–—－~～至到-]\s*(?:第\s*)?[0-9零〇一二兩三四五六七八九十百]+\s*課/.test(label))return 'unknown';
   units=[...label.matchAll(/第\s*[0-9零〇一二兩三四五六七八九十百]+\s*課/g)].map(m=>presetOrdinal({catalog:{unit:m[0]}}));
  }else{
   units=catalogUnitIds(c);
   if(!units){let n=presetOrdinal(p);if(!Number.isFinite(n)&&c.subject==='數學')n=grade3MathUnits.indexOf(c.unit||p.title)+1;units=Number.isFinite(n)&&n>0?[n]:[];}
  }
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
