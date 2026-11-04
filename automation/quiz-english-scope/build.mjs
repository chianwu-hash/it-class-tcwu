import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
import {validateDocument} from '../../shared/quiz-document.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),[out]=process.argv.slice(2),dir=path.join(out,'kang-g6-en');
const read=async p=>JSON.parse(await fs.readFile(p,'utf8')),scope=await read(path.join(root,'scope.json')),before=await read(path.join(out,'before.private.json')),catalog=await read(path.join(dir,'catalog.json'));
const hash=b=>createHash('sha256').update(b).digest('hex'),pool=[],assets={},excluded=[];
const registered=new Map(before.media.map(a=>[new URL(a.url).pathname.split('/').at(-1),a]));
const combine=(a,b)=>{if(!a.text&&!a.media?.length)return b;const offset=a.media.length,layout=structuredClone(b.layout||[{type:'paragraph',runs:[{type:'text',text:b.text}]}]);for(const p of layout)for(const runs of p.type==='paragraph'?[p.runs]:p.rows.flat())for(const r of runs)if(r.type==='image')r.media_index+=offset;return {text:[a.text,b.text].filter(Boolean).join('\n'),media:[...a.media,...b.media],layout:[{type:'paragraph',runs:[{type:'text',text:a.text}]},...layout]};};
for(const r of catalog){try{
 if(r.publisher_chapter!=='04'||r.unit!=='03'||!r.checks.original_answer_independently_verified)throw Error('incorrect_unit_source');
 const q=structuredClone(r.question);if(/[①②③④]|選項\s*[1-4A-D]|[（(][1-4][)）].{0,3}(?:皆|都)對/.test(q.explanation.text))throw Error('explanation_references_option_position');
 if(/承上題|根據上題|接續上題|畫線|劃線|底線|underlined/i.test(q.prompt.text))throw Error('dependent_or_unpreserved_styling');
 q.prompt=combine(r.material,q.prompt);
 for(const c of [q.prompt,q.explanation,...q.options.map(o=>o.content)]){
  for(const m of c.media||[]){const oldName=path.basename(new URL(m.url).pathname),file=path.join(dir,m.kind==='audio'?'web-audio':'web-images',oldName),bytes=await fs.readFile(file),sha=hash(bytes),mime=m.kind==='audio'?'audio/mpeg':({'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.gif':'image/gif'}[path.extname(file).toLowerCase()]);if(!mime)throw Error('unsupported_media');
   const old=registered.get(sha);if(old&&(old.bytes!==bytes.length||old.mime!==mime))throw Error('existing_asset_conflict');
   assets[sha]={hash:sha,md5:createHash('md5').update(bytes).digest('hex'),mime,bytes:bytes.length,file:path.resolve(file),url:old?.url||`https://quiz-media.invalid/${before.owner}/${sha}`,owner_id:before.owner,object_path:old?.object_path||'g6-english-u3-20261030-'+sha,registered:Boolean(old)};
   m.url=assets[sha].url;m.alt=m.kind==='audio'?'聽力音檔':'圖片';
  }
 }
 if(new Set(q.options.map(o=>JSON.stringify(o.content))).size!==q.options.length)throw Error('duplicate_options');
 if(!q.prompt.text?.trim()&&!q.prompt.media?.length)throw Error('empty_prompt');
 const codes=r.publisher_knowledge.split(';').sort();if(codes.some(c=>!scope.knowledge_labels[c]))throw Error('knowledge_not_reviewed');
 q.id='mp_'+hash(scope.course_id+'|'+r.id+'|u3-native-v1|'+hash(JSON.stringify(r))).slice(0,32);
 validateDocument({schema:1,title:'Unit 3 核對',catalog:before.course.definition,blocks:[{id:'b_'+q.id,material:{text:'',media:[]},questions:[q]}]});
 pool.push({question_id:q.id,source_item_id:r.id,group_key:hash(scope.course_id+'|'+JSON.stringify([q.prompt,q.options.map(o=>o.content)])),unit_ids:[3],knowledge_code:'kang-g6-en:'+codes.join('+'),knowledge_name:'Unit 3 From Farm to Table：'+codes.map(c=>scope.knowledge_labels[c]).join('、'),difficulty:r.difficulty,source_version:hash(JSON.stringify(r)),publisher_explanation:r.publisher_explanation_present,question:q,checks:{...r.checks,validated:true,source_catalog:'kang-g6-en',source_question_id:r.question.id,publisher_chapter:'04',logical_unit:3,publisher_knowledge:codes,knowledge_reliable:true,knowledge_review:{revision:'g6-english-u1-u3-20261030',method:'原知識代碼、Unit 3 課本與原題內容核對'}},usable:true,course_id:scope.course_id,knowledge_reliable:true});
}catch(e){excluded.push({source_item_id:r.id,reason:e.message});}}
// Keep only assets actually used by accepted questions.
const used=new Set(pool.flatMap(p=>[p.question.prompt,p.question.explanation,...p.question.options.map(o=>o.content)].flatMap(c=>(c.media||[]).map(m=>new URL(m.url).pathname.split('/').at(-1)))));
for(const sha of Object.keys(assets))if(!used.has(sha))delete assets[sha];
const chosen=[],groups=new Set(),points=new Set();let audio=0;
for(const [difficulty,n] of [[-3,2],[0,6],[3,2]])for(let i=0;i<n;i++){
 const options=pool.filter(p=>p.difficulty===difficulty&&!groups.has(p.group_key)&&(!p.question.prompt.media.some(m=>m.kind==='audio')||audio<4));
 options.sort((a,b)=>Number(points.has(a.knowledge_code))-Number(points.has(b.knowledge_code))||Number(a.question.prompt.media.some(m=>m.kind==='audio'))-Number(b.question.prompt.media.some(m=>m.kind==='audio'))||a.question_id.localeCompare(b.question_id));
 const p=options[0];if(!p)throw Error('teacher_distribution_unavailable');chosen.push(p);groups.add(p.group_key);points.add(p.knowledge_code);if(p.question.prompt.media.some(m=>m.kind==='audio'))audio++;
}
const document={schema:1,title:'六年級英語 Unit 3 From Farm to Table',catalog:{school_year:'115',volume:'6年級上學期',subject:'英語',publisher:'康軒',unit:scope.units[3],difficulty:'容易 2・中等 6・困難 2'},blocks:chosen.map(p=>({id:'b_'+p.source_item_id,material:{text:'',media:[]},questions:[p.question]}))};validateDocument(document);
const old=before.presets.filter(p=>p.document.catalog.unit==='Unit 2 Having a Cold');if(old.length!==1)throw Error('unit2_preset_not_unique');
const bundle={scope,pool,assets,excluded,preset:{bank_id:crypto.randomUUID(),version_id:crypto.randomUUID(),session_id:crypto.randomUUID(),document,class_codes:before.presets.find(p=>p.document.catalog.unit===scope.units[1]).session.class_codes,owner_id:before.owner,retire_session_id:old[0].session.id},source_catalog_sha256:hash(await fs.readFile(path.join(dir,'catalog.json')))};
await fs.writeFile(path.join(out,'bundle.private.json'),JSON.stringify(bundle));await fs.writeFile(path.join(out,'excluded.json'),JSON.stringify(excluded,null,2));
console.log(JSON.stringify({unit3_pool:pool.length,excluded:excluded.length,distribution:Object.fromEntries([-3,0,3].map(d=>[d,pool.filter(p=>p.difficulty===d).length])),images:Object.values(assets).filter(a=>a.mime.startsWith('image')).length,audio:Object.values(assets).filter(a=>a.mime.startsWith('audio')).length,teacher:chosen.map(p=>({id:p.source_item_id,knowledge:p.knowledge_name,difficulty:p.difficulty,audio:p.question.prompt.media.some(m=>m.kind==='audio')}))}));
