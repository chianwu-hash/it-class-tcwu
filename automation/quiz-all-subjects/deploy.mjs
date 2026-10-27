// Authorized rollout. All source documents, credentials and exports remain private.
import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {storage} from '../output/quiz/all-midterm-local/supabase_cloud_storage.mjs';
const base='automation/output/quiz/all-subjects-pool',dir=base+'/cloud',project='upxgyusodibaqcrocdzj';await fs.mkdir(dir,{recursive:true});
function cli(args){let s;try{s=execFileSync('pwsh',['-NoProfile','-NonInteractive','-Command','& supabase-personal '+args.map(a=>"'"+a.replaceAll("'","''")+"'").join(' ')],{encoding:'utf8',windowsHide:true,timeout:180000,maxBuffer:40*1024*1024,stdio:['ignore','pipe','pipe']});}catch(e){writeFileSync(dir+'/last-error.txt',String(e.stderr||e.message),'utf8');throw Error('cloud_operation_failed_'+String(e.status??e.signal??'unknown'));}return JSON.parse(s.slice(Math.min(...[s.indexOf('{'),s.indexOf('[')].filter(i=>i>=0))));}
if(!cli(['projects','list','--output','json']).some(p=>p.id===project&&p.name==="chianwu-hash's Project"))throw Error('project_mismatch');
const query=sql=>cli(['db','query','--linked','--project-ref',project,sql,'--output','json']).rows,read=async p=>JSON.parse(await fs.readFile(p,'utf8')),hash=b=>createHash('sha256').update(b).digest('hex'),lit=s=>"'"+s.replaceAll("'","''")+"'",j=v=>lit(JSON.stringify(v))+'::jsonb';
const pool=await read(base+'/pool.json'),courses=await read(base+'/courses.json'),assets=await read(base+'/assets.json'),verified=await read(base+'/qa/build-report.json');if(verified.pool_sha256!==hash(await fs.readFile(base+'/pool.json'))||verified.source_answer_checks!==pool.length)throw Error('source_validation_required');
const snapshot=()=>query("select (select md5(coalesce(string_agg(row_to_json(a)::text,'' order by a.attempt_id,a.question_id),'')) from public.quiz_answers a) answers,(select md5(coalesce(string_agg(row_to_json(v)::text,'' order by v.id),'')) from public.quiz_versions v) versions")[0];
if(process.argv.includes('--prepare')){
 const owners=query("select id from auth.users where lower(email)='chianwu@gmail.com' and email_confirmed_at is not null");if(owners.length!==1)throw Error('owner_account_mismatch');
 for(const r of pool)for(const c of [r.question.prompt,r.question.explanation,...r.question.options.map(o=>o.content)])for(const m of c.media||[])if(new URL(m.url).pathname.split('/')[1]!==owners[0].id)throw Error('media_owner_mismatch');
 const versions=query('select id,document from public.quiz_versions order by id');await fs.writeFile(dir+'/versions-before.json',JSON.stringify(versions),'utf8');
 let sql='begin;\n';
 for(const c of courses)sql+=`insert into public.quiz_courses values(${lit(c.id)},${c.grade},${j(c.definition)},false) on conflict(id) do update set definition=excluded.definition;\n`;
 for(const [sha,a] of Object.entries(assets)){const owner=new URL(pool.flatMap(p=>[p.question.prompt,...p.question.options.map(o=>o.content),p.question.explanation]).flatMap(c=>c.media||[]).find(m=>m.url.endsWith('/'+sha))?.url||'https://invalid/x/x').pathname.split('/')[1];if(owner==='x')continue;
  const url=`https://quiz-media.invalid/${owner}/${sha}`,objectPath=a.mime.startsWith('audio/')?'all-subjects-20261027-'+sha:'drive-all-subjects-'+sha;
  sql+=`insert into public.quiz_media_assets values(${lit(url)},${lit(owner)},${lit(objectPath)},${lit(a.mime)},${a.bytes}) on conflict(url) do nothing;\n`;
 }
 for(const r of pool){
  sql+=`insert into public.quiz_question_pool values(${lit(r.question_id)},${lit(r.source_item_id)},${lit(r.group_key)},${j(r.unit_ids)},${lit(r.knowledge_code)},${lit(r.knowledge_name)},${r.difficulty},${lit(r.source_version)},${r.publisher_explanation},${j(r.question)},${j(r.checks)},false) on conflict(question_id) do nothing;\n`;
  sql+=`do $$begin if not exists(select 1 from public.quiz_question_pool where question_id=${lit(r.question_id)} and source_version=${lit(r.source_version)} and question=${j(r.question)}) then raise exception 'source_revision_conflict';end if;end$$;\n`;
  sql+=`insert into public.quiz_pool_membership values(${lit(r.question_id)},${lit(r.course_id)},${r.knowledge_reliable}) on conflict(question_id) do nothing;\n`;
  sql+=`do $$begin if not exists(select 1 from public.quiz_pool_membership where question_id=${lit(r.question_id)} and course_id=${lit(r.course_id)} and knowledge_reliable=${r.knowledge_reliable}) then raise exception 'course_membership_conflict';end if;end$$;\n`;
 }
 const byLegacy=new Map();for(const r of pool){const c=courses.find(c=>c.id===r.course_id);byLegacy.set([c.grade,c.definition.subject,c.definition.publisher,r.checks.source_question_id].join('|'),r);}
 const norm=c=>String(c?.text||'').replace(/\s+/g,'').replace(/。$/,'');
 const mediaKey=c=>(c?.media||[]).map(m=>[m.kind,new URL(m.url).pathname.split('/').at(-1)]);let aliases=0;
 for(const v of versions)for(const b of v.document.blocks||[])for(const q of b.questions||[]){const c=v.document.catalog||{},r=byLegacy.get([String(c.volume||'').slice(0,1),c.subject,c.publisher,q.id].join('|'));if(!r)continue;const expected=r.question;
  if(norm({text:[b.material?.text,q.prompt?.text].filter(Boolean).join('\n')})!==norm(expected.prompt)||JSON.stringify([...mediaKey(b.material),...mediaKey(q.prompt)])!==JSON.stringify(mediaKey(expected.prompt))||q.options?.length!==expected.options.length||q.options.some((o,i)=>norm(o.content)!==norm(expected.options[i].content)||JSON.stringify(mediaKey(o.content))!==JSON.stringify(mediaKey(expected.options[i].content)))||q.answer.option_id!==expected.answer.option_id)continue;
  sql+=`insert into public.quiz_pool_aliases values('${v.id}',${lit(q.id)},${lit(r.question_id)}) on conflict do nothing;\n`;aliases++;
 }
 sql+=`update public.quiz_question_pool set usable=true where question_id in (${pool.map(r=>lit(r.question_id)).join(',')});\nupdate public.quiz_courses set enabled=true where id in (${courses.map(c=>lit(c.id)).join(',')});\nnotify pgrst,'reload schema';\ncommit;`;
 await fs.writeFile(dir+'/import.sql',sql,'utf8');
 // Management API request-size limit: import inactive rows in bounded transactions,
 // then activate all validated courses together. A failed batch exposes no new rows.
 const cut=sql.indexOf('\nupdate public.quiz_question_pool set usable=true'),lines=sql.slice(0,cut).split('\n').filter(x=>x&&x!=='begin;'),chunks=[];let batch='',bytes=0;
 async function flush(){if(!batch)return;const file=dir+`/batch-${String(chunks.length).padStart(3,'0')}.sql`;await fs.writeFile(file,'begin;\n'+batch+'commit;','utf8');chunks.push(file);batch='';bytes=0;}
 for(const line of lines){const n=Buffer.byteLength(line)+1;if(n>450000)throw Error('single_statement_too_large');if(bytes+n>450000)await flush();batch+=line+'\n';bytes+=n;}await flush();
 const activation=dir+'/activate.sql';await fs.writeFile(activation,'begin;'+sql.slice(cut),'utf8');chunks.push(activation);
 await fs.writeFile(dir+'/prepared.json',JSON.stringify({pool_sha256:verified.pool_sha256,pool:pool.length,aliases,chunks},null,2),'utf8');console.log(JSON.stringify({prepared:pool.length,aliases,chunks:chunks.length}));
}else if(process.argv.includes('--upload-audio')){
 let done=0;const rows=Object.values(assets).filter(a=>a.mime.startsWith('audio/')&&!a.registered);
 const queue=[...rows];await Promise.all(Array.from({length:4},async()=>{while(queue.length){const a=queue.shift(),bytes=await fs.readFile(a.path);if(hash(bytes)!==a.hash)throw Error('audio_changed');const object='quiz-media/all-subjects-20261027-'+a.hash;let r=await storage('object/'+object,{method:'POST',headers:{'Content-Type':a.mime,'x-upsert':'false'},body:bytes});if(!r.ok){const e=await r.json().catch(()=>({}));if(r.status!==409&&e.statusCode!=='409'&&e.error!=='Duplicate')throw Error('audio_upload_failed_'+r.status);}r=await storage('object/'+object);if(!r.ok||hash(Buffer.from(await r.arrayBuffer()))!==a.hash)throw Error('audio_verification_failed');done++;}}));await fs.writeFile(dir+'/audio-verified.json',JSON.stringify({verified:done},null,2),'utf8');console.log(JSON.stringify({audioVerified:done}));
}else if(process.argv.includes('--apply')){
 const p=await read(dir+'/prepared.json');if(p.pool_sha256!==verified.pool_sha256)throw Error('prepared_pool_changed');const a=await read(dir+'/audio-verified.json');if(a.verified!==Object.values(assets).filter(a=>a.mime.startsWith('audio/')&&!a.registered).length)throw Error('audio_not_ready');
 const before=snapshot();await fs.writeFile(dir+'/before.json',JSON.stringify(before),'utf8');for(const f of ['supabase/quiz.sql','supabase/quiz-pool.sql','supabase/quiz-rewards.sql',...p.chunks]){await fs.writeFile(dir+'/apply-progress.json',JSON.stringify({file:f}));cli(['db','query','--linked','--project-ref',project,'--file',path.resolve(f),'--output','json']);}
 const after=snapshot();if(JSON.stringify(before)!==JSON.stringify(after))throw Error('existing_answers_or_versions_changed');const report={at:new Date().toISOString(),originalAnswersUnchanged:true,originalVersionsUnchanged:true,courses:query('select c.id,count(p.question_id)::int total from public.quiz_courses c join public.quiz_pool_membership m on m.course_id=c.id join public.quiz_question_pool p on p.question_id=m.question_id where p.usable group by c.id order by c.id')};await fs.writeFile(dir+'/deployment.json',JSON.stringify(report,null,2),'utf8');console.log(JSON.stringify(report));
}else if(process.argv.includes('--enable-rewards')){
 query('update public.quiz_integrity_settings set enabled=true where id');console.log(JSON.stringify({enabled:true,minSeconds:2}));
}else throw Error('action_required');
