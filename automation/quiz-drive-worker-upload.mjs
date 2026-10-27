import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vault from './lib/quiz-drive-worker-private.cjs';
const dir='automation/output/quiz/drive-worker-poc',cfg=vault.load();
const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:cfg.clientId,client_secret:cfg.clientSecret,refresh_token:cfg.refreshToken,grant_type:'refresh_token'})});
const token=await response.json();if(!response.ok||!token.access_token)throw Error('drive_authorization_failed');
const headers={Authorization:`Bearer ${token.access_token}`};
const about=await fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)',{headers}).then(r=>r.json());
if(about.user?.emailAddress!=='th990821@mail.thps.ntpc.edu.tw')throw Error('school_account_mismatch');
const manifest=JSON.parse(await readFile(`${dir}/upload-manifest.json`,'utf8'));
let saved;try{saved=JSON.parse(await readFile(`${dir}/manifest.json`,'utf8'));}catch{}
let folderId=saved?.folderId;
if(!folderId){
 const r=await fetch('https://www.googleapis.com/drive/v3/files?fields=id',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({name:'考前練功房_圖片送圖測試_20261027',mimeType:'application/vnd.google-apps.folder',appProperties:{quizMediaPoc:'20261027'}})});
 const data=await r.json();if(!r.ok||!data.id)throw Error('folder_create_failed');folderId=data.id;
}
const output={email:about.user.emailAddress,folderId,workerOrigin:'https://dingxi-quiz-drive-poc.nblm-book-audio.workers.dev',assets:saved?.assets||{}};
await writeFile(`${dir}/manifest.json`,JSON.stringify(output,null,2),'utf8');
for(const [hash,a] of Object.entries(manifest.assets)){
 if(output.assets[hash]?.verified)continue;
 const bytes=await readFile(a.localFile);if(createHash('sha256').update(bytes).digest('hex')!==hash)throw Error('local_image_changed');
 const boundary='quizmedia'+crypto.randomUUID().replaceAll('-','');
 const metadata={name:hash+'.png',parents:[folderId],appProperties:{quizMediaPoc:'20261027',sha256:hash}};
 const body=Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${a.mime}\r\n\r\n`),bytes,Buffer.from(`\r\n--${boundary}--\r\n`)]);
 const r=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,mimeType,size,permissions(id,type,role)',{method:'POST',headers:{...headers,'Content-Type':`multipart/related; boundary=${boundary}`},body});
 const data=await r.json();if(!r.ok||!data.id||data.permissions?.some(p=>p.type==='anyone'))throw Error('private_upload_failed');
 output.assets[hash]={fileId:data.id,mime:a.mime,bytes:a.bytes,roles:a.roles};
 await writeFile(`${dir}/manifest.json`,JSON.stringify(output,null,2),'utf8');
 const raw=await fetch(`https://www.googleapis.com/drive/v3/files/${data.id}?alt=media`,{headers});
 const back=Buffer.from(await raw.arrayBuffer());if(!raw.ok||createHash('sha256').update(back).digest('hex')!==hash)throw Error('uploaded_integrity_failed');
 output.assets[hash].verified=true;await writeFile(`${dir}/manifest.json`,JSON.stringify(output,null,2),'utf8');
}
console.log(JSON.stringify({email:output.email,privateImages:Object.keys(output.assets).length,bytes:Object.values(output.assets).reduce((s,a)=>s+a.bytes,0),originalHashesVerified:true}));
