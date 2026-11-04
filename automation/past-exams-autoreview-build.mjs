// Delegated editorial decisions, not per-question teacher confirmations.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const root='automation/output/past-exams-autoreview-20261101',packet='.chat-mode/auto-review-20261101';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,'')),hash=v=>createHash('sha256').update(v).digest('hex'),save=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2));
fs.mkdirSync(root,{recursive:true});assert(!fs.existsSync(root+'/candidates.private.json'),'Immutable review; do not rebuild');
const reviews=[['claude','auto-review-20261101-compact'],['agy','auto-agy-20261101-01']].map(([worker,id])=>{const dir=packet+'/.chat-mode/sessions/'+id,run=read(dir+'/turn-0001.run.json'),response=fs.readFileSync(dir+'/turn-0001.response.md');assert.equal(run.status,'completed');assert(run.conversationViewerStarted);if(worker==='agy')assert(run.toolBoundaryVerified);save(root+'/'+worker+'-run.private.json',run);fs.copyFileSync(dir+'/turn-0001.response.md',root+'/'+worker+'-response.private.md');return{worker,session:id,responseSha256:hash(response),coverage:worker==='agy'?'supplied-text-only':'six-source-pages-plus-supplied-text'};});
const decisions={date:'2026-11-01',authority:'教師授權Codex與Claude判讀，真正分歧交AGY第三方討論，自主驗證後上線並報告；不再等逐題人工簽核。',reviews,sourceManifestSha256:hash(fs.readFileSync(packet+'/source-manifest.json')),items:[
 {id:'P11',paperId:'dingxi-114-1-g3-exam1-science',fields:['s2-q13'],action:'revise-stem-and-correct-answer',answer:'4',rationale:'沉下的碎石仍受水的浮力，空氣中的杯子也受空氣浮力；明示限定水的浮力後才有唯一正解。'},
 {id:'P13',paperId:'dingxi-114-1-g3-exam1-science',fields:['s3-q08-1'],action:'restore-shared-figure-and-equivalents',answer:['輪生','乙','乙（輪生）'],rationale:'問葉序名稱、官方填圖代號；沿用共同圖，兩種答法均收，不替圖中植物品種背書。'},
 {id:'P14',paperId:'dingxi-114-1-g6-exam1-science',fields:['s1-q11'],action:'correct-answer',answer:'2',rationale:'季風是風系，冷鋒是冷暖氣團交界，原句應判×；保持原題，不重造○敘述。'},
 {id:'C01',paperId:'dingxi-113-1-g3-exam1-chinese',fields:[],action:'clarify-online-order',rationale:'明示按段內原文順序填字，原文不改、不洩漏錯字；不改共享逐格判分。'},
 {id:'C09',paperId:'dingxi-113-1-g6-exam1-english',fields:['s5-q01','s5-q05','s8-q01-b','s8-q02-a'],action:'add-explicit-equivalents',rationale:'薯條是普通名詞，國名屬專有名詞；僅增明確詞形、國名縮寫及縮寫完整形式，不全域忽略大小寫。'},
 {id:'C22',paperId:'dingxi-114-1-g6-exam1-science',fields:['s3-q05'],action:'revise-stem-and-add-equivalents',rationale:'原問法寬泛而壓力也影響三態；明示只問故事描述的因素，不把科學正確的壓力一概說錯。'}],missingListening:{fields:26,action:'hold-source-missing',reason:'兩卷三英A/C/E缺完整發話，答案號或答案詞不等於聽力稿；不得逆造官方發話。'}};
save(root+'/adjudication.private.json',decisions);const decisionSha=hash(fs.readFileSync(root+'/adjudication.private.json'));
const paths={
 'dingxi-114-1-g3-exam1-science':'past-exams-approved11-20261031',
 'dingxi-114-1-g6-exam1-science':'past-exams-batch',
 'dingxi-113-1-g3-exam1-chinese':'past-exams-approved11-20261031',
 'dingxi-113-1-g6-exam1-english':'past-exams-approved11-20261031'};
const cards=read(packet+'/raw-cards.json'),candidates=[];
for(const [pid,base] of Object.entries(paths)){
 const folder=root+'/'+pid;fs.mkdirSync(folder,{recursive:true});const old=read('automation/output/'+base+'/'+pid+'/bundle.private.json');assert.equal(hash(JSON.stringify(old.document)),old.sha256);save(folder+'/before-bundle.private.json',old);const b=structuredClone(old),items=decisions.items.filter(c=>c.paperId===pid),restored=[],changed=[];
 const find=id=>{for(const g of b.document.groups){const f=g.fields.find(f=>f.id===id);if(f)return{g,f};}throw Error('Missing field '+id);};
 const add=(id,title,kind,text,answer,material='')=>{const f=b.document.blocked.find(f=>f.id===id);assert(f);const g={id,kind,title,sourceLabel:title,material,codes:[],materialContent:{text:material,media:[]},promptContent:{text,media:[]},assets:[],choices:[],fields:[{id,label:id,text,points:f.points,answer}]};const order=new Map(b.provenance.entries.map((e,i)=>[e.id,i])),i=b.document.groups.findIndex(g=>order.get(g.fields[0].id)>order.get(id));b.document.groups.splice(i<0?b.document.groups.length:i,0,g);b.document.blocked=b.document.blocked.filter(f=>f.id!==id);restored.push(id);return g;};
 for(const c of items){
  if(c.id==='P11'){
   const f=old.document.blocked.find(f=>f.id==='s2-q13'),[stem,...opts]=cards.find(c=>c.id==='P11').questions[0].fields[0].text.split(/[①②③④]/);assert.equal(opts.length,4);assert(stem.includes('浮力'));
   const g=add(f.id,'二、選擇題 13','single',stem.replace('浮力','水的浮力'),'4');g.choices=opts.map((text,i)=>({id:String(i+1),text,content:{text,media:[]}}));g.notice='修訂練習題｜本題已明確限定為「水的浮力」，並採複核後答案。';
  }else if(c.id==='P13'){
   const source=b.document.groups.find(g=>g.id==='s3-q08');assert(source.assets.length===1);delete source.notice;
   const f=old.document.blocked.find(f=>f.id==='s3-q08-1'),g=add(f.id,'三、8-(1) 葉序','short',f.text,c.answer,source.material);g.assets=structuredClone(source.assets);g.materialContent=structuredClone(source.materialContent);g.notice='線上作答說明｜可填葉序名稱或原圖代號。';
  }else if(c.id==='P14'){
   const f=old.document.blocked.find(f=>f.id==='s1-q11'),g=add(f.id,'一、是非題 11','single',f.text,'2');g.choices=['○','×'].map((text,i)=>({id:String(i+1),text,content:{text,media:[]}}));g.notice='答案校訂題｜保留原題敘述，採複核後答案。';
  }else if(c.id==='C01'){
   const g=b.document.groups.find(g=>g.id==='s3');assert.equal(g.fields.length,10);g.notice='線上作答說明｜請依每段錯字在原文出現的順序，填入正確的字；線上以填字作答，每格1分。';
   for(const f of g.fields){assert(!f.text.includes('圈「'));assert(!f.text.includes('圈『'));}
  }else if(c.id==='C09'){
   const addAnswers=(id,answers)=>{const {f}=find(id);f.answer=[...new Set([...f.answer,...answers])];changed.push(id);};
   addAnswers('s5-q01',['french fries','fries']);addAnswers('s5-q05',['UK','the U.K.','U.K.','United Kingdom','the United Kingdom']);
   for(const gid of ['s8-q01','s8-q02']){const g=b.document.groups.find(g=>g.id===gid),f=g.fields[gid==='s8-q01'?1:0];assert(f.answer.some(a=>/m|re/.test(a)));f.answer=[...new Set([...f.answer,gid==='s8-q01'?'I am':'we are'])];changed.push(f.id);}
  }else if(c.id==='C22'){
   const {g,f}=find('s3-q05');f.text='承第4題，在上述水循環的過程中，主要是環境中哪一個條件的改變，影響了水的三態變化？________(2分)';if(g.fields.length===1)g.promptContent.text=f.text;
   f.answer=[...new Set([...f.answer,'氣溫','環境溫度','溫度高低','溫度升降','溫度變化','冷熱','溫度和氣壓','溫度與氣壓','溫度和壓力','溫度與壓力'])];changed.push(f.id);g.notice='修訂練習題｜本題已明確限定為上文描述的環境條件。';
  }
  const card=cards.find(x=>x.id===c.id);for(const id of c.fields){const e=b.provenance.entries.find(e=>e.id===id);assert(e);e.editorialDecision={reviewId:c.id,authority:'delegated-ai-adjudication',adjudicationSha256:decisionSha,previousSha256:old.sha256,action:c.action,sourcePages:card.pages,reason:c.rationale};e.type=find(id).g.kind;}
 }
 // Keep every official raw/source record and every unrelated field byte-for-byte.
 for(const e of old.provenance.entries)assert.deepEqual(b.provenance.entries.find(x=>x.id===e.id).answerSource,e.answerSource);
 for(const g of old.document.groups)for(const f of g.fields)if(!changed.includes(f.id))assert.deepEqual(find(f.id).f,f);
 assert.deepEqual(b.assets,old.assets);assert.deepEqual(b.document.blocked,old.document.blocked.filter(f=>!restored.includes(f.id)));
 b.provenance.editorialRevisions=[...(b.provenance.editorialRevisions||[]),{date:decisions.date,reviewIds:items.map(x=>x.id),adjudicationSha256:decisionSha,authority:decisions.authority,previousSha256:old.sha256}];b.provenance.qc={...b.provenance.qc,status:'verified',editorialReview:items.map(x=>x.id)};
 b.sha256=hash(JSON.stringify(b.document));save(folder+'/bundle.private.json',b);candidates.push({paperId:pid,oldSha256:old.sha256,newSha256:b.sha256,reviewIds:items.map(x=>x.id),restoredIds:restored,changedIds:changed,remainingBlocked:b.document.blocked.length});
}
save(root+'/candidates.private.json',candidates);console.log(JSON.stringify({papers:candidates.length,restored:candidates.flatMap(c=>c.restoredIds).length,noNewMedia:true}));
