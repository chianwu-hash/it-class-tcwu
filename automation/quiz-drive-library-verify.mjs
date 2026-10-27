import {readFile,writeFile} from 'node:fs/promises';
import {createHmac,createHash} from 'node:crypto';
import vault from './lib/quiz-drive-worker-private.cjs';
const dir='automation/output/quiz/drive-library',manifest=JSON.parse(await readFile(`${dir}/manifest.json`,'utf8')),inventory=JSON.parse(await readFile(`${dir}/inventory.json`,'utf8')),cfg=vault.load();
if(Object.keys(manifest.assets).length!==inventory.images||Object.values(manifest.assets).some(a=>!a.verified))throw Error('upload_incomplete');
const registered=JSON.parse(await readFile(`${dir}/supabase-assets.json`,'utf8')).filter(a=>a.mime.startsWith('image/')).map(a=>new URL(a.url).pathname.split('/').at(-1));
const selected=new Set(registered),largest={};for(const [hash,a] of Object.entries(inventory.assets))for(const course of a.courses){if(!largest[course]||a.bytes>inventory.assets[largest[course]].bytes)largest[course]=hash;}
Object.values(largest).forEach(h=>selected.add(h));
let report={at:new Date().toISOString(),totalImages:inventory.images,totalBytes:inventory.bytes,allUploadMd5Verified:true,registeredImages:registered.length,images:[],failures:[]};
const link=(hash,exp=Math.floor(Date.now()/1000)+300)=>{const a=manifest.assets[hash],p=Buffer.from(JSON.stringify({aud:manifest.audience,hash,fileId:a.fileId,mime:a.mime,bytes:a.bytes,role:'material',exp})).toString('base64url');return `${manifest.workerOrigin}/media/${hash}?ticket=${p}.${createHmac('sha256',Buffer.from(cfg.ticketKey,'base64url')).update(p).digest('base64url')}`;};
let hashes=[...selected];
if(process.argv.includes('--retry-failures')){
 const previous=JSON.parse(await readFile(`${dir}/worker-final-qa.json`,'utf8'));
 await writeFile(`${dir}/worker-first-pass-qa.json`,JSON.stringify(previous,null,2),'utf8');
 hashes=previous.failures.filter(a=>a.hash).map(a=>a.hash);
 report={...previous,initialTransientFailures:previous.failures,failures:[],retriedAt:new Date().toISOString()};
}
for(let at=0;at<hashes.length;at+=4)await Promise.all(hashes.slice(at,at+4).map(async hash=>{
 const t=performance.now();try{const r=await fetch(link(hash),{signal:AbortSignal.timeout(45000)}),b=Buffer.from(await r.arrayBuffer());if(!r.ok||createHash('sha256').update(b).digest('hex')!==hash)throw Error(`original_mismatch_${r.status}`);report.images.push({hash,bytes:b.length,ms:Math.round(performance.now()-t),cache:r.headers.get('X-Quiz-Cache'),source:r.headers.get('X-Quiz-Media-Source')});}catch(e){report.failures.push({hash,error:e.message,cause:e.cause?.code});}
}));
const hash=registered[0];report.denials={};for(const [key,url,status] of [['unsigned',manifest.workerOrigin+'/media/'+hash,401],['expired',link(hash,1),401],['privateCache',manifest.workerOrigin+'/__private-cache/'+hash,404]]){const r=await fetch(url);report.denials[key]=r.status;await r.arrayBuffer();if(r.status!==status)report.failures.push({error:'access_denial_failed'});}
await writeFile(`${dir}/worker-final-qa.json`,JSON.stringify(report,null,2),'utf8');console.log(JSON.stringify({totalImages:report.totalImages,registeredImages:registered.length,downloadedAndSha256Verified:report.images.length,largestImageBytes:Math.max(...report.images.map(i=>i.bytes)),failures:report.failures.length}));if(report.failures.length)process.exitCode=1;
