import {sourceStream,replaceTextRange} from './quiz-content-slices.mjs';
const circles='①②③④⑤⑥⑦⑧';
function prefix(text){
 const m=text.match(/^\s*(?:([①②③④⑤⑥⑦⑧])\s*[:：]?\s*|[（(]([1-8１-８A-HＡ-Ｈ])[）)]\s*|([1-8１-８A-HＡ-Ｈ])[、．.]\s*)/u);if(!m)return null;
 const raw=m[1]||m[2]||m[3],value=raw.normalize('NFKC'),n=m[1]?circles.indexOf(raw)+1:/^[A-H]$/.test(value)?value.charCodeAt(0)-64:Number(value);
 // A decimal number is content, not a list prefix (1.5, 2.75, ...).
 if(m[3]&&/[.．]$/u.test(m[0].trim())&&!/\s$/u.test(m[0])&&/^\d/u.test(text.slice(m[0].length)))return null;
 return {end:m[0].length,n,family:m[1]?'circled':(m[2]?'bracket':'delimited')+(/^[A-H]$/.test(value)?'_letter':'_number')};
}
// A complete, unique source-label run is required. A/B/C/D badges belong to
// the UI; IDs, ordering, answers, numeric content and non-single controls stay.
export function optionLabelProjection(options,{referenceText=''}={}){
 if(!Array.isArray(options)||options.length<2||options.length>8)return {options,status:'unchanged'};
 const streams=options.map(o=>sourceStream(o.content)),marks=streams.map(s=>s===null?null:prefix(s));
 if(!marks.some(Boolean))return {options,status:'unchanged'};
 if(streams.some((s,i)=>s!==null&&options[i].content.layout&&s.replace(/\ufffc|\s/gu,'')!==options[i].content.text.replace(/\s/gu,'')))return {options,status:'retained',reason:'rich_text_mismatch'};
 if(marks.some(m=>!m)||new Set(marks.map(m=>m.family)).size!==1||new Set(marks.map(m=>m.n)).size!==options.length)return {options,status:'retained',reason:'incomplete_or_ambiguous_label_run'};
 const bodies=streams.map((s,i)=>s.slice(marks[i].end));
 const diagram=marks.every((m,i)=>m.family==='circled'&&new RegExp('^原圖[^。\\n]*'+circles[m.n-1],'u').test(bodies[i]));
 // Circled marks may point to numbered sentences/figures in the source.
 // Keep that relation unless the body already repeats the exact figure mark.
 if(!diagram&&marks.every(m=>m.family==='circled'&&referenceText.includes(circles[m.n-1])))return {options,status:'retained',reason:'source_reference_markers'};
 if(!diagram&&marks.some(m=>m.n<1||m.n>options.length))return {options,status:'retained',reason:'incomplete_or_ambiguous_label_run'};
 // Codes alone, combinations of statement numbers, or nested labels can be
 // the actual answer. Do not remove them or repeatedly strip their content.
 if(bodies.some(s=>!s.trim()||/^[①②③④⑤⑥⑦⑧A-H\s、，。]+$/u.test(s)||prefix(s)))return {options,status:'retained',reason:'code_or_nested_label_content'};
 const projected=options.map((o,i)=>{let content=replaceTextRange(o.content,0,marks[i].end,'');if(content.layout)content={...content,text:content.layout.map(p=>p.runs.filter(r=>r.type==='text').map(r=>r.text).join('')).join('\n').trimStart()};return {...o,content};});
 return {options:projected,status:'projected',family:marks[0].family};
}
export function normalizeQuestionOptionLabels(q){
 const referenceText=optionLabelReferenceText(q);
 if(q.type==='single'){const p=optionLabelProjection(q.options,{referenceText});return p.status==='projected'?{...q,options:p.options}:q;}
 if(q.type!=='fields')return q;
 let changed=false;const fields=q.fields.map(f=>{if(f.input!=='single')return f;const p=optionLabelProjection(f.options,{referenceText});if(p.status!=='projected')return f;changed=true;return {...f,options:p.options};});
 return changed?{...q,fields}:q;
}
export function optionLabelReferenceText(q){
 const text=c=>typeof c==='string'?c:c?(sourceStream(c)??c.text??''):'';
 // An original inline option bank in a prompt is not a semantic reference.
 // Shared source text and explicit references to marked sentences are.
 const prompt=text(q.prompt??q.promptContent),material=text(q.material??q.materialContent);
 return material+'\n'+(/畫線(?!連)|劃線(?!連)|底線|[①②③④⑤⑥⑦⑧][句處]/u.test(prompt)?prompt:'');
}
