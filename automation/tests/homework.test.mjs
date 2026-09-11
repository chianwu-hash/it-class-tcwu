import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, validateFile, resumeOffset, decryptToken } from '../../supabase/functions/homework/handler.mjs';
import { encryptToken } from '../../supabase/functions/drive-connect/handler.mjs';
test('Canva videos over 5 MB accepted, configurable limit and unsafe filenames rejected',()=>{
 validateFile('Canva 作品.mp4',20*1024*1024);validateFile('large.mp4',104857600);
 assert.throws(()=>validateFile('large.mp4',104857601),/file_size/);
 validateFile('large.mp4',104857601,200*1024*1024);
 for(const name of ['../video.mp4','bad.exe','bad\n.mp4','a\\b.mp4'])assert.throws(()=>validateFile(name,100),/file_type/);
 assert.throws(()=>validateFile('zero.mp4',0),/file_size/);
});
test('resumable upload reads authoritative received bytes',()=>{
 assert.equal(resumeOffset(new Response(null,{status:308}),100),0);
 assert.equal(resumeOffset(new Response(null,{status:308,headers:{Range:'bytes=0-41'}}),100),42);
 assert.throws(()=>resumeOffset(new Response(null,{headers:{Range:'bytes=0-101'}}),100),/drive_unavailable/);
});
test('Drive token decrypts only for bound school owner',async()=>{
 const key=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
 const encrypted=await encryptToken('fake-test-token',key,'owner:school');
 assert.equal(await decryptToken(encrypted,key,'owner:school'),'fake-test-token');
 await assert.rejects(decryptToken(encrypted,key,'other:school'));
});
test('Edge rejects wrong origin, unauthenticated requests and forged identities',async()=>{
 const env=n=>({DRIVE_REDIRECT_URI:'https://school.test/admin-drive.html',SUPABASE_URL:'https://db.test',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'service'}[n]);
 let calls=0;const h=createHandler({env,fetcher:async()=>{calls++;return new Response('{}',{status:401});}});
 assert.equal((await h(new Request('https://edge.test',{method:'POST',headers:{Origin:'https://evil.test'}}))).status,403);
 assert.equal(calls,0);
 assert.equal((await h(new Request('https://edge.test',{method:'POST',headers:{Origin:'https://school.test'}}))).status,401);
 assert.equal(calls,0);
 assert.equal((await h(new Request('https://edge.test',{method:'POST',headers:{Origin:'https://school.test',Authorization:'Bearer forged'}}))).status,401);
 assert.equal(calls,1);
});

test('local homework preview passes preflight but still requires login; other origins denied',async()=>{
 const h=createHandler({env:n=>({DRIVE_REDIRECT_URI:'https://school.test/admin-drive.html',SUPABASE_URL:'https://db.test',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'service'}[n]),fetcher:async()=>{throw new Error('Must not access upstream');}});
 for(const origin of ['https://school.test','http://127.0.0.1:8126']) {
  const r=await h(new Request('https://edge.test',{method:'OPTIONS',headers:{Origin:origin}}));
  assert.equal(r.status,204);assert.equal(r.headers.get('Access-Control-Allow-Origin'),origin);
  const denied=await h(new Request('https://edge.test',{method:'POST',headers:{Origin:origin}}));
  assert.equal(denied.status,401);assert.equal(denied.headers.get('Access-Control-Allow-Origin'),origin);
 }
 for(const origin of ['https://evil.test','http://127.0.0.1:8127','http://127.0.0.1:8126.evil.test','null']) {
  const r=await h(new Request('https://edge.test',{method:'OPTIONS',headers:{Origin:origin}}));
  assert.equal(r.status,403);assert.equal(r.headers.get('Access-Control-Allow-Origin'),null);
 }
});

test('real handler proxies resumable chunks, checks hash, survives lost response, finalizes once verified',async()=>{
 const user='00000000-0000-0000-0000-000000000002',owner='00000000-0000-0000-0000-000000000001',id='10000000-0000-0000-0000-000000000001';
 const key=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
 const envelope=await encryptToken('refresh-test',key,`${owner}:th990821@mail.thps.ntpc.edu.tw`);
 const a={id,owner_user_id:owner,drive_folder_id:'folder',max_file_bytes:104857600};
 let u={id,assignment_id:id,user_id:user,drive_file_id:'file',file_name:'canva.mp4',file_size:9*1024*1024,sha256:'a'.repeat(64),expires_at:new Date(Date.now()+86400000).toISOString(),resume_uri:'https://www.googleapis.com/upload/drive/v3/files?upload_id=test'};
 let offset=0,finalized=0,lost=false,validHash=true,dbFailure=false;
 const env=n=>({DRIVE_REDIRECT_URI:'https://school.test/admin-drive.html',SUPABASE_URL:'https://db.test',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_test',DRIVE_TOKEN_KEY:key,DRIVE_CLIENT_ID:'client',DRIVE_CLIENT_SECRET:'secret'}[n]);
 const j=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json'}});
 const h=createHandler({env,fetcher:async(url,opt)=>{
   url=String(url);
   if(url.endsWith('/auth/v1/user'))return j({id:user,email_confirmed_at:'now'});
   if(url.endsWith('/rpc/homework_action'))return j(a);
   if(url.includes('/rest/v1/homework_uploads?'))return j([u]);
   if(url.includes('/rest/v1/drive_connections?'))return j([{token_envelope:envelope,drive_email:'th990821@mail.thps.ntpc.edu.tw'}]);
   if(url==='https://oauth2.googleapis.com/token')return j({access_token:'access-test'});
   if(url.includes('/rpc/homework_finalize')){if(dbFailure)return j({},500);finalized++;return j({ok:true});}
   if(url.includes('/drive/v3/files/file?'))return j({id:'file',size:String(u.file_size),parents:['folder'],appProperties:{homeworkUpload:id},sha256Checksum:validHash?u.sha256:'wrong'});
   if(url.includes('upload_id=test')){
     assert.equal(opt.headers.Authorization,undefined); // one-file session capability; never the teacher's token
     if(opt.headers['Content-Range'].startsWith('bytes */'))return offset===u.file_size?j({id:'file'}):new Response(null,{status:308,headers:offset?{Range:`bytes=0-${offset-1}`}:{}});
     const length=opt.body.size;offset+=length;
     if(!lost){lost=true;throw new Error('lost response after stored bytes');}
     return offset===u.file_size?j({id:'file'}):new Response(null,{status:308,headers:{Range:`bytes=0-${offset-1}`}});
   }
   throw new Error(`Unexpected route ${url}`);
 }});
 const send=async(start)=>{const f=new FormData();f.set('assignment_id',id);f.set('id',id);f.set('offset',String(start));f.set('chunk',new Blob([new Uint8Array(Math.min(4*1024*1024,u.file_size-start))]),'chunk.bin');return h(new Request('https://edge.test',{method:'POST',headers:{Origin:'https://school.test',Authorization:'Bearer student'},body:f}));};
 assert.equal((await send(0)).status,502);assert.equal(offset,4*1024*1024);assert.equal(finalized,0);
 assert.deepEqual(await (await send(0)).json(),{done:false,offset:4*1024*1024});
 assert.equal((await (await send(offset)).json()).offset,8*1024*1024);
 validHash=false;assert.equal((await send(offset)).status,502);assert.equal(finalized,0);
 const resume=()=>h(new Request('https://edge.test',{method:'POST',headers:{Origin:'https://school.test',Authorization:'Bearer student','Content-Type':'application/json'},body:JSON.stringify({action:'resume',assignment_id:id,id})}));
 validHash=true;dbFailure=true;assert.equal((await resume()).status,400);assert.equal(finalized,0);
 dbFailure=false;assert.deepEqual(await (await resume()).json(),{done:true,offset:u.file_size});assert.equal(finalized,1);
 u={...u,user_id:'other',submitted_at:null}; // real query is user scoped; test expiration next
 u.expires_at=new Date(Date.now()-1000).toISOString();assert.equal((await (await resume()).json()).error,'upload_expired');
});
