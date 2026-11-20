import {fieldsValues,fieldsResponseError,validateFieldsQuestion} from './quiz-fields.mjs';
import {attachPastInputKeyboard} from './quiz-past-input.mjs';
import {hasSketchFields,openSketchResponseError} from './quiz-open-sketch.mjs';
import {createSketchEditor,sketchImage} from './sketch/editor.mjs';
import {choiceQuestionPresentation} from './quiz-choice-conversion.mjs';
import {openSubquestionPresentation} from './quiz-open-subquestions.mjs';
import {answerTemplatePresentation,mountAnswerTemplate} from './quiz-answer-templates.mjs';
import {openCompositionReview} from './quiz-open-composition.mjs';
import {phoneticWordFields} from './quiz-field-input-aids.mjs';
import {phoneticWordReview} from './quiz-phonetic-word-review.mjs';
import {wordMeaningReview} from './quiz-word-meaning-review.mjs';

const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const only=(v,keys)=>object(v)&&Object.keys(v).every(k=>keys.includes(k));
const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
export const openResponseError=(q,raw)=>hasSketchFields(q)?openSketchResponseError(q,raw):fieldsResponseError(q,raw);
export const openReferenceSummary=(q,answer=q.answer)=>{const phonetic=phoneticWordReview(choiceQuestionPresentation(q),answer);if(phonetic)return phonetic.cards.map(c=>c.character+'：'+c.entries.map(e=>'注音 '+e.readings.join('／')+'；造詞 '+[...e.words,...e.given].join('、')).join('；')).join('；');const composed=openCompositionReview(choiceQuestionPresentation(q),answer);if(composed)return composed.groups.map(g=>g.title+'：'+g.examples.join('／')).join('；')+'；整組檢核：'+composed.criteria.join('、');return (openSubquestionPresentation(choiceQuestionPresentation(q))?.fields??choiceQuestionPresentation(q).fields).map(f=>{
 const ref=answer.fields[f.id];return `${f.label}：參考例答 ${ref.examples.join('／')}；檢核 ${ref.criteria.join('、')}`;
}).join('；');};

// Examples are review material, never an accepted-answer list for grading.
export function validateOpenQuestion(q,checkContent){
 const fail=()=>{throw Error('題庫格式錯誤：開放作答的欄位、參考例答或檢核重點不完整。');};
 if(!Array.isArray(q.fields)||q.fields.some(f=>!['text','sketch'].includes(f.input))||!only(q.answer,['format','fields'])||q.answer.format!=='self-review-v1'||!object(q.answer.fields))fail();
 const placeholders=Object.fromEntries(q.fields.map(f=>[f.id,['validation-only']]));
 validateFieldsQuestion({...q,type:'fields',fields:q.fields.map(f=>f.input==='sketch'?{...f,input:'text'}:f),answer:{format:'fields-v1',fields:placeholders}},checkContent);
 if(Object.keys(q.answer.fields).length!==q.fields.length||Object.keys(q.answer.fields).some(id=>!q.fields.some(f=>f.id===id)))fail();
 for(const field of q.fields){
  const ref=q.answer.fields[field.id];if(!only(ref,['examples','criteria']))fail();
  for(const [key,maxCount,maxLength]of[['examples',3,500],['criteria',4,150]]){
   const values=ref[key];if(!Array.isArray(values)||values.length<1||values.length>maxCount||values.some(v=>typeof v!=='string'||!v.trim()||v.length>maxLength))fail();
  }
 }
 return q;
}

export function renderOpenInputs(host,q,{raw='',locked=false,onChange,renderContent}){
 q=choiceQuestionPresentation(q);
 const presentation=openSubquestionPresentation(q);
 const values=fieldsValues(q,raw),group=make('div',undefined,'quiz-fields quiz-open-inputs'),phonetic=phoneticWordFields(q);
 group.classList.toggle('quiz-open-subquestions',Boolean(presentation));
 group.append(make('p','請依原題寫下自己的答案。儲存後可以查看參考例答與檢核重點，再完成自評。'));
 for(const field of presentation?.fields??q.fields){
  if(field.input==='sketch'){
   const slot=make('fieldset',undefined,'quiz-field quiz-open-sketch');slot.append(make('legend',field.label));
   if(locked){appendSketch(slot,values[field.id],field.label);}
   else{
    const board=make('div');slot.append(board);
    const editor=createSketchEditor(board,{value:object(values[field.id])?values[field.id]:{version:1,strokes:[]},onChange:value=>{values[field.id]=value;onChange(JSON.stringify({v:1,f:values}));},messages:{clearConfirm:'確定清除這一欄的手寫內容？可按「復原一步」恢復。',capacityHint:'最多80筆；請確認算式、直式或圖形完整，再一起送出。'}});
    group.sketchEditors??=[];group.sketchEditors.push(editor);
   }
   group.append(slot);continue;
  }
  const slot=make('fieldset',undefined,'quiz-field'),legend=make('legend',field.label),input=make('textarea');
  input.id='open-'+q.id+'-'+field.id;input.maxLength=250;input.rows=presentation?1:3;input.disabled=locked;input.autocomplete='off';input.setAttribute('aria-label',field.label);input.value=typeof values[field.id]==='string'?values[field.id]:'';
  input.addEventListener('input',()=>{values[field.id]=input.value;onChange(JSON.stringify({v:1,f:values}));});slot.append(legend,input);
  if(phonetic.has(field.id))slot.classList.add('quiz-answer-bopomofo-slot');
  if(phonetic.size?phonetic.has(field.id):field.label.includes('注音'))attachPastInputKeyboard(slot,input,{bopomofo:true});
  group.append(slot);
 }
 mountAnswerTemplate(group,q,{renderContent});host.append(group);return group;
}

function appendSketch(host,value,label){
 if(!value?.strokes?.length&&!value?.marks?.length){host.append(make('p','這一欄尚未儲存手寫內容。','helper'));return;}
 const svg=sketchImage(value);svg.setAttribute('aria-label',label+'・已儲存手寫內容');svg.classList.add('quiz-open-sketch-saved');host.append(svg,make('p','手寫內容已儲存，請對照參考例答與檢核重點。','helper'));
}
export function renderOpenSavedSketches(host,q,raw,{renderContent}={}){
 if(openSubquestionPresentation(choiceQuestionPresentation(q))||answerTemplatePresentation(choiceQuestionPresentation(q))){renderOpenInputs(host,q,{raw,locked:true,onChange:()=>{},renderContent});return;}
 if(!hasSketchFields(q))return;
 const values=fieldsValues(q,raw);
 for(const field of q.fields.filter(f=>f.input==='sketch')){const slot=make('section',undefined,'quiz-field quiz-open-sketch');slot.append(make('h4',field.label));appendSketch(slot,values[field.id],field.label);host.append(slot);}
}
export function destroyOpenSketchEditors(root){root?.querySelectorAll('.quiz-open-inputs,.quiz-fields').forEach(group=>group.sketchEditors?.forEach(editor=>editor.destroy()));}
export function disableOpenSketchEditors(root,disabled){root?.querySelectorAll('.quiz-open-inputs,.quiz-fields').forEach(group=>group.sketchEditors?.forEach(editor=>editor.setDisabled(disabled)));}

export function renderOpenReferences(host,q,answer,{raw=''}={}){
 const words=wordMeaningReview(q,answer);if(words){renderWordMeanings(host,words);return true;}
 q=choiceQuestionPresentation(q);const phonetic=phoneticWordReview(q,answer,{raw});if(phonetic){renderPhoneticWordReferences(host,phonetic);return true;}const composed=openCompositionReview(q,answer,{raw});if(!composed)return false;
 const box=make('div',undefined,'quiz-open-composition-review');
 for(const group of composed.groups){
  const section=make('section',undefined,'quiz-open-reference');section.append(make('h5',group.title));
  if(group.student!==null)section.append(make('p',group.fragment?'你的接寫內容：':'你的整組作答：'),make('p',group.student,'quiz-open-complete-text'));
  section.append(make('p',group.fragment?'原參考接寫片段（請連同上方原句閱讀）：':'參考例答（其他合理答案也可以）：'));const list=make('ul',undefined,'quiz-open-complete-examples');for(const text of group.examples)list.append(make('li',text));section.append(list);box.append(section);
 }
 const notes=make('section',undefined,'quiz-open-reference');notes.append(make('h5','把整組連起來想'));
 if(composed.guide)notes.append(make('p',composed.guide.explanation));
 const criteria=make('ul');for(const text of [...new Set([...composed.criteria,...(composed.guide?.checks||[])])])criteria.append(make('li',text));notes.append(criteria);box.append(notes);
 renderWritingSupplement(box,composed.guide,{family:composed.family});
 host.append(box);return true;
}

function renderWordMeanings(host,model){
 const box=make('div',undefined,'quiz-word-meaning-review');
 for(const card of model.cards){const section=make('section',undefined,'quiz-open-reference quiz-word-meaning-card');section.append(make('h5',card.character),make('p',card.meaning,'quiz-word-meaning-text'));const list=make('ul',undefined,'quiz-word-meaning-examples');for(const word of card.examples)list.append(make('li',word));section.append(list);box.append(section);}host.append(box);
}

function renderPhoneticWordReferences(host,model){
 const box=make('div',undefined,'quiz-open-composition-review quiz-phonetic-word-review');
 for(const card of model.cards){
  const section=make('section',undefined,'quiz-open-reference quiz-phonetic-word-card');section.append(make('h5',card.character),make('p',card.note));
  for(const [i,entry]of card.entries.entries()){
   const group=make('div',undefined,'quiz-phonetic-word-reading');if(card.entries.length>1)group.append(make('h6','第'+(i+1)+'組讀音'+(entry.given.length?'（'+entry.given.join('、')+'）':'')));
   if(entry.student){group.append(make('p','你的作答：','helper'));const own=make('dl',undefined,'quiz-phonetic-word-original'),value=make('dd',entry.student.phonetic||'【未填】');if(entry.phoneticCheck)value.classList.add('quiz-phonetic-value-'+entry.phoneticCheck.status);own.append(make('dt','注音'),value);if(entry.wordField)own.append(make('dt','造詞'),make('dd',entry.student.word||'【未填】'));group.append(own);}
   if(entry.phoneticCheck){const check=entry.phoneticCheck,notice=make('div',undefined,'quiz-phonetic-check quiz-phonetic-check-'+check.status);notice.append(make('strong',check.label),make('p',check.detail));if(check.readings.length)notice.append(make('p','核對讀音：'+check.readings.join('／')));group.append(notice);}
   const reference=make('dl',undefined,'quiz-phonetic-word-original');reference.append(make('dt','注音參考'),make('dd',entry.readings.join('／')));if(entry.words.length)reference.append(make('dt','造詞原參考'),make('dd',entry.words.join('、')));if(entry.given.length)reference.append(make('dt','原題提供的詞'),make('dd',entry.given.join('、')));group.append(reference);
   for(const text of entry.issues)group.append(make('p',text,'quiz-phonetic-word-issue'));
   if(entry.supplements.length){group.append(make('h6','更多造詞（同讀音）'));for(const supplement of entry.supplements){if(entry.readings.length>1)group.append(make('p',supplement.reading+'：'));const list=make('ul',undefined,'quiz-phonetic-word-examples');for(const word of supplement.words){const item=make('li');item.append(make('strong',word.word),make('span',word.reading));list.append(item);}group.append(list);}}
   else group.append(make('p','這個讀音可用的常見組合較少，先熟悉上面的原參考，不必為了數量拼湊詞語。','helper'));
   const details=make('details'),summary=make('summary','原檢核要求'),list=make('ul');for(const text of entry.criteria)list.append(make('li',text));details.append(summary,list);group.append(details);section.append(group);
  }box.append(section);
 }
 const source=make('p','注音標示只核對字音及已知詞音，不代替整組自評；補充詞例不是唯一答案。資料提供者：教育部，CC BY-ND 3.0 TW。字詞與讀音來源：','helper');for(const [title,url]of [['《國語小字典》','https://language.moe.gov.tw/001/Upload/Files/site_content/M0001/respub/dict_mini_download.html'],['《國語辭典簡編本》','https://language.moe.gov.tw/001/Upload/Files/site_content/M0001/respub/dict_concised_download.html'],['《重編國語辭典修訂本》','https://language.moe.gov.tw/001/Upload/Files/site_content/M0001/respub/dict_reviseddict_download.html']]){const link=make('a',title);link.href=url;link.target='_blank';link.rel='noopener';source.append(link,document.createTextNode(' '));}source.append(document.createTextNode('20260929版；量詞組合另為用法示範。'));box.append(source);host.append(box);
}

export function renderWritingSupplement(host,guide,{family='sentence',explain=false}={}){
 if(!guide)return false;
 const wrapper=make('div',undefined,'quiz-open-composition-review'),extra=make('section',undefined,'quiz-open-reference quiz-writing-supplement');
 extra.append(make('h5',guide.kind==='usage'?'更多完整句子用法':family==='phrase'?'更多短語例子':'更多造句例子'),make('p','以下是補充的用法示範，不是唯一答案，也不是系統判分條件。'));
 if(explain){extra.append(make('p',guide.explanation));const checks=make('ul');for(const text of guide.checks??[])checks.append(make('li',text));extra.append(checks);}
 const list=make('ul',undefined,'quiz-open-complete-examples');for(const text of guide.examples)list.append(make('li',text));extra.append(list);
 if(guide.sentences?.length){extra.append(make('h5','放進完整句子讀一讀'));const sentences=make('ul',undefined,'quiz-open-complete-examples');for(const text of guide.sentences)sentences.append(make('li',text));extra.append(sentences);}
 wrapper.append(extra);host.append(wrapper);return true;
}

export function renderOpenReview(host,q,review,{busy=false,pending=false,draftNote='',onNoteChange=()=>{},onSelfCheck,raw=''}){
 q=choiceQuestionPresentation(q);
 const presentation=openSubquestionPresentation(q);
 const box=make('section',undefined,'answer-preview quiz-open-review');box.tabIndex=-1;
 const words=wordMeaningReview(q,review.answer);
 if(!words){box.append(make('h4','開放作答・核對自己的想法'));box.append(make('p','這題不以單一例答判對錯。請對照原題要求與下方重點，確認自己的答案。'));}
 if(!renderOpenReferences(box,q,review.answer,{raw}))for(const field of presentation?.fields??q.fields){
  const ref=review.answer.fields[field.id],section=make('section',undefined,'quiz-open-reference');section.append(make('h5',field.label),make('p','參考例答（其他合理答案也可以）：'));
  const examples=make('ul');for(const text of ref.examples)examples.append(make('li',text));section.append(examples,make('p','檢核重點：'));const criteria=make('ul');for(const text of ref.criteria)criteria.append(make('li',text));section.append(criteria);box.append(section);
 }
 if(review.assessment?.status==='self_checked'){
  box.append(make('p',review.assessment.rating==='understood'?'已完成自評：我的答案符合檢核重點。':'已完成自評：我還想再練習或修改。','notice'));
  if(review.assessment.note)box.append(make('p','我的想法：'+review.assessment.note));
 }else{
  const label=make('label','想修改或再練習的地方（選填）'),note=make('textarea');note.maxLength=250;note.rows=2;note.value=draftNote;note.disabled=busy||pending;note.setAttribute('aria-label','自評想法（選填）');label.append(note);box.append(label);
  note.addEventListener('input',()=>onNoteChange(note.value));
  const actions=make('div',undefined,'toolbar quiz-open-self-check');
  for(const [rating,text]of[['understood','我的答案符合重點'],['practice','我還想再練習']]){
   const button=make('button',text,rating==='understood'?'quiz-primary':'secondary');button.type='button';button.disabled=busy||pending;button.addEventListener('click',()=>onSelfCheck(rating,note.value));actions.append(button);
  }
  box.append(actions);
 }
 host.append(box);return box;
}
