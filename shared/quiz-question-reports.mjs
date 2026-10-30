export const reportCategories={question:'題目文字有誤',options:'選項有誤',answer:'正確答案有疑問',explanation:'解析有誤',media:'圖片或音檔有問題',other:'其他問題'};
export const reportStatuses={pending:'待處理',processing:'處理中',resolved:'已處理',dismissed:'確認無需修改'};
export const reportNode=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
export function reportStyles(){
 if(document.querySelector('[data-quiz-report-style]'))return;
 const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('./quiz-question-reports.css',import.meta.url).href;link.dataset.quizReportStyle='';document.head.append(link);
}
// Keep the returned node when the host rerenders, so an answer save does not erase
// an unfinished report. Hosts discard it when the authenticated identity changes.
export function createQuestionReport({request,context,options=[],valid=()=>true}){
 reportStyles();const n=reportNode,box=n('section');box.className='quiz-question-report';
 const toggle=n('button','題目出錯回報');toggle.type='button';toggle.className='quiz-report-toggle';toggle.setAttribute('aria-expanded','false');box.append(toggle);
 const form=n('form'),category=n('select'),choice=n('select'),description=n('textarea'),status=n('p'),submit=n('button','送出回報');
 form.id='quiz-report-'+crypto.randomUUID();form.hidden=true;toggle.setAttribute('aria-controls',form.id);
 toggle.addEventListener('click',()=>{form.hidden=!form.hidden;toggle.setAttribute('aria-expanded',String(!form.hidden));if(!form.hidden)description.focus();});
 category.setAttribute('aria-label','問題類型');for(const [v,t] of Object.entries(reportCategories))category.append(new Option(t,v));
 choice.setAttribute('aria-label','有問題的選項');choice.append(new Option('整題／不指定選項',''));for(const [i,o] of options.entries())choice.append(new Option(`選項 ${o.label??String.fromCharCode(65+i)}`,o.id));
 description.required=true;description.maxLength=1000;description.rows=3;description.setAttribute('aria-label','問題說明');description.placeholder='請說明哪裡有問題，例如：選項 B 的文字和圖片不同。';
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');submit.type='submit';
 form.append(n('p','請用文字描述錯誤的地方。送出時會自動附上這一題、當時的選項順序與你的說明給老師。'),category,choice,description,submit,status);box.append(form);
 let pending=null,busy=false,done=false;
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(busy||done||!valid())return;
  const fields={...context,category:category.value,option_id:choice.value,description:description.value.trim()};
  if(!fields.description){status.textContent='請補充問題說明。';description.focus();return;}
  const key=JSON.stringify(fields);if(pending?.key!==key)pending={key,packet:{...fields,request_id:crypto.randomUUID()}};
  busy=true;for(const el of [category,choice,description,submit])el.disabled=true;status.textContent='正在送出回報…';
  try{await request('question_report',{action:'submit',...pending.packet});if(!valid())return;done=true;status.textContent='回報已送出，老師可在後台查看。謝謝你幫忙確認！';submit.hidden=true;}
  catch(e){if(valid())status.textContent=e.message||'尚未確認送出，請重試；你的說明仍保留。';}
  finally{busy=false;if(valid()&&!done)for(const el of [category,choice,description,submit])el.disabled=false;}
 });return box;
}
