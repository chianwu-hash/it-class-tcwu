// Teacher-authorized eleven corrections only. Prior documents and official raw marks remain immutable.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
export const root='automation/output/past-exams-approved11-20261031';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,'')),save=(f,v)=>fs.writeFileSync(f,JSON.stringify(v,null,2)),hash=v=>createHash('sha256').update(v).digest('hex');
fs.mkdirSync(root,{recursive:true});const revise=process.argv.includes('--revise-candidate');assert(!fs.existsSync(root+'/candidates.private.json')||revise,'Do not overwrite reviewed revisions');assert(!fs.existsSync(root+'/cloud/registered.private.json'),'Already registered; no candidate rebuild');
const review=read('automation/output/past-exams-review-20261030/review-data-claude.private.json'),cards=review.cards.filter(c=>c.category==='明確答案建議');assert.equal(cards.length,11);
const approval={at:'2026-10-31',statement:'11項明確答案建議就照你們的結論，驗證沒問題就上線，其他需要決定的我再逐題確認。',scope:cards.map(c=>({id:c.id,paperId:c.paperId,questionIds:c.questionIds,sourceSha256:c.bundleSha256,proposal:c.proposal})),reviewSnapshot:review.createdAt,reviewFileSha256:hash(fs.readFileSync('automation/output/past-exams-review-20261030/review-data-claude.private.json'))};
save(root+'/teacher-approval.private.json',approval);const confirmationSha256=hash(fs.readFileSync(root+'/teacher-approval.private.json'));
const grouped=Map.groupBy(cards,c=>c.paperId),media=read(root+'/media.private.json'),summary=[];
const baseFiles=id=>['past-exams-audio/'+id+'/bundle.private.json','past-exams-midterms/'+id+'/bundle.private.json','past-exams-batch/'+id+'/bundle.private.json','past-exam-production/bundle.private.json'].map(p=>'automation/output/'+p).filter(p=>fs.existsSync(p));
const group=(id,kind,title,text,points,answer,material='')=>({id,kind,title,sourceLabel:title,material,codes:[],materialContent:{text:material,media:[]},promptContent:{text,media:[]},assets:[],fields:[{id,label:id,text,points,...(kind==='manual'?{reference:answer}:{answer})}],choices:[]});
const options=(g,texts)=>{g.choices=texts.map((text,i)=>({id:String(i+1),text,content:{text,media:[]}}));return g;};
for(const [pid,items] of grouped){
 const folder=root+'/'+pid;fs.mkdirSync(folder,{recursive:true});if(revise&&fs.existsSync(folder+'/bundle.private.json')){const previous=read(folder+'/bundle.private.json');save(folder+'/candidate-'+previous.sha256+'.private.json',previous);}const old=baseFiles(pid).map(read).find(b=>b.paperId===pid&&b.sha256===items[0].bundleSha256);assert(old,'Current local baseline required: '+pid);assert.equal(hash(JSON.stringify(old.document)),old.sha256);save(folder+'/before-bundle.private.json',old);const b=structuredClone(old),added=[];
 for(const c of items){
  assert.equal(c.questionIds.length,1);const id=c.questionIds[0],f=b.document.blocked.find(f=>f.id===id);assert(f,'Only restore approved blocked fields');const source=c.questions[0],e=b.provenance.entries.find(e=>e.id===id);assert(e);let g;
  if(['P01','P02'].includes(c.id)){
   g=b.document.groups.find(g=>g.id==='s1');g.fields.push({id,label:c.id==='P01'?'6':'17',text:f.text,points:f.points,answer:[c.id==='P01'?'ㄌㄨㄢˋ':'ㄌㄡˋ']});g.fields.sort((a,b)=>Number(a.label)-Number(b.label));
  }else if(c.id==='P03'){
   const [stem,...opts]=f.text.split(/[①②③④]/);assert.equal(opts.length,4);g=options(group(id,'single','二、選擇題 14',stem,f.points,'2'),opts);added.push(g);
  }else if(c.id==='P05'){g=group(id,'short','大手牽小手 4',f.text,f.points,['125'],b.document.groups.find(g=>g.id==='d2-q01').material);added.push(g);
  }else if(['P06','P07'].includes(c.id)){
   const reference=c.id==='P06'?'教師核定參考：4：8.5＝40：85＝8：17。':'教師核定參考：瓜瓜7／36，小蝦8／17，阿啾3／8；8／17＞3／8＞7／36，小蝦最酸。須寫出三個比值並比較，整題人工核對3分。';
   g=group(id,'manual',c.id==='P06'?'園遊會 比(2)':'園遊會 (4)',f.text,f.points,reference,source.material);added.push(g);
  }else if(c.id==='P08'){
   const [stem,...opts]=f.text.split(/[①②③④]/);assert.equal(opts.length,4);g=options(group(id,'single','一、選擇題 6',stem.trim(),f.points,'4'),opts);added.push(g);
  }else if(c.id==='P09'){
   g=options(group(id,'single','四、圈圈看 3','布告欄長3公尺40公分，也可以說是幾毫米？',f.points,'2','圈圈看：每題2分、共8分'),['3040毫米','3400毫米','3004毫米']);added.push(g);
  }else if(c.id==='P10'){
   g=b.document.groups.find(g=>g.id==='s6-q03');g.fields.push({id,label:'3-2',text:'用0、4、6、9組成的四位數，數字不能重複，最小的數是（ ）',points:f.points,answer:['4069']});
   g.promptContent.text='';
  }else if(c.id==='P12'){
   g=b.document.groups.find(g=>g.id==='s3-q04');g.fields.push({id,label:'4',text:f.text,points:f.points,answer:true});g.fields.sort((a,b)=>Number(a.label)-Number(b.label));delete g.notice;
  }else if(c.id==='C07'){
   const owner=b.owner,asset=m=>{assert.equal(hash(fs.readFileSync(m.file)),m.hash);return{hash:m.hash,url:`https://quiz-media.invalid/${owner}/${m.hash}`,owner_id:owner,object_path:`${owner}/${m.hash}`,mime:m.mime,bytes:m.bytes,file:m.file};},audio=asset(media.audio),images=media.images.map(asset);b.assets.push(audio,...images);
   g=group(id,'single','B 聽力・選圖 4','請選出與聽到的敘述相符的圖片。',f.points,'2','仔細聽，選出與敘述相符的圖片。');g.notice='合成語音練習版｜依官方聽力文字製作，每段播讀兩次，可自行重播。';g.materialContent.media=[{kind:'audio',url:audio.url,alt:'B 聽力・選圖 4｜合成語音練習版'}];g.choices=images.map((m,i)=>({id:String(i+1),text:'',content:{text:'',media:[{kind:'image',url:m.url,alt:'原卷選項'+(i+1)+'圖'}]}}));added.push(g);
   e.audioSource={sha256:audio.hash,scriptSha256:media.audio.scriptSha256,source:{fileId:'key',page:5,sha256:media.audio.sourceSha256},synthetic:true};
  }else throw Error('Unexpected approval '+c.id);
  const field=g.fields.find(f=>f.id===id);e.type=g.kind;e.teacherDecision={reviewId:c.id,confirmed:true,proposal:c.proposal,confirmationSha256,approvedAnswer:field.answer??field.reference,previousSha256:old.sha256};
  // answerSource.raw remains the original official mark, even where it was wrong or empty.
  b.document.blocked=b.document.blocked.filter(f=>f.id!==id);
 }
 // Insert restored groups in source order without reordering any existing groups.
 const entryOrder=new Map(b.provenance.entries.map((e,i)=>[e.id,i]));
 for(const g of added){const pos=entryOrder.get(g.fields[0].id),i=b.document.groups.findIndex(x=>entryOrder.get(x.fields[0].id)>pos);b.document.groups.splice(i<0?b.document.groups.length:i,0,g);}
 const ids=new Set(items.flatMap(c=>c.questionIds));
 for(const g of old.document.groups){const now=b.document.groups.find(x=>x.id===g.id);for(const f of g.fields)assert.deepEqual(now.fields.find(x=>x.id===f.id),f);if(!g.fields.some(f=>['s1-f01','s6-q03-1','s3-q04-1'].includes(f.id)))assert.deepEqual(now,g);}
 assert.deepEqual(b.document.blocked,old.document.blocked.filter(f=>!ids.has(f.id)));assert.equal(b.document.catalog?.grade??3,Number(pid.split('-')[3].slice(1)));
 b.provenance.teacherRevisions=[...(b.provenance.teacherRevisions||[]),{reviewIds:items.map(c=>c.id),confirmationSha256,previousSha256:old.sha256,authority:approval.statement,date:approval.at}];
 b.provenance.issues.push({id:'teacher-approved11-20261031',questions:[...ids],detail:'教師採納Codex與Claude複核的11項明確答案建議；本卷所列欄位恢復，舊官方原記號及疑義歷程保留，其餘待決定項不變。'});
 b.provenance.qc={...b.provenance.qc,status:'verified',teacherRevision:items.map(c=>c.id)};b.sha256=hash(JSON.stringify(b.document));save(folder+'/bundle.private.json',b);
 summary.push({paperId:pid,oldSha256:old.sha256,newSha256:b.sha256,reviewIds:items.map(c=>c.id),restoredIds:[...ids],remainingBlocked:b.document.blocked.length});
}
assert.equal(summary.length,7);save(root+'/candidates.private.json',summary);console.log(JSON.stringify({papers:7,restored:11,remainingBlocked:29}));
