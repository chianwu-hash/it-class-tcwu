import test from 'node:test';import assert from 'node:assert/strict';
import {createHandler} from '../../supabase/functions/quiz-media/handler.mjs';
const id='00000000-0000-4000-8000-000000000001',url='https://quiz-media.invalid/'+id+'/'+'a'.repeat(64);
test('課本只簽私有Drive票證，不進Storage；授權參數與版本原樣送驗',async()=>{
 const calls=[],env={SUPABASE_URL:'https://db.invalid',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',QUIZ_ALLOWED_ORIGINS:'http://localhost:8880',QUIZ_IMAGE_BACKEND:'drive',QUIZ_DRIVE_ORIGIN:'https://dingxi-quiz-drive-library.nblm-book-audio.workers.dev',QUIZ_DRIVE_TICKET_KEY:Buffer.alloc(32,1).toString('base64url')};
 let backend='drive';const handler=createHandler({env:k=>env[k],fetcher:async(target,options)=>{
  calls.push({target,options});if(target.endsWith('/auth/v1/user'))return Response.json({id,email_confirmed_at:'2026-11-09'});
  assert.ok(target.endsWith('/rpc/quiz_textbook_media_access'));return Response.json({url,backend,mime:'image/webp',bytes:100});
 }});
 const req=()=>new Request('https://edge.invalid',{method:'POST',headers:{Origin:'http://localhost:8880',Authorization:'Bearer synthetic'},body:JSON.stringify({action:'textbook',url,kind:'past',attempt_id:id,version_id:id})});
 const response=await handler(req());assert.equal(response.status,200);const ticket=(await response.json()).url;assert.ok(ticket.startsWith(env.QUIZ_DRIVE_ORIGIN+'/media/'));
 assert.deepEqual(JSON.parse(calls[1].options.body),{p_kind:'past',p_attempt:id,p_version:id,p_url:url});assert.ok(!calls.some(c=>c.target.includes('/storage/')));
 backend='supabase';assert.equal((await handler(req())).status,400);
 backend='drive';env.QUIZ_IMAGE_BACKEND='supabase';assert.equal((await handler(req())).status,400);assert.ok(!calls.some(c=>c.target.includes('/storage/')));
 const anonymous=new Request('https://edge.invalid',{method:'POST',body:'{}'});assert.equal((await handler(anonymous)).status,401);
});

test('registered past images use Drive after normal attempt authorization',async()=>{
 const hash='a'.repeat(64),calls=[];
 const env={SUPABASE_URL:'https://db.invalid',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',
  QUIZ_ALLOWED_ORIGINS:'http://localhost:8880',QUIZ_IMAGE_BACKEND:'drive',
  QUIZ_DRIVE_ORIGIN:'https://dingxi-quiz-drive-library.nblm-book-audio.workers.dev',
  QUIZ_DRIVE_TICKET_KEY:Buffer.alloc(32,1).toString('base64url')};
 const req=()=>new Request('https://edge.invalid',{method:'POST',headers:{Origin:'http://localhost:8880',Authorization:'Bearer synthetic'},
  body:JSON.stringify({action:'read',url,attempt_id:id})});
 let asset={url,backend:'supabase',object_path:'drive-past/'+hash,mime:'image/webp',bytes:120};
 let deny=false;
 const handler=createHandler({env:k=>env[k],fetcher:async(target,options)=>{
  calls.push({target,options});
  if(target.endsWith('/auth/v1/user'))return Response.json({id,email_confirmed_at:'2026-11-09'});
  if(target.endsWith('/rpc/quiz_media_access'))return deny?Response.json({message:'media_unavailable'},{status:400}):Response.json(asset);
  assert(target.startsWith('https://db.invalid/storage/v1/object/sign/quiz-media/'));
  return Response.json({signedURL:'/object/sign/quiz-media/legacypath?token=synthetic'});
 }});
 const drive=await handler(req());
 assert.equal(drive.status,200);
 assert((await drive.json()).url.startsWith(env.QUIZ_DRIVE_ORIGIN+'/media/'+hash+'?ticket='));
 assert.deepEqual(JSON.parse(calls[1].options.body),{p_url:url,p_attempt:id});
 assert.equal(calls.length,2);
 deny=true;
 assert.equal((await handler(req())).status,400);
 deny=false;
 env.QUIZ_IMAGE_BACKEND='supabase';
 assert.equal((await handler(req())).status,400);
 env.QUIZ_IMAGE_BACKEND='drive';
 asset={...asset,mime:'audio/mpeg'};
 assert((await handler(req())).status>=400);
 asset={...asset,mime:'image/webp',object_path:'drive-past/'+'b'.repeat(64)};
 assert((await handler(req())).status>=400);
 assert(!calls.some(({target})=>target.includes('/storage/')));
 for(const mime of ['image/png','audio/mpeg']){
  asset={...asset,mime,object_path:'legacypath'};
  assert.equal((await handler(req())).status,200);
  assert(calls.at(-1).target.includes('/storage/'));
 }
});
