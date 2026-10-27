import {renderContent} from './quiz-render.mjs';
import {resolveQuizMedia} from './quiz-media.mjs';
import {initImageLightbox} from './image-lightbox.js';

const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
export function initWrongQuestions({request,pageGrade,getUserId,onExtension,canExtend=()=>Boolean(onExtension)}) {
  const library=document.getElementById('cloud-library');
  const views=make('div',undefined,'wrong-view-switch');views.setAttribute('aria-label','練習與複習');
  const papersButton=make('button','單元練習'),wrongButton=make('button','我的錯題');views.append(papersButton,wrongButton);library.prepend(views);
  const panel=make('section',undefined,'wrong-panel');panel.hidden=true;
  panel.innerHTML='<h2>我的錯題</h2><p>把答錯的題目再看一次，從解析裡找一個新線索。這裡只會收錄已開放解析的錯題。</p><div class="filters"><label>科目 <select id="wrong-subject"><option value="">全部科目</option></select></label><label>單元 <select id="wrong-unit"><option value="">全部單元</option></select></label><button id="wrong-refresh">更新錯題</button></div><p id="wrong-status" role="status" aria-live="polite"></p><div id="wrong-list"></div><div id="wrong-pages" class="wrong-pages"></div><section id="wrong-detail" hidden><button id="wrong-back">返回錯題清單</button><h3 id="wrong-title" tabindex="-1"></h3><p id="wrong-meta"></p><div id="server-quiz"></div></section>';
  library.append(panel);
  const el=id=>document.getElementById(id),detail=el('server-quiz');
  initImageLightbox({root:detail,selector:'img',initialScale:.8,minScale:.2,zoomStep:.1,resolveImageSource:i=>resolveQuizMedia(i.dataset.quizMediaUrl||i.src)});
  let active=false,generation=0,busy=false,page=0,facets=[];
  const locked=value=>{busy=value;for(const n of [...panel.querySelectorAll('button,select'),papersButton,wrongButton])n.disabled=value||n.dataset.pageDisabled==='true';};
  const message=text=>el('wrong-status').textContent=text;
  const current=(g,uid)=>g===generation&&uid===getUserId();
  function listView(){el('wrong-detail').hidden=true;el('wrong-list').hidden=false;el('wrong-pages').hidden=false;detail.replaceChildren();document.getElementById('lightbox-close')?.click();}
  function fill(select,values,label){const old=select.value;select.replaceChildren(new Option(label,''),...values.map(v=>new Option(v,v)));if(values.includes(old))select.value=old;}
  function units(){const subject=el('wrong-subject').value;fill(el('wrong-unit'),[...new Set(facets.filter(f=>!subject||f.subject===subject).map(f=>f.unit))],'全部單元');}
  async function load(){
    if(busy||!getUserId())return;const g=generation,uid=getUserId();locked(true);listView();message('正在整理你的錯題…');el('wrong-list').replaceChildren();el('wrong-pages').replaceChildren();
    try {
      const data=await request('wrong_questions',{action:'list',grade:pageGrade,page,subject:el('wrong-subject').value,unit:el('wrong-unit').value});if(!current(g,uid))return;
      facets=data.facets;fill(el('wrong-subject'),[...new Set(facets.map(f=>f.subject))],'全部科目');units();
      if(page>0&&!data.items.length){page=0;locked(false);return load();}
      message(data.total?`共有 ${data.total} 題可複習的錯題，依作答時間由新到舊排列。`:'目前沒有符合條件的錯題。完成練習、開放解析後，答錯的題目會自動收進來。');
      for(const item of data.items){
        const card=make('article',undefined,'wrong-card'),h=make('h3',`${item.catalog?.subject||'未分類'}・${item.catalog?.unit||item.title}`);
        card.append(h,make('p',`第 ${item.number} 題｜${new Date(item.answered_at).toLocaleString('zh-TW')}`,'meta'),make('p',item.preview));
        const button=make('button','回看題目與解析');button.dataset.questionId=item.question_id;button.addEventListener('click',()=>open(item));card.append(button);el('wrong-list').append(card);
      }
      const previous=make('button','上一頁'),next=make('button','下一頁');previous.dataset.pageDisabled=String(page===0);next.dataset.pageDisabled=String((page+1)*20>=data.total);
      previous.addEventListener('click',()=>{page--;load();});next.addEventListener('click',()=>{page++;load();});
      if(data.total)el('wrong-pages').append(previous,make('span',`第 ${page+1}／${Math.ceil(data.total/20)} 頁`),next);
    }catch(e){if(current(g,uid))message(e.message);}finally{if(current(g,uid)){locked(false);panel.querySelectorAll('[data-page-disabled="true"]').forEach(n=>n.disabled=true);}}
  }
  function content(target,value){
    const c=structuredClone(value||{text:'',media:[]});
    if(c.text?.trim()==='書商未提供這一題的詳細解析。')c.text='這一題目前沒有詳細解析，可以先核對正確答案。';
    for(const m of c.media||[])if(m.alt==='書商原圖')m.alt='圖片';else if(m.alt==='書商原版聽力音檔')m.alt='聽力音檔';
    renderContent(target,c,{imageLoading:'eager'});
  }
  async function open(item){
    if(busy)return;const g=generation,uid=getUserId();locked(true);message('正在讀取這題的作答與解析…');
    try{
      const data=await request('wrong_questions',{action:'detail',grade:pageGrade,attempt_id:item.attempt_id,question_id:item.question_id});if(!current(g,uid)||!active)return;
      detail.dataset.subject=data.catalog?.subject||'';detail.replaceChildren();const article=make('article',undefined,'question');
      el('wrong-title').textContent=`${data.catalog?.subject||'未分類'}・${data.catalog?.unit||data.title}・第 ${data.number} 題`;
      el('wrong-meta').textContent=`作答時間：${new Date(data.answered_at).toLocaleString('zh-TW')}｜以下保留你當時的選項順序。`;
      const q=data.question;if(q.material?.text||q.material?.media?.length){const material=make('section',undefined,'wrong-material');material.append(make('h4','共用材料'));content(material,q.material);article.append(material);}
      content(article,q.prompt);
      const choices=make('div',undefined,'wrong-choices');
      for(const [index,o] of (q.options||[]).entries()){
        const option=make('div',undefined,'wrong-option');option.append(make('strong',String.fromCharCode(65+index)));const body=make('div');content(body,o.content);
        if(o.id===data.response){body.append(make('p','你的答案','wrong-selected'));option.classList.add('was-selected');}
        if(o.id===data.review.answer.option_id){body.append(make('p','✓ 正確答案','wrong-correct'));option.classList.add('is-correct');}
        option.append(body);choices.append(option);
      }
      article.append(choices);const explanation=make('section',undefined,'answer-preview');explanation.append(make('h4','解題想法'));
      if(q.type!=='single'){explanation.append(make('p',`你的答案：${data.response}`),make('p',`可接受的答案：${data.review.answer.accepted.join('、')}`));}
      else explanation.append(make('p',`正確選項：${String.fromCharCode(65+q.options.findIndex(o=>o.id===data.review.answer.option_id))}`));
      content(explanation,data.review.explanation);article.append(explanation);detail.append(article);
      if(onExtension&&canExtend()&&data.catalog?.subject==='數學'){
        const section=make('section',undefined,'wrong-extension'),button=make('button','再練3題同一個重點'),status=make('p');status.setAttribute('role','status');section.append(button,status);detail.append(section);
        const requestId=crypto.randomUUID();
        button.addEventListener('click',async()=>{if(busy)return;locked(true);status.textContent='正在找同一個重點的題目…';try{const result=await onExtension({...item,request_id:requestId});if(!current(g,uid)||!active)return;const d=result.distribution;status.textContent=`已找到${d.actual}題（易${d.easy}、中${d.medium}、難${d.hard}），不會重複剛才那題。${d.actual<3?'這個重點目前可用題較少，先練這幾題。':''}`;section.querySelector('a')?.remove();const a=make('a','開始同重點練習 →','paper-start');a.href=result.url;section.append(a);}catch(e){if(current(g,uid))status.textContent=e.message;}finally{if(current(g,uid))locked(false);}});
      }
      el('wrong-list').hidden=true;el('wrong-pages').hidden=true;el('wrong-detail').hidden=false;message('可以慢慢核對題目、當時答案與解析。');el('wrong-title').focus();
    }catch(e){if(current(g,uid))message(e.message);}finally{if(current(g,uid))locked(false);}
  }
  function activate(value){if(busy)return;active=value;panel.hidden=!value;for(const id of ['cloud-papers','cloud-status','my-papers-section'])if(el(id))el(id).hidden=value||(id==='my-papers-section'&&el(id).dataset.enabled!=='true');library.querySelector('.filters').hidden=value;const composer=document.getElementById('quiz-composer');if(composer)composer.hidden=value||composer.dataset.available!=='true';papersButton.setAttribute('aria-pressed',String(!value));wrongButton.setAttribute('aria-pressed',String(value));if(value)load();}
  papersButton.addEventListener('click',()=>{history.replaceState(null,'',location.pathname+location.search);activate(false);});
  wrongButton.addEventListener('click',()=>{history.replaceState(null,'',location.pathname+location.search+'#wrong');activate(true);});
  el('wrong-subject').addEventListener('change',()=>{el('wrong-unit').value='';units();page=0;load();});el('wrong-unit').addEventListener('change',()=>{page=0;load();});
  el('wrong-refresh').addEventListener('click',()=>{page=0;load();});el('wrong-back').addEventListener('click',()=>{listView();message('選一題，回看當時的答案與解析。');});
  return {ready(){activate(location.hash==='#wrong');},reset(){generation++;locked(false);page=0;facets=[];listView();el('wrong-list').replaceChildren();el('wrong-pages').replaceChildren();fill(el('wrong-subject'),[],'全部科目');units();message('');}};
}
