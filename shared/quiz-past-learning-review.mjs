// Only render reviewed content attached to an already disclosed answer record.
// No question mappings, answers, network calls, or progress writes live here.
export function renderPastLearningReview({host,group,record,version,onPractice}){
 const review=record?.learningReview,source=review?.source;
 if(review?.schema!==1||source?.versionId!==version||source?.groupId!==group.id||
  !group.fields.some(f=>f.id===source.questionId)||
  !record.results?.some(r=>r.questionId===source.questionId&&typeof r.correct==='boolean')||
  typeof review.explanation!=='string'||!Array.isArray(review.concepts)||!review.concepts.length)return false;
 if(!review.concepts.every(c=>typeof c.id==='string'&&/^[a-z0-9-]{1,80}$/.test(c.id)&&typeof c.title==='string'&&
  typeof c.connection==='string'&&Array.isArray(c.points)&&c.points.every(p=>typeof p==='string')))return false;
 const doc=host.ownerDocument,make=(tag,text,cls)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const section=make('section',undefined,'past-learning-review');section.setAttribute('aria-label','本題解析與學習重點');
 section.append(make('h3','這題怎麼想？'),make('p',review.explanation),make('h4','這題連到哪些學習重點？'),make('p','選一個重點，看看它和這題的關係。','helper'));
 const links=make('div',undefined,'past-learning-links'),panels=make('div'),buttons=[];
 for(const concept of review.concepts){
  const panel=make('section',undefined,'past-learning-topic'),id=`past-learning-${group.id}-${concept.id}`;
  panel.id=id;panel.hidden=true;panel.tabIndex=-1;
  const heading=make('h4',concept.title);heading.id=id+'-heading';panel.setAttribute('aria-labelledby',heading.id);
  panel.append(heading,make('p',concept.connection));const list=make('ul');for(const point of concept.points)list.append(make('li',point));panel.append(list);
  if(concept.practice?.available===true&&Number.isInteger(concept.practice.count)&&concept.practice.count>0&&typeof onPractice==='function'){
   panel.append(make('p',`書商題庫：${concept.practice.publisher} ${concept.practice.schoolYear} 上學期自然｜${concept.practice.chapter}`,'helper'));
   const practice=make('button',`練習這個重點（${concept.practice.count}題）`,'past-learning-start'),status=make('p');practice.type='button';status.setAttribute('role','status');let requestId=null;
   practice.addEventListener('click',async()=>{
    if(practice.disabled)return;practice.disabled=true;requestId??=crypto.randomUUID();status.textContent='正在準備對應練習…';
    try{
     const result=await onPractice({source,conceptId:concept.id,requestId});if(!status.isConnected)return;
     const link=make('a','開始練習 →');link.href=result.url;status.replaceChildren(link);
     if(!panel.hidden)location.assign(result.url);
    }catch(e){if(status.isConnected)status.textContent='尚未開啟練習：'+e.message+' 可以重試。';}
    finally{if(practice.isConnected)practice.disabled=false;}
   });panel.append(practice,status);
  }
  const link=make('button',concept.title);link.type='button';link.setAttribute('aria-controls',id);link.setAttribute('aria-expanded','false');
  link.addEventListener('click',()=>{const open=panel.hidden;for(const [b,p] of buttons){p.hidden=true;b.setAttribute('aria-expanded','false');}panel.hidden=!open;link.setAttribute('aria-expanded',String(open));if(open)panel.focus({preventScroll:true});});
  buttons.push([link,panel]);links.append(link);panels.append(panel);
 }
 const connected=review.concepts.some(c=>c.practice?.available===true);
 section.append(links,panels,make('p',connected?'原題補充解析與重點由 AI 整理，非官方解析；對應練習選自書商原始題庫。':'補充解析與重點由 AI 依題意整理，非官方解析；尚未連接書商練習題。','helper'));
 host.append(section);return true;
}
