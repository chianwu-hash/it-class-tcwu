import {answerTemplatePresentation} from './quiz-answer-templates.mjs';
import {sourceStream} from './quiz-content-slices.mjs';
import {presentationSignature} from './quiz-presentation-signature.mjs';
import {readingSignature} from './quiz-reading-signature.mjs';
import {openCompositionSources} from './quiz-open-composition-sources.mjs';
import {taskReadingSource} from './quiz-task-instructions.mjs';
import {writingVocabulary} from './quiz-writing-example-guides.mjs';
import {compositionExampleGuides} from './quiz-composition-example-guides.mjs';

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
 if(q?.type!=='open')return null;const source=taskReadingSource(q),entry=registry[source?.id];if(!entry||entry.guard!==presentationSignature(source)||entry.family==='writing')return null;
 let plan=answerTemplatePresentation(q,templateRegistry);
 if(!plan&&entry.completion){const c=entry.completion,text=sourceStream(source.prompt);if(text===null||c.start<c.rowStart||c.end!==text.length||source.fields.length!==1||source.fields[0].id!==c.field)return null;plan={mode:'blanks',source,start:c.rowStart,rows:[{start:c.rowStart,end:c.end,fields:[c.field]}],blanks:[{start:c.start,end:c.end,field:c.field}]};}
 if(!plan||plan.mode!=='blanks'||plan.source.prompt.media.length||plan.source.fields.some(f=>f.input!=='text'))return null;
 const rows=plan.rows.filter(r=>r.fields.length),ids=rows.flatMap(r=>r.fields);
 if((!rows.some(r=>r.fields.length>1)&&entry.family!=='continuation')||ids.length!==q.fields.length||new Set(ids).size!==ids.length)return null;
 return {...plan,family:entry.family,rows,guide:entry.guide};
}

// Reassemble using original connectors and field IDs. Never permute fragments
// into speculative cross-products or infer a student's correctness.
export function openCompositionReview(q,answer,{raw='',registry,templateRegistry}={}){
 const source=taskReadingSource(q),entry=(registry??openCompositionSources)[source?.id];
 if(entry?.family==='writing'&&q.type==='open'&&entry.guard===presentationSignature(source)&&q.fields.length===1&&q.fields[0].input==='text'&&answer?.format==='self-review-v1'){
  const ref=answer.fields?.[q.fields[0].id],guide=writingVocabulary[entry.guide];if(!ref?.examples?.length||!Array.isArray(ref.criteria)||!guide)return null;let student=null;try{const p=JSON.parse(raw);if(p.v===1&&typeof p.f?.[q.fields[0].id]==='string')student=p.f[q.fields[0].id];}catch{}
  return {family:'sentence',groups:[{title:'完整造句',student,examples:[...ref.examples],fields:[q.fields[0].id]}],criteria:[...ref.criteria],guide};
 }
 const plan=openCompositionPlan(q,registry,templateRegistry);if(!plan||answer?.format!=='self-review-v1')return null;
 const ids=plan.rows.flatMap(r=>r.fields);if(ids.some(id=>!answer.fields?.[id]?.examples?.length||!Array.isArray(answer.fields[id].criteria)))return null;
 const text=sourceStream(plan.source.prompt);let values=null;
 if(raw)try{const parsed=JSON.parse(raw);if(parsed.v===1&&parsed.f&&ids.every(id=>typeof parsed.f[id]==='string'))values=parsed.f;}catch{}
 const compose=(row,get)=>{let at=row.start,out='';const append=part=>{if(/[。！？]/u.test(out.at(-1)||'')&&part[0]===out.at(-1))part=part.slice(1);out+=part;};for(const b of plan.blanks.filter(b=>row.fields.includes(b.field))){append(text.slice(at,b.start));append(get(b.field));at=b.end;}append(text.slice(at,row.end));return out.replace(/^[\s．‧·•˙]+/u,'').replace(/\s*\n\s*/gu,'').trim();};
 const groups=plan.rows.map((row,i)=>{
  const counts=row.fields.map(id=>answer.fields[id].examples.length);
  // Reviewed references in this registry have aligned alternatives. If this
  // invariant changes, retain the existing per-field view instead of dropping
  // alternatives or guessing how to pair them.
  if(counts.some(n=>n!==counts[0]))return null;
  const fragment=plan.family==='continuation'&&row.fields.length===1;
  return {title:`第${i+1}組${fragment?'接寫內容':plan.family==='phrase'?'完整短語':'完整句子'}`,student:values?(fragment?values[row.fields[0]]:compose(row,id=>values[id]||'【未填】')):null,examples:[...new Set(Array.from({length:counts[0]},(_,j)=>fragment?answer.fields[row.fields[0]].examples[j]:compose(row,id=>answer.fields[id].examples[j])))],fields:row.fields,fragment};
 });
 if(groups.some(g=>!g))return null;
 const criteria=[...new Set(ids.flatMap(id=>answer.fields[id].criteria))],authored=compositionExampleGuides[plan.guide];let guide=teachingGuide(plan,criteria);
 if(authored){if(authored.variants?.some(values=>values.length!==plan.rows[0].fields.length))return null;const originals=new Set(groups.flatMap(g=>g.examples));guide={...authored,examples:[...new Set(authored.examples??authored.variants.map(values=>compose(plan.rows[0],id=>values[plan.rows[0].fields.indexOf(id)])))].filter(text=>!originals.has(text)),checks:authored.checks??['依原題要求的句型或詞語仿寫；補充示範不是唯一答案。','把整組讀一遍，檢查搭配與意思是否自然。'],sentences:authored.sentences??[]};}
 return {family:plan.family,groups,criteria,guide};
}

export function compositionExplanationPresentation(q,text,registry=openCompositionSources,templateRegistry){
 const source=taskReadingSource(q),entry=registry[source?.id],fix=entry?.guard===presentationSignature(source)?entry.explanationFix:null;
 if(!fix||readingSignature({prompt:{text:String(text??''),media:[]}})!==fix.guard)return null;
 const changes=[{start:fix.start,end:fix.end,replacement:''}];return {text:text.slice(0,fix.start)+text.slice(fix.end),changes,issues:[]};
}
