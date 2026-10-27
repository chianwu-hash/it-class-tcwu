// Explicitly authorized rollout; private inputs and SQL exports stay in ignored output.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {validateDocument,newDocument} from '../../shared/quiz-document.mjs';
const dir='automation/output/quiz/hanlin-g3-math-pool',drive='automation/output/quiz/drive-library',project='upxgyusodibaqcrocdzj';
await mkdir(dir+'/cloud',{recursive:true});
function cli(args){let raw;try{raw=execFileSync('pwsh',['-NoProfile','-NonInteractive','-Command','& supabase-personal '+args.map(a=>"'"+a.replaceAll("'","''")+"'").join(' ')],{encoding:'utf8',windowsHide:true,timeout:120000,maxBuffer:10*1024*1024,stdio:['ignore','pipe','pipe']});}catch{throw Error('pool_cloud_command_failed');}return JSON.parse(raw.slice(Math.min(...[raw.indexOf('{'),raw.indexOf('[')].filter(n=>n>=0))));}
const query=sql=>cli(['db','query','--linked','--project-ref',project,sql,'--output','json']).rows;
if(!cli(['projects','list','--output','json']).some(p=>p.id===project&&p.name==="chianwu-hash's Project"))throw Error('project_mismatch');
const users=query("select id from auth.users where lower(email)='chianwu@gmail.com' and email_confirmed_at is not null");if(users.length!==1)throw Error('owner_mismatch');const owner=users[0].id;
const validation=JSON.parse(await readFile(dir+'/qa/structure-validation.json','utf8'));
if(!validation.passed||validation.pool_sha256!==createHash('sha256').update(await readFile(dir+'/pool.json')).digest('hex'))throw Error('validated_pool_required');
const pool=JSON.parse(await readFile(dir+'/pool.json','utf8')),assets=JSON.parse(await readFile(dir+'/media-assets.json','utf8'));
const literal=s=>"'"+s.replaceAll("'","''")+"'",j=x=>literal(JSON.stringify(x))+'::jsonb';
if(process.argv.includes('--prepare')){
 const inventory=JSON.parse(await readFile(drive+'/inventory.json','utf8'));await copyFile(drive+'/inventory.json',dir+'/cloud/drive-inventory-before.json');let additions=0;
 for(const [hash,a] of Object.entries(assets)){const bytes=await readFile(a.path);if(createHash('sha256').update(bytes).digest('hex')!==hash)throw Error('asset_changed');
  if(inventory.assets[hash]){if(inventory.assets[hash].mime!==a.mime||inventory.assets[hash].bytes!==a.bytes)throw Error('asset_conflict');continue;}
  inventory.assets[hash]={hash,md5:createHash('md5').update(bytes).digest('hex'),mime:a.mime,bytes:a.bytes,localFile:resolve(a.path),courses:['hanlin-g3-math-pool'],aliases:[]};additions++;
 }
 inventory.images=Object.keys(inventory.assets).length;inventory.bytes=Object.values(inventory.assets).reduce((s,a)=>s+a.bytes,0);await writeFile(drive+'/inventory.json',JSON.stringify(inventory,null,2),'utf8');
 let sql="begin;\nupdate public.quiz_question_pool set usable=false where question_id like 'hanlin3m_%';\n";
 for(const a of Object.values(assets)){
  const hash=a.sha256,url=`https://quiz-media.invalid/${owner}/${hash}`;
  sql+=`insert into public.quiz_media_assets values(${literal(url)},'${owner}',${literal('drive-g3-pool-'+hash)},${literal(a.mime)},${a.bytes}) on conflict(url) do nothing;\n`;
  sql+=`do $$begin if not exists(select 1 from public.quiz_media_assets where url=${literal(url)} and mime=${literal(a.mime)} and bytes=${a.bytes}) then raise exception 'asset_conflict';end if;end$$;\n`;
 }
 for(const r of pool){
  const q=JSON.parse(JSON.stringify(r.question).replaceAll('00000000-0000-4000-8000-000000000001',owner));const doc=newDocument();doc.blocks[0].questions=[q];validateDocument(doc);
  sql+=`select public.quiz_validate(${j(doc)});\ninsert into public.quiz_question_pool values(${literal(r.question_id)},${literal(r.source_item_id)},${literal(r.group_key)},${j(r.unit_ids)},${literal(r.knowledge_code)},${literal(r.knowledge_name)},${r.difficulty},${literal(r.source_version)},${r.publisher_explanation},${j(q)},${j(r.checks)},true) on conflict(question_id) do update set group_key=excluded.group_key,unit_ids=excluded.unit_ids,knowledge_code=excluded.knowledge_code,knowledge_name=excluded.knowledge_name,difficulty=excluded.difficulty,source_version=excluded.source_version,publisher_explanation=excluded.publisher_explanation,question=excluded.question,checks=excluded.checks,usable=true;\n`;
 }
 sql+="notify pgrst,'reload schema';\ncommit;";
 await writeFile(dir+'/cloud/import.sql',sql,'utf8');const report={project,pool_sha256:validation.pool_sha256,questions:pool.length,images:Object.keys(assets).length,newDriveImages:additions,totalDriveImages:inventory.images};
 await writeFile(dir+'/cloud/prepared.json',JSON.stringify(report,null,2),'utf8');console.log(JSON.stringify(report));
}else if(process.argv.includes('--apply')){
 const prepared=JSON.parse(await readFile(dir+'/cloud/prepared.json','utf8')),manifest=JSON.parse(await readFile(drive+'/manifest.json','utf8'));
 if(prepared.pool_sha256!==validation.pool_sha256||!Object.keys(assets).every(h=>manifest.assets[h]?.verified))throw Error('cloud_media_not_ready');
 const baseline=()=>query("select (select count(*)::int from public.quiz_answers) answers,(select count(*)::int from public.quiz_versions) versions,(select md5(coalesce(string_agg(row_to_json(a)::text,'' order by a.attempt_id,a.question_id),'')) from public.quiz_answers a) answer_digest,(select md5(coalesce(string_agg(row_to_json(v)::text,'' order by v.id),'')) from public.quiz_versions v) version_digest")[0];
 const before=baseline();await writeFile(dir+'/cloud/before.json',JSON.stringify(before,null,2),'utf8');
 for(const file of ['supabase/quiz.sql','supabase/quiz-pool.sql',dir+'/cloud/import.sql'])cli(['db','query','--linked','--project-ref',project,'--file',resolve(file),'--output','json']);
 const after=baseline();if(JSON.stringify(before)!==JSON.stringify(after))throw Error('existing_progress_or_versions_changed_review_required');
 const status=query("select count(*)::int total,count(distinct group_key)::int groups from public.quiz_question_pool where usable")[0];if(status.total!==pool.length)throw Error('pool_count_mismatch');
 const permissions=query("select has_table_privilege('authenticated','public.quiz_question_pool','SELECT') pool_read,has_table_privilege('authenticated','public.quiz_generated_papers','SELECT') private_read,has_function_privilege('anon','public.quiz_compose(jsonb)','EXECUTE') anon_compose,has_function_privilege('authenticated','public.quiz_compose(jsonb)','EXECUTE') student_compose")[0];
 if(permissions.pool_read||permissions.private_read||permissions.anon_compose||!permissions.student_compose)throw Error('permission_mismatch');
 const report={at:new Date().toISOString(),project,status,permissions,existingAnswersUnchanged:true,existingVersionsUnchanged:true};await writeFile(dir+'/cloud/deployment.json',JSON.stringify(report,null,2),'utf8');console.log(JSON.stringify(report));
}else throw Error('prepare_or_apply_required');
