import {readFile,writeFile} from 'node:fs/promises';
import {createHash,createHmac} from 'node:crypto';
import vault from './lib/quiz-drive-worker-private.cjs';
const dir='automation/output/quiz/drive-worker-poc',m=JSON.parse(await readFile(`${dir}/manifest.json`,'utf8')),cfg=vault.load();
const urlFor=(hash,a,exp=Math.floor(Date.now()/1000)+300)=>{
 const payload=Buffer.from(JSON.stringify({aud:'quiz-drive-media-poc',hash,fileId:a.fileId,mime:a.mime,bytes:a.bytes,role:a.roles[0],exp})).toString('base64url');
 return `${m.workerOrigin}/media/${hash}?ticket=${payload}.${createHmac('sha256',Buffer.from(cfg.ticketKey,'base64url')).update(payload).digest('base64url')}`;
};
const report={checkedAt:new Date().toISOString(),images:[],authorization:{},load:{}};
for(const [hash,a] of Object.entries(m.assets)){
 const start=performance.now(),r=await fetch(urlFor(hash,a)),b=Buffer.from(await r.arrayBuffer());
 if(!r.ok||createHash('sha256').update(b).digest('hex')!==hash)throw Error(`worker_original_mismatch:${r.status}`);
 const warm=await fetch(urlFor(hash,a));await warm.arrayBuffer();
 report.images.push({hash,bytes:b.length,source:r.headers.get('X-Quiz-Media-Source'),firstCache:r.headers.get('X-Quiz-Cache'),warmCache:warm.headers.get('X-Quiz-Cache'),elapsedMs:Math.round(performance.now()-start)});
}
const [hash,a]=Object.entries(m.assets)[0];
for(const [name,url,status] of [['unsigned',`${m.workerOrigin}/media/${hash}`,401],['expired',urlFor(hash,a,1),401],['forged',urlFor(hash,a).slice(0,-5)+'wrong',401],['cachePath',`${m.workerOrigin}/__private-cache/${hash}`,404]]){
 const r=await fetch(url);if(r.status!==status)throw Error('authorization_check_failed');report.authorization[name]=r.status;await r.arrayBuffer();
}
const google=await fetch(`https://www.googleapis.com/drive/v3/files/${a.fileId}?alt=media`);report.authorization.googleUnauthenticated=google.status;if(google.ok)throw Error('image_public');await google.arrayBuffer();
const timings=[],cacheCounts={};let failures=0;const start=performance.now();
await Promise.all(Array.from({length:30},async()=>{
 for(const [hash,a] of Object.entries(m.assets)){
  const t=performance.now();try{const r=await fetch(urlFor(hash,a)),b=Buffer.from(await r.arrayBuffer());if(!r.ok||createHash('sha256').update(b).digest('hex')!==hash)failures++;const c=r.headers.get('X-Quiz-Cache');cacheCounts[c]=(cacheCounts[c]||0)+1;}catch{failures++;}timings.push(performance.now()-t);
 }
}));
timings.sort((a,b)=>a-b);report.load={concurrentClients:30,imagesPerClient:5,requests:timings.length,failures,elapsedMs:Math.round(performance.now()-start),p50Ms:Math.round(timings[Math.floor(timings.length*.5)]),p95Ms:Math.round(timings[Math.floor(timings.length*.95)]),cacheCounts,cpuMetricsMeasured:false};
await writeFile(`${dir}/worker-qa.json`,JSON.stringify(report,null,2),'utf8');console.log(JSON.stringify(report));if(failures)process.exitCode=1;
