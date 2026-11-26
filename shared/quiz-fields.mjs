import {appendSingleChoiceOptions} from './quiz-choice.mjs';
import {attachPastInputKeyboard} from './quiz-past-input.mjs';
import {fieldPresentation,fieldsAreSingleChoice} from './quiz-fields-presentation.mjs';
import {booleanChoicePresentation} from './quiz-boolean-choice.mjs';
import {choiceQuestionPresentation} from './quiz-choice-conversion.mjs';
import {readingPresentation} from './quiz-reading-presentation.mjs';
import {fieldsReviewPresentation,appendFieldReviewStatus,decorateFieldReviewOption,appendFieldReviewReference} from './quiz-fields-review.mjs';
import {validWorkSpec,workValue,workResponseError,renderWorkInput,renderSavedWork} from './quiz-work-response.mjs';
import {groupingDrawingPlan} from './quiz-grouping-drawing.mjs';
import {renderSequenceCards} from './quiz-sequence.mjs';
import {matchingPresentation} from './quiz-matching-presentation.mjs';
import {renderMatchingBoard,appendMatchingOriginal} from './quiz-matching.mjs';
import {answerTemplatePresentation,mountAnswerTemplate} from './quiz-answer-templates.mjs';
import {phoneticWordFields} from './quiz-field-input-aids.mjs';
import {inlineReadingPlan} from './quiz-reading-inline.mjs';
import {mountReadingWorkbench,readingWorkbenchSupported} from './quiz-reading-workbench.mjs';
import {workAnswerPresentation,mountWorkAnswerInputs,workResponseContent} from './quiz-work-answer-layout.mjs';
import {sourceStream} from './quiz-content-slices.mjs';
import {circleColoringPlan,renderCircleColoring} from './quiz-circle-coloring.mjs';
import {isFractionPartition,fractionPartitionPlan,readFractionPartition,renderFractionPartition,fractionPartitionSummary} from './quiz-fraction-partition.mjs';
import {isSourceRoute,sourceRoutePlan,readSourceRoute,renderSourceRoute,sourceRouteSummary} from './quiz-source-route.mjs';
import {fractionColorsPlan,isFractionColorsQuestion,readFractionColors,renderFractionColors} from './quiz-fraction-colors.mjs';
import {fractionComparisonPlan,readFractionComparison,renderFractionComparison} from './quiz-fraction-comparison.mjs';
import {fractionShadingPlan,fractionBarPlan,fractionRectPlan,isFractionShadingMatch,fractionShadingMatchPlan,readFractionShading,renderFractionShading} from './quiz-fraction-shading.mjs';
export {fieldsAreSingleChoice,fieldsPromptPresentation} from './quiz-fields-presentation.mjs';

const integerFields = {
 'hlg3m_019d47a1_fraction_bar_5': ['numerator'],
 'hlg3m_05507d9c_fraction_circle_2': ['brother','sister'],
 'hlg3m_05507d9c_fraction_circle_4': ['amount','numerator'],
};
const own=(o,k)=>o&&Object.hasOwn(o,k);
const object=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
const make=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
export function fieldsValues(q,raw){
 try{const d=JSON.parse(raw);if(d.v===1&&object(d.f))return d.f;}catch{}
 return Object.fromEntries(q.fields.map(f=>[f.id,['set','sequence'].includes(f.input)?null:'']));
}
export function fieldsResponseError(q,raw){
 const partition=fractionPartitionPlan(q);
 if(isFractionPartition(q)&&!partition)return '這題的原圖與分割區不符，請回報題目。';
 if(partition){
  const draft=readFractionPartition(fieldsValues(q,raw).partition);
  if(!draft)return '請先選一種分法。';
  if(!draft.regions.length)return '請在色紙上塗色。';
 }
 const route=sourceRoutePlan(q);
 if(isSourceRoute(q)&&!route)return '這題的原圖與路線不符，請回報題目。';
 if(route&&!raw)return '請依序點路線，走到終點再送出。';
 const colors=fractionColorsPlan(q);
 if(isFractionColorsQuestion(q)&&!colors)return '這題的圖片與塗色區不符，請回報題目。';
 const fraction=fractionComparisonPlan(q);
 const matchingShade=fractionShadingMatchPlan(q);
 if(isFractionShadingMatch(q)&&!matchingShade)return '這題的原圖與塗色區不符，請回報題目。';
 const shading=fractionShadingPlan(q)||fractionBarPlan(q)||fractionRectPlan(q)||matchingShade;
 if(colors&&!raw)return '請把蛋糕每一片都塗上顏色。';
 if(shading&&!raw)return '請在原圖塗色，再送出答案。';
 if(fraction&&!raw)return '請在兩個圓上塗色，再選比較符號。';
 if(typeof raw!=='string'||!raw||(q.work?.input==='sketch'?new TextEncoder().encode(raw).length>300000:raw.length>2000))return '請完成每個答案欄與要求的計算過程。';
 let d;try{d=JSON.parse(raw)}catch{return '答案格式不完整，請更新儲存狀態後再試。'}
 if(!object(d)||d.v!==1||!object(d.f)||Object.keys(d).some(k=>!(q.work?['v','f','w']:['v','f']).includes(k))||Object.keys(d.f).length!==q.fields.length)return '請完成每個答案欄。';
 if(route&&(readSourceRoute(route,d.f.route)?.at(-1)!==route.end))return '請依序點路線，走到終點再送出。';
 if(colors&&readFractionColors(colors,d)?.size!==colors.regions.length)return '請把蛋糕每一片都塗上顏色。';
 if(fraction&&(!readFractionComparison(fraction,d)||d.f.left==='0'||d.f.right==='0'))return '請在左右兩個圓上各塗色，再送出答案。';
 if(shading&&!readFractionShading(shading,d)?.size)return '請在原圖塗色，再送出答案。';
 const workError=workResponseError(q,d.w);if(workError)return workError;
 const reading=readingPresentation(choiceQuestionPresentation(q));
 for(const [i,storedField] of q.fields.entries()){
  const f=reading?.fields?.[i]??fieldPresentation(q,storedField);
  const v=d.f[f.id];if(!own(d.f,f.id))return '請完成每個答案欄。';
  if(['math','text','single'].includes(f.input)){
   if(typeof v!=='string'||!v.trim()||v.length>250)return `請完成「${f.label}」，每格最多250字。`;
   if(f.input==='single'&&!f.options.some(o=>o.id===v))return `請選擇「${f.label}」的答案。`;
  }else if(!Array.isArray(v)||v.some(x=>typeof x!=='string'||!f.options.some(o=>o.id===x))||new Set(v).size!==v.length||f.input==='sequence'&&v.length!==f.options.length)return `請完成「${f.label}」的${f.input==='sequence'?'排列':'選擇'}。`;
 }
 return '';
}

export function renderFieldsInputs(host,q,{raw='',locked=false,saved=locked,onChange,renderContent,textInputAids={},review=null}){
 if(isFractionPartition(q)){
  const plan=fractionPartitionPlan(q);
  if(!plan||!renderFractionPartition(host,plan,{value:fieldsValues(q,raw).partition,locked,review,renderContent,
   onChange:value=>onChange(JSON.stringify({v:1,f:{partition:value}}))}))host.append(make('p','原圖無法顯示，請重新整理頁面。'));
  return host.lastElementChild;
 }
 const route=sourceRoutePlan(q);
 if(route){
  if(!renderSourceRoute(host,route,{value:fieldsValues(q,raw).route,locked,correct:review?.correct,renderContent,
   onChange:value=>onChange(JSON.stringify({v:1,f:{route:value}}))}))host.append(make('p','原圖無法顯示，請重新整理頁面。'));
  return host.lastElementChild;
 }
 const colors=fractionColorsPlan(q);
 if(colors){
  if(!renderFractionColors(host,q,colors,{response:{v:1,f:fieldsValues(q,raw),w:workValue(raw)},
   locked,review,renderContent,onChange}))host.append(make('p','圖片無法顯示，請重新整理頁面。'));
  return host.lastElementChild;
 }
 const circle=circleColoringPlan(q);
 if(circle&&renderCircleColoring(host,circle,{value:fieldsValues(q,raw).regions,locked,correct:review?.correct,onChange:value=>onChange(JSON.stringify({v:1,f:{regions:value}})),renderContent}))return host.lastElementChild;
 const rectangle=fractionRectPlan(q);
 const shading=fractionShadingPlan(q)||(q.fields.length===1&&rectangle);
 if(shading&&renderFractionShading(host,shading,{response:{f:fieldsValues(q,raw),w:workValue(raw)},
  locked,review:locked?review:null,onChange,renderContent}))return host.lastElementChild;
 const fraction=fractionComparisonPlan(q);
 if(fraction&&renderFractionComparison(host,q,fraction,{
  value:{f:fieldsValues(q,raw),w:workValue(raw)},locked,
  feedback:locked?fieldsReviewPresentation(q,raw,review):null,onChange,renderContent,
 }))return host.lastElementChild;
 const matchingShade=fractionShadingMatchPlan(q);
 const bar=fractionBarPlan(q)||rectangle||matchingShade;
 const grouping=groupingDrawingPlan(q),values=fieldsValues(q,raw),group=make('div'),phonetic=phoneticWordFields(choiceQuestionPresentation(q));group.className='quiz-fields';group.classList.toggle('quiz-fields-single',q.fields.length===1);
 const workLayout=workAnswerPresentation(q);if(workLayout)group.classList.add('quiz-work-answer-layout');
 const inline=inlineReadingPlan(q),reading=inline?.reading??readingPresentation(choiceQuestionPresentation(q));group.classList.toggle('quiz-reading-fields',Boolean(reading));
 const shown=q.fields.map((f,i)=>reading?.fields?.[i]??fieldPresentation(q,f)),feedback=locked?fieldsReviewPresentation({...q,fields:shown},raw,review):null;
 const matching=matchingPresentation(choiceQuestionPresentation(q),shown);
 const formatPair=(id,value)=>{const f=shown.find(f=>f.id===id);return f.label+'：'+formatted(f,value)};
 let work=workValue(raw);
 const changed=()=>onChange(JSON.stringify({v:1,f:values,...(q.work?{w:work}:{} )}));
 const onBar=bar&&renderFractionShading(group,bar,{response:{f:values,w:work},locked,review:locked?review:null,
  renderContent,showCount:Boolean(matchingShade),onChange:payload=>{
   const next=JSON.parse(payload);
   values.colored=next.f.colored;work=next.w;changed();
  }});
 if(onBar)group.lastElementChild.style.gridColumn='1/-1';
 else{
  const editor=renderWorkInput(group,q,{raw,locked,saved,renderContent,onChange:value=>{work=value;changed()}});
  group.sketchEditors=editor?[editor]:[];
 }
 if(!matchingShade&&!fieldsAreSingleChoice(q)&&matching?.covered.size!==q.fields.length)group.append(make('p',feedback?'你原本的作答已保留；請看各小題旁的核對結果。':q.fields.length===1?'填好答案後送出。':'依照題目順序填好每格，再一起送出。'));
 for(const [fieldIndex,storedField] of q.fields.entries()){
  if(onBar&&storedField.id==='colored')continue;
  if(matching?.covered.has(fieldIndex)){
   const board=matching.boards.find(b=>b.indices[0]===fieldIndex);if(board)renderMatchingBoard(group,board,{values,locked,renderContent,accepted:feedback?Object.fromEntries(board.left.map(l=>[l.id,feedback[shown.findIndex(f=>f.id===l.id)]?.accepted])):null,onChange:next=>{Object.assign(values,next);changed();}});
   continue;
  }
  const f=reading?.fields?.[fieldIndex]??fieldPresentation(q,storedField);
  const slot=make('fieldset'),legend=make('legend',f.label),id='field-'+q.id+'-'+f.id;slot.className='quiz-field';slot.append(legend);
  if(reading?.questions[fieldIndex]){const question=reading.questions[fieldIndex];
   if(question.media.length){legend.textContent=reading.numbered?`第${reading.numbers[fieldIndex]}小題`:f.label;const material=make('div');material.className='quiz-field-material';renderContent(material,reading.reviewKind==='picture-bank'?{...question,text:'',layout:question.layout.slice(1)}:question);slot.append(material);}
   else{legend.textContent=reading.numbered?`(${reading.numbers[fieldIndex]}) `:'';renderContent(legend,question);}
   slot.append(make('p',feedback?.[fieldIndex]?(f.input==='set'?'核對你的勾選結果。':f.input==='single'?'核對你的選擇。':'核對這一格的答案。'):f.input==='set'?'勾選所有正確選項。':f.input==='single'?'選擇一個答案。':'請填寫答案。'));
  }
  appendFieldReviewStatus(slot,feedback?.[fieldIndex]);
  if(['math','text'].includes(f.input)){
   const input=make('input');input.id=id;input.type='text';input.maxLength=250;input.value=typeof values[f.id]==='string'?values[f.id]:'';input.disabled=locked;input.autocomplete='off';input.setAttribute('aria-label',f.label);
   const integer=Boolean(grouping||bar?.integerIds.has(f.id)||integerFields[q.id]?.includes(f.id));
   if(integer)input.inputMode='numeric';
   else if(f.input==='math')input.placeholder='分數可以用 / 表示';
   input.addEventListener('input',()=>{values[f.id]=input.value;changed()});slot.append(input);
   if(f.input==='math'&&!integer)attachPastInputKeyboard(slot,input,{math:true});
   if(phonetic.has(f.id))slot.classList.add('quiz-answer-bopomofo-slot');
   if(f.input==='text'&&!inline?.slots.some(s=>s.field===f.id))attachPastInputKeyboard(slot,input,{bopomofo:phonetic.size?phonetic.has(f.id):textInputAids.bopomofo===true,punctuation:textInputAids.punctuation===true});
  }else if(f.input==='single'){
   appendSingleChoiceOptions(slot,{name:id,options:f.options.map(o=>({...o,value:o.id})),selected:values[f.id],locked,literalSymbols:['diagram-symbols','image-item-marks'].includes(answerTemplatePresentation(q)?.mode),badgeForOption:storedField.input==='text'&&f!==storedField?o=>o.id:undefined,onSelect:v=>{values[f.id]=v;changed()},renderBody:(box,o)=>renderContent(box,o.content)});
   if(feedback?.[fieldIndex])slot.querySelectorAll(':scope > .student-option').forEach((row,i)=>decorateFieldReviewOption(row,feedback[fieldIndex].options[i]));
  }else if(f.input==='set'){
   const checks=[];const update=()=>{const selected=checks.filter(x=>x.input.checked).map(x=>x.id);values[f.id]=selected.length?selected:null;none.checked=false;changed()};
   for(const [i,o]of f.options.entries()){const label=make('label'),input=make('input');input.type='checkbox';input.disabled=locked;input.checked=Array.isArray(values[f.id])&&values[f.id].includes(o.id);const body=make('span');renderContent(body,o.content);label.append(input,body);slot.append(label);decorateFieldReviewOption(label,feedback?.[fieldIndex]?.options[i]);checks.push({id:o.id,input});input.addEventListener('change',update)}
   const label=make('label'),none=make('input');none.type='checkbox';none.disabled=locked;none.checked=Array.isArray(values[f.id])&&values[f.id].length===0;none.addEventListener('change',()=>{if(none.checked)checks.forEach(x=>x.input.checked=false);values[f.id]=none.checked?[]:null;changed()});label.append(none,make('span','這些選項都不選'));slot.append(label);decorateFieldReviewOption(label,feedback?.[fieldIndex]?.none);
  }else if(f.input==='sequence'){
   renderSequenceCards(slot,f,{value:values[f.id],locked,onChange:value=>{values[f.id]=value;changed()},renderContent,accepted:feedback?.[fieldIndex]?.accepted});
  }
  appendFieldReviewReference(slot,feedback?.[fieldIndex],v=>formatted(f,v),formatPair);group.append(slot);
 }
 if(matching)appendMatchingOriginal(group,matching.original,renderContent);else if(!reading)mountAnswerTemplate(group,choiceQuestionPresentation(q),{renderContent,fieldFeedback:feedback});
 mountReadingWorkbench(group,q,reading,{renderContent,fieldFeedback:feedback});mountWorkAnswerInputs(group,q,{renderContent,fieldFeedback:feedback});host.append(group);return group;
}
export function renderFieldsChoices(host,q,{renderContent,raw='',review=null,referenceAnswer=null,showWork=true}){
 if(isFractionPartition(q)){
  const example=(referenceAnswer??review?.answer)?.fields?.partition?.[0];
  if(showWork&&(raw||example))renderFieldsInputs(host,q,{raw:raw||JSON.stringify({v:1,f:{partition:example}}),locked:true,renderContent,review});
  else if(raw)host.append(make('p',fieldsResponseSummary(q,raw)));
  return;
 }
 const route=sourceRoutePlan(q);
 if(route){
  if(raw&&showWork){renderFieldsInputs(host,q,{raw,locked:true,onChange:()=>{},renderContent,review});return;}
  if(raw)host.append(make('p','你的路線：'+fieldsResponseSummary(q,raw)));
  const answer=referenceAnswer??review?.answer;
  if(answer?.format==='fields-v1'&&Array.isArray(answer.fields?.route)){
   host.append(make('p','參考路線：'+fieldsAnswerSummary(q,answer)));
  }
  return;
 }
 if(raw&&showWork&&(fractionColorsPlan(q)||fractionComparisonPlan(q)||fractionShadingPlan(q)||fractionBarPlan(q)||fractionRectPlan(q)||fractionShadingMatchPlan(q))){renderFieldsInputs(host,q,{raw,locked:true,saved:true,onChange:()=>{},renderContent,review});return;}
 const circle=circleColoringPlan(q);
 if(circle&&renderCircleColoring(host,circle,{value:raw?fieldsValues(q,raw).regions:referenceAnswer?.fields?.regions?.[0],locked:true,correct:raw?review?.correct:undefined,renderContent}))return;
 if(!raw&&answerTemplatePresentation(choiceQuestionPresentation(q))?.mode==='image-item-marks'){
  const given=referenceAnswer?.format==='fields-v1'?referenceAnswer.fields:null;
  const values=given&&q.fields.every(f=>given[f.id]?.length===1)?Object.fromEntries(q.fields.map(f=>[f.id,given[f.id][0]])):null;
  renderFieldsInputs(host,q,{raw:values?JSON.stringify({v:1,f:values}):'',locked:true,onChange:()=>{},renderContent});
  return;
 }
 const workPlan=workAnswerPresentation(q);if((workPlan?.responseGroups||['within-template','source-slots'].includes(workPlan?.workPosition))&&!raw&&!host.querySelector(':scope > .quiz-work-source-reference')){const source=make('div');source.className='quiz-work-source-reference';renderContent(source,workResponseContent(q,workPlan.passageEnd,workPlan.groupUnit==='layout'?q.prompt.layout.length:sourceStream(q.prompt).length,workPlan.groupUnit));host.append(source);}
 if(raw&&readingWorkbenchSupported(q,readingPresentation(choiceQuestionPresentation(q)))){if(host.querySelector('.quiz-reading-workbench'))return;renderFieldsInputs(host,q,{raw,locked:true,saved:true,onChange:()=>{},renderContent,review});return;}
 if(raw&&(answerTemplatePresentation(choiceQuestionPresentation(q))||workAnswerPresentation(q))){if(host.querySelector('.quiz-has-answer-template,.quiz-work-answer-layout'))return;const group=renderFieldsInputs(host,showWork?q:{...q,work:undefined},{raw,locked:true,saved:true,onChange:()=>{},renderContent,review});mountWorkAnswerInputs(group,q,{renderContent,fieldFeedback:fieldsReviewPresentation(q,raw,review)});return;}
 if(showWork&&raw&&q.work)renderSavedWork(host,q,raw,{renderContent});
 const reading=readingPresentation(choiceQuestionPresentation(q));
 const shown=(q.fields||[]).map((f,i)=>reading?.fields?.[i]??fieldPresentation(q,f)),feedback=fieldsReviewPresentation({...q,fields:shown},raw,review),formatPair=(id,v)=>{const f=shown.find(f=>f.id===id);return f.label+'：'+formatted(f,v)};
 const matching=matchingPresentation(choiceQuestionPresentation(q),shown);
 for(const [index,stored] of (q.fields||[]).entries()){const f=shown[index],reference=referenceAnswer?.format==='fields-v1'?referenceAnswer.fields?.[f.id]:null;
  if(matching?.covered.has(index)){const board=matching.boards.find(b=>b.indices[0]===index);if(board)renderMatchingBoard(host,board,{values:fieldsValues(q,raw),locked:true,referenceOnly:!raw&&referenceAnswer?.format==='fields-v1',renderContent,accepted:review?.answer?.format==='fields-v1'?review.answer.fields:referenceAnswer?.format==='fields-v1'?referenceAnswer.fields:null});continue;}
  if(!f.options&&!reading?.questions[index]&&!feedback?.[index]&&!reference)continue;
  const section=make('section');section.className='quiz-field-preview'+(f.input==='set'?' quiz-field-preview-set':'');const question=reading?.questions[index],hasMedia=question?.media.length;const title=make('h5',question&&!hasMedia?(reading.numbered?`(${reading.numbers[index]}) `:''):f.label);if(question&&!hasMedia)renderContent(title,question);section.append(title);if(hasMedia)renderContent(section,reading.reviewKind==='picture-bank'?{...question,text:'',layout:question.layout.slice(1)}:question);const display=f.input==='single'?booleanChoicePresentation(f.options):null;
  appendFieldReviewStatus(section,feedback?.[index]);
  if(f.input==='sequence')renderSequenceCards(section,f,{value:raw?fieldsValues(q,raw)[f.id]:reference?.[0],locked:true,renderContent,accepted:feedback?.[index]?.accepted});
  else if(f.options)f.options.forEach((o,i)=>{const row=make('div');row.className='preview-option';row.append(make('strong',(display?.[i].badge??String.fromCharCode(65+i))+' '));if(display)row.append(make('span',display[i].text));else renderContent(row,o.content);decorateFieldReviewOption(row,feedback?.[index]?.options[i]);section.append(row);});
  if(feedback?.[index]?.none&&feedback[index].none.state!=='neutral'){const row=make('div','這些選項都不選');row.className='preview-option';decorateFieldReviewOption(row,feedback[index].none);section.append(row);}
  appendFieldReviewReference(section,feedback?.[index],v=>formatted(f,v),formatPair);host.append(section);
  if(!feedback?.[index]&&Array.isArray(reference)){const box=make('div');box.className='quiz-field-review-reference';box.append(make('p','參考答案：'+reference.map(v=>formatted(f,v)).join(' 或 ')));section.append(box);}
  if(!feedback?.[index])for(const tuple of referenceAnswer?.tuples||[])if(tuple.fields[0]===f.id){const box=make('div');box.className='quiz-field-review-reference';box.append(make('strong','這些欄位須同時符合的完整配對'));for(const accepted of tuple.accepted)box.append(make('p',tuple.fields.map(id=>formatPair(id,accepted[id])).join('；')));section.append(box);}
 }
 if(matching)appendMatchingOriginal(host,matching.original,renderContent);
}
const formatted=(f,v)=>{
 if(f.input==='sketch')return v?.strokes?.length?'已儲存手寫內容（'+v.strokes.length+'筆）':'未填';
 const one=id=>{const i=f.options?.findIndex(o=>o.id===id)??-1;return i<0?String(id):f.options[i].content.text||`選項${i+1}`};
 return Array.isArray(v)?v.map(one).join(f.input==='sequence'?' → ':'、')||'都不選':['single'].includes(f.input)?one(v):String(v??'未填');
};
export function fieldsResponseSummary(q,raw){const v=fieldsValues(q,raw),route=sourceRoutePlan(q);if(isFractionPartition(q))return fractionPartitionSummary(v.partition);if(route)return sourceRouteSummary(route,readSourceRoute(route,v.route));const reading=readingPresentation(choiceQuestionPresentation(q));return q.fields.map((storedField,i)=>{const f=reading?.fields?.[i]??fieldPresentation(q,storedField);return `${f.label}：${formatted(f,v[f.id])}`}).join('；');}
export function fieldsAnswerSummary(q,answer){
 if(isFractionPartition(q))return fractionPartitionSummary(answer.fields.partition[0]);
 const route=sourceRoutePlan(q);
 if(route)return answer.fields.route.map(value=>sourceRouteSummary(route,readSourceRoute(route,value))).join('／');
 const reading=readingPresentation(choiceQuestionPresentation(q));
 const parts=q.fields.map((storedField,i)=>{const f=reading?.fields?.[i]??fieldPresentation(q,storedField);return `${f.label}：${(answer.fields[f.id]||[]).map(v=>formatted(f,v)).join(' 或 ')}`});
 for(const tuple of answer.tuples||[])parts.push('可接受的完整配對：'+tuple.accepted.map(a=>tuple.fields.map(id=>{const f=q.fields.find(f=>f.id===id);return `${f.label} ${formatted(f,a[id])}`}).join('、')).join('；'));
 return parts.join('；');
}

// The browser checks structure before import; the SQL validator independently
// checks canonical math values, tuple consistency and every nested key again.
export function validateFieldsQuestion(q,checkContent){
 const fail=()=>{throw Error('題庫格式錯誤：多格題組的欄位或答案不完整。')};
 const keys=(o,allowed)=>object(o)&&Object.keys(o).every(k=>allowed.includes(k));
 if(own(q,'work')&&!validWorkSpec(q))fail();
 if('options'in q||!Array.isArray(q.fields)||q.fields.length<1||q.fields.length>20||!keys(q.answer,['format','fields','tuples'])||q.answer.format!=='fields-v1'||!object(q.answer.fields))fail();
 const ids=new Set();
 for(const f of q.fields){
  if(!keys(f,['id','label','input','options'])||typeof f.id!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(f.id)||['constructor','prototype','__proto__'].includes(f.id)||ids.has(f.id)||typeof f.label!=='string'||!f.label.trim()||f.label.length>120||!['math','text','single','set','sequence'].includes(f.input))fail();ids.add(f.id);
  const opts=new Set();
  if(['math','text'].includes(f.input)){if('options'in f)fail()}
  else{if(!Array.isArray(f.options)||f.options.length<2||f.options.length>8)fail();for(const o of f.options){if(!keys(o,['id','content'])||typeof o.id!=='string'||!/^[A-Za-z0-9_-]{1,40}$/.test(o.id)||opts.has(o.id))fail();opts.add(o.id);checkContent(o.content)}}
  const accepted=q.answer.fields[f.id];if(!Array.isArray(accepted)||accepted.length<1||accepted.length>20)fail();
  for(const value of accepted){if(['math','text','single'].includes(f.input)){if(typeof value!=='string'||!value.trim()||value.length>250||f.input==='single'&&!opts.has(value))fail()}else if(!Array.isArray(value)||new Set(value).size!==value.length||value.some(x=>typeof x!=='string'||!opts.has(x))||f.input==='sequence'&&value.length!==opts.size)fail()}
 }
 if(Object.keys(q.answer.fields).length!==ids.size||Object.keys(q.answer.fields).some(id=>!ids.has(id)))fail();
 if('tuples'in q.answer){if(!Array.isArray(q.answer.tuples)||q.answer.tuples.length<1||q.answer.tuples.length>20)fail();for(const t of q.answer.tuples){if(!keys(t,['fields','accepted'])||!Array.isArray(t.fields)||t.fields.length<2||t.fields.length>20||new Set(t.fields).size!==t.fields.length||t.fields.some(id=>!ids.has(id))||!Array.isArray(t.accepted)||!t.accepted.length||t.accepted.length>20)fail();for(const a of t.accepted)if(!keys(a,t.fields)||Object.keys(a).length!==t.fields.length||t.fields.some(id=>!own(a,id)))fail()}}
 return q;
}
