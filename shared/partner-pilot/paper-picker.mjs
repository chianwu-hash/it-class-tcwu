export const partySizes=p=>p?.kind==='leaf'&&Number(p.total)===10?[2]:[2,3,4];
export const paperCategory=p=>p.self?'self':p.past?'past':'teacher';
export function filterPapers(papers,{category='teacher',subject='',query=''}={}){
 const needle=query.trim().toLocaleLowerCase('zh-TW');
 return papers.filter(p=>paperCategory(p)===category&&(!subject||p.subject===subject)&&(!needle||[p.title,p.subject,p.total].join(' ').toLocaleLowerCase('zh-TW').includes(needle)));
}
export function mountPaperPicker(root,{papers,selected=null,esc,onChange}){
 let category=selected?paperCategory(selected):'teacher',subject='',query='',page=0,picked=selected;
 const labels={teacher:'老師卷',past:'考古題',self:'我的自組卷'},size=6;
 root.innerHTML=`<fieldset class="paper-picker"><legend>共同題組</legend><input type="hidden" id="paper"><div class="picker-tabs" role="group" aria-label="題組分類">${Object.entries(labels).map(([k,t])=>`<button type="button" data-category="${k}">${t}</button>`).join('')}</div><div class="picker-filters"><label>科目<select id="picker-subject"></select></label><label>搜尋題組<input type="search" id="picker-query" placeholder="輸入名稱或關鍵字"></label></div><div id="picker-list" class="picker-list"></div><div class="picker-pages"><button type="button" id="picker-prev">上一頁</button><span id="picker-count" role="status"></span><button type="button" id="picker-next">下一頁</button></div><p id="picker-selected" class="picker-selected" role="status"></p><p class="muted">自組卷只開放10、20題；5、15題仍可自己練習。<a href="quiz-library.html#my-papers-section">回練功坊自組卷</a></p></fieldset>`;
 const $=s=>root.querySelector(s);
 function choose(p){picked=p;$('#paper').value=p?.id||'';$('#picker-selected').textContent=p?`已選：${p.title}｜${p.total}題・${partySizes(p).join('／')}人`:'請先選一份共同題組。';onChange(p);}
 function draw(){
  const matches=filterPapers(papers,{category,subject,query}),pages=Math.max(1,Math.ceil(matches.length/size));page=Math.min(page,pages-1);
  root.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.category===category)));
  $('#picker-list').innerHTML=matches.length?matches.slice(page*size,(page+1)*size).map(p=>`<button type="button" class="picker-paper" data-paper="${esc(p.id)}" aria-pressed="${picked?.id===p.id}"><span class="badge">${esc(p.subject||'單元練習')}・${p.total}題</span><strong>${esc(p.title)}</strong><span>${partySizes(p).length===1?'2人一起練':'2～4人一起練'}・${p.kind==='flower'?'達標每人1朵紀念花':`達標每人${Math.floor(p.total/10)}片紀念葉`}</span></button>`).join(''):'<p class="muted">目前沒有符合的題組。可以換個分類、科目或關鍵字。</p>';
  $('#picker-count').textContent=`${matches.length}份・第${page+1}／${pages}頁`;
  $('#picker-prev').disabled=page===0;$('#picker-next').disabled=page+1>=pages;
  root.querySelectorAll('[data-paper]').forEach(b=>b.onclick=()=>{choose(papers.find(p=>p.id===b.dataset.paper));draw();});
 }
 function subjects(){const values=[...new Set(papers.filter(p=>paperCategory(p)===category).map(p=>p.subject).filter(Boolean))];$('#picker-subject').innerHTML='<option value="">全部科目</option>'+values.map(s=>`<option>${esc(s)}</option>`).join('');subject='';}
 root.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{category=b.dataset.category;page=0;subjects();draw();});
 $('#picker-subject').onchange=e=>{subject=e.target.value;page=0;draw();};$('#picker-query').oninput=e=>{query=e.target.value;page=0;draw();};
 $('#picker-prev').onclick=()=>{if(page>0){page--;draw();}};$('#picker-next').onclick=()=>{page++;draw();};
 subjects();choose(picked);draw();
}
