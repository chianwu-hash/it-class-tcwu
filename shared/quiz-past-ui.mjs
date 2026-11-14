import {booleanChoicePresentation} from './quiz-boolean-choice.mjs?v=20261107-boolean-choice';
import {pastFieldInputAids} from './quiz-past-field-aids.mjs?v=20261104';
import {applySourceCrop} from './quiz-source-crop.mjs?v=20261102-transcribed';
import {renderMathResponse,mathResponseComplete,mathResponseError} from './quiz-math-response.mjs?v=20261102-math-audio';
import {renderLocalContent as renderScopedContent} from './quiz-past-content.mjs?v=20261102-transcribed';
import {renderManualResponse} from './quiz-past-manual.mjs';
import {attachPastInputKeyboard} from './quiz-past-input.mjs?v=20261102-math-audio';
import {createQuestionReport,mountQuestionReport} from './quiz-question-reports.mjs';
import {renderPastLearningReview} from './quiz-past-learning-review.mjs';
import {appendSingleChoiceOptions} from './quiz-choice.mjs';
import {createQuizWorkspace} from './quiz-workspace.mjs';
import {createQuizStudy,studySourceLabel} from './quiz-study.mjs';
import {renderExplanation} from './quiz-explanation-render.mjs';
export function initPastExamUI({root,request,resolveAsset,resolveTextbook,onView,reportRequest,onPractice}){
let active=true;
const mediaScope={resolve:resolveAsset,active:()=>active};
const renderLocalContent=(host,content)=>renderScopedContent(host,content,{mediaScope,imageLoading:'eager'});
const $=s=>root.querySelector(s),el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const workspace=createQuizWorkspace($('#workspace'),{scratchpaper:true}),statusElement=$('#status');
const onToolsToggle=()=>{if(active)workspace.refresh();};
root.addEventListener('toggle',onToolsToggle,true);
const button=(text,fn,cls)=>{const b=el('button',text,cls);b.type='button';b.addEventListener('click',fn);return b;};
let state,index=0,busy=false;const drafts=new Map(),clean=new Map(),pending=new Map(),reports=new Map();let tool='point',cursor={x:.5,y:.5},arrowStart=null,undo=[],draftRequest=null;
const study=createQuizStudy({root,kind:'past',getSnapshot:()=>state,resolvePage:resolveTextbook||(()=>Promise.reject(Error('課本暫時無法載入。')))});
const say=t=>{if(active&&statusElement)statusElement.textContent=t;};
const api=request;

const isManual=g=>['annotation','manual'].includes(g.kind);
const stopAudio=()=>root.querySelectorAll('audio').forEach(audio=>{audio.pause();audio.removeAttribute('src');audio.load();});
function draft(g){if(!drafts.has(g.id)){drafts.set(g.id,g.kind==='mark'?g.fields.map(()=>false):g.kind==='sequence'?g.choices.map(()=>''):g.kind==='manual'?{text:'',strokes:[],confirmed:false}:g.kind==='annotation'?{point:null,arrow:null,mediaSha256:g.assets[0].sha256}:g.fields.map(()=>g.kind==='set'?[]:''));clean.set(g.id,JSON.stringify(drafts.get(g.id)));}return drafts.get(g.id);}
function dirty(){return active&&state?.draft&&[...drafts].some(([id,value])=>!state.records[id]&&JSON.stringify(value)!==clean.get(id));}
function draftStatus(){const status=$('#past-draft-status');if(status)status.textContent=dirty()?'有尚未儲存的修改，離開前請按「暫存作答」。':state?.draft?.updatedAt?'雲端草稿已儲存（'+new Date(state.draft.updatedAt).toLocaleString('zh-TW')+'）；尚未送出判分。':'可先暫存作答，下次開啟同一份卷繼續作答；草稿不計分。';}
const observe=()=>queueMicrotask(()=>{if(active)draftStatus();});
for(const event of ['input','change','click','pointerup','keydown'])root.addEventListener(event,observe);
const warn=e=>{if(dirty()){e.preventDefault();e.returnValue='';}};
window.addEventListener('beforeunload',warn);
const leave=e=>{const a=e.target.closest?.('a[href]');if(a&&a.getAttribute('href')!=='#'&&dirty()&&!window.confirm('還有未儲存的答案。確定離開？請先按「暫存作答」才能下次接續。'))e.preventDefault();};
document.addEventListener('click',leave);
async function saveDraft(){
 if(busy||!active)return;
 busy=true;say('正在儲存雲端草稿…');render();
 try{
  // Resolve uncertain writes first. Never replace an unacknowledged request ID.
  if(pending.size){const next=await api('/api/resume',{});if(!active)return;state=next;for(const id of pending.keys())if(state.records[id]){pending.delete(id);draftRequest=null;}}
  if(draftRequest){const result=await api('/api/draft',draftRequest.packet);if(!active)return;if(result.snapshot)state=result.snapshot;else state.draft=result;draftRequest=null;}
  const groups=Object.fromEntries([...drafts].filter(([id])=>!state.records[id]));
  const body={version:state.version,revision:state.draft?.revision||0,groups,currentGroup:state.groups[index].id};
  draftRequest={packet:{...structuredClone(body),requestId:crypto.randomUUID()}};
  const result=await api('/api/draft',draftRequest.packet);if(!active)return;if(result.snapshot)state=result.snapshot;else state.draft=result;for(const [id,value] of Object.entries(result.groups))clean.set(id,JSON.stringify(value));draftRequest=null;say('作答已暫存。下次開啟這份卷即可接續，尚未送出判分。');
 }
 catch(e){if(active)say('草稿尚未確認儲存成功：'+e.message+' 請保留本頁並重試。');}
 finally{if(active){busy=false;render();}}
}
function currentValue(g){const r=state.records[g.id];return r?(isManual(g)?r.responses[0].value:r.responses.map(x=>x.value)):draft(g);}
function art(a){const f=el('figure',undefined,'figure');const link=el('a');link.href='#';link.dataset.imageLightbox='';const img=el('img');img.dataset.quizMediaUrl=a.url;resolveAsset(a.url).then(src=>{if(img.isConnected)img.src=src;}).catch(e=>say(e.message));img.alt=a.alt;applySourceCrop(link,img,a.viewBox);link.append(img);f.append(link,el('figcaption',a.alt));return f;}
function officialText(g,value){if(g.kind==='mark')return value?'應打勾':'不打勾';if(Array.isArray(value))return value.join(g.kind==='sequence'?' → ':'、');return value;}
function feedback(g,i,host){const r=state.records[g.id];if(!r||isManual(g))return;const result=r.results[i],box=el('div',undefined,'feedback'+(result.correct?'':' wrong'));if(g.fields.length>1)box.dataset.fieldLabel=`（${g.fields[i].label}）${g.fields[i].text}`;box.append(el('strong',result.correct?'✓ 這一格核對正確':'這一格和核對答案不同'),el('span','核對答案：'+officialText(g,result.official)));host.append(box);}
function renderPractice(){
 const host=$('#practice-progress'),p=state.practice;if(!host||!p)return;
 const box=el('div',undefined,'demo-note');
 const message=state.policy?.automaticPoints===0?'本卷採自我核對，作答會保存，不計自動成績與考古花。':p.earnedByThisAttempt?'這次完整作答達標，開出1朵考古花。':p.flowerCount?'這份試卷已開出1朵考古花，可繼續練習，不重複領取。':p.complete?'這次作答已完成，尚未開花；可以重新作答再挑戰。':'完整作答達60%後開出1朵考古花；不同次答案不合併計算。';
 box.append(el('strong',message));
 const details=el('details');details.append(el('summary',`歷次作答（${p.history.length}次）`));
 const wrap=el('div',undefined,'table-scroll'),table=el('table'),head=el('tr');for(const title of ['次數','成績','狀態','考古花'])head.append(el('th',title));table.append(head);
 p.history.forEach((h,i)=>{const row=el('tr');row.append(el('td',String(i+1)+(h.id===state.attemptId?'（目前）':'')),el('td',h.complete?`${h.score}／${h.max_score}`:`目前 ${h.score} 分`),el('td',h.complete?(h.passed?'達標':'未達60%'):'未完成'),el('td',h.earned_flower?'開出1朵':'—'));table.append(row);});wrap.append(table);details.append(wrap);box.append(details);host.replaceChildren(box);
 $('#restart').textContent=p.complete?'重新作答':'另開一次作答';
}
function render(){if(!active)return;study.refresh();
 workspace.reset();
 stopAudio();
 const g=state.groups[index],saved=state.records[g.id],locked=Boolean(saved)||busy||pending.has(g.id);if(!saved)onView(g.id);const values=currentValue(g);const summary=state.summary;
 $('#score').textContent=summary.answered?`目前核對 ${summary.score}／${summary.max} 分`:'準備好，就從一組開始。';$('#progress').textContent=`已核對 ${summary.answered}／${summary.total} 個欄位${summary.drawingStatus==='self_checked'?'・開放題已有自我核對紀錄':''}`;
 const meter=$('#past-progress');if(meter){meter.max=summary.total;meter.value=summary.answered;}
 renderPractice();
 $('#steps').replaceChildren(...state.groups.map((item,i)=>{const b=button('',()=>{index=i;arrowStart=null;undo=[];say('');render();},'step'+(i===index?' active':''));b.setAttribute('aria-current',i===index?'step':'false');b.append(el('b',String(i+1)));const t=el('span',item.title);t.append(el('small',state.records[item.id]?(isManual(item)?'已自我核對':'已核對'):'試試看'));b.append(t);return b;}));
 const card=el('div',undefined,'question-card'),head=el('header',undefined,'card-title'),title=el('div');card.dataset.kind=g.kind;card.dataset.groupId=g.id;title.append(el('span','原卷 '+g.sourceLabel,'source-label'),el('h2',g.title));head.append(title,el('span',isManual(g)?'不自動計分':`${g.fields.reduce((n,f)=>n+f.points,0)} 分`,'badge'));card.append(head);
 const grid=el('div',undefined,'body-grid'+(g.assets.length?'':' no-art')),left=el('div'),right=el('div');
 const hasMaterial=g.materialContent?Boolean(g.materialContent.text.trim()||g.materialContent.layout?.length||g.materialContent.media.length):Boolean(g.material?.trim());
 if(hasMaterial){const material=el('div',undefined,'material material-box');if(g.materialContent)renderLocalContent(material,g.materialContent);else material.textContent=g.material;left.append(material);}
 if(g.notice)left.append(el('p',g.notice,'demo-note'));
 if(g.choices.length&&g.kind!=='single'){const bank=el('div',undefined,'choice-bank');g.choices.forEach(c=>{const row=el('div',undefined,'past-bank-choice');row.append(el('b',c.id+'　'));renderLocalContent(row,c.content||{text:c.text,media:[]});bank.append(row);});left.append(bank);}
 if(g.assets.length&&g.kind!=='annotation'){const imgs=el('div',undefined,'art-grid'+(g.kind==='set'?' magnets':''));g.assets.forEach(a=>imgs.append(art(a)));left.append(imgs,el('p','點圖片可放大查看。','helper'));}
 if(g.kind==='single'||g.kind==='short'){
  const stem=el('div',undefined,'material');renderLocalContent(stem,g.promptContent);right.append(stem);
  if(g.kind==='single'){
   const display=booleanChoicePresentation(g.choices),choices=el('div',undefined,'past-choices');
   const result=saved?.results?.[0];
   appendSingleChoiceOptions(choices,{name:'single',options:g.choices.map(c=>({...c,value:c.id})),selected:values[0],locked,
    onSelect:value=>{draft(g)[0]=value;},badgeForOption:(_c,i)=>display?.[i].badge??g.choices[i].id,
    renderBody:(body,c,i)=>{if(display)body.textContent=display[i].text;else renderLocalContent(body,c.content);},
    result:result?{chosen:values[0],correct:result.official,chosenCorrect:result.correct}:null});
   for(const row of choices.children)row.classList.add('choice-row');
   right.append(choices);
  }
  else{g.fields.forEach((f,i)=>{const slot=el('div',undefined,'slot'),label=el('label',g.fields.length===1?'你的答案':`（${f.label}）${f.text}`,'field-label');label.htmlFor='short-answer-'+i;slot.dataset.studyQuestionId=f.id;if(g.answerFormat==='math-v1'){slot.append(label);renderMathResponse({host:slot,id:'short-answer-'+i,value:values[i],locked,onChange:v=>{draft(g)[i]=v}});feedback(g,i,slot);right.append(slot);return;}const input=el('input');input.id='short-answer-'+i;input.type='text';input.maxLength=2000;input.value=values[i];input.disabled=locked;input.autocomplete='off';input.addEventListener('input',()=>draft(g)[i]=input.value);slot.append(label,input);attachPastInputKeyboard(slot,input,pastFieldInputAids(g,f));feedback(g,i,slot);right.append(slot);});}
  if(g.kind==='single')feedback(g,0,right);
 }else if(g.kind==='mark'){
  right.append(el('p','勾選你認為正確的敘述。','helper'));const list=el('div',undefined,'answer-list');
  g.fields.forEach((f,i)=>{const wrap=el('div'),label=el('label',undefined,'choice-row student-option'),input=el('input');input.type='checkbox';input.checked=values[i];input.disabled=locked;input.dataset.field=f.id;input.addEventListener('change',()=>{draft(g)[i]=input.checked;label.querySelector('.option-badge').textContent=input.checked?'✓':f.label;const confirm=$('#mark-confirm');if(confirm)confirm.checked=false;});label.append(input,el('span',values[i]?'✓':f.label,'option-badge'),el('span',f.text,'option-body'));wrap.append(label);feedback(g,i,wrap);list.append(wrap);});right.append(list);
  if(!saved){const label=el('label',undefined,'confirm'),input=el('input');input.type='checkbox';input.id='mark-confirm';input.disabled=locked;label.append(input,el('span','我已檢查這一組，其他沒有勾選的格子就是「不勾」。'));right.append(label);}
 }else if(g.kind==='sequence'){
  right.append(el('p','每個位置選一個代號；也可用上移、下移調整。','helper'));
  for(let i=0;i<g.choices.length;i++){const slot=el('div',undefined,'slot'),label=el('label',`第 ${i+1} 位`);label.htmlFor='order-'+i;slot.append(label);const row=el('div',undefined,'order-line'),select=el('select');select.id='order-'+i;select.disabled=locked;select.append(new Option('請選擇代號',''));g.choices.forEach(c=>select.append(new Option(c.id+'　'+c.text,c.id)));select.value=saved?values[0][i]:values[i];select.addEventListener('change',()=>{draft(g)[i]=select.value;});row.append(select);
   for(const [delta,text] of [[-1,'↑'],[1,'↓']]){const b=button(text,()=>{const v=draft(g),j=i+delta;[v[i],v[j]]=[v[j],v[i]];render();$('#order-'+j)?.focus();});b.disabled=locked||i+delta<0||i+delta>=g.choices.length;b.setAttribute('aria-label',`將第${i+1}位${delta<0?'上移':'下移'}`);row.append(b);}slot.append(row);right.append(slot);}
  feedback(g,0,right);
 }else if(g.kind==='code'){
  g.fields.forEach((f,i)=>{const slot=el('div',undefined,'slot'),label=el('label',`（${f.label}）${f.text}`);label.htmlFor='code-'+i;const select=el('select');select.id='code-'+i;select.disabled=locked;select.append(new Option('請選擇代號',''));g.choices.forEach(c=>select.append(new Option(c.id+'　'+c.text,c.id)));select.value=values[i];select.addEventListener('change',()=>draft(g)[i]=select.value);slot.append(label,select);feedback(g,i,slot);right.append(slot);});
 }else if(g.kind==='set'){
  right.append(el('p','點選代號，可選一個或多個；再點一次即可取消。','helper'));
  g.fields.forEach((f,i)=>{const slot=el('fieldset',undefined,'slot');slot.append(el('legend',`（${f.label}）${f.text}`,'field-label'));const codes=el('div',undefined,'codes');for(const c of g.codes){const b=button(c,()=>{const list=draft(g)[i],at=list.indexOf(c);if(at<0)list.push(c);else list.splice(at,1);b.setAttribute('aria-pressed',String(list.includes(c)));});b.setAttribute('aria-pressed',String(values[i].includes(c)));b.setAttribute('aria-label',`第${f.label}欄代號${c}`);b.disabled=locked;codes.append(b);}slot.append(codes);feedback(g,i,slot);right.append(slot);});
 }else if(g.kind==='manual'){
  const manualPrompt=el('div',undefined,'material');renderLocalContent(manualPrompt,{text:g.fields[0].text,media:[]});right.append(manualPrompt);
  renderManualResponse({host:right,value:values,locked,asset:g.assets[0],resolveAsset});
  if(saved){const ref=el('div',undefined,'reference');ref.append(el('h3',saved.referenceStatus==='not_provided'?'作答已保留・不自動判分':saved.referenceStatus==='partial'?'對照已確認的官方參考':'對照官方參考，自己檢查'));renderLocalContent(ref,{text:saved.reference||'這題採自我核對。',media:[]});if(saved.referenceUrl)ref.append(art({url:saved.referenceUrl,alt:'官方解答局部參考圖'}));right.append(ref);}
 }else if(g.kind==='annotation'){
  left.append(el('p',g.fields[0].text,'material'));renderDrawing(g,right,locked,values);
  if(saved){const ref=el('div',undefined,'reference');ref.append(el('h3','對照官方標記，自己檢查'),el('p','看看施力點的位置與箭頭方向。這是自我核對，不是老師評分，也不計入分數。'));ref.append(art({url:saved.referenceUrl,alt:'官方解答局部參考圖'}));right.append(ref);}
 }
 const studentExplanations=saved?g.fields.flatMap(f=>{const explanation=study.explanation(f.id);return explanation?[{...explanation,label:f.label,questionId:f.id}]:[];}):[];
 if(saved&&!studentExplanations.some(e=>e.questionId===saved.learningReview?.source?.questionId))renderPastLearningReview({host:right,group:g,record:saved,version:state.version,onPractice,showConcepts:false});
 const legacyExplanations=saved?.learningExplanations||(typeof saved?.learningExplanation==='string'?[{text:saved.learningExplanation,wrongReviewHref:saved.wrongReviewHref}]:[]);
 const explanations=[...studentExplanations,...legacyExplanations.filter(e=>studentExplanations.length!==g.fields.length&&!studentExplanations.some(s=>s.questionId===e.questionId||String(s.label)===String(e.label)))];
 for(const explanation of explanations){
  const review=el('section',undefined,'past-learning-review quiz-explanation-copy');if(!explanation.origin||explanation.origin==='ai')review.classList.add('quiz-explanation-ai');review.append(el('h3',explanation.selfCheck?'這題怎麼自我核對？':explanation.label?'第（'+explanation.label+'）小題怎麼想？':'這題怎麼想？'));renderExplanation(review,explanation.text);review.append(el('p',explanation.origin?studySourceLabel(explanation.origin):'補充解析由 AI 依題意整理，非官方解析。','helper'));
  if(typeof explanation.wrongReviewHref==='string'){
   const url=new URL(explanation.wrongReviewHref,location.origin);
   if(url.origin===location.origin&&/\/grade[3469]\/115-1\/quiz-library\.html$/.test(url.pathname)){
    const link=el('a','到我的錯題繼續練習 →');link.href=url.href;review.append(link);
   }
  }right.append(review);
 }
 if(left.childNodes.length)grid.append(left,right);else{grid.classList.add('question-only');grid.append(right);}card.append(grid);const actions=el('div',undefined,'actions'),al=el('div',undefined,'actions-left');
 if(index>0)al.append(button('← 上一組',()=>{index--;say('');render();},'quiet'));if(index<state.groups.length-1){const next=button('下一組 →',()=>{index++;say('');render();},'quiet');next.dataset.pastNext='';al.append(next);}actions.append(al);
 if(saved)actions.append(el('span',isManual(g)?'已保留這次作答・未自動判分':`這組已儲存並核對：${saved.score} 分`,'local-saved'));
 else {const submit=button(busy?'正在儲存…':pending.has(g.id)?'以同一份答案重試':isManual(g)?'完成並儲存作答':'送出這一組',submitGroup,'primary');submit.id='submit';submit.disabled=busy;actions.append(submit);}
 if(state.draft){const save=button('暫存作答',saveDraft,'quiet');save.id='save-past-draft';save.disabled=busy;al.append(save);const note=el('p',undefined,'helper');note.id='past-draft-status';note.setAttribute('role','status');card.append(note);}
 if(saved){const next=al.querySelector('[data-past-next]');if(next){next.className='primary';actions.append(next);}}
 card.append(actions);
 let reportBox=null;
 if(reportRequest){const aid=state.attemptId,key=aid+':'+g.id;if(!reports.has(key))reports.set(key,createQuestionReport({request:reportRequest,context:{source:'past',attempt_id:aid,question_id:g.id},options:g.choices.map(c=>({...c,label:c.id})),valid:()=>active&&state?.attemptId===aid}));reportBox=reports.get(key);card.append(reportBox);}
 // Only presentation moves: all group/field IDs, listeners, draft maps and
 // request packets stay owned by this original-paper controller.
 const feedbackPanel=el('aside',undefined,'answer-preview');
 for(const node of [...card.querySelectorAll('.feedback,.reference,.past-learning-review')]){
  if(node.dataset.fieldLabel)feedbackPanel.append(el('p',node.dataset.fieldLabel,'helper'));
  feedbackPanel.append(node);
 }
 if(feedbackPanel.childNodes.length)card.append(feedbackPanel);card.classList.add('question');card.dataset.questionId=g.id;
 actions.classList.add('quiz-actions');
 const primary=actions.querySelector('.primary');if(primary)primary.classList.add('quiz-primary');
 const draftNote=card.querySelector('#past-draft-status');
 $('#workspace').replaceChildren(card);
 workspace.apply({article:card,saved:Boolean(saved),complete:state.practice?.complete,closed:false,statusElement,
  forceLongForm:g.fields.length>1||isManual(g)||['sequence','code','set'].includes(g.kind),scratchpadKey:JSON.stringify([state.attemptId,state.version,g.id]),scratchpadLabel:'原卷 '+g.sourceLabel+'・計算紙'});
 if(reportBox)mountQuestionReport(card.querySelector('.quiz-reading-panel')||card,reportBox);
 if(draftNote)$('#workspace .quiz-workspace-status')?.append(draftNote);
 draftStatus();
}
function renderDrawing(g,host,locked,value){
 const panel=el('div',undefined,'drawing-panel'),tools=el('div',undefined,'drawing-tools');
 for(const [id,text] of [['point','放施力點'],['arrow','畫箭頭']]){const b=button(text,()=>{tool=id;arrowStart=null;render();});b.setAttribute('aria-pressed',String(tool===id));b.disabled=locked;tools.append(b);}
 const reset=button('清除標示',()=>{undo.push(structuredClone(draft(g)));drafts.set(g.id,{point:null,arrow:null,mediaSha256:g.assets[0].sha256});arrowStart=null;render();});reset.disabled=locked;tools.append(reset);
 const back=button('復原',()=>{if(undo.length)drafts.set(g.id,undo.pop());render();});back.disabled=locked||!undo.length;tools.append(back);panel.append(tools);
 const NS='http://www.w3.org/2000/svg',svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','0 0 1 1');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('class','drawing-board');svg.setAttribute('tabindex','0');svg.setAttribute('role','group');svg.setAttribute('aria-label','訂書機標示區：方向鍵移動游標，Enter放置；按Shift可加大移動距離。');
 const node=(tag,attrs)=>{const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);return n;};
 const image=node('image',{href:'',x:0,y:0,width:1,height:1,preserveAspectRatio:'none'});svg.append(image);resolveAsset(g.assets[0].url).then(src=>{if(svg.isConnected)image.setAttribute('href',src);}).catch(e=>say(e.message));
 const defs=node('defs',{}),marker=node('marker',{id:'arrowhead',viewBox:'0 0 10 10',refX:8,refY:5,markerWidth:5,markerHeight:5,orient:'auto-start-reverse'});marker.append(node('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:'#c34f3f'}));defs.append(marker);svg.append(defs);
 if(value.point)svg.append(node('circle',{cx:value.point.x,cy:value.point.y,r:.017,class:'dot'}));if(value.arrow)svg.append(node('line',{x1:value.arrow.from.x,y1:value.arrow.from.y,x2:value.arrow.to.x,y2:value.arrow.to.y,class:'arrow','marker-end':'url(#arrowhead)'}));
 if(!locked){svg.append(node('circle',{cx:cursor.x,cy:cursor.y,r:.027,class:'cursor'}));if(arrowStart)svg.append(node('circle',{cx:arrowStart.x,cy:arrowStart.y,r:.012,class:'dot'}));}
 function put(p){if(locked)return;cursor=p;if(tool==='point'){undo.push(structuredClone(draft(g)));draft(g).point={...p};}else if(!arrowStart){arrowStart={...p};}else{undo.push(structuredClone(draft(g)));draft(g).arrow={from:arrowStart,to:{...p}};arrowStart=null;}render();$('.drawing-board')?.focus({preventScroll:true});}
 svg.addEventListener('pointerdown',e=>{e.preventDefault();const r=svg.getBoundingClientRect();put({x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))});});
 svg.addEventListener('keydown',e=>{if(locked)return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const step=e.shiftKey?.05:.01;cursor={x:Math.max(0,Math.min(1,cursor.x+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0))),y:Math.max(0,Math.min(1,cursor.y+(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0)))};render();$('.drawing-board').focus({preventScroll:true});}else if(e.key==='Enter'||e.key===' '){e.preventDefault();put({...cursor});}else if(e.key==='Escape'){arrowStart=null;render();}});
 panel.append(svg,el('p',tool==='point'?'選「放施力點」，在用力的位置按一下。':'選「畫箭頭」，先按起點，再按終點。','helper'),el('p','也可用方向鍵移動游標，Enter放置；Shift＋方向鍵可加大距離。','helper'));
 const dirs=el('div',undefined,'direction-grid');for(const [text,dx,dy] of [['↖',-1,-1],['↑',0,-1],['↗',1,-1],['←',-1,0],['•',0,0],['→',1,0],['↙',-1,1],['↓',0,1],['↘',1,1]]){const b=button(text,()=>{if(!draft(g).point){say('請先放置施力點，再選箭頭方向。');return;}const p=draft(g).point;undo.push(structuredClone(draft(g)));draft(g).arrow={from:{...p},to:{x:Math.max(0,Math.min(1,p.x+dx*.2)),y:Math.max(0,Math.min(1,p.y+dy*.2))}};render();});b.setAttribute('aria-label','由施力點畫出'+text+'方向箭頭');b.disabled=locked||(!dx&&!dy);dirs.append(b);}panel.append(el('p','或者：放好施力點後，直接選箭頭方向。','helper'),dirs);host.append(panel);
}
async function submitGroup(){const g=state.groups[index];let packet=pending.get(g.id);
 if(!packet){const value=draft(g);if(g.kind==='mark'&&!$('#mark-confirm')?.checked){say('請先確認未勾選的格子就是不勾。');return;}
  if(['single','short'].includes(g.kind)&&value.some(v=>g.answerFormat==='math-v1'?!mathResponseComplete(v):!v.trim())){say('請先完成每個答案欄再送出。');return;}
  if(g.answerFormat==='math-v1'){const error=value.map(mathResponseError).find(Boolean);if(error){say(error);return;}}
  if(g.kind==='manual'&&(!value.confirmed||(!value.text.trim()&&!value.strokes.length))){say('請先輸入文字或畫圖，並勾選完成確認。');return;}
  if(g.kind==='sequence'&&(value.some(v=>!v)||new Set(value).size!==g.choices.length)){say('請將所有位置填完整，每個代號使用一次。');return;}
  if(g.kind==='code'&&value.some(v=>!v)){say('請為每個位置選好代號。');return;}
  if(g.kind==='set'&&value.some(v=>!v.length)){say('請為每個答案欄選擇代號，再送出。');return;}
  if(g.kind==='annotation'&&(!value.point||!value.arrow)){say('請先放置施力點並畫出箭頭。');return;}
  packet={version:state.version,groupId:g.id,requestId:crypto.randomUUID(),confirmed:g.kind==='mark'?true:undefined,responses:g.fields.map((f,i)=>({questionId:f.id,value:isManual(g)?structuredClone(value):g.kind==='sequence'?[...value]:structuredClone(value[i])}))};pending.set(g.id,packet);
 }
 busy=true;say('正在儲存這一組…');render();try{const next=await api('/api/submit',packet);if(!active)return;state=next;pending.delete(g.id);draftRequest=null;say(isManual(g)?'已保留作答，請依題目要求檢查；有官方參考時可供對照。':'已儲存這一組，可以看核對結果或繼續下一組。');}catch(e){if(!active)return;if(e.code==='invalid_response'){pending.delete(g.id);say('答案格式不符，尚未儲存。請修改答案後再送出。');}else say('儲存結果尚未確認：'+e.message+' 請用同一份答案重試。');}finally{if(active){busy=false;render();}}
}
let restartRequest=null;
$('#restart').addEventListener('click',async()=>{if(busy)return;if(dirty()&&!window.confirm('還有未儲存的答案。要先暫存作答，請按取消。確定另開一次作答？'))return;busy=true;restartRequest??=crypto.randomUUID();try{const next=await api('/api/reset',{requestId:restartRequest});if(!active)return;state=next;restartRequest=null;drafts.clear();clean.clear();pending.clear();draftRequest=null;index=0;undo=[];arrowStart=null;say('');}catch(e){if(active)say(e.message);}finally{if(active){busy=false;render();}}});
return {load(next){state=next;for(const [id,value] of Object.entries(next.draft?.groups||{})){if(!next.records[id]){drafts.set(id,structuredClone(value));clean.set(id,JSON.stringify(value));}}const found=state.groups.findIndex(g=>g.id===next.draft?.currentGroup);index=found>=0?found:Math.max(0,state.groups.findIndex(g=>!state.records[g.id]));render();draftStatus();},clear(){study.clear();root.removeEventListener('toggle',onToolsToggle,true);workspace.destroy();stopAudio();active=false;window.removeEventListener('beforeunload',warn);document.removeEventListener('click',leave);for(const event of ['input','change','click','pointerup','keydown'])root.removeEventListener(event,observe);drafts.clear();clean.clear();pending.clear();state=null;root.replaceChildren();}};

}
