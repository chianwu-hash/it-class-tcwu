import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import vault from './lib/quiz-drive-worker-private.cjs';
const dir=resolve('automation/output/quiz/drive-library');await mkdir(dir,{recursive:true});
const inventory=JSON.parse(await readFile(resolve(dir,'inventory.json'),'utf8')),cfg=vault.load();let cached;
async function token(){
 if(cached?.expires>Date.now()+60000)return cached.token;
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:cfg.clientId,client_secret:cfg.clientSecret,refresh_token:cfg.refreshToken,grant_type:'refresh_token'}),signal:AbortSignal.timeout(30000)});
 const d=await r.json();if(!r.ok||!d.access_token)throw Error('school_drive_authorization_failed');cached={token:d.access_token,expires:Date.now()+d.expires_in*1000};return cached.token;
}
async function drive(path,options={}){
 for(let attempt=0;attempt<5;attempt++){
  try{
   const r=await fetch('https://www.googleapis.com/'+path,{...options,headers:{...options.headers,Authorization:`Bearer ${await token()}`},signal:AbortSignal.timeout(90000)});
   const limited=r.status===403 && (await r.clone().json().catch(()=>({}))).error?.errors?.some(e=>['rateLimitExceeded','userRateLimitExceeded','backendError'].includes(e.reason));
   if((r.status===429||r.status>=500||limited)&&attempt<4){await r.body?.cancel();await new Promise(r=>setTimeout(r,1000*2**attempt));continue;}
   return r;
  }catch(e){if(attempt===4)throw Error('drive_network_failed');await new Promise(r=>setTimeout(r,1000*2**attempt));}
 }
}
const about=await drive('drive/v3/about?fields=user(emailAddress)').then(r=>r.json());
if(about.user?.emailAddress!=='th990821@mail.thps.ntpc.edu.tw'||cfg.email!==about.user.emailAddress)throw Error('school_account_mismatch');
let manifest;try{manifest=JSON.parse(await readFile(resolve(dir,'manifest.json'),'utf8'));}catch{}
if(!manifest){
 const r=await drive('drive/v3/files?fields=id',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'考前練功房_已整理題庫圖片_20261027',mimeType:'application/vnd.google-apps.folder',appProperties:{quizLibrary:'prepared-20261027'}})});
 const folder=await r.json();if(!r.ok||!folder.id)throw Error('library_folder_failed');
 manifest={email:about.user.emailAddress,folderId:folder.id,workerOrigin:'https://dingxi-quiz-drive-library.nblm-book-audio.workers.dev',audience:'quiz-drive-media-library',assets:{}};
}
async function checkpoint(){const target=resolve(dir,'manifest.json');await writeFile(target+'.tmp',JSON.stringify(manifest,null,2),'utf8');await rename(target+'.tmp',target);}
await checkpoint();
// Allocate IDs before uploads: retrying a lost response cannot create duplicate files.
const pending=Object.keys(inventory.assets).filter(h=>!manifest.assets[h]);
for(let at=0;at<pending.length;at+=1000){
 const batch=pending.slice(at,at+1000),r=await drive(`drive/v3/files/generateIds?count=${batch.length}&space=drive&type=files`),d=await r.json();
 if(!r.ok||d.ids?.length!==batch.length)throw Error('file_id_allocation_failed');
 batch.forEach((hash,i)=>{const a=inventory.assets[hash];manifest.assets[hash]={fileId:d.ids[i],mime:a.mime,bytes:a.bytes,md5:a.md5,verified:false};});await checkpoint();
}
let priority=new Set();try{priority=new Set(JSON.parse(await readFile(resolve(dir,'supabase-assets.json'),'utf8')).filter(a=>a.mime.startsWith('image/')).map(a=>new URL(a.url).pathname.split('/').at(-1)));}catch{}
const hashes=Object.keys(inventory.assets).filter(h=>!manifest.assets[h].verified).sort((a,b)=>Number(priority.has(b))-Number(priority.has(a)));let completed=Object.values(manifest.assets).filter(a=>a.verified).length;
const parallel=Math.max(1,Math.min(96,Number(process.env.QUIZ_DRIVE_UPLOAD_CONCURRENCY||12)));
const progress=async()=>writeFile(resolve(dir,'upload-progress.json'),JSON.stringify({at:new Date().toISOString(),total:inventory.images,verified:completed,remaining:inventory.images-completed,bytes:inventory.bytes},null,2));
await progress();
for(let at=0;at<hashes.length;at+=parallel){
 await Promise.all(hashes.slice(at,at+parallel).map(async hash=>{
  const a=inventory.assets[hash],entry=manifest.assets[hash],bytes=await readFile(a.localFile);
  if(createHash('sha256').update(bytes).digest('hex')!==hash)throw Error('local_source_changed');
  const boundary='quizlibrary'+crypto.randomUUID().replaceAll('-',''),meta={id:entry.fileId,name:hash+ext(a.mime),parents:[manifest.folderId],appProperties:{quizLibrary:'prepared-20261027',sha256:hash}};
  const body=Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${a.mime}\r\n\r\n`),bytes,Buffer.from(`\r\n--${boundary}--\r\n`)]);
  let r=await drive('upload/drive/v3/files?uploadType=multipart&fields=id,mimeType,size,md5Checksum,permissions(type,role)',{method:'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body});
  if(r.status===409){await r.body?.cancel();r=await drive(`drive/v3/files/${entry.fileId}?fields=id,mimeType,size,md5Checksum,permissions(type,role)`);}
  const d=await r.json();
  if(!r.ok||d.id!==entry.fileId||Number(d.size)!==a.bytes||d.md5Checksum!==a.md5||d.mimeType!==a.mime||d.permissions?.some(p=>p.type==='anyone'||p.type==='domain'))throw Error('uploaded_image_verification_failed');
  entry.verified=true;completed++;
 }));
 await checkpoint();await progress();
}
function ext(mime){return {'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp','image/gif':'.gif'}[mime];}
console.log(JSON.stringify({images:completed,bytes:inventory.bytes,schoolAccountVerified:true,md5Verified:true}));
