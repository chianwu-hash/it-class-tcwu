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
