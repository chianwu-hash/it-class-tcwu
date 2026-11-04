import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
const ROOT='D:/projects/it-class-tcwu/automation/output/past-exams-113-114-1/pilot/dingxi-114-1-g3-exam1-science';
const out='automation/output/past-exam-production';fs.mkdirSync(out,{recursive:true});
const source=JSON.parse(fs.readFileSync(path.join(out,'source.private.json'),'utf8'));
const owner=process.env.PAST_EXAM_OWNER||'00000000-0000-4000-8000-000000000001';
if(!/^[a-f0-9-]{36}$/.test(owner))throw Error('invalid_owner');
const sha=b=>createHash('sha256').update(b).digest('hex'),url=hash=>`https://quiz-media.invalid/${owner}/${hash}`;
const groups=[];
for(const b of source.legacy.blocks)for(const q of b.questions){const e=source.entries.find(e=>e.id===q.id);groups.push({id:q.id,kind:q.type,title:'第 '+e.sourceNumber+' 題',sourceLabel:e.sectionId.slice(1)+'、'+e.sourceNumber,material:b.material.text,materialContent:b.material,promptContent:q.prompt,assets:[],choices:(q.options||[]).map(o=>({id:o.id,text:o.content.text,content:o.content})),fields:[{id:q.id,label:e.sourceNumber,text:q.prompt.text,points:e.points,answer:q.type==='single'?q.answer.option_id:q.answer.accepted}]});}
const assets=source.media.map(a=>{const file=path.join(ROOT,'assets',a.sha256+'.png'),bytes=fs.readFileSync(file);if(sha(bytes)!==a.sha256)throw Error('source_media_changed');return {hash:a.sha256,url:url(a.sha256),owner_id:owner,object_path:owner+'/'+a.sha256,mime:'image/png',bytes:bytes.length,file};});
const refFile=path.join(ROOT,'interactive/stapler-reference.png'),refBytes=fs.readFileSync(refFile),refHash=sha(refBytes);assets.push({hash:refHash,url:url(refHash),owner_id:owner,object_path:owner+'/'+refHash,mime:'image/png',bytes:refBytes.length,file:refFile});
for(const original of source.typed.groups){const g=structuredClone(original);for(const a of g.assets)a.url=url(a.sha256);if(g.kind==='annotation')g.referenceUrl=url(refHash);const held=source.entries.filter(e=>e.route==='blocked'&&e.passageId===g.id+'-material').length;if(held)g.notice=`這個題組另有${held}個官方答案待確認欄位，暫不作答或計分。`;groups.push(g);}
const document={schema:2,title:source.title,catalog:{school_year:'114',subject:'自然',publisher:'康軒',volume:'三上',unit:'第1–2單元・期中考古題'},groups,
 policy:{version:1,threshold_percent:60,leaf_count:1,automatic_points:92,manual_points:4,blocked_points:4},blocked:source.entries.filter(e=>e.route==='blocked').map(e=>({id:e.id,text:e.stem,points:e.points,reason:e.reason}))};
const provenance={sourceBankSha256:source.sourceBankSha256,sourceVersion:source.exam.version,sourceFiles:source.exam.sourceFiles.map(({fileId,sha256,name})=>({fileId,sha256,name})),entries:source.entries.map(({id,points,type,review,source,answerSource,route})=>({id,points,type,review,source,answerSource,route})),issues:source.issues};
const bundle={paperId:source.exam.id,owner,document,provenance,assets,sha256:sha(JSON.stringify(document))};fs.writeFileSync(out+'/bundle.private.json',JSON.stringify(bundle,null,2));console.log(JSON.stringify({paperId:bundle.paperId,groups:groups.length,fields:groups.flatMap(g=>g.fields).length,assets:assets.length,sha256:bundle.sha256}));
