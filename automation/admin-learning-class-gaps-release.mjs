import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {vercelApi,project,team} from './admin-learning-release.mjs';
const out=path.resolve('automation/output/admin-learning-class-gaps-release-20261101'),run=promisify(execFile);
const changed=['admin-learning.html','shared/admin-learning.mjs','shared/admin-learning.css','shared/admin-learning-garden.mjs'],sha=b=>createHash('sha1').update(b).digest('hex');
await fs.mkdir(out,{recursive:true});
const flatten=tree=>{const src=tree.find(n=>n.name==='src'),files=[];function walk(n,p=''){if(n.type==='directory')for(const c of n.children||[])walk(c,p+(n===src?'':n.name+'/'));else files.push({path:p+n.name,uid:n.uid});}walk(src);return files;};
if(process.argv.includes('--prepare')){
 const base=await vercelApi('/v13/deployments/it-class-tcwu.vercel.app');if(base.project?.id!==project||base.team?.id!==team||base.readyState!=='READY')throw Error('wrong_production');
 const files=flatten(await vercelApi('/v6/deployments/'+base.id+'/files'));let fetched=0;
 for(const f of files){
  let bytes=null;
  for(const dir of ['automation/output/admin-learning-release-20261101/publish','.']){
   const b=await fs.readFile(path.resolve(dir,f.path)).catch(()=>null);if(b&&sha(b)===f.uid){bytes=b;break;}
  }
  if(!bytes){
   const {stdout}=await run('pwsh',['-NoProfile','-File','automation/lib/admin-learning-vercel-api.ps1','-Endpoint',`/v8/deployments/${base.id}/files/${f.uid}`],{windowsHide:true,encoding:'buffer',maxBuffer:20e6,timeout:60000});
   const candidates=[stdout];try{const value=JSON.parse(stdout.toString('utf8'));if(typeof value==='string')candidates.push(Buffer.from(value),Buffer.from(value,'base64'));if(typeof value.data==='string')candidates.push(Buffer.from(value.data,'base64'),Buffer.from(value.data));}catch{}
   for(const b of [...candidates]){candidates.push(Buffer.from(b.toString('utf8').replace(/\r?\n$/,'')));}
   bytes=candidates.find(b=>sha(b)===f.uid);if(!bytes)throw Error('source_download_mismatch_'+f.path);fetched++;
  }
  const dest=path.join(out,'publish',f.path);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,bytes);
 }
 await fs.writeFile(out+'/baseline.json',JSON.stringify({deployment:base.id,files,changed},null,2));
 for(const f of changed)await fs.copyFile(f,path.join(out,'publish',f));
 await fs.mkdir(out+'/publish/.vercel',{recursive:true});await fs.writeFile(out+'/publish/.vercel/project.json',JSON.stringify({projectId:project,orgId:team,projectName:'it-class-tcwu'}));
 console.log(JSON.stringify({prepared:true,baseline:base.id,files:files.length,changed,downloaded:fetched}));
}
if(process.argv.includes('--guard')){
 const id=process.argv.at(-1);if(!/^dpl_\w+$/.test(id))throw Error('deployment_required');
 const base=JSON.parse(await fs.readFile(out+'/baseline.json','utf8')),files=flatten(await vercelApi('/v6/deployments/'+id+'/files'));
 if(files.length!==base.files.length)throw Error('source_count_changed');
 for(const f of files){if(sha(await fs.readFile(path.join(out,'publish',f.path)))!==f.uid)throw Error('published_source_mismatch_'+f.path);
  if(!changed.includes(f.path)&&base.files.find(x=>x.path===f.path)?.uid!==f.uid)throw Error('unrelated_file_changed_'+f.path);}
 const latest=await vercelApi('/v13/deployments/it-class-tcwu.vercel.app');if(![base.deployment,id].includes(latest.id))throw Error('concurrent_production_changed');
 const report={passed:true,deployment:id,baseline:base.deployment,files:files.length,changed,unrelatedSourcesPreserved:true};await fs.writeFile(out+'/source-guard.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
if(process.argv.includes('--public')){
 for(const f of changed){const r=await fetch('https://it-class-tcwu.vercel.app/'+f,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(r.status!==200||sha(Buffer.from(await r.arrayBuffer()))!==sha(await fs.readFile(path.join(out,'publish',f))))throw Error('public_mismatch_'+f);}
 await fs.writeFile(out+'/public-check.json',JSON.stringify({passed:true,files:changed.length,at:new Date().toISOString()}));console.log(JSON.stringify({passed:true,publicFilesVerified:changed.length}));
}
