// Classroom practice only. Native clipboard and native undo; no auth, storage or rewards.
export const CLIPBOARD_TASKS = [
 {id:'select',title:'① 選得剛剛好',icon:'computer-mouse',bookRef:'課本 p.126–127｜按住左鍵拖曳，確認文字反白。',intro:'拖曳滑鼠，只選取指定詞語，不多選標點。',variants:[
  {seed:'午餐有白飯和玉米湯。',word:'玉米湯',goal:'只反白「玉米湯」，不要選到句號。'},
  {seed:'書桌上有鉛筆和橡皮擦。',word:'橡皮擦',goal:'只反白「橡皮擦」，不要選到句號。'}]},
 {id:'copy',title:'② 名牌多一份',icon:'copy',bookRef:'課本 p.127｜複製 Ctrl＋C，點好目的地，再貼上 Ctrl＋V。',intro:'同樣的文字要多一份，原本的也要留下來。',variants:[
  {seed:'我的名牌：三年級小作家\n書包吊牌：',word:'三年級小作家',target:'我的名牌：三年級小作家\n書包吊牌：三年級小作家',kind:'copy',goal:'把「三年級小作家」複製到第二行冒號後，原處保留。'},
  {seed:'門口海報：歡迎光臨小書店\n教室海報：',word:'歡迎光臨小書店',target:'門口海報：歡迎光臨小書店\n教室海報：歡迎光臨小書店',kind:'copy',goal:'把「歡迎光臨小書店」複製到第二行冒號後，原處保留。'}]},
 {id:'cut',title:'③ 文字搬回家',icon:'scissors',bookRef:'課本 p.88｜剪下 Ctrl＋X、貼上 Ctrl＋V；原書搬移檔案，本關延伸到文字。',intro:'文字放錯地方了，搬到新位置，原處不留那段字。',variants:[
  {seed:'放錯位置：國語課本\n書包：',word:'國語課本',target:'放錯位置：\n書包：國語課本',kind:'cut',goal:'剪下「國語課本」，搬到第二行「書包：」後。'},
  {seed:'放錯位置：彩色鉛筆\n筆筒：',word:'彩色鉛筆',target:'放錯位置：\n筆筒：彩色鉛筆',kind:'cut',goal:'剪下「彩色鉛筆」，搬到第二行「筆筒：」後。'}]},
 {id:'decide',title:'④ 自己決定：多一份，還是搬過去？',icon:'lightbulb',extra:true,bookRef:'對照課本 p.127、88｜比較複製與剪下；故事為教師自編。',intro:'讀故事，先想想：原處的文字還要留下來嗎？',variants:[
  {seed:'小貓的盤子：魚餅乾\n小狗的盤子：',word:'魚餅乾',target:'小貓的盤子：魚餅乾\n小狗的盤子：魚餅乾',kind:'copy',goal:'小狗也要一份「魚餅乾」，小貓的要留著。你要怎麼做？'},
  {seed:'小貓的盤子：\n小狗的盤子：魚餅乾',word:'魚餅乾',target:'小貓的盤子：魚餅乾\n小狗的盤子：',kind:'cut',goal:'這份「魚餅乾」是小貓的，放錯盤子了。搬回小貓的盤子。'}]},
 {id:'replace',title:'⑤ 貼上換新詞',icon:'wand-magic-sparkles',extra:true,bookRef:'對照課本 p.127–128「複製／貼上與修改」；反白後貼上取代是教師補充練習。',intro:'先複製詞語卡，再反白要換掉的詞，貼上就會取代它。',variants:[
  {seed:'詞語卡：長頸鹿\n我最喜歡的動物是大象。',word:'長頸鹿',replace:'大象',target:'詞語卡：長頸鹿\n我最喜歡的動物是長頸鹿。',kind:'copy',goal:'複製「長頸鹿」，選取第二行「大象」再貼上，其餘文字保留。'},
  {seed:'詞語卡：向日葵\n我最喜歡的花是玫瑰。',word:'向日葵',replace:'玫瑰',target:'詞語卡：向日葵\n我最喜歡的花是向日葵。',kind:'copy',goal:'複製「向日葵」，選取第二行「玫瑰」再貼上，其餘文字保留。'}]}
];
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function renderClipboardPractice(){return `<p class="clip-summary" data-clip-summary role="status">本次練好 0／5 關；先練前 3 關，後面自由挑戰。</p>`+CLIPBOARD_TASKS.map(t=>`<article class="clip-task" data-clip-task="${t.id}">
 <h3><span class="clip-icon"><i class="fa-solid fa-${t.icon}" aria-hidden="true"></i></span><span>${t.title}</span></h3>
 <p class="clip-role">${t.extra?'快手延伸':'跟著練習'}</p><p class="book-ref">${esc(t.bookRef)}</p><p>${t.intro}</p>
 <p id="clip-goal-${t.id}" class="clip-goal" data-clip-goal>${esc(t.variants[0].goal)}</p>
 <label for="clip-input-${t.id}">${t.id==='select'?'在這裡選取文字':'在這裡選取、複製或搬動文字'}</label>
 <textarea id="clip-input-${t.id}" rows="${t.id==='select'?2:3}" ${t.id==='select'?'readonly':''} spellcheck="false" autocomplete="off" autocapitalize="off" aria-describedby="clip-goal-${t.id} clip-selection-${t.id} clip-feedback-${t.id}">${esc(t.variants[0].seed)}</textarea>
 <p id="clip-selection-${t.id}" class="clip-selection" data-clip-selection>點入文字框，試著選取指定文字。</p>
 <div class="clip-actions"><button type="button" data-clip-check>檢查這一關</button><button type="button" data-clip-hint>給我提示</button><button type="button" data-clip-reset>重新開始這題</button><button type="button" data-clip-replay disabled>再練一次（換題）</button></div>
 <div class="clip-feedback-wrap"><p id="clip-feedback-${t.id}" data-clip-feedback class="clip-feedback" role="status" aria-live="polite">${t.id==='select'?'看反白範圍，不多也不少。':'先選對文字，再點好目的地。快捷鍵或右鍵選單都可以。'}</p>
 <span class="clip-celebration" data-clip-celebration aria-hidden="true" hidden><span class="clip-cheer">✓ 過關！</span>${Array.from({length:6},()=>'<span class="clip-spark">★</span>').join('')}</span></div>
 </article>`).join('');}

export const freshClipboardState=()=>({record:null,proof:false});
const clone=s=>({record:s.record?{...s.record}:null,proof:s.proof});
export function sourceRecord(v,kind,value,start,end){
 const index=v.seed.indexOf(v.word);
 return value===v.seed&&start===index&&end===index+v.word.length
  ?{kind,text:v.word,source:value,start,end,removed:kind==='copy'}:null;
}
export function applyClipboardEdit(v,state,edit){
 const next=clone(state);next.proof=false;
 if(edit.type==='deleteByCut'){
  const r=edit.cut;
  next.record=r&&edit.before===r.source&&edit.after===r.source.slice(0,r.start)+r.source.slice(r.end)
    ?{...r,removed:true}:null;
 }else if(edit.type==='insertFromPaste'){
  const r=state.record;
  const expected=edit.before.slice(0,edit.start)+edit.text+edit.before.slice(edit.end);
  const replacing=!v.replace||edit.before.slice(edit.start,edit.end)===v.replace;
  next.proof=!!(r&&r.kind===v.kind&&r.removed&&r.text===edit.text&&edit.after===expected&&replacing&&edit.after===v.target);
 }
 return next;
}
export function checkClipboard(v,state,value,selected){
 if(!v.target)return value===v.seed&&selected===v.word
  ?{ok:true,message:'你選得剛剛好！指定詞語反白，標點留在外面。'}
  :{ok:false,message:`請只選「${v.word}」，再看看有沒有多選標點或少選字。`};
 if(value===v.target&&state.proof)return {ok:true,message:v.replace?'你保留了其他文字，只用貼上換掉指定詞語！':v.kind==='cut'?'原處搬走，已到新位置！你用剪下完成了文字搬家。':'原處還在，多了一份！你用複製保留了原本的文字。'};
 if(value===v.target)return {ok:false,message:'文字結果對了；這題也要練操作。請重新開始，從本題文字框選取、複製或剪下，再貼上。'};
 if(state.record?.kind==='cut'&&state.record.removed)return {ok:false,message:'文字已剪下。點好故事指定的位置，再貼上；貼錯可用 Ctrl＋Z 救回。'};
 return {ok:false,message:v.replace?'先複製詞語卡，再選取第二行要換掉的詞，貼上取代。貼錯可用 Ctrl＋Z 救回。':'看看原處是否該保留，再檢查目的地。多一份用複製，搬位置用剪下；貼錯可用 Ctrl＋Z 救回。'};
}

export function initClipboardPractice(root){
 if(!root||root.dataset.ready)return;root.dataset.ready='true';
 const done=new Set();
 const summary=()=>{root.querySelector('[data-clip-summary]').textContent=`本次練好 ${done.size}／5 關；先練前 3 關，後面自由挑戰。`;};
 for(const task of CLIPBOARD_TASKS){
  const card=root.querySelector(`[data-clip-task="${task.id}"]`);
  let input=card.querySelector('textarea'),variantIndex=0,state=freshClipboardState(),pending=null,composing=false,hints=0;
  let frames=[],position=0,lastSelection='';
  const variant=()=>task.variants[variantIndex];
  const feedback=card.querySelector('[data-clip-feedback]'),replay=card.querySelector('[data-clip-replay]');
  const celebration=card.querySelector('[data-clip-celebration]');let celebrationTimer=null;
  const stopCelebration=()=>{clearTimeout(celebrationTimer);celebrationTimer=null;celebration.hidden=true;card.classList.remove('clip-celebrating');};
  const celebrate=()=>{
   stopCelebration();
   // The persistent success text is the reduced-motion alternative; never steal focus.
   if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
   celebration.hidden=false;card.classList.add('clip-celebrating');
   celebrationTimer=setTimeout(stopCelebration,1150);
  };
  const invalidate=()=>{stopCelebration();done.delete(task.id);card.classList.remove('clip-passed');replay.disabled=true;summary();};
  const report=(message,ok=null)=>{feedback.textContent=message;if(typeof ok==='boolean')card.classList.toggle('clip-passed',ok);};
  const selection=()=>input.value.slice(input.selectionStart,input.selectionEnd);
  const snapshot=()=>({value:input.value,state:clone(state)});
  function updateSelection(){
   if(composing)return;
   const selected=selection();card.querySelector('[data-clip-selection]').textContent=selected?`目前選取：「${selected.replaceAll('\n',' ↵ ')}」`:'目前沒有反白。貼上前，先看看游標在哪裡。';
   if(task.id==='select'&&selected!==lastSelection){invalidate();lastSelection=selected;}
  }
  function reset(change){
   if(change)variantIndex=1-variantIndex;
   // A new native textarea establishes a fresh undo scope; old questions cannot be restored.
   const replacement=input.cloneNode(false);input.replaceWith(replacement);input=replacement;
   input.value=variant().seed;state=freshClipboardState();pending=null;composing=false;hints=0;lastSelection='';
   frames=[snapshot()];position=0;card.querySelector('[data-clip-check]').disabled=false;card.querySelector('[data-clip-goal]').textContent=variant().goal;
   invalidate();bind();input.setSelectionRange(0,0);updateSelection();report('新的一次練習，先選對文字，再一步一步做。');
  }
  function restore(type){
   const direction=type==='historyUndo'?-1:1;
   let found=-1;for(let i=position+direction;i>=0&&i<frames.length;i+=direction)if(frames[i].value===input.value){found=i;break;}
   if(found>=0){position=found;state=clone(frames[found].state);}
   else{state=freshClipboardState();frames=[snapshot()];position=0;}
  }
  function bind(){
   for(const name of ['select','click','keyup'])input.addEventListener(name,updateSelection);
   input.addEventListener('copy',()=>{
    if(composing)return;
    state.record=sourceRecord(variant(),'copy',input.value,input.selectionStart,input.selectionEnd);
    frames[position].state=clone(state);
   });
   input.addEventListener('cut',()=>{
    if(composing)return;
    pending={type:'deleteByCut',cut:sourceRecord(variant(),'cut',input.value,input.selectionStart,input.selectionEnd),before:input.value,start:input.selectionStart,end:input.selectionEnd};
   });
   input.addEventListener('paste',e=>{
    if(composing)return;
    pending={type:'insertFromPaste',text:(e.clipboardData?.getData('text/plain')||'').replaceAll('\r\n','\n'),before:input.value,start:input.selectionStart,end:input.selectionEnd};
   });
   input.addEventListener('beforeinput',e=>{
    if(composing||e.isComposing)return;
    if(!pending||pending.type!==e.inputType)pending={type:e.inputType,before:input.value,start:input.selectionStart,end:input.selectionEnd};
   });
   input.addEventListener('input',e=>{
    invalidate();if(composing||e.isComposing)return;
    if(['historyUndo','historyRedo'].includes(e.inputType))restore(e.inputType);
    else{
     state=applyClipboardEdit(variant(),state,{...pending,type:pending?.type||e.inputType,after:input.value});
     frames.splice(position+1);frames.push(snapshot());position=frames.length-1;
    }
    pending=null;updateSelection();report('看看原處和目的地，再按「檢查這一關」。');
   });
   input.addEventListener('compositionstart',()=>{composing=true;pending=null;card.querySelector('[data-clip-check]').disabled=true;});
   input.addEventListener('compositionend',()=>{composing=false;pending=null;state.proof=false;frames.splice(position+1);frames.push(snapshot());position=frames.length-1;card.querySelector('[data-clip-check]').disabled=false;invalidate();updateSelection();});
  }
  card.querySelectorAll('button').forEach(b=>b.addEventListener('mousedown',e=>{if(e.button===0)e.preventDefault();}));
  card.querySelector('[data-clip-check]').addEventListener('click',()=>{
   if(composing)return;
   const wasPassed=done.has(task.id);
   const result=checkClipboard(variant(),state,input.value,selection());if(!result.ok)invalidate();report(result.message,result.ok);
   if(result.ok){done.add(task.id);replay.disabled=false;summary();if(!wasPassed)celebrate();}
  });
  card.querySelector('[data-clip-hint]').addEventListener('click',()=>{
   hints++;
   const kind=variant().kind;
   report(hints===1?variant().goal:task.id==='select'?`先點一下取消反白，再從「${variant().word}」開頭拖到結尾。也可按住 Shift，用方向鍵微調。`:`① 選「${variant().word}」→ ② ${kind==='cut'?'Ctrl＋X 剪下':'Ctrl＋C 複製'} → ③ ${variant().replace?'選取第二行「'+variant().replace+'」':'點故事指定的目的地'} → ④ Ctrl＋V 貼上。也可以用右鍵選單。`);
  });
  card.querySelector('[data-clip-reset]').addEventListener('click',()=>{reset(false);input.focus();});
  replay.addEventListener('click',()=>{if(replay.disabled)return;reset(true);input.focus();});
  frames=[snapshot()];bind();
 }
}
if(typeof document!=='undefined')initClipboardPractice(document.getElementById('clipboard-practice'));
