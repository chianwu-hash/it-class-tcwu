import {fieldPresentation} from './quiz-fields-presentation.mjs';
import {reviewedOptionOrders} from './quiz-reviewed-option-orders.mjs';
import {sourceStream,replaceTextRange} from './quiz-content-slices.mjs';
import {reviewedSequenceQuestion,sequenceExplanationChanges} from './quiz-sequence-presentation.mjs';
const circles='①②③④⑤⑥⑦⑧',numerals='一二三四五六七八';
const indexOf=code=>circles.includes(code)?circles.indexOf(code):numerals.includes(code)?numerals.indexOf(code):/^[A-H]$/.test(code)?code.charCodeAt(0)-65:Number(code)-1;
export function choiceReferenceTokens(text){
 const found=new Map(),add=(start,code,end=start+code.length)=>found.set(start,{start,end,code,index:indexOf(code)});
 for(const pattern of [/(?:選項|應選|故選|所以選|答案(?:為|是|：|:)|選)\s*([①②③④⑤⑥⑦⑧A-H])(?![A-Za-z])/gu,/([①②③④⑤⑥⑦⑧])(?=敘述|的敘述|選項|的說法|錯誤|正確|不正確)/gu,/第\s*([1-8一二三四五六七八])\s*個選項/gu, /選項\s*[（(]?([1-8])[）)]?(?![0-9])/gu]){
  for(const m of text.matchAll(pattern)){const offset=m[0].lastIndexOf(m[1]);let start=m.index+offset;const ordinal=m[0].startsWith('第');let end=ordinal?m.index+m[0].length:start+m[1].length;add(ordinal?m.index:start,m[1],end);let next;
   while((next=text.slice(end).match(/^(?:[\s、，與和或及]*([①②③④⑤⑥⑦⑧])|[\s、，與和或及]+([A-H1-8])(?![A-Za-z0-9]))/u))){const code=next[1]||next[2];start=end+next[0].lastIndexOf(code);add(start,code);end=start+code.length;}
  }
 }
 const tokens=[...found.values()].sort((a,b)=>a.start-b.start);let cursor=0,depth=0;
 return tokens.filter(t=>{for(;cursor<t.start;cursor++){if('「『'.includes(text[cursor]))depth++;else if('」』'.includes(text[cursor]))depth=Math.max(0,depth-1);}return depth===0;});
}
export function referenceChoiceGroups(q){
 if(q.type==='single')return [{id:'$single',options:q.options}];
 return (q.fields||[]).map(f=>fieldPresentation(q,f)).filter(f=>f.options?.length).map(f=>({id:f.id,options:f.options}));
}
export function explanationReferencePresentation(q,text,{orders=reviewedOptionOrders[q.id]}={}){
 if(reviewedSequenceQuestion(q)){
  text=String(text??'');const changes=sequenceExplanationChanges(q,text);let result=text;
  for(const c of [...changes].reverse())result=result.slice(0,c.start)+c.replacement+result.slice(c.end);
  return {text:result,changes,issues:[]};
 }
 text=String(text??'');const tokens=choiceReferenceTokens(text),groups=referenceChoiceGroups(q),changes=[],issues=[];let result=text;
 // Current nested multi-field choices are not shuffled. Their circled numbers
 // may identify subquestions; never reinterpret them as a global option index.
 if(q.type!=='single'&&q.fields?.length!==1)return {text,changes,issues,retained:'non_shuffled_multi_field'};
 for(const t of [...tokens].reverse()){
  const contexts=[...text.slice(0,t.start).matchAll(/第[（(]?([0-9０-９]+)[）)]?(?:小)?題|(?:^|\n)[（(]([0-9０-９]+)[）)]/gu)];
  const n=contexts.at(-1),field=n?q.fields?.[Number((n[1]||n[2]).normalize('NFKC'))-1]?.id:null;
  const group=q.type==='single'?groups[0]:groups.length===1?groups[0]:groups.find(g=>g.id===field);
  if(!group){if(groups.length)issues.push({...t,reason:'field_context_required'});continue;}
  const id=orders?.[group.id]?.[t.index],position=group.options.findIndex(o=>o.id===id),option=group.options[position];
  if(!option){issues.push({...t,reason:'source_option_order_required'});continue;}
  let body=option.content?.text?.trim()||'',replacement;
  if(/^[「『]/u.test(text.slice(t.end).trimStart())||body&&text.slice(t.end).trimStart().startsWith(body))replacement='';
  else replacement=body?`「${body}」`:`畫面選項 ${String.fromCharCode(65+position)}（圖示）`;
  result=result.slice(0,t.start)+replacement+result.slice(t.end);changes.push({...t,field:group.id,option_id:id,replacement});
 }
 return {text:result,changes:changes.reverse(),issues:issues.reverse()};
}
export function explanationReferenceContent(q,content,options){
 if(!q||!content)return content;
 const source=content.layout?sourceStream(content):content.text;if(typeof source!=='string')return content;
 const result=explanationReferencePresentation(q,source,options);if(!result.changes.length)return content;
 if(!content.layout)return {...content,text:result.text};
 let view=content;for(const change of [...result.changes].reverse())view=replaceTextRange(view,change.start,change.end,change.replacement);return view;
}
