// Presentation only: move existing controls/cards without combining papers or progress.
const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
export function initLibraryHome({tabs,scopeBox,ownSection,continueBox}){
 const byId=id=>document.getElementById(id),select=byId('subject-filter');
 byId('home-continue-slot').append(continueBox);
 byId('home-pick-title').nextElementSibling.after(tabs);
 const filters=byId('cloud-library').querySelector('.filters'),filterbar=make('div',null,'home-filterbar');tabs.after(filterbar);filterbar.append(scopeBox,filters);
 const chips=make('div',null,'home-subjects');chips.setAttribute('role','group');chips.setAttribute('aria-label','選擇科目');
 for(const option of select.options){const b=make('button',option.value?option.textContent:'全部科目');b.type='button';b.dataset.subject=option.value;b.onclick=()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));};chips.append(b);}
 select.parentElement.hidden=true;select.parentElement.after(chips);
 const sync=()=>{for(const b of chips.children)b.setAttribute('aria-pressed',String(b.dataset.subject===select.value));};select.addEventListener('change',sync);sync();
 const composeEntry=byId('compose-entry'),composePanel=byId('quiz-composer');ownSection.prepend(composeEntry,composePanel);
 const explore=make('a','找不到想練的？自己組一份','home-compose-link');explore.href='#mine';byId('system-papers-section').append(explore);
 return {sync};
}
export function groupLibraryCards(container,papers){
 const byId=new Map(papers.map(p=>[String(p.id),p]));
 const groups=new Map();
 for(const card of [...container.children]){
  if(!card.matches('.paper-card')||card.dataset.source!=='preset')continue;
  const p=byId.get(card.dataset.sessionId),c=p?.catalog||{};
  const key=JSON.stringify([c.subject,c.unit||p?.title,c.volume,c.publisher,card.dataset.practiceScope]);
  let group=groups.get(key);
  if(!group){group=make('section',null,'home-unit-group');const h=make('h3',c.unit||p.title);const header=make('header',null,'home-unit-heading');header.append(make('span',c.subject||'單元練習','home-unit-subject'),h);group.append(header);container.insertBefore(group,card);groups.set(key,group);}
  card.classList.add('home-paper-row');card.setAttribute('aria-label',`${c.subject||''} ${c.unit||p.title} ${p.total}題`);group.append(card);
 }
 for(const group of groups.values()){
  const rows=[...group.querySelectorAll(':scope>.paper-card')];rows.sort((a,b)=>(byId.get(a.dataset.sessionId)?.total||0)-(byId.get(b.dataset.sessionId)?.total||0));group.append(...rows);
 }
}
