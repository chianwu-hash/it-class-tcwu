// Classroom warm-up only: native text editing, in-memory feedback, no auth/progress/reward writes.
export const EDIT_TASKS = [
 {id:'backspace',title:'① Backspace：往左擦',hint:'把游標移到多出的「喜」後面，按一次 Backspace。',key:'deleteContentBackward',variants:[
  {seed:'我喜喜歡小貓。',target:'我喜歡小貓。',intermediate:'我喜歡小貓。'},
  {seed:'我喜喜歡小狗。',target:'我喜歡小狗。',intermediate:'我喜歡小狗。'}]},
 {id:'delete',title:'② Delete：往右擦',hint:'把游標移到多出的字前面，按一次 Delete。',key:'deleteContentForward',variants:[
  {seed:'我喜歡小小貓。',target:'我喜歡小貓。',intermediate:'我喜歡小貓。'},
  {seed:'我喜歡小狗狗。',target:'我喜歡小狗。',intermediate:'我喜歡小狗。'}]},
 {id:'replace',title:'③ 只換錯字，後面保留',hint:'用 ← → 找到 r，按 Backspace 或 Delete 刪掉 r，再補上 e，保留後面的字。',variants:[
  {seed:'I likr cats.',target:'I like cats.',intermediate:'I lik cats.'},
  {seed:'I likr dogs.',target:'I like dogs.',intermediate:'I lik dogs.'}]},
 {id:'lines',title:'④ 上下移動，兩行都修好',hint:'用 ↑ 到第一行，再用 ↓ 回第二行；每行都只刪掉多出的字，保留換行。',variants:[
  {seed:'我喜歡小貓貓。\n我也喜歡小狗狗。',target:'我喜歡小貓。\n我也喜歡小狗。'},
  {seed:'我喜歡紅紅花。\n我也喜歡綠綠草。',target:'我喜歡紅花。\n我也喜歡綠草。'}]},
 {id:'undo',title:'⑤ Ctrl＋Z：救回誤刪',hint:'先故意刪掉最後一個詞的末字，用 Ctrl＋Z 救回來，再刪掉多出的「喜」。',variants:[
  {seed:'我喜喜歡白雲。',target:'我喜歡白雲。',intermediate:'我喜歡白雲。',rescueChar:'雲'},
  {seed:'我喜喜歡彩虹。',target:'我喜歡彩虹。',intermediate:'我喜歡彩虹。',rescueChar:'虹'}]}
];
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function renderEditPractice(){
 const icons={backspace:'cat',delete:'paw',replace:'pencil',lines:'arrows-up-down',undo:'rotate-left'};
 return `<div id="edit-practice" class="edit-practice"><div class="edit-undo-lesson"><h3>刪錯先別急，Ctrl＋Z 復原！</h3>
 <p>先點進文字框，按住 <kbd>Ctrl</kbd>，再按一下 <kbd>Z</kbd>，就能撤銷剛才的一次編輯。還沒救回需要的文字，可以再按一次。</p>
 <ol><li>發現刪錯，先停下來。</li><li>按 Ctrl＋Z，把誤刪的文字救回來。</li><li>看看游標位置，再移到真正的錯字旁邊，只改那裡。</li></ol>
 <p><strong>「復原」退回上一步；「重新開始這題」回到預填原句。</strong>這裡的復原只處理這個練習框，不會撤銷已保存的闖關進度或葉花。</p></div>
 <h3>直接在這裡，跟老師修五題</h3>
 <p>錯誤文字已放好了。點入輸入框，用鍵盤移動游標，只改需要的地方。</p>
 <p class="edit-summary" data-edit-summary role="status" aria-live="polite">本次練好 0／${EDIT_TASKS.length} 題</p>
 ${EDIT_TASKS.map(task=>`<article class="edit-task" data-edit-task="${task.id}">
 <h4><span class="edit-task-icon"><i class="fa-solid fa-${icons[task.id]}" aria-hidden="true"></i></span><span>${task.title}</span></h4><p id="edit-hint-${task.id}" class="edit-hint">${task.hint}</p>
 <p class="edit-target-label">要改成：</p><pre class="edit-target" data-edit-target>${esc(task.variants[0].target)}</pre>
 <label for="edit-input-${task.id}">在這裡修改文字</label>
 <textarea id="edit-input-${task.id}" rows="${task.id==='lines'?3:2}" spellcheck="false" autocomplete="off" autocapitalize="off" aria-describedby="edit-hint-${task.id} edit-caret-${task.id} edit-feedback-${task.id}">${esc(task.variants[0].seed)}</textarea>
 <p id="edit-caret-${task.id}" class="edit-caret" data-edit-caret>點入輸入框，看看游標在哪裡。</p>
 <div class="edit-keybar" role="group" aria-label="${esc(task.title)}的輔助按鍵">${[
 ['left','←','游標往左移一格'],['right','→','游標往右移一格'],...(task.id==='lines'?[['up','↑','游標移到上一行'],['down','↓','游標移到下一行']]:[]),['backward','Backspace','刪除游標左邊一個字'],['forward','Delete','刪除游標右邊一個字'],['undo','Ctrl＋Z 復原','復原這個文字框的上一步編輯']
 ].map(([action,label,name])=>`<button type="button" data-edit-key="${action}" aria-label="${name}">${label}</button>`).join('')}</div>
 <p class="edit-key-note">優先練習實體鍵盤；也可以用上方輔助按鍵。</p>
 <div class="edit-actions"><button type="button" data-edit-check>檢查修改</button><button type="button" data-edit-reset>重新開始這題</button><button type="button" data-edit-replay disabled>再練一次（換題）</button></div>
 <p id="edit-feedback-${task.id}" class="edit-feedback" data-edit-feedback role="status" aria-live="polite">保留原句，用剛學的按鍵修改。</p>
 </article>`).join('')}
 <p class="edit-note">這是課堂暖身，本次結果只留在這個畫面；重新整理會重新開始。不另外給葉花，接著再做下方中英打六關。</p>
 </div>`;
}

export const newEditState=()=>({deletions:new Set(),moves:new Set(),restartNeeded:false,passed:false,rescued:false,undoCount:0});
export const copyEditState=state=>({...state,deletions:new Set(state.deletions),moves:new Set(state.moves)});
export function isRescueDeletion(task,variant,before,after,inputType){
 if(task.id!=='undo'||!before||before.value!==variant.seed||before.start!==before.end)return false;
 const i=inputType==='deleteContentBackward'?before.start-1:inputType==='deleteContentForward'?before.start:-1;
 return i>=0&&variant.seed[i]===variant.rescueChar&&after===variant.seed.slice(0,i)+variant.seed.slice(i+1);
}
export function restoreEditSnapshot(before,current,rescue=false){
 const restored=copyEditState(before.state);
 restored.undoCount=current.undoCount+1;restored.rescued=restored.rescued||rescue;
 return restored;
}
export const caretRow=(value,position)=>value.slice(0,position).split('\n').length-1;
export function recordEdit(state,task,variant,before,after,inputType){
 if(!before||state.passed)return;
 if(before.value===after)return;
 const {value,start,end}=before;
 if(!after||(start===0&&end===value.length&&value.length>1))state.restartNeeded=true;
 const backward=inputType==='deleteContentBackward',forward=inputType==='deleteContentForward';
 if((!backward&&!forward)||start!==end||value.length-after.length!==1)return;
 const index=backward?start-1:start;
 if(index<0||after!==value.slice(0,index)+value.slice(index+1))return;
 if(task.key&&task.key!==inputType)return;
 if(task.id==='lines'){
  const row=caretRow(value,index),oldLines=value.split('\n'),newLines=after.split('\n');
  if(newLines.length===2&&oldLines[row]===variant.seed.split('\n')[row]&&newLines[row]===variant.target.split('\n')[row])state.deletions.add(row);
 }else if(value===variant.seed&&after===variant.intermediate)state.deletions.add(0);
}
export function recordMove(state,value,from,to,key){
 if(caretRow(value,from)!==caretRow(value,to)&&['ArrowUp','ArrowDown'].includes(key))state.moves.add(key);
}
export function checkEdit(state,task,variant,value){
 if(state.restartNeeded)return {ok:false,message:'整段被刪除或替換了。先按 Ctrl＋Z 復原，救回文字後繼續修改；也可以按「重新開始這題」。'};
 if(value!==variant.target){
  let index=0;while(index<value.length&&value[index]===variant.target[index])index++;
  const row=caretRow(variant.target,index)+1;
  return {ok:false,message:`第 ${row} 行還有地方不同。移動游標，檢查多字、錯字、空白與標點，不用整句重打。`};
 }
 if(state.deletions.size!==(task.id==='lines'?2:1))return {ok:false,message:task.key==='deleteContentBackward'?'文字正確；這題要練 Backspace。重新開始，把游標放在多字後面，往左擦。':task.key==='deleteContentForward'?'文字正確；這題要練 Delete。重新開始，把游標放在多字前面，往右擦。':'文字正確；再練一次局部修改。重新開始，只刪錯字再補上，保留其他文字。'};
 if(task.id==='lines'&&(!state.moves.has('ArrowUp')||!state.moves.has('ArrowDown')))return {ok:false,message:'文字修好了！再用 ↑ 移到上一行、↓ 回到下一行，練過兩個方向後再按檢查。'};
 if(task.id==='undo'&&!state.rescued)return {ok:false,message:`文字正確；這題還要練復原。重新開始，先刪掉正確的「${variant.rescueChar}」，按 Ctrl＋Z 救回來，再修掉多字。`};
 return {ok:true,message:task.id==='lines'?'練好了！你用上下鍵換行位置，也保留了兩行正確文字。':task.id==='undo'?'練好了！你用 Ctrl＋Z 救回誤刪，再只改需要的地方。':'練好了！你只改了需要的地方，其他文字都保留下來了。'};
}

export function initEditPractice(root){
 if(!root||root.dataset.initialized)return;
 root.dataset.initialized='true';
 const states=new Map();
 const updateSummary=()=>{const count=[...states.values()].filter(s=>s.passed).length;root.querySelector('[data-edit-summary]').textContent=`本次練好 ${count}／${EDIT_TASKS.length} 題${count===EDIT_TASKS.length?'，準備挑戰中英打！':''}`;};
 for(const task of EDIT_TASKS){
  const card=root.querySelector(`[data-edit-task="${task.id}"]`),input=card.querySelector('textarea');
  const feedback=card.querySelector('[data-edit-feedback]'),check=card.querySelector('[data-edit-check]'),replay=card.querySelector('[data-edit-replay]');
  let variantIndex=0,state=newEditState(),pending=null,move=null,composing=false,compositionBefore=null;
  const history=[];
  const variant=()=>task.variants[variantIndex];
  states.set(task.id,state);
  const snapshot=()=>({value:input.value,start:input.selectionStart,end:input.selectionEnd,state:copyEditState(state)});
  const remember=(before,after,type)=>{
   if(!before||before.value===after)return;
   history.push({before,rescue:isRescueDeletion(task,variant(),before,after,type)});
   if(history.length>100)history.shift();
  };
  const show=(message,success=false)=>{feedback.textContent=message;card.classList.toggle('edit-passed',success);};
  const refresh=()=>{
   const start=input.selectionStart,end=input.selectionEnd;
   const display=char=>char==='\n'?'換行':char?`「${char}」`:'沒有文字';
   card.querySelector('[data-edit-caret]').textContent=start!==end?`選取了 ${end-start} 個字元，按方向鍵先取消選取。`:`游標左邊：${display(input.value[start-1])}　右邊：${display(input.value[start])}`;
   check.disabled=composing||state.passed;replay.disabled=composing||!state.passed;
   card.querySelectorAll('[data-edit-key]').forEach(b=>b.disabled=composing||state.passed);
   card.querySelector('[data-edit-key="undo"]').disabled=composing||state.passed||history.length===0;
   card.querySelector('[data-edit-reset]').disabled=composing;
  };
  const reset=(changeVariant=false)=>{
   if(composing)return;
   if(changeVariant)variantIndex=1-variantIndex;
   state=newEditState();states.set(task.id,state);pending=null;move=null;compositionBefore=null;history.length=0;
   input.readOnly=false;input.value=variant().seed;input.setSelectionRange(input.value.length,input.value.length);
   card.querySelector('[data-edit-target]').textContent=variant().target;
   if(task.id==='undo')card.querySelector('.edit-hint').textContent=`先故意刪掉正確的「${variant().rescueChar}」，按 Ctrl＋Z 救回來，再刪掉多出的「喜」。`;
   show(changeVariant?'換一題了！這次也只改需要的地方。':'原句準備好了，移動游標開始修改。');
   updateSummary();refresh();
  };
  // One per-textarea history covers native input and auxiliary setRangeText edits together.
  // Ctrl+Z is handled only in this warm-up input; reset/replay never restore a previous question.
  const undo=()=>{
   if(composing||state.passed)return;
   const entry=history.pop();
   if(!entry){show('目前沒有可復原的編輯。先在這個文字框修改，再試 Ctrl＋Z。');refresh();return;}
   state=restoreEditSnapshot(entry.before,state,entry.rescue);states.set(task.id,state);
   pending=null;move=null;input.value=entry.before.value;
   input.setSelectionRange(entry.before.start,entry.before.end);
   show(entry.rescue?'已用 Ctrl＋Z 救回誤刪！現在移到多出的「喜」旁邊，只刪那個字。':'已復原上一步，文字和剛才的練習狀態都回來了，可以繼續修改。');
   updateSummary();refresh();
  };
  input.addEventListener('beforeinput',event=>{
   if(event.inputType==='historyUndo'&&event.cancelable&&!composing){event.preventDefault();pending=null;undo();return;}
   if(['insertFromPaste','insertFromDrop','deleteByCut'].includes(event.inputType)){event.preventDefault();pending=null;show('這次練習請移動游標、按鍵修改，不使用貼上、拖入或剪下。');return;}
   pending=composing||event.isComposing?null:snapshot();
  });
  for(const event of ['paste','drop','cut'])input.addEventListener(event,e=>{e.preventDefault();pending=null;show('請直接移動游標、按鍵修改，保留原本正確的文字。');});
  input.addEventListener('input',event=>{
   if(!composing&&!event.isComposing){remember(pending,input.value,event.inputType);recordEdit(state,task,variant(),pending,input.value,event.inputType);}
   pending=null;
   if(!state.passed)show(state.restartNeeded?'整段被刪除或替換了。按 Ctrl＋Z 救回文字，再繼續修改；也可以重新開始。':'修改好了就按「檢查修改」，看看文字和方法。');
   refresh();
  });
  input.addEventListener('keydown',event=>{
   if(!composing&&!event.isComposing&&(event.ctrlKey||event.metaKey)&&!event.altKey&&!event.shiftKey&&event.key.toLowerCase()==='z'){
    event.preventDefault();undo();return;
   }
   if(!composing&&!event.isComposing&&['ArrowUp','ArrowDown'].includes(event.key)&&!event.shiftKey&&!event.ctrlKey&&!event.altKey)move={value:input.value,from:input.selectionStart,key:event.key};else move=null;
  });
  input.addEventListener('keyup',event=>{
   if(move&&move.key===event.key&&move.value===input.value)recordMove(state,input.value,move.from,input.selectionStart,event.key);
   move=null;refresh();
  });
  for(const event of ['focus','click','select'])input.addEventListener(event,refresh);
  input.addEventListener('compositionstart',()=>{compositionBefore=snapshot();composing=true;pending=null;move=null;refresh();});
  input.addEventListener('compositionend',()=>{
   composing=false;remember(compositionBefore,input.value,'insertCompositionText');
   recordEdit(state,task,variant(),compositionBefore,input.value,'insertCompositionText');
   compositionBefore=null;pending=null;refresh();
  });
  check.addEventListener('click',()=>{
   if(composing||state.passed)return;
   const result=checkEdit(state,task,variant(),input.value);state.passed=result.ok;
   input.readOnly=result.ok;show(result.message,result.ok);refresh();updateSummary();
  });
  card.querySelector('[data-edit-reset]').addEventListener('click',()=>{reset();input.focus({preventScroll:true});});
  replay.addEventListener('click',()=>{if(!state.passed||composing)return;reset(true);input.focus({preventScroll:true});});
  card.querySelectorAll('[data-edit-key]').forEach(button=>{
   button.addEventListener('mousedown',event=>event.preventDefault());
   button.addEventListener('click',()=>{
    if(composing||state.passed)return;
    const key=button.dataset.editKey,value=input.value,start=input.selectionStart,end=input.selectionEnd;
    input.focus({preventScroll:true});
    if(key==='undo'){undo();return;}
    if(key==='backward'||key==='forward'){
     if(start!==end){show('先用方向鍵取消選取，再只刪游標旁邊的一個字。');return;}
     const from=key==='backward'?start-1:start;
     if(from<0||from>=value.length){refresh();return;}
     pending=snapshot();input.setRangeText('',from,from+1,'end');
     input.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:key==='backward'?'deleteContentBackward':'deleteContentForward'}));
    }else{
     let position;
     if(key==='left')position=start!==end?start:Math.max(0,start-1);
     else if(key==='right')position=start!==end?end:Math.min(value.length,start+1);
     else{
      const rows=value.split('\n'),row=caretRow(value,start),column=start-(value.lastIndexOf('\n',start-1)+1),next=row+(key==='up'?-1:1);
      position=next<0||next>=rows.length?start:rows.slice(0,next).reduce((n,line)=>n+line.length+1,0)+Math.min(column,rows[next].length);
      recordMove(state,value,start,position,key==='up'?'ArrowUp':'ArrowDown');
     }
     input.setSelectionRange(position,position);refresh();
    }
   });
  });
  reset();
 }
}

// Loaded independently of the authenticated weekly challenge, so warm-up survives auth/network failure.
if(typeof document!=='undefined')initEditPractice(document.getElementById('edit-practice'));
