import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';import vault from '../lib/quiz-drive-worker-private.cjs';
import {pathToFileURL} from 'node:url';
const [out,baseline]=process.argv.slice(2),bundle=JSON.parse(await fs.readFile(path.join(out,'bundle.private.json'),'utf8')),manifest=JSON.parse(await fs.readFile(path.join(baseline,'drive-library/manifest.json'),'utf8'));
const cfg=vault.load();if(cfg.email!=='th990821@mail.thps.ntpc.edu.tw')throw Error('drive_account_mismatch');
let cached;async function token(){if(cached?.expires>Date.now()+60000)return cached.value;const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:cfg.clientId,client_secret:cfg.clientSecret,refresh_token:cfg.refreshToken,grant_type:'refresh_token'}),signal:AbortSignal.timeout(30000)}),d=await r.json();if(!r.ok||!d.access_token)throw Error('drive_authorization_failed');cached={value:d.access_token,expires:Date.now()+d.expires_in*1000};return cached.value;}
async function drive(endpoint,options={}){const r=await fetch('https://www.googleapis.com/'+endpoint,{...options,headers:{...options.headers,Authorization:'Bearer '+await token()},signal:AbortSignal.timeout(60000)});return r;}
const about=await(await drive('drive/v3/about?fields=user(emailAddress)')).json();if(about.user?.emailAddress!==cfg.email)throw Error('drive_signed_in_account_mismatch');
const hash=b=>createHash('sha256').update(b).digest('hex');
let delta;try{delta=JSON.parse(await fs.readFile(path.join(out,'drive-delta.private.json'),'utf8'));}catch{delta={email:cfg.email,folderId:manifest.folderId,workerOrigin:manifest.workerOrigin,audience:manifest.audience,assets:{}};}
for(const a of Object.values(bundle.assets).filter(a=>a.mime.startsWith('image'))){
 const prior=manifest.assets[a.hash];if(prior?.verified){delta.assets[a.hash]=prior;continue;}
 let item=delta.assets[a.hash];if(!item){const r=await drive('drive/v3/files/generateIds?count=1&space=drive&type=files'),j=await r.json();if(!r.ok||!j.ids?.[0])throw Error('drive_id_allocation_failed');item=delta.assets[a.hash]={fileId:j.ids[0],mime:a.mime,bytes:a.bytes,md5:a.md5,verified:false};await fs.writeFile(path.join(out,'drive-delta.private.json'),JSON.stringify(delta));}
 if(!item.verified){const bytes=await fs.readFile(a.file);if(hash(bytes)!==a.hash)throw Error('local_asset_changed');const boundary='unit3'+crypto.randomUUID().replaceAll('-',''),meta={id:item.fileId,name:a.hash+path.extname(a.file),parents:[manifest.folderId],appProperties:{quizScope:'g6-u1-u3-20261030',sha256:a.hash}};
 const body=Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${a.mime}\r\n\r\n`),bytes,Buffer.from(`\r\n--${boundary}--\r\n`)]);
 let r=await drive('upload/drive/v3/files?uploadType=multipart&fields=id,mimeType,size,md5Checksum,permissions(type,role)',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body});if(r.status===409){await r.body?.cancel();r=await drive(`drive/v3/files/${item.fileId}?fields=id,mimeType,size,md5Checksum,permissions(type,role)`);}const j=await r.json();if(!r.ok||j.id!==item.fileId||Number(j.size)!==a.bytes||j.md5Checksum!==a.md5||j.permissions?.some(p=>['anyone','domain'].includes(p.type)))throw Error('private_drive_upload_verification_failed');
 const read=await drive(`drive/v3/files/${item.fileId}?alt=media`);if(!read.ok||hash(Buffer.from(await read.arrayBuffer()))!==a.hash)throw Error('drive_original_hash_failed');item.verified=true;await fs.writeFile(path.join(out,'drive-delta.private.json'),JSON.stringify(delta));
 }
}
const {authorizeCloud,storage}=await import(pathToFileURL(path.resolve(baseline,'all-midterm-local/supabase_cloud_storage.mjs')));authorizeCloud();
const bucket=await(await storage('bucket/quiz-media')).json();if(bucket.public!==false)throw Error('private_media_bucket_required');let audio=0;
for(const a of Object.values(bundle.assets).filter(a=>a.mime.startsWith('audio'))){
 const bytes=await fs.readFile(a.file);if(hash(bytes)!==a.hash)throw Error('local_audio_changed');if(!a.registered){let r=await storage('object/quiz-media/'+a.object_path,{method:'POST',headers:{'Content-Type':a.mime,'x-upsert':'false'},body:bytes});if(!r.ok&&r.status!==409){const j=await r.json().catch(()=>({}));if(j.statusCode!=='409'&&j.error!=='Duplicate')throw Error('audio_upload_failed');}}
 const r=await storage('object/quiz-media/'+a.object_path);if(!r.ok||hash(Buffer.from(await r.arrayBuffer()))!==a.hash)throw Error('original_audio_hash_failed');audio++;
}
const report={passed:true,drive_account_verified:true,private_images:Object.keys(delta.assets).length,original_audio:audio,download_sha256_verified:true};await fs.writeFile(path.join(out,'media-upload-verified.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
