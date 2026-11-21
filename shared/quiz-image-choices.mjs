import {sourceStream,omitRanges} from './quiz-content-slices.mjs';
import {presentationSignature} from './quiz-presentation-signature.mjs';
import {answerTemplateSources} from './quiz-answer-template-sources.mjs';

// Compatibility only; native option IDs and the complete bank are included.
// This fingerprint never grants media access or reads an answer key.
export const imageChoiceSignature=q=>presentationSignature({id:q.id,prompt:q.prompt,fields:[{id:'$single',input:'single',options:q.options}]});
export function deriveImageChoiceTemplate(q,{width,badges=null}={}){
 if(q?.type!=='single'||sourceStream(q.prompt)===null||!Number.isInteger(width)||width<140||width>600||!Array.isArray(q.prompt.media)||!q.prompt.media.length||!Array.isArray(q.prompt.layout))return null;
 const options=q.options;if(!Array.isArray(options)||options.length<2||options.length>8||new Set(options.map(o=>o.id)).size!==options.length)return null;
 if(badges!==null&&(!Array.isArray(badges)||badges.length!==options.length||badges.some((s,i)=>s!==`(${i+1})`)))return null;
 const sourceWidths=[],promptMediaIndices=[];
 for(const o of options){const c=o.content,stream=sourceStream(c);if(!c||c.media?.length!==1||c.media[0].kind!=='image'||!c.media[0].alt?.trim()||stream===null||stream.replace(/[\s\ufffc]/gu,'')||[...stream].filter(s=>s==='\ufffc').length!==1)return null;
  const images=c.layout.flatMap(p=>p.runs).filter(r=>r.type==='image');if(images.length!==1||images[0].media_index!==0||!Number.isFinite(images[0].width)||images[0].width<=0)return null;sourceWidths.push(images[0].width);
  const indices=q.prompt.media.map((m,i)=>m.kind==='image'&&m.url===c.media[0].url?i:-1).filter(i=>i>=0);if(indices.length!==1)return null;promptMediaIndices.push(indices[0]);
 }
 const text=sourceStream(q.prompt),lines=text.split('\n'),runs=q.prompt.layout.flatMap(p=>p.runs).filter(r=>r.type==='image');let task;
 if(badges){if(lines.length!==options.length+1||!lines[0].trim()||runs.length!==options.length||lines.slice(1).some((line,i)=>line.normalize('NFKC').replace(/\s/gu,'')!==`(${i+1})\ufffc`))return null;task='numbered';}
 else{if(options.length!==3||lines.length!==2||lines[0].trim()!=='\ufffc'||lines[1].normalize('NFKC').replace(/[\s\ufffc]/gu,'')!=='(,,)最重'||runs.length!==4)return null;task='heaviest';}
 const bankRuns=runs.slice(task==='heaviest'?1:0);if(bankRuns.some((r,i)=>r.media_index!==promptMediaIndices[i]||r.width!==sourceWidths[i]))return null;
 return {mode:'image-choices',width,badges,sourceWidths,promptMediaIndices,task,bankRange:[text.indexOf('\n')+1,text.length]};
}
function reviewed(source,p){const model=p&&deriveImageChoiceTemplate(source,p.model);if(!model||JSON.stringify(model)!==JSON.stringify(p.model))return null;let passage=omitRanges(source.prompt,[model.bankRange]);if(model.task==='heaviest'){const instruction='圈出最重的杯子。';passage={...passage,text:[passage.text,instruction].filter(Boolean).join('\n'),layout:[...passage.layout,{type:'paragraph',runs:[{type:'text',text:instruction}]}]};}return {...model,source,passage};}
export function imageChoicePresentation(q,registry=answerTemplateSources){const p=registry[q?.id];return p?.model?.mode==='image-choices'&&p.guard===imageChoiceSignature(q)?reviewed(q,p):null;}
export function partnerImageChoiceSource(q){if(q?.past||q?.normal||!q?.rich?.prompt||!Array.isArray(q.rich.options)||q.options?.length!==q.rich.options.length)return null;return {id:'partner-image-choice',type:'single',prompt:q.rich.prompt,options:q.rich.options.map((content,i)=>({id:String(i),content}))};}
export function partnerImageChoicePresentation(q,registry=answerTemplateSources){const source=partnerImageChoiceSource(q);if(!source)return null;const signature=imageChoiceSignature(source),matches=Object.values(registry).filter(p=>p.model?.mode==='image-choices'&&p.partnerViewGuard===signature);return matches.length===1?reviewed(source,matches[0]):null;}
function pictureCard(card,row,body,badge,plan,i){
 const doc=card.ownerDocument,stage=doc.createElement('div'),zoom=doc.createElement('button');card.classList.add('quiz-graphic-choice-card');card.dataset.choiceImageCard='';row.dataset.choiceImageSelect='';row.style.setProperty('--choice-image-width',plan.sourceWidths[i]/Math.max(...plan.sourceWidths)*100+'%');stage.className='quiz-graphic-choice-stage';stage.style.width=`min(100%, ${plan.width}px)`;stage.append(...body.childNodes);body.append(stage);
 if(plan.badges)badge.textContent=plan.badges[i];else badge.hidden=true;
 zoom.type='button';zoom.className='quiz-graphic-choice-zoom';zoom.dataset.choiceImageZoom='';zoom.textContent='放大原圖';zoom.setAttribute('aria-label',[plan.badges?.[i],plan.source.options[i].content.media[0].alt,'放大原圖'].filter(Boolean).join('，'));card.append(zoom);
 for(const img of body.querySelectorAll('img')){img.dataset.imageLightbox='';img.dataset.partnerImage='';img.tabIndex=-1;img.removeAttribute('role');img.removeAttribute('aria-label');img.removeAttribute('title');}
}
export function mountImageChoices(host,plan){
 const labels=[...host.querySelectorAll(':scope > .student-option')];if(labels.length!==plan.source.options.length||labels.some(label=>!label.querySelector('input[type=radio]')||!label.querySelector('.option-body')||!label.querySelector('.option-badge')))return false;
 const doc=host.ownerDocument,hint=doc.createElement('p'),grid=doc.createElement('div');host.classList.add('quiz-graphic-choice-field');hint.className='helper';hint.textContent=labels.every(label=>label.querySelector('input').disabled)?'可以放大原圖查看。':'點圖選擇。按「放大原圖」只看圖片，不會選答。';grid.className='quiz-graphic-choice-grid';
 for(const[i,label]of labels.entries()){const card=doc.createElement('div'),input=label.querySelector('input'),note=label.querySelector('.option-result');card.append(label);input.setAttribute('aria-label',[plan.badges?.[i],plan.source.options[i].content.media[0].alt].filter(Boolean).join('，'));if(note){note.id=input.name+'-image-result-'+i;input.setAttribute('aria-describedby',[input.getAttribute('aria-describedby'),note.id].filter(Boolean).join(' '));}pictureCard(card,label,label.querySelector('.option-body'),label.querySelector('.option-badge'),plan,i);grid.append(card);}host.append(hint,grid);return true;
}
export function mountImageChoiceReview(host,plan){
 if(host.dataset.imageChoicesMounted)return;const rows=[...host.querySelectorAll(':scope > [data-review-option-index]')];if(rows.length!==plan.source.options.length||rows.some(row=>!row.querySelector('.rv-option')||!row.querySelector('.rv-letter')))return;
 host.dataset.imageChoicesMounted='true';host.classList.add('quiz-graphic-choice-grid');
 for(const[i,row]of rows.entries()){const main=host.ownerDocument.createElement('div'),body=row.querySelector('.rv-option'),badge=row.querySelector('.rv-letter');main.className='quiz-graphic-choice-review-main';main.append(badge,body);row.append(main);pictureCard(row,main,body,badge,plan,i);}
}
