import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';import {createHash,randomUUID} from 'node:crypto';
const project='upxgyusodibaqcrocdzj',root='automation/output/past-exams-batch',out=root+'/cloud';fs.mkdirSync(out,{recursive:true});
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),save=(f,v)=>fs.writeFileSync(f,JSON.stringify(v,null,2)),hash=v=>createHash('sha256').update(v).digest('hex'),lit=s=>"'"+s.replaceAll("'","''")+"'",json=v=>lit(JSON.stringify(v))+'::jsonb';
function cli(args){try{const raw=execFileSync('pwsh',['-NoProfile','-NonInteractive','-Command','& supabase-personal '+args.map(a=>lit(a)).join(' ')],{encoding:'utf8',windowsHide:true,timeout:240000,maxBuffer:32*1024*1024,stdio:['ignore','pipe','pipe']});const start=Math.min(...[raw.indexOf('{'),raw.indexOf('[')].filter(i=>i>=0));return JSON.parse(raw.slice(start));}catch(e){fs.writeFileSync(out+'/last-error.private.txt',String(e.stderr||e.message));throw Error('cloud_operation_failed; inspect private error artifact');}}
if(!cli(['projects','list','--output','json']).some(p=>p.id===project&&p.name==="chianwu-hash's Project"))throw Error('project_mismatch');
const query=sql=>cli(['db','query','--linked','--project-ref',project,sql,'--output','json']).rows;
const queryFile=(file,sql)=>{fs.writeFileSync(file,sql);return cli(['db','query','--linked','--project-ref',project,'--file',path.resolve(file),'--output','json']).rows;};
const funcs=()=>query("select p.proname,pg_get_function_identity_arguments(p.oid) args,pg_get_functiondef(p.oid) definition,md5(pg_get_functiondef(p.oid)) hash from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'quiz_%' order by p.proname,args");
const tables=['quiz_answers','quiz_versions','quiz_leaf_awards','student_progress','quiz_past_attempts','quiz_past_answers','quiz_past_receipts','quiz_past_leaves','quiz_past_views'];
const snapshotSql=tables.map(t=>`select ${lit(t)} name,count(*)::integer count,md5(coalesce(string_agg(row_to_json(t)::text,'' order by row_to_json(t)::text),'')) digest from public.${t} t`).join(' union all ');
const snapshot=()=>query(snapshotSql);
const scope=read(root+'/publication-scope.json'),bundles=scope.paperIds.filter(id=>!scope.publishedPaperIds.includes(id)).map(id=>read(root+'/'+id+'/bundle.private.json'));
if(bundles.length!==19||bundles.some(b=>b.provenance.qc.status!=='verified'||b.document.catalog.sourceYear!=='114-1'||hash(JSON.stringify(b.document))!==b.sha256))throw Error('nineteen_verified_bundles_required');
const assets=[...new Map(bundles.flatMap(b=>b.assets).map(a=>[a.hash,a])).values()];
const frozen=()=>Object.fromEntries(bundles.map(b=>[b.paperId,b.sha256]));
const verifyPilot=()=>{const pilot=query(`select id,paper_id,sha256,md5(document::text) document_hash from public.quiz_past_versions where paper_id=${lit(scope.publishedPaperIds[0])}`);if(JSON.stringify(pilot)!==JSON.stringify(read(out+'/pilot.private.json')))throw Error('immutable_pilot_changed');};
const phase=process.argv[2];
if(phase==='inspect'){
 if(fs.existsSync(out+'/before-functions.private.json'))throw Error('existing_baseline_do_not_overwrite');
 const owners=query("select id from auth.users where lower(email)='chianwu@gmail.com' and email_confirmed_at is not null");if(owners.length!==1||bundles.some(b=>b.owner!==owners[0].id))throw Error('owner_mismatch');
 const papers=query('select id,enabled,active_version from public.quiz_past_papers order by id');if(papers.some(p=>!scope.publishedPaperIds.includes(p.id)))throw Error('unexpected_existing_paper');
 const pilot=query(`select id,paper_id,sha256,md5(document::text) document_hash from public.quiz_past_versions where paper_id=${lit(scope.publishedPaperIds[0])}`);if(pilot.length!==1||pilot[0].sha256!=='1536ce5703e91719a6f7503e2585c628b44eba2e91ffdc100fb601eea681fca8')throw Error('pilot_changed');
 save(out+'/before-functions.private.json',funcs());save(out+'/before-data.private.json',snapshot());save(out+'/before-papers.private.json',papers);save(out+'/pilot.private.json',pilot);save(out+'/frozen.private.json',{project,papers:frozen(),assets:assets.length,owner:owners[0].id,at:new Date().toISOString()});
 console.log(JSON.stringify({project,ownerVerified:true,papers:bundles.length,assets:assets.length,mutation:false}));
}else if(phase==='upload'){
 const f=read(out+'/frozen.private.json');if(JSON.stringify(f.papers)!==JSON.stringify(frozen()))throw Error('bundle_changed');
 const qa=read(root+'/browser-all.private.json');if(qa.status!=='passed'||qa.reports.length!==19)throw Error('browser_checks_required');
 const catalog=read(root+'/catalog-final/report.json');if(!catalog.passed||catalog.checks.length!==6)throw Error('catalog_checks_required');
 const bucket=query("select public from storage.buckets where id='quiz-media'");if(bucket.length!==1||bucket[0].public!==false)throw Error('private_media_bucket_required');
 const {storage}=await import('file:///D:/projects/it-class-tcwu/automation/output/quiz/all-midterm-local/supabase_cloud_storage.mjs');
 for(const a of assets){const bytes=fs.readFileSync(a.file);if(hash(bytes)!==a.hash||a.owner_id!==f.owner)throw Error('asset_changed');let r=await storage('object/quiz-media/'+a.object_path,{method:'POST',headers:{'Content-Type':a.mime,'x-upsert':'false'},body:bytes});if(!r.ok&&r.status!==409){const e=await r.json().catch(()=>({}));if(e.error!=='Duplicate'&&e.statusCode!=='409')throw Error('private_upload_failed');}r=await storage('object/quiz-media/'+a.object_path);if(!r.ok||hash(Buffer.from(await r.arrayBuffer()))!==a.hash)throw Error('uploaded_hash_mismatch');}
 save(out+'/media-verified.private.json',{papers:frozen(),assets:assets.length,verified:true});console.log(JSON.stringify({verifiedPrivateAssets:assets.length}));
}else if(phase==='apply'){
 const f=read(out+'/frozen.private.json'),m=read(out+'/media-verified.private.json');if(JSON.stringify(f.papers)!==JSON.stringify(frozen())||JSON.stringify(m.papers)!==JSON.stringify(frozen())||m.assets!==assets.length)throw Error('unverified_bundle');
 const before=read(out+'/before-functions.private.json'),now=funcs();if(JSON.stringify(before.map(f=>[f.proname,f.args,f.hash]))!==JSON.stringify(now.map(f=>[f.proname,f.args,f.hash])))throw Error('functions_changed_since_inspection');
 let sql='begin isolation level repeatable read;\ncreate temporary table past114_before as '+snapshotSql+';\n';
 const migration=fs.readFileSync('supabase/quiz-past-batch-114.sql','utf8').replace(/^begin;\s*$/im,'').replace(/^commit;\s*$/im,'');sql+=migration+'\n';
 for(const b of bundles){sql+=`select public.quiz_past_validate(${json(b.document)});\ninsert into public.quiz_past_papers(id,owner_id,grade,school_year,semester,title) values(${lit(b.paperId)},${lit(b.owner)},${b.document.catalog.grade},115,1,${lit(b.document.title)});\ninsert into public.quiz_past_versions(id,paper_id,sha256,document,provenance) values(${lit(randomUUID())},${lit(b.paperId)},${lit(b.sha256)},${json(b.document)},${json(b.provenance)});\nupdate public.quiz_past_papers set active_version=(select id from public.quiz_past_versions where paper_id=${lit(b.paperId)} and sha256=${lit(b.sha256)}) where id=${lit(b.paperId)};\n`;}
 for(const a of assets)sql+=`do $$begin if exists(select 1 from public.quiz_media_assets where url=${lit(a.url)} and (owner_id<>${lit(a.owner_id)}::uuid or object_path<>${lit(a.object_path)} or mime<>${lit(a.mime)} or bytes<>${a.bytes})) then raise exception 'media_registry_conflict';end if;end$$;\ninsert into public.quiz_media_assets values(${lit(a.url)},${lit(a.owner_id)},${lit(a.object_path)},${lit(a.mime)},${a.bytes}) on conflict(url) do nothing;\n`;
 sql+=`create temporary table past114_after as ${snapshotSql};\ndo $$begin if exists((select * from past114_before except select * from past114_after) union all (select * from past114_after except select * from past114_before)) then raise exception 'student_data_changed';end if;end$$;\nnotify pgrst,'reload schema';\ncommit;`;
 queryFile(out+'/register.private.sql',sql);
 const allowed=new Set(['quiz_past_has_media','quiz_past_canonical','quiz_past_validate','quiz_past_snapshot','quiz_past_action','quiz_media_access']),after=funcs();if(before.some(p=>!allowed.has(p.proname)&&after.find(a=>a.proname===p.proname&&a.args===p.args)?.hash!==p.hash))throw Error('unrelated_function_changed');
 verifyPilot();
 save(out+'/applied.private.json',{project,papers:frozen(),enabled:false,studentDataUnchanged:true,unrelatedFunctionsUnchanged:true,at:new Date().toISOString()});console.log(JSON.stringify({registered:19,enabled:false,studentDataUnchanged:true}));
}else if(phase==='deactivate'){
 const applied=read(out+'/applied.private.json');if(applied.project!==project)throw Error('applied_project_mismatch');
 query(`update public.quiz_past_papers set enabled=false where id in (${bundles.map(b=>lit(b.paperId)).join(',')})`);
 save(out+'/deactivated.private.json',{papers:frozen(),at:new Date().toISOString(),retainedAttemptsAndLeaves:true});console.log(JSON.stringify({disabled:19,retainedAttemptsAndLeaves:true}));
}else if(phase==='activate'){
 const gate=read(out+'/release-ready.private.json');if(!gate.passed||JSON.stringify(gate.papers)!==JSON.stringify(frozen()))throw Error('verified_release_required');
 const checks=read(out+'/smoke.private.json');if(!checks.passed||checks.papers!==19)throw Error('cloud_rollback_checks_required');
 verifyPilot();
 const sql='begin;\n'+bundles.map(b=>`update public.quiz_past_papers set enabled=true where id=${lit(b.paperId)} and active_version in(select id from public.quiz_past_versions where paper_id=${lit(b.paperId)} and sha256=${lit(b.sha256)});`).join('\n')+'\ncommit;';queryFile(out+'/activate.private.sql',sql);
 save(out+'/activated.private.json',{papers:frozen(),at:new Date().toISOString()});console.log(JSON.stringify({activated:19}));
}else throw Error('phase_required');
