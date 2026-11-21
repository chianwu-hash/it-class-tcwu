import {sourceStream,omitRanges} from './quiz-content-slices.mjs';

// Coordinates are reviewed against the immutable original image. Neither the
// geometry nor the input aid may be inferred from a private answer key.
export function deriveImageBlankTemplate(q,{media_index,sourceSize,width,blanks,bank}={}){
 if(q?.type!=='fields'||!q.fields?.length||q.fields.some(f=>f.input!=='text')||new Set(q.fields.map(f=>f.id)).size!==q.fields.length)return null;
 const text=sourceStream(q.prompt);
 if(text===null||!Number.isInteger(media_index)||q.prompt.media?.[media_index]?.kind!=='image'||!Array.isArray(sourceSize)||sourceSize.length!==2||sourceSize.some(n=>!Number.isInteger(n)||n<=0)||!Number.isInteger(width)||width<640||width>1200)return null;
 if(!Array.isArray(bank)||!bank.length||bank.length>8||new Set(bank).size!==bank.length||bank.some(s=>typeof s!=='string'||!s.trim()||s.length>8||!q.prompt.text.includes(s)))return null;
 if(!Array.isArray(blanks)||blanks.length!==q.fields.length)return null;
 for(const[i,b]of blanks.entries()){
  const r=b.rect;if(b.field!==q.fields[i].id||!Array.isArray(r)||r.length!==4||r.some(n=>!Number.isInteger(n)||n<0)||r[2]*width/sourceSize[0]<44||r[3]*width/sourceSize[0]<44||r[0]+r[2]>sourceSize[0]||r[1]+r[3]>sourceSize[1])return null;
  if(blanks.slice(0,i).some(a=>a.rect[0]<r[0]+r[2]&&a.rect[0]+a.rect[2]>r[0]&&a.rect[1]<r[1]+r[3]&&a.rect[1]+a.rect[3]>r[1]))return null;
 }
 let pos=0;const ranges=[];
 for(const p of q.prompt.layout||[]){for(const r of p.runs){if(r.type==='image'&&r.media_index===media_index)ranges.push([pos,pos+1]);pos+=r.type==='text'?r.text.length:1;}pos++;}
 if(ranges.length!==1)return null;
 return {mode:'image-blanks',media_index,sourceSize,width,blanks,bank,imageRange:ranges[0]};
}

export const imageBlankPassage=(prompt,model)=>omitRanges(prompt,[model.imageRange]);

export function mountImageBlanks(container,plan,{byId,render}){
 const doc=container.ownerDocument,scroll=doc.createElement('div'),board=doc.createElement('div'),picture=doc.createElement('div'),tools=doc.createElement('div'),hint=doc.createElement('p'),feedback=doc.createElement('div');
 container.classList.add('quiz-image-blanks');scroll.className='quiz-image-blank-scroll';scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','原圖作答區，可上下及左右捲動');
 board.className='quiz-image-blank-board';board.style.width=plan.width+'px';board.style.aspectRatio=plan.sourceSize.join('/');picture.className='quiz-image-blank-picture';
 render(picture,{text:'',media:[plan.renderPrompt.media[plan.media_index]],layout:[{type:'paragraph',runs:[{type:'image',media_index:0}]}]});board.append(picture);
 tools.className='quiz-image-blank-tools';tools.setAttribute('role','group');tools.setAttribute('aria-label','原題代號或名詞輸入輔助');hint.className='helper';hint.setAttribute('aria-live','polite');
 feedback.className='quiz-image-blank-feedback';let active=null,returningFromAid=false;const buttons=[];
 const locked=plan.blanks.every(b=>byId.get(b.field).querySelector('input[type=text]')?.disabled);
 hint.textContent=locked?'已保留各格作答，請對照原圖核對。':'先選原圖中的空格，再輸入或按下代號／名詞；圖可上下及左右捲動。';
 const selected=doc.createElement('span');selected.className='quiz-image-blank-selected';selected.textContent='先選空格';tools.append(selected);
 if(!locked)for(const value of plan.bank){const button=doc.createElement('button');button.type='button';button.textContent=value;button.disabled=true;button.addEventListener('pointerdown',event=>{if(active&&!active.disabled)event.preventDefault();});button.addEventListener('click',()=>{if(!active||active.disabled)return;active.value=value;active.dispatchEvent(new doc.defaultView.Event('input',{bubbles:true}));returningFromAid=true;try{active.focus({preventScroll:true});}finally{returningFromAid=false;}});buttons.push(button);tools.append(button);}
 for(const b of plan.blanks){
  const slot=byId.get(b.field),input=slot.querySelector('input[type=text]'),legend=slot.querySelector('legend');if(!input)throw Error('image_blank_original_input_required');
  slot.classList.add('quiz-image-blank-slot');legend.classList.add('quiz-answer-template-label');const[x,y,w,h]=b.rect;Object.assign(slot.style,{left:x/plan.sourceSize[0]*100+'%',top:y/plan.sourceSize[1]*100+'%',width:w/plan.sourceSize[0]*100+'%',height:h/plan.sourceSize[1]*100+'%'});
  input.addEventListener('focus',()=>{active=input;buttons.forEach(button=>button.disabled=input.disabled);selected.textContent=legend.textContent;if(!locked)hint.textContent=legend.textContent+'：請輸入或選代號／名詞。';if(!returningFromAid)input.scrollIntoView({block:'nearest',inline:'nearest'});});
  const notes=[...slot.querySelectorAll(':scope > .quiz-field-review-status,:scope > .quiz-field-review-reference')];
  if(notes.length){const card=doc.createElement('section'),title=doc.createElement('h4');card.className='quiz-image-blank-review';card.dataset.fieldReview=slot.dataset.fieldReview;card.id=input.id+'-image-review';slot.dataset.imageReviewTarget=card.id;title.textContent=legend.textContent;card.append(title,...notes);feedback.append(card);input.setAttribute('aria-describedby',[input.getAttribute('aria-describedby'),card.id].filter(Boolean).join(' '));}
  board.append(slot);
 }
 scroll.append(board);container.append(hint);if(!locked)container.append(tools);container.append(scroll);if(feedback.childNodes.length)container.append(feedback);
}
