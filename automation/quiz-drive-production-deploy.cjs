// Explicit production rollout. Credential values stay in process memory, never logs/files.
const fs=require('node:fs/promises'),{spawnSync}=require('node:child_process');
const vault=require('./lib/quiz-drive-worker-private.cjs');
const project='upxgyusodibaqcrocdzj',dir='automation/output/quiz/drive-production';
function cli(args,input){
 const command=input
  ? "$v=[Console]::In.ReadToEnd()|ConvertFrom-Json; $pairs=@($v.PSObject.Properties|ForEach-Object { $_.Name+'='+$_.Value }); & supabase-personal secrets set @pairs --project-ref '"+project+"'"
  : '& supabase-personal '+args.map(a=>"'"+a.replaceAll("'","''")+"'").join(' ');
 const r=spawnSync('pwsh',['-NoProfile','-NonInteractive','-Command',command],{input:input?JSON.stringify(input):undefined,encoding:'utf8',windowsHide:true,timeout:120000,maxBuffer:2*1024*1024});
 if(r.status!==0)throw Error('supabase_rollout_command_failed');return r.stdout;
}
function json(raw){return JSON.parse(raw.slice(raw.indexOf('[')));}
(async()=>{
 const projects=json(cli(['projects','list','--output','json']));
 if(!projects.some(p=>p.id===project&&p.name==="chianwu-hash's Project"))throw Error('project_mismatch');
 await fs.mkdir(dir,{recursive:true});
 if(process.argv.includes('--rollback')){
  cli([],{QUIZ_IMAGE_BACKEND:'supabase'});console.log(JSON.stringify({project,backend:'supabase'}));return;
 }
 const manifest=JSON.parse(await fs.readFile('automation/output/quiz/drive-library/manifest.json','utf8'));
 if(manifest.workerOrigin!=='https://dingxi-quiz-drive-library.nblm-book-audio.workers.dev'||Object.values(manifest.assets).filter(a=>a.verified).length!==5534)throw Error('verified_library_required');
 const cfg=vault.load();if(cfg.email!=='th990821@mail.thps.ntpc.edu.tw'||!cfg.ticketKey)throw Error('verified_grant_required');
 if(process.argv.includes('--activate')){
  const health=await fetch(manifest.workerOrigin+'/health',{headers:{Origin:'https://it-class-tcwu.vercel.app'}});
  const status=await health.json();
  if(!health.ok||!status.ready||status.service!=='quiz-drive-media-library'||health.headers.get('Access-Control-Allow-Origin')!=='https://it-class-tcwu.vercel.app')throw Error('production_worker_not_ready');
  const deployed=JSON.parse(await fs.readFile(dir+'/deployment.json','utf8'));
  const current=json(cli(['functions','list','--project-ref',project,'--output','json'])).find(f=>f.slug==='quiz-media');
  // Supabase also increments version on secret changes; compare the actual bundle instead.
  if(deployed.project!==project||!current||current.status!=='ACTIVE'||current.id!==deployed.function.id||!current.ezbr_sha256||current.ezbr_sha256!==deployed.function.ezbr_sha256)throw Error('function_deployment_mismatch');
  cli([],{QUIZ_IMAGE_BACKEND:'drive'});
  await fs.writeFile(dir+'/activation.json',JSON.stringify({at:new Date().toISOString(),project,backend:'drive'},null,2),'utf8');
  console.log(JSON.stringify({project,activated:true}));return;
 }
 const before=json(cli(['functions','list','--project-ref',project,'--output','json']));
 await fs.writeFile(dir+'/functions-before.json',JSON.stringify(before,null,2),'utf8');
 cli([],{QUIZ_DRIVE_ORIGIN:manifest.workerOrigin,QUIZ_DRIVE_TICKET_KEY:cfg.ticketKey});
 cli(['functions','deploy','quiz-media','--project-ref',project,'--use-api','--no-verify-jwt']);
 const after=json(cli(['functions','list','--project-ref',project,'--output','json']));
 const fn=after.find(f=>f.slug==='quiz-media'||f.name==='quiz-media');if(!fn||fn.status!=='ACTIVE')throw Error('function_not_active');
 const report={at:new Date().toISOString(),project,function:fn,backendChanged:false};
 await fs.writeFile(dir+'/deployment.json',JSON.stringify(report,null,2),'utf8');console.log(JSON.stringify(report));
})().catch(e=>{const safe=['supabase_rollout_command_failed','project_mismatch','verified_library_required','verified_grant_required','production_worker_not_ready','function_deployment_mismatch','function_not_active'];console.error('Production rollout failed: '+(safe.includes(e.message)?e.message:'service_or_local_input_unavailable'));process.exitCode=1;});
