import {sourceStream,replaceTextRange} from './quiz-content-slices.mjs';
import {reviewedFinalOptionPeriods} from './quiz-option-periods-reviewed.mjs';
const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
export function optionPeriodGroups(q){return q?.type==='single'?[{id:'$single',input:'single',options:q.options}]:q?.type==='fields'?q.fields||[]:[];}
// Includes the complete option bank, not its display order. Answers are excluded.
export function optionPeriodSignature(q,f){
 const value={prompt:q.prompt,label:f.label,options:[...f.options].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0).map(o=>({id:o.id,content:o.content}))};
 const text=JSON.stringify(stable(value));let h=0xcbf29ce484222325n;
 for(let i=0;i<text.length;i++){h^=BigInt(text.charCodeAt(i));h=BigInt.asUintN(64,h*0x100000001b3n);}
 return h.toString(16).padStart(16,'0');
}
export function terminalOptionPeriodCandidate(q,f){
 if(f.input!=='single'||!Array.isArray(f.options)||f.options.length<2)return {reason:'not_single'};
 const streams=f.options.map(o=>sourceStream(o.content));
 if(streams.some((s,i)=>s===null||f.options[i].content.media?.length||s.replace(/\s/gu,'')!==f.options[i].content.text.replace(/\s/gu,'')))return {reason:'media_or_rich_mismatch'};
 const ends=streams.map(s=>/。\s*$/u.test(s));
 if(ends.filter(Boolean).length!==1)return {reason:'not_one_terminal_period'};
 const option=ends.indexOf(true),bodies=streams.map(s=>s.trim().replace(/。$/u,''));
 const context=[q.prompt?.text,f.label].filter(Boolean).join('\n');
 const lexicalTask=/哪(?:一|個|些)*[字詞]|錯別字|錯字|字形|字音|讀音|筆畫|部首/u.test(context.replace(/\s/gu,''));
 // A sentence in the STEM is not a sentence-valued option. For example,
 // "句子中哪個字錯誤" still offers individual characters, not sentences.
 if(/標點|句號|逗號|頓號|問號|驚嘆號|引號|語氣/u.test(context)||!lexicalTask&&/句子|句意|敘述|說法|說明/u.test(context))return {reason:'sentence_or_punctuation_task'};
 if(bodies.some(s=>/[「」『』“”"。！？!?，,；;：:\n\ufffc]/u.test(s)))return {reason:'quotation_sentence_or_image'};
 const terms=bodies.every(s=>/^[\p{Script=Han}]{1,6}$/u.test(s)&&(lexicalTask&&s.length===1||!/[的得地是有在不沒非會能讓被把將應要可了著過我你他她它們這那都很最更每用來去增加減少降低提高出現變成]/u.test(s)));
 const quantity=bodies.every(s=>/^(?:約\s*)?[+−-]?\d+(?:\.\d+)?\s*(?:％|%|度|元|個|人|票|倍|公分|公尺|公克|公斤|公里|公升|毫升|公畝|公頃|平方公分|平方公尺|平方公里|立方公分|立方公尺|萬人次)?$/u.test(s));
 if(!terms&&!quantity)return {reason:'not_unambiguous_short_terms_or_quantities'};
 return {status:'candidate',optionId:f.options[option].id,kind:quantity?'numeric_quantity':'short_terms',guard:optionPeriodSignature(q,f)};
}
// Display only. Only an audited final-range ID + exact complete bank may opt in.
// Source documents, option IDs, response values and shuffled order stay intact.
export function finalOptionPeriodProjection(q,registry=reviewedFinalOptionPeriods){
 const entries=registry[q?.id];if(!entries)return q;let changed=false;
 const groups=optionPeriodGroups(q).map(f=>{
  if(f.input!=='single')return f;
  const entry=entries.find(e=>e.field===f.id&&e.guard===optionPeriodSignature(q,f));if(!entry)return f;
  const candidate=terminalOptionPeriodCandidate(q,f);if(candidate.status!=='candidate'||candidate.optionId!==entry.optionId)return f;
  const options=f.options.map(o=>{if(o.id!==entry.optionId)return o;const s=sourceStream(o.content),i=s.lastIndexOf('。');const content={...o.content,...replaceTextRange(o.content,i,i+1,'')};changed=true;return {...o,content};});
  return {...f,options};
 });
 if(!changed)return q;
 return q.type==='single'?{...q,options:groups[0].options}:{...q,fields:groups};
}
