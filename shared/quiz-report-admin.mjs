import {reportCategories,reportStatuses,reportNode as n,reportStyles} from './quiz-question-reports.mjs';
import {renderContent} from './quiz-render.mjs?v=20261029-load-batch1';
export function initReportAdmin({root,request,getUserId}){
 reportStyles();root.classList.add('quiz-report-admin');root.id='question-reports';
 const title=n('h2','題目與選項出錯回報'),toolbar=n('div'),filter=n('select'),refresh=n('button','更新回報'),status=n('p'),list=n('div'),pages=n('div'),dialog=n('dialog');
 toolbar.className='report-toolbar';filter.setAttribute('aria-label','回報處理狀態');filter.append(new Option('全部狀態',''));for(const [v,t] of Object.entries(reportStatuses))filter.append(new Option(t,v));filter.value='pending';
 status.setAttribute('role','status');toolbar.append(filter,refresh);root.append(title,n('p','查看學生指出的題目、選項與說明。標記處理不會直接改動題庫或學生作答。'),toolbar,status,list,pages,dialog);
 let enabled=false,generation=0,page=0,scope=null,busy=false;
 const current=(g,uid)=>enabled&&g===generation&&uid===getUserId();
 const button=(text,fn)=>{const b=n('button',text);b.type='button';b.addEventListener('click',fn);return b;};
 const clearDialog=()=>{scope?.dispose();scope=null;dialog.querySelectorAll('audio').forEach(a=>a.pause());dialog.replaceChildren();};
 dialog.addEventListener('close',clearDialog);
 const locks=value=>{busy=value;filter.disabled=value;refresh.disabled=value;for(const el of pages.querySelectorAll('button'))el.disabled=value||el.dataset.disabled==='true';};
 async function load(){
  if(!enabled||busy)return;const g=generation,uid=getUserId();locks(true);status.textContent='正在讀取回報…';
  try{const data=await request('question_report',{action:'list',page,status:filter.value});if(!current(g,uid))return;
   if(page&&!data.items.length){page=0;locks(false);return load();}
   list.replaceChildren();pages.replaceChildren();status.textContent=`符合條件共 ${data.total} 筆回報。`;
   for(const r of data.items){const card=n('article'),who=r.identity;card.append(n('h3',`${r.title}・第 ${r.number} 題`),n('p',`${who.class_code} 班 ${who.seat_no??''} 號 ${who.display_name??''}｜${new Date(r.created_at).toLocaleString('zh-TW')}｜${reportStatuses[r.status]}`),n('p',`${reportCategories[r.category]}${r.option_id?'（指定選項，詳見題目）':''}：${r.description}`),button('查看題目與處理',()=>open(r.id)));list.append(card);}
   if(data.total){const prev=button('上一頁',()=>{page--;load();}),next=button('下一頁',()=>{page++;load();});prev.dataset.disabled=String(page===0);next.dataset.disabled=String((page+1)*20>=data.total);pages.append(prev,n('span',` 第 ${page+1}／${Math.ceil(data.total/20)} 頁 `),next);}
  }catch(e){if(current(g,uid))status.textContent=e.message;}finally{if(current(g,uid))locks(false);}
 }
 async function open(id){
  if(!enabled||busy)return;const g=generation,uid=getUserId();locks(true);status.textContent='正在核對原題…';
  try{const r=await request('question_report',{action:'detail',id});if(!current(g,uid))return;clearDialog();
   scope=request.createMediaScope?.({user_id:uid,attempt_id:r.id,version_id:r.version_id,view:crypto.randomUUID(),generation:g},{valid:()=>current(g,uid)&&dialog.open});
   const content=(host,c)=>{if(c)renderContent(host,c,{mediaScope:scope,imageLoading:'eager'});};
   dialog.append(button('關閉',()=>dialog.close()),n('h2',`${r.snapshot.title}・第 ${r.snapshot.number} 題`),n('p',`${reportCategories[r.category]}：${r.description}`),n('p',`版本：${r.version_id}｜作答：${r.attempt_id}`));
   const body=n('section');dialog.append(body);dialog.showModal();
   if(r.source==='quiz'){
    const q=r.snapshot.question;content(body,q.material);content(body,q.prompt);
    for(const [i,o] of (q.options||[]).entries()){const row=n('div');row.append(n('strong',`${String.fromCharCode(65+i)}${o.id===r.option_id?'（學生回報此選項）':''}　`));content(row,o.content);body.append(row);}
    const answer=q.type==='single'?String.fromCharCode(65+q.options.findIndex(o=>o.id===q.answer.option_id)):q.answer.accepted.join('、');body.append(n('h3',`固定版本正解：${answer}`));content(body,q.explanation);
   }else{
    const q=r.snapshot.group;body.append(n('h3',q.title));content(body,q.materialContent||{text:q.material||'',media:[]});content(body,q.promptContent);
    for(const o of q.choices||[]){const row=n('div');row.append(n('strong',`${o.id}${o.id===r.option_id?'（學生回報此選項）':''}　`));content(row,o.content||{text:o.text||'',media:[]});body.append(row);}
    body.append(n('h3','固定版本題目與核對記號'));
    for(const f of q.fields||[]){const answer=typeof f.answer==='boolean'?(f.answer?'應打勾':'不打勾'):Array.isArray(f.answer)?f.answer.join('、'):f.answer??'自我核對';body.append(n('p',`${f.label??''} ${f.text??''}｜核對：${answer}`));}
    content(body,{text:'',media:(q.assets||[]).map(a=>({kind:'image',url:a.url,alt:a.alt||'原卷圖片'}))});
    if(q.reference)body.append(n('p',q.reference));
    if(q.referenceUrl)content(body,{text:'官方參考圖',media:[{kind:'image',url:q.referenceUrl,alt:'官方參考圖'}]});
   }
   const state=n('select'),note=n('textarea'),save=button('儲存處理狀態',async()=>{
    if(save.disabled)return;save.disabled=true;message.textContent='正在儲存…';
    try{const next=await request('question_report',{action:'update',id:r.id,updated_at:r.updated_at,status:state.value,note:note.value});if(!current(g,uid)||!save.isConnected)return;r.updated_at=next.updated_at;message.textContent='處理狀態已儲存。';status.textContent='處理已儲存；按「更新回報」更新清單。';}
    catch(e){if(current(g,uid)&&save.isConnected)message.textContent=e.message;}finally{if(current(g,uid))save.disabled=false;}
   }),message=n('p');state.setAttribute('aria-label','處理狀態');note.setAttribute('aria-label','處理備註');note.maxLength=1000;note.rows=3;note.placeholder='處理備註（教師可見）';note.value=r.note;message.setAttribute('role','status');for(const [v,t] of Object.entries(reportStatuses))state.append(new Option(t,v));state.value=r.status;dialog.append(n('h3','處理紀錄'),state,note,save,message);status.textContent='已開啟回報原題。';
  }catch(e){if(current(g,uid))status.textContent=e.message;}finally{if(current(g,uid))locks(false);}
 }
 filter.addEventListener('change',()=>{page=0;load();});refresh.addEventListener('click',()=>{page=0;load();});
 return {async setEnabled(value){generation++;enabled=value;locks(false);dialog.close();clearDialog();list.replaceChildren();pages.replaceChildren();status.textContent='';page=0;if(value)await load();}};
}
