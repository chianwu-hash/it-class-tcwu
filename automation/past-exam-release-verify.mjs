import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
const root='automation/output/past-exam-production',manifest=JSON.parse(fs.readFileSync(root+'/release-manifest.json','utf8')),origin=process.argv[2];
if(!/^https:\/\/it-class-tcwu-[a-z0-9]+-chianwu-4755s-projects\.vercel\.app$/.test(origin))throw Error('deployment_target_mismatch');
const sha=b=>createHash('sha256').update(b).digest('hex');
for(const [file,expected] of Object.entries(manifest.files)){
 const target=path.resolve(root,'staged-files',file);fs.mkdirSync(path.dirname(target),{recursive:true});
 const command="& vercel curl '"+origin+'/'+file+"' --output '"+target.replaceAll("'","''")+"'";
 execFileSync('pwsh',['-NoProfile','-NonInteractive','-Command',command],{cwd:path.resolve(root,'release'),stdio:['ignore','pipe','pipe'],windowsHide:true,timeout:60000});
 if(sha(fs.readFileSync(target))!==expected)throw Error('deployment_bytes_mismatch_'+file);
}
fs.writeFileSync(root+'/cloud/release-verified.json',JSON.stringify({origin,files:Object.keys(manifest.files).length,manifestSha:sha(Buffer.from(JSON.stringify(manifest))),passed:true,at:new Date().toISOString()},null,2));console.log(JSON.stringify({passed:true,files:Object.keys(manifest.files).length,origin}));
