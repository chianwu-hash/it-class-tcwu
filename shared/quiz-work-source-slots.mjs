import {sourceStream} from './quiz-content-slices.mjs';
import {compactTemplateFeedback} from './quiz-answer-templates.mjs';

// Called only after the reviewed source/copy signature and work contract match.
// Positions describe original blanks; they never contain reference answers.
export function validWorkSourceSlots(q,p){
 const text=sourceStream(q.prompt),slots=p.sourceSlots,ids=q.fields.map(f=>f.id),count=p.groups?.length??1;
 if(q.work?.input!=='expression'||p.responseGroups||p.groupUnit||p.sketchGroups||p.templateRows||p.workBeforeFields||q.prompt.media?.length||typeof text!=='string'||text!==q.prompt.text||!Array.isArray(slots)||!slots.length||!Number.isInteger(p.passageEnd)||p.passageEnd<=0||text[p.passageEnd-1]!=='\n')return false;
 const fields=[],work=[];let previous=p.passageEnd;
 for(const s of slots){
  if(!s||Object.keys(s).some(k=>!['start','end','field','work'].includes(k))||!Number.isInteger(s.start)||!Number.isInteger(s.end)||s.start<previous||s.end<s.start||s.end>text.length||Object.hasOwn(s,'field')===Object.hasOwn(s,'work'))return false;
  if(s.end>s.start&&!/^（[ \u3000]*）$/u.test(text.slice(s.start,s.end)))return false;
  if(Object.hasOwn(s,'field')){if(!ids.includes(s.field)||s.start===s.end)return false;fields.push(s.field);}
  else{if(!Number.isInteger(s.work)||s.work<0||s.work>=count)return false;
   if(s.start===s.end){const label=p.groups?.[s.work]??p.work.label;if(text[s.start]!=='\n'||text.slice(text.lastIndexOf('\n',s.start-1)+1,s.start)!==label+'：')return false;}
   work.push(s.work);
  }
  previous=s.end;
 }
 const blanks=[...text.slice(p.passageEnd).matchAll(/（[ \u3000]*）/gu)],mapped=slots.filter(s=>s.end>s.start);
 return fields.length===ids.length&&new Set(fields).size===ids.length&&work.length===count&&new Set(work).size===count&&blanks.length===mapped.length&&blanks.every((m,i)=>m.index+p.passageEnd===mapped[i].start&&m.index+p.passageEnd+m[0].length===mapped[i].end);
}

export function mountWorkSourceSlots(host,q,p,{fieldFeedback}={}){
 if(host.querySelector(':scope > .quiz-work-source-slots'))return true;
 const fields=[...host.querySelectorAll(':scope > .quiz-field')],work=host.querySelector(':scope > .quiz-work-input,:scope > .quiz-saved-work,:scope > .quiz-pending-work');
 if(fields.length!==q.fields.length)return false;
 const parts=work?[...work.querySelectorAll(':scope > .quiz-work-part')]:[],list=work?.querySelector(':scope > dl'),pairs=list?[...list.children]:[],keys=work?.querySelector(':scope > .quiz-work-keys'),count=p.groups?.length??1;
 const grouped=parts.length===count,saved=pairs.length===count*2,legacy=Boolean(p.groups&&work&&!grouped&&!saved);
 const text=sourceStream(q.prompt),container=document.createElement('div');container.className='quiz-answer-templates quiz-work-source-slots';
 const row=document.createElement('section');row.className='quiz-answer-template-row';container.append(row);
 let cursor=p.passageEnd,at=0;
 for(const sourceLine of text.slice(p.passageEnd).split('\n')){
  const line=document.createElement('div');line.className='quiz-answer-template-line';const end=cursor+sourceLine.length;let from=cursor;
  while(at<p.sourceSlots.length&&p.sourceSlots[at].start<=end){const s=p.sourceSlots[at++];line.append(document.createTextNode(text.slice(from,s.start)));
   if(s.field){const index=q.fields.findIndex(f=>f.id===s.field),field=fields[index],input=field.querySelector('input[type=text]');field.classList.add('quiz-answer-template-slot');field.querySelector('legend')?.classList.add('quiz-answer-template-label');
    const mark=input?.disabled&&compactTemplateFeedback(fieldFeedback?.[index]);if(mark){field.dataset.templateReview=mark.state;field.querySelectorAll(':scope > .quiz-field-review-status,:scope > .quiz-field-review-reference').forEach(n=>n.remove());const note=document.createElement('span');note.className='quiz-answer-template-result';note.id=input.id+'-template-result';note.textContent=mark.text;input.setAttribute('aria-describedby',note.id);field.append(note);}line.append(field);}
   else{const slot=document.createElement('div');slot.className='quiz-work-source-slot';slot.dataset.workSlot=String(s.work);
    if(grouped){const part=parts[s.work];slot.append(part);const label=part.firstChild;if(label?.nodeType===3){const hidden=document.createElement('span');hidden.className='quiz-answer-template-label';label.before(hidden);hidden.append(label);}
     const moveKeys=()=>{if(keys){if(keys.parentNode!==slot)slot.append(keys);keys.setAttribute('aria-label',(p.groups?.[s.work]??p.work.label)+'輸入按鍵');}};part.querySelector('input').addEventListener('focus',moveKeys);if(s.work===0)moveKeys();
    }else if(saved){const dl=document.createElement('dl');dl.className='quiz-work-source-saved';dl.append(pairs[s.work*2],pairs[s.work*2+1]);slot.append(dl);}
    else if(work&&!legacy)slot.append(work);
    else{slot.classList.add('quiz-work-source-slot-reference');slot.textContent=legacy?'計算過程保留於下方':'計算過程';}
    line.append(slot);
   }
   from=s.end;
  }
  line.append(document.createTextNode(text.slice(from,end)));row.append(line);cursor=end+1;
 }
 host.append(container);host.classList.add('quiz-has-answer-template');
 if(work&&(grouped||saved)){work.hidden=true;for(const note of work.querySelectorAll(':scope > p'))host.append(note);}
 return true;
}
