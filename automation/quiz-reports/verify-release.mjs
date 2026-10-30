import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
const run=promisify(execFile),out='automation/output/quiz/question-reports',origin=process.argv[2],live=process.argv[3]==='live';
if(!/^https:\/\/it-class-tcwu(?:-[a-z0-9]+-chianwu-4755s-projects)?\.vercel\.app$/.test(origin))throw Error('origin_not_allowed');
const manifest=JSON.parse(await fs.readFile(out+'/manifest.json','utf8')),queue=[...manifest.changes],results=[];
const hash=b=>createHash('sha256').update(b).digest('hex');
if(live){for(const item of manifest.preserved)if(!item.file.startsWith('api/')&&!item.file.startsWith('.')&&!item.file.startsWith('package')&&/\.(html|js|mjs|css|svg|png|jpg|jpeg|webp|gif|woff2?|mp3|wav|json)$/.test(item.file))queue.push({file:item.file,sha256:hash(await fs.readFile(path.join(out,'release',item.file)))});}
await Promise.all(Array.from({length:4},async()=>{for(let item;item=queue.shift();){const {file,sha256}=item;let bytes;
 if(live){const res=await fetch(origin+'/'+file,{signal:AbortSignal.timeout(45000)});if(!res.ok)throw Error('fetch_failed:'+file+':'+res.status);bytes=Buffer.from(await res.arrayBuffer());}
 else{const target=path.resolve(out,'candidate-files',file);await fs.mkdir(path.dirname(target),{recursive:true});const lit=s=>"'"+s.replaceAll("'","''")+"'";await run('pwsh',['-NoProfile','-NonInteractive','-Command',`& vercel curl ${lit(origin+'/'+file)} --output ${lit(target)}`],{cwd:path.resolve(out,'release'),windowsHide:true,timeout:90000});bytes=await fs.readFile(target);}
 if(hash(bytes)!==sha256)throw Error('sha_mismatch:'+file);results.push(file);
}}));
const result={passed:true,origin,files:results.length,changes:manifest.changes.length,preserved:results.length-manifest.changes.length,results};await fs.writeFile(out+'/'+(live?'live-files.json':'candidate-files.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({...result,results:undefined}));
