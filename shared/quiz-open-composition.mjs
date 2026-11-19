import {answerTemplatePresentation} from './quiz-answer-templates.mjs';
import {sourceStream} from './quiz-content-slices.mjs';
import {presentationSignature} from './quiz-presentation-signature.mjs';
import {readingSignature} from './quiz-reading-signature.mjs';
import {openCompositionSources} from './quiz-open-composition-sources.mjs';

// General, fixed teaching examples, not publisher answers or grading rules.
// Select only after an authorized reference provides the matching criteria.
function teachingGuide(plan,criteria){
 const body=criteria.join(' '),rows=plan.rows.filter(r=>r.fields.length),text=sourceStream(plan.source.prompt);
 const between=(r,i)=>{const b=plan.blanks.filter(b=>r.fields.includes(b.field));return text.slice(b[i].end,b[i+1].start).replace(/\s/gu,'');};
 if(rows.every(r=>r.fields.length===3&&between(r,0)===''&&between(r,1)==='的')&&/數量詞/u.test(body)&&/形容詞/u.test(body)&&/名詞/u.test(body)&&!/疊字|AA/u.test(body))return {
  explanation:'先說數量，再描述特點，最後說清楚是什麼東西；把三格連起來讀，要成為意思完整、搭配自然的短語。',
  checks:['數量詞與名詞搭配，例如花用「朵」、小狗用「隻」。','中間描述特點，最後一格要寫出事物，不能只有另一個描述詞。','本題要求短語；下方完整句子只是示範用法，不必改寫成造句題。'],
  examples:['一朵鮮豔的花','一隻活潑的小狗','一條清澈的小溪','一本有趣的故事書'],
  sentences:['花園裡開著一朵鮮豔的花。','我正在讀一本有趣的故事書。']
 };
 if(rows.every(r=>r.fields.length===2&&between(r,0)==='的')&&/ABB/u.test(body))return {
  explanation:'先用疊字詞描寫樣子，再接上搭配合理的事物；整個短語要一起閱讀。',checks:['檢查原題要求的疊字形式，例如ABB；不要把不同疊字形式混用。','描述詞要適合後面的事物。'],examples:['亮晶晶的星星','香噴噴的麵包','綠油油的草地'],sentences:[]
 };
 if(plan.family==='continuation'&&rows.every(r=>r.fields.length===2&&between(r,0)==='，於是'))return {
  explanation:'先交代事情發生的原因，再用「於是」接出後續的行動或結果。',checks:['把前後兩半句一起讀，確認事情有合理的因果關係。'],examples:['天空突然下起大雨，於是我們跑到屋簷下躲雨。','弟弟找不到鉛筆，於是向同學借了一枝。'],sentences:[]
 };
 return null;
}

export function openCompositionPlan(q,registry=openCompositionSources,templateRegistry){
 if(q?.type!=='open')return null;const plan=answerTemplatePresentation(q,templateRegistry),entry=registry[plan?.source.id];
 if(!entry||entry.guard!==presentationSignature(plan.source)||plan.mode!=='blanks'||plan.source.prompt.media.length||plan.source.fields.some(f=>f.input!=='text'))return null;
 const rows=plan.rows.filter(r=>r.fields.length),ids=rows.flatMap(r=>r.fields);
 if(!rows.some(r=>r.fields.length>1)||ids.length!==q.fields.length||new Set(ids).size!==ids.length)return null;
 return {...plan,family:entry.family,rows};
}

// Reassemble using original connectors and field IDs. Never permute fragments
// into speculative cross-products or infer a student's correctness.
export function openCompositionReview(q,answer,{raw='',registry,templateRegistry}={}){
 const plan=openCompositionPlan(q,registry,templateRegistry);if(!plan||answer?.format!=='self-review-v1')return null;
 const ids=plan.rows.flatMap(r=>r.fields);if(ids.some(id=>!answer.fields?.[id]?.examples?.length||!Array.isArray(answer.fields[id].criteria)))return null;
 const text=sourceStream(plan.source.prompt);let values=null;
 if(raw)try{const parsed=JSON.parse(raw);if(parsed.v===1&&parsed.f&&ids.every(id=>typeof parsed.f[id]==='string'))values=parsed.f;}catch{}
 const compose=(row,get)=>{let at=row.start,out='';for(const b of plan.blanks.filter(b=>row.fields.includes(b.field))){out+=text.slice(at,b.start)+get(b.field);at=b.end;}return (out+text.slice(at,row.end)).replace(/^[\s．‧·•]+/u,'').replace(/\s*\n\s*/gu,'').trim();};
 const groups=plan.rows.map((row,i)=>{
  const counts=row.fields.map(id=>answer.fields[id].examples.length);
  // Reviewed references in this registry have aligned alternatives. If this
  // invariant changes, retain the existing per-field view instead of dropping
  // alternatives or guessing how to pair them.
  if(counts.some(n=>n!==counts[0]))return null;
  return {title:`第${i+1}組${plan.family==='phrase'?'完整短語':'完整句子'}`,student:values?compose(row,id=>values[id]||'【未填】'):null,examples:[...new Set(Array.from({length:counts[0]},(_,j)=>compose(row,id=>answer.fields[id].examples[j])))],fields:row.fields};
 });
 if(groups.some(g=>!g))return null;
 const criteria=[...new Set(ids.flatMap(id=>answer.fields[id].criteria))];return {family:plan.family,groups,criteria,guide:teachingGuide(plan,criteria)};
}

export function compositionExplanationPresentation(q,text,registry=openCompositionSources,templateRegistry){
 const plan=openCompositionPlan(q,registry,templateRegistry),fix=registry[plan?.source.id]?.explanationFix;
 if(!fix||readingSignature({prompt:{text:String(text??''),media:[]}})!==fix.guard)return null;
 const changes=[{start:fix.start,end:fix.end,replacement:''}];return {text:text.slice(0,fix.start)+text.slice(fix.end),changes,issues:[]};
}
