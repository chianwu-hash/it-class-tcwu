import {grade3MathUnits} from './quiz-paper-display.mjs';
import {difficultyModes,difficultyTarget,difficultyAdjustment} from './quiz-difficulty.mjs';
const make=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
export function localPoolContext(){
 if(!['localhost','127.0.0.1'].includes(location.hostname)||document.querySelector('meta[name="quiz-pool-local"]')?.content!=='1'||new URLSearchParams(location.search).get('local')!=='1')return null;
 const n=Number(new URLSearchParams(location.search).get('student')||1);if(!Number.isInteger(n)||n<1||n>31)throw Error('本機測試身分不符。');return {student:n,session:{user:{id:`demo-student-${n}`}}};
}
export function paperUrl(id,context){return `quiz.html?${context?`local=1&student=${context.student}`:'cloud=1'}&session=${encodeURIComponent(id)}`;}
export function initComposer({request,context}){
 const library=document.getElementById('cloud-library'),panel=make('section');panel.id='quiz-composer';panel.className='panel';panel.hidden=true;
 panel.innerHTML='<h2>自己選範圍練習</h2><p>組卷成功就會自動儲存到「我的自組卷」，不必先作答。</p><form id="compose-form"><label>試卷名稱（選填）<input id="compose-name" type="text" maxlength="60" placeholder="例如：我的分數複習卷"></label><fieldset id="compose-units"><legend>選擇單元（可複選）</legend></fieldset><label>題數（最多20題） <select id="compose-count"><option value="5">5題</option><option value="10" selected>10題</option><option value="15">15題</option><option value="20">20題</option></select></label><p id="compose-mix"></p><button type="submit">組卷並儲存</button></form><p id="compose-status" role="status" aria-live="polite"></p><div id="compose-result"></div>';
 library.insertBefore(panel,library.querySelector('.filters'));
 const difficultyLabel=make('label','試卷難度 '),difficulty=make('select');difficultyLabel.className='compose-difficulty';difficulty.id='compose-difficulty';
 for(const [value,m] of Object.entries(difficultyModes)){const o=make('option',m.label);o.value=value;o.defaultSelected=value==='medium';difficulty.append(o);}difficultyLabel.append(difficulty);document.getElementById('compose-mix').before(difficultyLabel);
 const courseLabel=make('label','科目 '),courseSelect=make('select');courseSelect.id='compose-course';courseLabel.append(courseSelect);panel.querySelector('form').prepend(courseLabel);
 const rewardsHint=make('p','完成實際10題以上、正確率達60%，可為努力樹增加1片葉子。5題短練習不計葉；相同題目組合不重複計葉。');rewardsHint.className='compose-reward-hint';panel.querySelector('form').before(rewardsHint);
 let generation=0,busy=false,pending=null,courses=[];
 function fillUnits(){const course=courses.find(c=>c.id===courseSelect.value);const box=document.getElementById('compose-units');box.replaceChildren(make('legend','選擇單元（可複選）'));for(const u of course?.units||[]){const label=make('label'),input=make('input');input.type='checkbox';input.value=u.id;label.append(input,make('span',`${u.id}. ${u.title||grade3MathUnits[u.id-1]||'單元'}（${u.count}題）`));box.append(label);}}
 courseSelect.addEventListener('change',fillUnits);
 const status=document.getElementById('compose-status'),result=document.getElementById('compose-result');
 const updateMix=()=>{const n=Number(document.getElementById('compose-count').value),m=difficultyModes[difficulty.value],d=difficultyTarget(difficulty.value,n);document.getElementById('compose-mix').textContent=`${m.label}；${n}題以${d.easy}題易、${d.medium}題中、${d.hard}題難為目標。${m.rule}組卷後顯示實際配比。`;};
 document.getElementById('compose-count').addEventListener('change',updateMix);difficulty.addEventListener('change',updateMix);updateMix();
 document.addEventListener('quiz-paper-removed',e=>{const a=result.querySelector('a');if(a&&new URL(a.href).searchParams.get('session')===e.detail.sessionId){pending=null;result.replaceChildren();status.textContent='這份卷已從清單移除，可以重新組一份新卷。';}});
 const labels=grade3MathUnits;
 async function ready(){
  const g=++generation;
  try{const d=await request('pool_catalog');if(g!==generation)return;panel.dataset.available=String(d.available);panel.hidden=!d.available;if(!d.available)return;
   courses=d.courses||[{id:'115-1-hanlin-g3-math',subject:'數學',units:d.units}];const old=courseSelect.value;courseSelect.replaceChildren(...courses.map(c=>new Option(c.subject,c.id)));if(courses.some(c=>c.id===old))courseSelect.value=old;else if(courses.some(c=>c.id==='115-1-hanlin-g3-math'))courseSelect.value='115-1-hanlin-g3-math';fillUnits();
  }catch{if(g===generation){panel.dataset.available='false';panel.hidden=true;}}
 }
 panel.querySelector('form').addEventListener('input',()=>{pending=null;result.replaceChildren();status.textContent='';});
 panel.querySelector('form').addEventListener('submit',async e=>{
  e.preventDefault();if(busy)return;
  const units=[...panel.querySelectorAll('input:checked')].map(n=>Number(n.value)),count=Number(document.getElementById('compose-count').value),name=document.getElementById('compose-name').value.trim();
  if(!units.length){status.textContent='先勾選至少一個想複習的單元。';return;}
  pending??={kind:'self',count,units,name,course_id:courseSelect.value,difficulty:difficulty.value,request_id:crypto.randomUUID()};const g=generation;
  busy=true;panel.querySelectorAll('button,input,select').forEach(n=>n.disabled=true);status.textContent='正在組卷並儲存…';
  try{
   const r=await request('compose',pending);if(g!==generation)return;const d=r.distribution;
   status.textContent=`✓ 已儲存到「我的自組卷」。${name?`名稱：${name}。`:''}${difficultyModes[d.difficulty||'medium'].label}。${difficultyAdjustment(d)}共${d.actual}題：易${d.easy}、中${d.medium}、難${d.hard}。${d.actual<count?'所選難度可用的題目較少，先練這幾題。':''}`;
   const a=make('a',`開始這${d.actual}題 →`);a.className='paper-start';a.href=paperUrl(r.session_id,context);
   const more=make('button','再組一份新卷');more.type='button';more.addEventListener('click',()=>{pending=null;result.replaceChildren();status.textContent='原卷已保留在「我的自組卷」。可以調整名稱和範圍，再組一份。';document.getElementById('compose-name').focus();});
   result.replaceChildren(a,more);document.dispatchEvent(new CustomEvent('quiz-paper-saved'));
  }catch(e){if(g===generation)status.textContent=e.message;}
  finally{if(g===generation){busy=false;panel.querySelectorAll('button,input,select').forEach(n=>n.disabled=false);}}
 });
 return {ready,canExtend(catalog){return courses.some(c=>c.subject===catalog?.subject&&String(c.grade||3)===String(catalog?.volume||'').slice(0,1)&&c.extension_available!==false);},reset(){generation++;busy=false;pending=null;courses=[];panel.hidden=true;panel.dataset.available='false';panel.querySelector('form').reset();updateMix();result.replaceChildren();status.textContent='';},async extend(item){const r=await request('compose',{kind:'extension',count:3,request_id:item.request_id,attempt_id:item.attempt_id,question_id:item.question_id});return {...r,url:paperUrl(r.session_id,context)};}};
}
