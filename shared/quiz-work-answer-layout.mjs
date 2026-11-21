import {workAnswerSources,answerTemplateSources} from './quiz-answer-template-sources.mjs';
import {presentationSignature} from './quiz-presentation-signature.mjs';
import {sliceContent,sourceStream} from './quiz-content-slices.mjs';
import {deriveAnswerTemplate,compactTemplateFeedback} from './quiz-answer-templates.mjs';
import {validWorkSourceSlots,mountWorkSourceSlots} from './quiz-work-source-slots.mjs';

// Reviewed response roles only. Never infer an answer, field, or work area.
export function workAnswerPresentation(q,registry=workAnswerSources){
 const p=registry[q?.id];if(!p||q.type!=='fields'||!q.fields?.length)return null;
 const mapped=p.responseWorkMap===true;
 if(p.responseWorkMap!==undefined&&!mapped||p.fieldInputs&&!mapped)return null;
 if(mapped){if(!p.responseGroups||!Array.isArray(p.fieldInputs)||p.fieldInputs.length!==q.fields.length||q.fields.some((f,i)=>!['math','text'].includes(f.input)||f.input!==p.fieldInputs[i]))return null;}
 else if(q.fields.some(f=>f.input!=='math'))return null;
 if(![p.guard,p.partnerGuard].includes(presentationSignature(q))||q.work?.input!==p.work?.input||q.work?.label!==p.work?.label)return null;
 if(!Number.isInteger(p.initialChars)||p.initialChars<2||p.initialChars>12)return null;
 const limit=p.groupUnit==='layout'?q.prompt.layout?.length:q.prompt.text.length;
 if(p.groupUnit!==undefined&&(p.groupUnit!=='layout'||!p.responseGroups))return null;
 if(p.passageEnd!==undefined&&(!Number.isInteger(p.passageEnd)||p.passageEnd<=0||p.passageEnd>=limit))return null;
 if(p.workPosition!==undefined){
  const template=answerTemplateSources[q.id];
  if(p.workPosition==='source-slots'){
   if(answerTemplateSources[q.id]||!validWorkSourceSlots(q,p))return null;
  }else if(p.workPosition==='within-template'){
   if(p.responseGroups||p.groups||!Number.isInteger(p.passageEnd)||template?.model?.mode!=='grouped-blanks'||![template.guard,template.partnerGuard].includes(presentationSignature(q)))return null;
   const model=deriveAnswerTemplate(q,{grouped:true});
   if(!model||JSON.stringify(model)!==JSON.stringify(template.model)||model.start!==p.passageEnd||!Array.isArray(p.templateRows)||p.templateRows.length!==(p.sketchGroups?.length??1)||new Set(p.templateRows).size!==p.templateRows.length||p.templateRows.some(i=>!Number.isInteger(i)||i<0||i>=model.rows.length))return null;
   if(p.sketchGroups&&(p.work.input!=='sketch'||p.sketchGroups.length<2||p.sketchGroups.length>4||p.sketchGroups.some(s=>typeof s!=='string'||!s.trim()||s.length>60)||new Set(p.sketchGroups).size!==p.sketchGroups.length))return null;
   if(!p.sketchGroups&&p.work.input!=='expression')return null;
   if(p.workBeforeFields&&(!p.sketchGroups||!Array.isArray(p.workBeforeFields)||p.workBeforeFields.length!==p.templateRows.length||p.workBeforeFields.some((id,i)=>{const n=model.blanks.findIndex(b=>b.field===id);return n<1||!model.rows[p.templateRows[i]].fields.includes(id)||q.prompt.text.slice(model.blanks[n-1].end,model.blanks[n].start).trim()!=='答：';})))return null;
  }else{
  if(p.workPosition!=='before-template'||p.work.input!=='expression'||p.groups||!Number.isInteger(p.passageEnd)||!q.prompt.text.slice(p.passageEnd).startsWith(p.work.label+'：')||template?.model?.mode!=='blanks'||![template.guard,template.partnerGuard].includes(presentationSignature(q)))return null;
  const model=deriveAnswerTemplate(q);if(!model||JSON.stringify(model)!==JSON.stringify(template.model)||model.start!==p.passageEnd+p.work.label.length+2)return null;
  }
 }
 if(p.sourceSlots&&p.workPosition!=='source-slots')return null;
 if((p.sketchGroups||p.templateRows||p.workBeforeFields)&&p.workPosition!=='within-template')return null;
 if(p.groups&&(!Array.isArray(p.groups)||p.work.input!=='expression'||p.groups.length<2||p.groups.length>8||p.groups.some(s=>typeof s!=='string'||!s.trim()||s.length>60)||new Set(p.groups).size!==p.groups.length))return null;
 if(p.responseGroups){
  const text=p.groupUnit==='layout'?q.prompt.layout:sourceStream(q.prompt),groups=p.responseGroups,ids=q.fields.map(f=>f.id);
  if((p.groupUnit==='layout'?!Array.isArray(text):typeof text!=='string')||(!mapped&&!p.groups)||p.workPosition||answerTemplateSources[q.id]||!Array.isArray(groups)||(!mapped&&groups.length!==p.groups.length)||groups[0]?.start!==p.passageEnd||groups.at(-1)?.end!==text.length)return null;
  if(groups.some((g,i)=>!g||typeof g!=='object'||!Number.isInteger(g.start)||!Number.isInteger(g.end)||g.start<0||g.end<=g.start||(i>0&&g.start!==groups[i-1].end)||!Array.isArray(g.fields)||!g.fields.length||g.fields.some(id=>!ids.includes(id))))return null;
  const covered=groups.flatMap(g=>g.fields);if(covered.length!==ids.length||new Set(covered).size!==ids.length)return null;
  if(mapped){const count=p.groups?.length??1,roles=groups.filter(g=>g.work!==null).map(g=>g.work);if(p.work.input!=='expression'||groups.length>8||groups.some(g=>Object.keys(g).some(k=>!['start','end','fields','work','label'].includes(k))||!Object.hasOwn(g,'work')||typeof g.label!=='string'||!g.label.trim()||g.label.length>60)||roles.length!==count||new Set(roles).size!==count||roles.some(n=>!Number.isInteger(n)||n<0||n>=count))return null;}
  if(p.groupUnit==='layout'){
   const runs=p=>p.type==='paragraph'?p.runs:p.type==='table'&&Array.isArray(p.rows)?p.rows.flat():null;
   if(q.prompt.media?.length||text.some(p=>{const rows=runs(p);return !Array.isArray(rows)||rows.some(r=>Array.isArray(r)?r.some(v=>v.type!=='text'):r.type!=='text');}))return null;
  }else{const anchored=new Set((q.prompt.layout||[]).flatMap(p=>p.runs.filter(r=>r.type==='image').map(r=>r.media_index)));if((q.prompt.media||[]).some((_,i)=>!anchored.has(i)))return null;}
 }
 return p;
}
export function workAnswerPassage(q){
 const p=workAnswerPresentation(q);return p&&Number.isInteger(p.passageEnd)?workResponseContent(q,0,p.passageEnd,p.groupUnit):null;
}
export function workResponseContent(q,start,end,unit){
 if(unit!=='layout')return sliceContent(q.prompt,start,end);
 const layout=q.prompt.layout.slice(start,end),plain=runs=>runs.map(r=>r.text).join(''),text=layout.map(p=>p.type==='paragraph'?plain(p.runs):p.rows.map(row=>row.map(plain).join(' ')).join('\n')).join('\n');return {text,media:[],layout};
}
export function encodeWorkGroups(values){if(!Array.isArray(values)||values.length<2||values.length>8||values.some(s=>typeof s!=='string'))throw Error('invalid_work_groups');return JSON.stringify({v:1,parts:values});}
export function decodeWorkGroups(raw,count){
 try{const d=JSON.parse(raw);return d&&Object.keys(d).length===2&&d.v===1&&Array.isArray(d.parts)&&d.parts.length===count&&d.parts.every(s=>typeof s==='string')?d.parts:null;}catch{return null;}
}
export function mountWorkAnswerInputs(host,q,{renderContent,fieldFeedback}={}){
 const p=workAnswerPresentation(q);if(!p)return false;
 if(p.workPosition==='source-slots'&&!mountWorkSourceSlots(host,q,p,{fieldFeedback})){
  if(!host.querySelector(':scope > .quiz-work-source-reference')){const content=workResponseContent(q,p.passageEnd,sourceStream(q.prompt).length),tail=document.createElement('div');tail.className='quiz-work-source-reference';if(renderContent)renderContent(tail,content);else tail.textContent=content.text;host.prepend(tail);}return false;
 }
 if(p.responseGroups&&!host.querySelector(':scope > .quiz-work-source-group')){
  const slots=[...host.querySelectorAll(':scope > .quiz-field')],work=host.querySelector(':scope > .quiz-work-input,:scope > .quiz-saved-work,:scope > .quiz-pending-work');
  if(slots.length!==q.fields.length)return false;
  const parts=work?[...work.querySelectorAll(':scope > .quiz-work-part')]:[],saved=work?.querySelector(':scope > dl'),pairs=saved?[...saved.children]:[],keys=work?.querySelector(':scope > .quiz-work-keys');
  const fragments=p.responseGroups.map(g=>workResponseContent(q,g.start,g.end,p.groupUnit));if(!renderContent&&fragments.some(c=>c.media.length||c.layout?.some(p=>p.type==='table')))return false;
  const count=p.groups?.length??1;
  const cards=p.responseGroups.map((g,i)=>{
   const index=p.responseWorkMap?g.work:i,label=p.responseWorkMap?g.label:p.groups[i];
   const card=document.createElement('section'),prompt=document.createElement('div'),answers=document.createElement('div');card.className='quiz-work-source-group';card.setAttribute('aria-label',label);prompt.className='quiz-work-source-prompt';answers.className='quiz-work-source-answers';
   if(renderContent)renderContent(prompt,fragments[i]);else prompt.textContent=fragments[i].text;card.append(prompt);
   if(index!==null){
    if(parts.length===count){const part=parts[index];card.append(part);const input=part.querySelector('input');const placeKeys=()=>{if(keys&&part.nextElementSibling!==keys){part.after(keys);keys.setAttribute('aria-label',(p.groups?.[index]??p.work.label)+'輸入按鍵');}};input.addEventListener('focus',placeKeys);if(index===0)placeKeys();}
    else if(pairs.length===count*2){const list=document.createElement('dl');list.className='quiz-work-source-saved';list.append(pairs[index*2],pairs[index*2+1]);card.append(list);}
    else if(work&&!p.groups)card.append(work);
   }
   for(const id of g.fields){const n=q.fields.findIndex(f=>f.id===id),field=slots[n];
    if(p.responseWorkMap){const input=field.querySelector('input[type=text]'),legend=field.querySelector('legend');field.classList.add('quiz-answer-template-slot');
     const unit=q.fields[n].label.split('：').at(-1);if(legend&&['公斤','公克'].includes(unit)){legend.textContent=unit;legend.title=q.fields[n].label;}
     const mark=input?.disabled&&compactTemplateFeedback(fieldFeedback?.[n],{allowText:true});if(mark){field.dataset.templateReview=mark.state;field.querySelectorAll(':scope > .quiz-field-review-status,:scope > .quiz-field-review-reference').forEach(node=>node.remove());const note=document.createElement('span');note.className='quiz-answer-template-result';note.id=input.id+'-template-result';note.textContent=mark.text;input.setAttribute('aria-describedby',note.id);field.append(note);}
    }
    answers.append(field);
   }card.append(answers);return card;
  });
  host.append(...cards);host.classList.add('quiz-work-source-layout');
  if(work&&(parts.length===count||pairs.length===count*2)){work.hidden=true;for(const note of work.querySelectorAll(':scope > p'))host.append(note);}
 }
 host.classList.add('quiz-work-answer-layout');
 if(p.workPosition==='within-template'){
  const template=host.querySelector(':scope > .quiz-answer-templates'),work=host.querySelector(':scope > .quiz-work-input,:scope > .quiz-saved-work,:scope > .quiz-pending-work');
  if(template&&work&&!host.classList.contains('quiz-work-within-template')){const rows=[...template.querySelectorAll(':scope > .quiz-answer-template-row')],parts=[...work.querySelectorAll(':scope > .quiz-work-sketch-part')];
   if(parts.length===p.templateRows.length){p.templateRows.forEach((n,i)=>{const slot=p.workBeforeFields&&host.querySelector('#field-'+q.id+'-'+p.workBeforeFields[i])?.closest('.quiz-answer-template-slot'),label=slot?.previousElementSibling;if(label?.classList.contains('quiz-answer-template-text')&&label.textContent.trim()==='答：')label.before(parts[i]);else rows[n].append(parts[i]);});work.hidden=true;for(const note of work.querySelectorAll(':scope > p'))host.append(note);host.classList.add('quiz-work-within-template');}
   else if(!parts.length){rows[p.templateRows[0]].append(work);host.classList.add('quiz-work-within-template');} // Old whole-sheet work stays whole.
  }
 }
 if(p.workPosition==='before-template'){
  const template=host.querySelector(':scope > .quiz-answer-templates');
  if(template){host.classList.add('quiz-work-before-template');for(const work of host.querySelectorAll(':scope > .quiz-work-input,:scope > .quiz-saved-work,:scope > .quiz-pending-work'))if(!(work.compareDocumentPosition(template)&4))host.insertBefore(work,template);
   const rows=answerTemplateSources[q.id].model.rows;for(const[i,row]of [...template.querySelectorAll(':scope > .quiz-answer-template-row')].entries()){const label=q.prompt.text.slice(rows[i].start,rows[i].end).match(/^([^：\n]+)：/u)?.[1];if(label)row.setAttribute('aria-label',label);}
  }
 }
 const ids=new Set(q.fields.map(f=>'field-'+q.id+'-'+f.id));
 for(const input of host.querySelectorAll('input[type=text]')){
  if(!ids.has(input.id)||input.dataset.workAnswerSized)continue;
  input.dataset.workAnswerSized='true';input.placeholder='';
  const resize=()=>{const chars=Math.min(250,Math.max(p.initialChars,Array.from(input.value).length));input.style.setProperty('--work-answer-chars',String(chars));if(p.workPosition)input.closest('.quiz-answer-template-slot')?.style.setProperty('--answer-slot-width',`calc(${chars}em + 1em)`);};
  input.addEventListener('input',resize);input.addEventListener('compositionend',resize);resize();
 }
 return true;
}
