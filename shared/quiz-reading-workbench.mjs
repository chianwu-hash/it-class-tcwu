import {inlineReadingPlan,inlineReadingFeedback} from './quiz-reading-inline.mjs';
import {sourceStream,sliceContent} from './quiz-content-slices.mjs';
import {attachPastInputKeyboard} from './quiz-past-input.mjs';
import {matchingPresentation} from './quiz-matching-presentation.mjs';
let dialogId=0;
export const readingWorkbenchSupported=(q,reading)=>Boolean(q?.type==='fields'&&reading&&!reading.standalone&&!reading.passage.media.length&&!q.work&&!matchingPresentation(q));

// Move original inputs, listeners and feedback. No new response, scoring or
// persistence path. The same article DOM moves into the mobile dialog.
export function mountReadingWorkbench(group,q,reading,{renderContent,fieldFeedback=null}={}){
 if(!readingWorkbenchSupported(q,reading)||!renderContent)return false;
 const doc=group.ownerDocument,view=doc.defaultView,inline=inlineReadingPlan(q),plan=inline?.reading??reading;
 const node=(tag,text,cls)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const fields=[...group.querySelectorAll(':scope > .quiz-field')];if(fields.length!==q.fields.length)return false;
 const byId=new Map(q.fields.map((f,i)=>[f.id,fields[i]])),layout=node('div',undefined,'quiz-reading-layout'),story=node('section',undefined,'quiz-reading-story'),questions=node('section',undefined,'quiz-reading-questions'),bar=node('div',undefined,'quiz-reading-navigation'),open=node('button',inline?'查看文章／填字（'+inline.slots.length+'格）':'查看文章','quiz-reading-open');open.type='button';
 story.setAttribute('aria-label','閱讀文章與文章內作答');story.tabIndex=-1;story.append(node('h4','閱讀文章'));
 const source=node('div',undefined,'quiz-reading-source'),tools=node('div',undefined,'quiz-reading-inline-tools');
 let activeInput=null;
 // Symbol insertion restores input focus. Keep that field's live keyboard;
 // rebuilding its toolbar here would detach and close it after every key.
 const activate=(slot,input,meta)=>{if(activeInput===input)return;activeInput=input;story.querySelectorAll('.quiz-inline-slot.is-reading-active').forEach(n=>n.classList.remove('is-reading-active'));slot.classList.add('is-reading-active');tools.replaceChildren(node('span','第'+slot.querySelector('.quiz-inline-number').textContent+'格・填'+(meta.role==='han'?'國字':'注音')));if(meta.role==='phonetic')attachPastInputKeyboard(tools,input,{bopomofo:true});};
 if(inline){
  story.append(node('p',fieldFeedback?'直接核對文章中的答案，需要修正的格子旁會顯示正確答案。':'在文章標示旁填國字或注音，再完成閱讀小題。','helper'),tools);
  const text=sourceStream(inline.passage);let offset=0;
  for(const line of text.split('\n')){const row=node('div',undefined,'quiz-reading-inline-paragraph'),end=offset+line.length;let at=offset;
   const append=(a,b)=>{if(a>=b)return;const span=node('span',undefined,'quiz-reading-piece');const content=inline.passage.layout?sliceContent(inline.passage,a,b):{text:text.slice(a,b),media:[]};renderContent(span,content);row.append(span);};
   for(const [i,meta]of inline.slots.entries()){if(meta.end<=offset||meta.end>end)continue;append(at,meta.end);const slot=byId.get(meta.field),input=slot.querySelector('input[type=text]');slot.classList.add('quiz-inline-slot');slot.dataset.readingRole=meta.role;slot.style.setProperty('--reading-slot-min',meta.role==='han'?'2.1em':(meta.characters>1?'6.5em':'3.8em'));slot.querySelector('legend').classList.add('quiz-inline-label');slot.prepend(node('span',String(i+1),'quiz-inline-number'));input.setAttribute('aria-label','第'+(i+1)+'格，'+text.slice(meta.start,meta.end)+'填'+(meta.role==='han'?'國字':'注音'));
    // Size is a minimum, never a one-character maxlength or saved-value trim.
    const fit=()=>{input.style.width=Math.max(meta.role==='han'?2.1:meta.characters>1?6.5:3.8,[...input.value].length+1.1)+'em';};input.addEventListener('input',fit);fit();
    input.addEventListener('focus',()=>activate(slot,input,meta));
    const feedback=[...slot.querySelectorAll(':scope > .quiz-field-review-status,:scope > .quiz-field-review-reference')],mark=input.disabled?inlineReadingFeedback(fieldFeedback?.[q.fields.findIndex(f=>f.id===meta.field)]):null;
    if(mark){slot.dataset.readingReview=mark.state;const note=node('span',mark.label+(mark.answers.length?mark.answers.join(' 或 '):''),'quiz-inline-result');note.id=input.id+'-result';input.setAttribute('aria-describedby',note.id);slot.append(note);feedback.forEach(n=>n.remove());}
    else if(feedback.length){const details=node('details',undefined,'quiz-inline-reference'),summary=node('summary','第'+(i+1)+'格核對');details.append(summary,...feedback);story.append(details);}
    row.append(slot);at=meta.end;
   }append(at,end);source.append(row);offset=end+1;
  }
  const first=inline.slots[0],firstInput=byId.get(first.field).querySelector('input');if(firstInput.disabled)tools.append(node('span',source.querySelector('[data-reading-review]')?'✓ 綠框答對　✕ 紅框旁看正確答案':'已儲存的文章作答'));else activate(byId.get(first.field),firstInput,first);
 }else renderContent(source,plan.passage);
 story.insertBefore(source,story.querySelector('.quiz-inline-reference'));bar.append(open);
 questions.append(bar);const remaining=fields.filter(f=>!f.classList.contains('quiz-inline-slot'));
 let current=remaining[0],returnFocus=null;
 const select=slot=>{remaining.forEach(s=>s.classList.toggle('is-reading-active',s===slot));bar.querySelectorAll('[data-reading-jump]').forEach((b,i)=>{if(remaining[i]===slot)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});current=slot;};
 remaining.forEach((slot,i)=>{slot.tabIndex=-1;const badge=node('span','目前小題','quiz-reading-active-label');slot.querySelector('legend')?.append(badge);slot.addEventListener('focusin',e=>{select(slot);returnFocus=e.target;});const jump=node('button','第'+(plan.numbers?.[q.fields.findIndex(f=>byId.get(f.id)===slot)]??i+1)+'題');jump.type='button';jump.dataset.readingJump=String(i);jump.addEventListener('click',()=>{select(slot);slot.scrollIntoView({block:'nearest',behavior:'instant'});slot.focus({preventScroll:true});returnFocus=slot;});bar.append(jump);questions.append(slot);});if(current)select(current);
 const dialog=node('dialog',undefined,'quiz-reading-dialog'),head=node('div',undefined,'quiz-reading-dialog-header'),close=node('button','回到作答小題');dialog.id='quiz-reading-dialog-'+(++dialogId);dialog.setAttribute('aria-label','閱讀文章與填字');close.type='button';head.append(node('strong','閱讀文章'),close);dialog.append(head);open.setAttribute('aria-haspopup','dialog');open.setAttribute('aria-controls',dialog.id);
 let savedWindow=0,savedQuestions=0;
 const hide=()=>{story.querySelectorAll('.past-input-popover:not([hidden]) .past-input-close').forEach(b=>b.click());if(dialog.open)dialog.close();layout.prepend(story);open.setAttribute('aria-expanded','false');questions.scrollTop=savedQuestions;if(group.isConnected){view.scrollTo({top:savedWindow,behavior:'instant'});(returnFocus?.isConnected?returnFocus:open).focus({preventScroll:true});}};
 let keyboardEscape=false;
 dialog.addEventListener('keydown',e=>{if(e.key!=='Escape')return;const keyClose=story.querySelector('.past-input-popover:not([hidden]) .past-input-close');keyboardEscape=Boolean(keyClose);if(keyClose){e.preventDefault();e.stopPropagation();keyClose.click();}},true);
 open.setAttribute('aria-expanded','false');open.addEventListener('click',()=>{savedWindow=view.scrollY;savedQuestions=questions.scrollTop;dialog.append(story);dialog.showModal();open.setAttribute('aria-expanded','true');close.focus({preventScroll:true});});close.addEventListener('click',hide);dialog.addEventListener('cancel',e=>{e.preventDefault();if(keyboardEscape){keyboardEscape=false;return;}hide();});
 // A native close (including an outer controller) must not strand the article
 // inside the closed dialog. Normal hide/destroy already move it themselves.
 dialog.addEventListener('close',()=>{if(story.parentNode!==dialog)return;layout.prepend(story);open.setAttribute('aria-expanded','false');questions.scrollTop=savedQuestions;});
 layout.append(story,questions);group.replaceChildren(layout,dialog);group.classList.add('quiz-reading-workbench');
 const controller=new view.AbortController();let frame=0;const resize=()=>{if(!group.isConnected)return;if(view.innerWidth>=900&&view.innerHeight>600&&dialog.open)hide();const dock=doc.querySelector('.quiz-workspace-dock'),top=Math.max(12,group.getBoundingClientRect().top);group.style.setProperty('--reading-pane-height',Math.max(280,view.innerHeight-top-(dock?.getBoundingClientRect().height??130)-18)+'px');};view.addEventListener('resize',resize,{signal:controller.signal});frame=view.requestAnimationFrame(resize);
 group.sketchEditors??=[];group.sketchEditors.push({setDisabled(disabled){if(disabled&&dialog.open)hide();},destroy(){controller.abort();view.cancelAnimationFrame(frame);if(dialog.open){dialog.close();layout.prepend(story);}dialog.remove();}});
 return true;
}
