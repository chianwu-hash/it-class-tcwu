import {readFile,writeFile} from 'node:fs/promises';
import {createHmac,createHash} from 'node:crypto';
import vault from '../lib/quiz-drive-worker-private.cjs';
const dir='automation/output/quiz/hanlin-g3-math-pool',manifest=JSON.parse(await readFile('automation/output/quiz/drive-library/manifest.json','utf8')),assets=JSON.parse(await readFile(dir+'/media-assets.json','utf8')),pool=JSON.parse(await readFile(dir+'/pool.json','utf8')),cfg=vault.load();
const picked=new Set();
for(let unit=1;unit<=9;unit++){
 const hashes=new Set(pool.filter(r=>r.unit_ids.includes(unit)).flatMap(r=>[r.question.prompt,r.question.explanation,...r.question.options.map(o=>o.content)].flatMap(c=>c.media.map(m=>new URL(m.url).pathname.split('/').at(-1)))));
 const sorted=[...hashes].sort((a,b)=>assets[b].bytes-assets[a].bytes);for(const h of [...sorted.slice(0,2),...sorted.slice(-1)])picked.add(h);
}
for(const h of Object.keys(assets))if(!manifest.assets[h]?.verified||manifest.assets[h].bytes!==assets[h].bytes||manifest.assets[h].mime!==assets[h].mime)throw Error('all_asset_manifest_required');
const link=h=>{const a=manifest.assets[h],p=Buffer.from(JSON.stringify({aud:manifest.audience,hash:h,mime:a.mime,bytes:a.bytes,role:'material',exp:Math.floor(Date.now()/1000)+300})).toString('base64url');return manifest.workerOrigin+'/media/'+h+'?ticket='+p+'.'+createHmac('sha256',Buffer.from(cfg.ticketKey,'base64url')).update(p).digest('base64url');};
const report={at:new Date().toISOString(),allManifestEntriesVerified:Object.keys(assets).length,downloads:[],failures:[]};const selected=[...picked];
for(let at=0;at<selected.length;at+=4)await Promise.all(selected.slice(at,at+4).map(async h=>{try{const r=await fetch(link(h),{headers:{Origin:'https://it-class-tcwu.vercel.app'},signal:AbortSignal.timeout(45000)}),b=Buffer.from(await r.arrayBuffer());if(!r.ok||createHash('sha256').update(b).digest('hex')!==h||r.headers.get('X-Quiz-Media-Source')!=='google-drive-via-cloudflare')throw Error('worker_original_mismatch_'+r.status);report.downloads.push({hash:h,bytes:b.length,source:r.headers.get('X-Quiz-Media-Source')});}catch(e){report.failures.push({hash:h,error:e.message});}}));
const unsigned=await fetch(manifest.workerOrigin+'/media/'+selected[0]);report.unsignedStatus=unsigned.status;await unsigned.body?.cancel();if(unsigned.status!==401)report.failures.push({error:'unsigned_allowed'});
report.passed=!report.failures.length;await writeFile(dir+'/cloud/worker-validation.json',JSON.stringify(report,null,2),'utf8');console.log(JSON.stringify({passed:report.passed,registered:Object.keys(assets).length,verifiedDownloads:report.downloads.length,failures:report.failures.length}));if(!report.passed)process.exitCode=1;
