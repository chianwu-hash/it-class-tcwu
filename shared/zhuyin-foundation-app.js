import {zhuyinLessons as lessons,getZhuyinLesson,zhuyinKeys,generateZhuyin,textDistance,zhuyinCount} from './zhuyin-foundation-curriculum.mjs';
import {createTypingFingerGuide,fingerLabel} from './typing-finger-guide.mjs';
import {createClock} from '../prototypes/typing-foundation/level1/grading.mjs';
import {initTypingChallenge} from './typing-challenge.js?v=20261006-google';
const $=id=>document.getElementById(id),config=window.foundationConfig;
const lesson=getZhuyinLesson(config.lessonKey),ime=lesson.mode==='ime';
let cloud,records=[],saved=null,started=false,stage=0,rows=[],row=0,pos=0,correct=0,errors=0,confirmations=0;
let mode='intro',review=false,busy=false,composing=false,interrupted=false,clock=createClock(),ticker;
let pendingSave=null,lastChecked=null,lastHintStage=null;
const previous=new Map(),challenge=()=>stage===5;
document.body.classList.add('zhuyin-page');
document.title=`中打第 ${lesson.number} 關：${lesson.title}`;
document.querySelector('.heading h1').textContent=lesson.title;
document.querySelector('.heading .eyebrow').textContent=`中打基礎 · 第 ${lesson.number} / ${lessons.length} 關`;
document.querySelector('.subtitle').textContent=ime?'切到微軟注音中文模式，選字與修正完成後再檢查。':'切到英文輸入模式，畫面顯示注音，按下對應的實體按鍵。';
document.querySelector('.badge').textContent='中打基礎';
document.querySelector('.brand .muted').textContent='中打基礎練習';
document.querySelector('.practice-card').setAttribute('aria-label','中打練習');
document.querySelectorAll('footer p')[1].textContent='標準注音配置；操作說明以 Windows 微軟注音為主。輸入法版本或個人設定可能影響候選字順序。';
document.querySelector('.journey > .eyebrow').textContent='本關的 6 個小步驟';
$('starter-label').hidden=true;$('grade').disabled=true;
$('goal-rule').textContent='初練 90% · 綜合 95%，連續兩組';
$('policy-note').textContent='先打準：目前不限速度；中打與英打成果分開保存。';
document.querySelector('#intro h2').textContent=ime?'先確認輸入法是「中文」':'注音定位，不是輸入中文字';
document.querySelector('#intro p').textContent=ime?'使用真正的注音輸入法。候選字尚未確認時不判分；可以選字、刪除、修改，確認內容後按「檢查這一行」。':'左食指放 F（ㄑ），右食指放 J（ㄨ）。保持英文模式，照注音提示按鍵；本關不替你開啟輸入法。';
document.querySelector('.intro-symbol').textContent=ime?'中文字':'ㄑ ＋ ㄨ';
const lessonTips=[
 '先練 ㄑ、ㄨ，再逐步加入基準列其餘注音。按完伸展鍵，食指回到 F、J 的小凸點。',
 '由基準列向上伸指；按完上排注音後，手指回到原來的位置。',
 '由基準列向下伸指；移動手指，不要把整隻手移走。',
 '數字列的部分按鍵也是注音：ㄅ、ㄉ、ㄓ、ㄚ、ㄞ、ㄢ、ㄦ。本關先不練聲調。',
 '混合三十七個注音，練習看到符號就找到按鍵。忘記指法時可以開啟手指圖。',
 '本關仍保持英文模式。依序練一聲（空白）、二聲（6）、三聲（3）、四聲（4）與輕聲（7）；不要另加分隔空白。',
 '先輸入完整詞語並確認選字，再繼續下一個詞。螢幕上的候選字順序可能因人而異。',
 '發音相近不代表字相同，例如「知道／直到」。微軟注音可用向下鍵進入候選視窗，再用方向鍵與 Enter 選字；候選字序號不固定。',
 '把句子分成詞語輸入，例如「我們／一起／去／看書」，不必每輸入一字就檢查。',
 '注意全形「，。？！」，半形標點不算相同。微軟注音中文模式下，可按 Ctrl＋Alt＋逗號開啟符號鍵盤，依畫面提示選符號；不要自行加入空白。',
 '送出前逐一核對同音字、漏字與標點。需要修正時，先完成組字，再移動游標或選取文字修改。',
 '整合詞語、選字、標點與檢查。先求內容正確，再逐漸提高速度。',
];
const tip=document.createElement('p');tip.textContent=lessonTips[lesson.number-1];tip.className='zh-lesson-tip';document.querySelector('#intro').append(tip);
const help=document.createElement('details'),summary=document.createElement('summary');summary.textContent='本關操作提示';help.className='zh-operation-help';help.append(summary,tip.cloneNode(true));
if(ime){const link=document.createElement('a');link.href='https://support.microsoft.com/zh-tw/windows/hardware/input-devices/microsoft-traditional-chinese-ime';link.textContent='微軟注音官方操作說明（另開分頁）';link.target='_blank';link.rel='noopener noreferrer';help.append(link);}
$('typing-area').before(help);
document.querySelector('.instructions').textContent=ime?'① 切到中文　② 完成組字與選字　③ 檢查這一行':'① 切到英文　② 手指定位　③ 依提示按鍵';
document.querySelector('.overline').textContent=ime?'看清楚整行，使用注音輸入法輸入。':lesson.mode==='sounds'?'依序拼音；「一」表示一聲，用空白鍵結束該音節。':'只輸入注音對應鍵，不要在符號之間加空白。';
$('tree-note').textContent='每個中打大關一片葉，不重複領取。';
document.querySelector('.stats small').textContent=ime?' 字元／分':' 鍵／分';
if(ime)$('accuracy').parentElement.firstChild.textContent='檢查正確率 ';
document.querySelector('.streak-stat').hidden=ime;
document.querySelector('.keyboard-heading span').textContent='標準注音配置（大千式）';
document.querySelector('.keyboard-heading small').textContent=ime?'真實輸入法負責組字與選字':'上方注音，下方英數鍵';
document.querySelector('.finger-legend').textContent='F／ㄑ：左食指定位　J／ㄨ：右食指定位　按完伸展鍵，回到基準列。';
const guide=createTypingFingerGuide($('finger-guide'));
for(const keys of ['1234567890-','qwertyuiop','asdfghjkl;','zxcvbnm,./']){
 const div=document.createElement('div');div.className='typing-letter-row';
 for(const key of keys){const k=document.createElement('kbd');k.className='typing-letter-key';k.dataset.key=key;const top=document.createElement('span'),bottom=document.createElement('small');top.textContent=zhuyinKeys[key];bottom.textContent=key.toUpperCase();k.append(top,bottom);div.append(k);}
 $('keyboard').append(div);
}
const editor=document.createElement('div');editor.id='zh-editor';
editor.innerHTML='<label for="zh-input">輸入本行中文字</label><textarea id="zh-input" rows="2" autocomplete="off" spellcheck="false" aria-describedby="zh-input-help"></textarea><p id="zh-input-help">先完成選字；可用 Backspace 修正。Enter 留給輸入法確認，Tab 可移到檢查按鈕。</p><button id="zh-check" class="primary" type="button">檢查這一行</button>';
$('typing-area').append(editor);editor.hidden=!ime;
if(ime)$('typing-area').removeAttribute('tabindex');
const map=document.createElement('details');map.className='course-map';map.innerHTML='<summary>中打學習地圖（選擇關卡）</summary><div class="course-links"></div>';
document.querySelector('.layout').before(map);
function status(text){$('cloud-status').textContent=text;}
function feedback(text,error=false){$('feedback').textContent=text;$('feedback').classList.toggle('error',error);}
function show(id){for(const name of ['intro','exercise','result','paused'])$(name).hidden=name!==id;}
function focusInput(){(ime?$('zh-input'):$('typing-area')).focus();}
function hints(){const visible=!ime&&$('show-fingers').checked;$('finger-guide').hidden=!visible;$('target-line').hidden=!visible;$('finger-controls').hidden=ime;}
$('show-fingers').onchange=hints;
function paint(){
 const text=rows[row];$('prompt').replaceChildren();
 [...text].forEach((char,index)=>{const span=document.createElement('span');span.textContent=ime?char:char===' '?'一':zhuyinKeys[char];span.className=!ime?(index<pos?'typed':index===pos?'active':''):'';$('prompt').append(span);});
 if(!ime){const key=text[pos];$('target').textContent=key===' '?'空白':zhuyinKeys[key];$('finger').textContent=fingerLabel(key);$('finger-note').textContent=key===' '?'這裡的空白表示第一聲，不是字間分隔。':`對應 ${key.toUpperCase()} 鍵`;guide.update(key,fingerLabel(key));
 for(const el of $('keyboard').querySelectorAll('[data-key]'))el.classList.toggle('is-target',!challenge()&&el.dataset.key===key);}
 $('count').textContent=`第 ${row+1} / 3 行 · ${correct} / ${zhuyinCount(lesson,stage)} ${ime?'字元':'鍵'}`;
 $('accuracy').textContent=correct+errors?`${Math.floor(correct/(correct+errors)*100)}%`:'—';$('streak').textContent=correct;
 $('progress').style.width=`${correct/zhuyinCount(lesson,stage)*100}%`;
}
function timing(){const ms=clock.elapsed(),s=Math.floor(ms/1000);$('time').textContent=`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;$('speed').textContent=ms&&correct?(correct*60000/ms).toFixed(1):'—';}
function controls(){
 $('steps').replaceChildren();lesson.stages.forEach((s,i)=>{const done=saved?.completed||i<(saved?.checkpoint||0),li=document.createElement('li'),b=document.createElement('button');li.className=`${done?'done ':''}${i===stage?'current':''}`;b.type='button';b.className='step-link';b.disabled=!done||busy||!cloud;
 const n=document.createElement('span');n.className='step-number';n.textContent=done?'✓':String(i+1).padStart(2,'0');const label=document.createElement('span'),strong=document.createElement('strong'),small=document.createElement('small');strong.textContent=s.title;small.textContent=lesson.mode==='keys'&&i<5?[...s.keys].map(k=>zhuyinKeys[k]).join(' · '):s.keys;label.append(strong,small);b.append(n,label);b.onclick=async()=>{if(await maySwitch()){stage=i;review=true;await begin();}};li.append(b);$('steps').append(li);});
 $('stage-label').textContent=`${stage+1} · ${lesson.stages[stage].title}${review?' · 重練':''}`;$('return-progress').hidden=!review;
 const container=map.querySelector('div');container.replaceChildren();lessons.forEach((l,i)=>{const b=document.createElement('button');b.type='button';b.className='quiet';const unlocked=lessons.slice(0,i).every(prior=>records.some(r=>r.lesson_key===prior.key&&r.completed));b.disabled=!unlocked||busy||!cloud;b.textContent=`${records.some(r=>r.lesson_key===l.key&&r.completed)?'✓ ':unlocked?'':'🔒 '}${i+1}. ${l.title}`;if(l.key===lesson.key)b.setAttribute('aria-current','page');b.onclick=async()=>{if(await maySwitch())location.href=`?lesson=${l.key}`;};container.append(b);});
}
async function maySwitch(){
 if(busy||!cloud)return false;
 if(!['playing','paused'].includes(mode)||!(correct+errors+($('zh-input').value.length)))return true;
 const wasPlaying=mode==='playing';clock.pause();const d=$('switch-practice');
 const ok=await new Promise(resolve=>{d.returnValue='cancel';d.addEventListener('close',()=>resolve(d.returnValue==='switch'),{once:true});d.showModal();});
 if(wasPlaying)clock.resume();if(!ok)focusInput();return ok;
}
async function begin(){
 if(busy||!cloud)return;busy=true;controls();$('start').disabled=true;
 try{
  if(!started&&!review){saved=await cloud.start(false);started=true;stage=saved.checkpoint;confirmations=0;}
  rows=generateZhuyin(lesson,stage,previous.get(stage));previous.set(stage,rows);
  row=pos=correct=errors=0;lastChecked=null;composing=false;interrupted=false;clock=createClock();
  $('zh-input').value='';$('zh-input').disabled=false;$('zh-check').disabled=false;
  if(lastHintStage!==stage){$('show-fingers').checked=!challenge();lastHintStage=stage;}
  $('finger-controls-note').textContent=challenge()?'挑戰預設隱藏，可自行開啟。':'從自己上方看雙手';hints();
  $('attempt-rule').textContent=`${review?'重練不改變已存成果。 ':''}${challenge()?'綜合正確率 95%，連續兩組不同題。':'初練正確率 90%。'}速度只記錄，不設過關門檻。${ime?'檢查時內容不符才記錯；選字與修正本身不記錯。':''}`;
  mode='playing';show('exercise');paint();timing();clearInterval(ticker);ticker=setInterval(timing,250);feedback(ime?'完成選字與修正後，按「檢查這一行」。':'看注音、找按鍵，慢慢來。');focusInput();
 }catch(error){status(error.message);}finally{busy=false;$('start').disabled=false;controls();}
}
function finishUI(passed,completed){
 mode='result';$('result-icon').textContent=passed?'✓':'↻';$('result-title').textContent=review?'重練完成':completed?`中打第 ${lesson.number} 關過關！`:passed?'這組完成了！':'完成練習，再試一次';
 $('result-text').textContent=review?'原本成果保留；重練不改變進度，也不重複長葉。':completed?'這一關長出一片中打過關葉。':challenge()?`連續達標 ${confirmations}/2；需要兩組不同題。`:'繼續保持正確的指法與檢查習慣。';
 $('result-stats').textContent=`正確 ${correct} · 錯誤 ${errors} · 正確率 ${Math.floor(correct/(correct+errors)*100)}% · ${(correct*60000/Math.max(1,clock.elapsed())).toFixed(1)} ${ime?'字元／分（含標點）':'鍵／分'}${interrupted?' · 曾暫停':''}`;
 $('continue').textContent=review?'再練一次 →':completed&&lesson.number<12?'前往下一關 →':passed&&!challenge()?'下一小關 →':'換新題再練 →';
 $('continue').disabled=false;$('continue').onclick=()=>{if(review)return begin();if(completed&&lesson.number<12){location.href=`?lesson=${lessons[lesson.number].key}`;return;}if(completed){review=true;}else if(passed&&!challenge())stage++;begin();};
 $('retry').hidden=!review;$('retry').textContent='回到目前進度';$('retry').disabled=false;
 if(saved?.completed){document.querySelector('.growth').classList.add('earned');$('tree-title').textContent=`中打第 ${lesson.number} 關的過關葉`;}
 controls();show('result');$('continue').focus();
}
async function finish(){
 clock.pause();clearInterval(ticker);timing();mode='saving';busy=true;controls();$('zh-input').disabled=true;$('zh-check').disabled=true;
 const passed=correct/(correct+errors)*100>=(challenge()?95:90);
 if(review){busy=false;finishUI(passed,false);return;}
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(rows.join('|')));
 const attempt={event_id:crypto.randomUUID(),stage:stage+1,correct,errors,elapsed_ms:Math.max(1,clock.elapsed()),interrupted,fingerprint:[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('')};
 pendingSave=async()=>{
  $('cloud-retry').hidden=true;status('正在儲存，請先不要關閉頁面…');
  try{saved=await cloud.save(attempt);records=records.filter(r=>r.lesson_key!==lesson.key).concat(saved);confirmations=saved.completed?2:saved.pending_count;busy=false;pendingSave=null;status('已儲存，可下次接續。');finishUI(passed,saved.completed);}
  catch(error){status(`尚未儲存：${error.message}`);$('cloud-retry').hidden=false;$('cloud-retry').onclick=pendingSave;}
 };await pendingSave();
}
function nextRow(){row++;pos=0;lastChecked=null;$('zh-input').value='';if(row===3){finish();return;}paint();feedback('本行完成，繼續下一行。');focusInput();}
$('typing-area').addEventListener('keydown',e=>{
 if(ime||mode!=='playing'||e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;
 if(e.key==='Tab'||e.key==='Shift')return;
 if(e.isComposing||e.key==='Process'){feedback('這是注音鍵位練習，請先切到英文模式。',true);return;}
 if(e.key.length!==1)return;e.preventDefault();clock.start();const expected=rows[row][pos];
 if(e.key!==expected){errors++;feedback(`請按 ${zhuyinKeys[expected]} 對應的 ${expected===' '?'空白':expected.toUpperCase()} 鍵。`,true);paint();return;}
 correct++;pos++;if($('show-fingers').checked)guide.press(expected);if(pos===rows[row].length)nextRow();else{paint();feedback('按對了，繼續。');}
});
$('zh-input').addEventListener('compositionstart',()=>{if(mode==='playing'){composing=true;clock.start();$('zh-check').disabled=true;}});
$('zh-input').addEventListener('compositionend',()=>{composing=false;$('zh-check').disabled=mode!=='playing';});
$('zh-input').addEventListener('input',()=>{if(mode==='playing')clock.start();});
$('zh-input').addEventListener('beforeinput',e=>{if(mode!=='playing'||['insertFromPaste','insertFromDrop'].includes(e.inputType))e.preventDefault();});
$('zh-check').onclick=()=>{
 if(mode!=='playing'||composing)return;const text=$('zh-input').value;
 if(!text){feedback('先輸入本行內容，再檢查。',true);focusInput();return;}
 if(text!==rows[row]){if(lastChecked!==text){errors+=textDistance(text,rows[row]);lastChecked=text;}feedback('內容還不相同，請檢查同音字、漏字與全形標點；修正後再檢查。',true);paint();focusInput();return;}
 correct+=rows[row].length;nextRow();
};
for(const type of ['paste','drop'])$('typing-area').addEventListener(type,e=>{e.preventDefault();feedback('請使用鍵盤與注音輸入法練習，不使用貼上。',true);});
function pause(){if(mode!=='playing'||$('switch-practice').open)return;clock.pause();interrupted=true;mode='paused';$('zh-input').disabled=true;$('pause-note').textContent='可繼續本次練習；速度僅供參考。';show('paused');$('resume').focus();}
$('pause').onclick=pause;window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
$('resume').onclick=()=>{mode='playing';clock.resume();$('zh-input').disabled=false;$('zh-check').disabled=composing;show('exercise');focusInput();};
async function returnProgress(){if(await maySwitch()){review=!!saved?.completed;stage=saved?.checkpoint||0;begin();}}
$('return-progress').onclick=returnProgress;$('retry').onclick=returnProgress;
$('start').onclick=()=>{review=!!saved?.completed;begin();};
$('result').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;const buttons=[$('continue'),$('retry')].filter(b=>!b.hidden&&!b.disabled),i=buttons.indexOf(e.target);if(i<0)return;e.preventDefault();buttons[(i+1)%buttons.length].focus();});
async function connect(){
 $('cloud-retry').hidden=true;try{cloud=await initTypingChallenge({foundation:config});records=await cloud.list();controls();saved=await cloud.load();stage=saved?.checkpoint||0;confirmations=0;document.querySelector('.practice-card').inert=false;$('start').textContent=saved?.completed?'已過關，繼續精進 →':stage?`接續：${lesson.stages[stage].title} →`:'手指就位，開始練習 →';status('身分已確認；中打成果獨立保存。');if(saved?.completed){document.querySelector('.growth').classList.add('earned');$('tree-title').textContent=`中打第 ${lesson.number} 關已過關`;}controls();}
 catch(error){cloud=null;status(error.message);$('cloud-retry').hidden=false;$('cloud-retry').onclick=connect;}
}
controls();await connect();
