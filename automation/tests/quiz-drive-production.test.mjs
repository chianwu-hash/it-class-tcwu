import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash, randomBytes} from 'node:crypto';
import {createHandler} from '../../supabase/functions/quiz-media/handler.mjs';
import {handleMedia, resetTokenCache} from '../workers/quiz-drive-media/worker.mjs';

const origin='https://it-class-tcwu.vercel.app', base='https://test.supabase.co';
const bytes=Buffer.from('production-original'), hash=createHash('sha256').update(bytes).digest('hex');
const user='11111111-1111-4111-8111-111111111111', url=`https://quiz-media.invalid/${user}/${hash}`;
const asset={url,object_path:`${user}/${hash}`,mime:'image/png',bytes:bytes.length};
const secret=randomBytes(32).toString('base64url');
const config={SUPABASE_URL:base,SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'server-only',QUIZ_ALLOWED_ORIGINS:origin,
  QUIZ_IMAGE_BACKEND:'drive',QUIZ_DRIVE_ORIGIN:'https://dingxi-quiz-drive-library.nblm-book-audio.workers.dev',QUIZ_DRIVE_TICKET_KEY:secret};
const request=(body={action:'read',url,attempt_id:user})=>new Request(`${base}/functions/v1/quiz-media`,{method:'POST',headers:{Origin:origin,Authorization:'Bearer student','Content-Type':'application/json'},body:JSON.stringify(body)});
function setup({allowed=true,audio=false,configuration=config}={}) {
  const calls=[];
  const handler=createHandler({env:k=>configuration[k],fetcher:async(u,opts)=>{
    calls.push(u);
    if(u.endsWith('/auth/v1/user'))return Response.json({id:user,email_confirmed_at:'2026-10-27'});
    if(u.endsWith('/rpc/quiz_media_access')) {
      assert.equal(opts.headers.Authorization,'Bearer student');
      assert.deepEqual(JSON.parse(opts.body),{p_url:url,p_attempt:user});
      return Response.json(allowed?{...asset,...(audio?{mime:'audio/wav'}:{})}:{message:'media_unavailable'},{status:allowed?200:403});
    }
    if(audio && u.includes('/object/sign/'))return Response.json({signedURL:'/object/sign/quiz-media/audio?token=test'});
    throw Error('unexpected_storage_or_google_request');
  }});
  return {handler,calls};
}
test('正式端點驗權後只簽圖片票證，Worker依私有白名單取原圖，Supabase不傳圖片',async()=>{
  const {handler,calls}=setup(), response=await handler(request());assert.equal(response.status,200);
  const result=await response.json();assert.equal(new URL(result.url).origin,config.QUIZ_DRIVE_ORIGIN);
  assert.equal(calls.length,2);assert.ok(calls.every(u=>!u.includes('/storage/')));
  resetTokenCache();
  const env={MEDIA_AUDIENCE:'quiz-drive-media-library',MEDIA_TICKET_KEY:secret,ALLOWED_ORIGINS:origin,
    MEDIA_ASSETS:JSON.stringify({[hash]:{fileId:'private-file',mime:asset.mime,bytes:asset.bytes}})};
  const original=await handleMedia(new Request(result.url,{headers:{Origin:origin}}),env,{waitUntil(){}},{cache:null,
    fetcher:async u=>String(u).includes('oauth2')?Response.json({access_token:'only-worker'}):new Response(bytes)});
  assert.equal(original.status,200);assert.deepEqual(Buffer.from(await original.arrayBuffer()),bytes);
  const unknown=await handleMedia(new Request(result.url,{headers:{Origin:origin}}),{...env,MEDIA_ASSETS:'{}'}, {},{fetcher:()=>{throw Error('must_not_fetch');}});
  assert.equal(unknown.status,403);
});
test('未揭答或他人媒體拒絕，錯誤設定不回退Storage，音檔維持原路徑',async()=>{
  const denied=setup({allowed:false});assert.equal((await denied.handler(request())).status,400);assert.equal(denied.calls.length,2);
  const broken=setup({configuration:{...config,QUIZ_DRIVE_TICKET_KEY:''}});assert.equal((await broken.handler(request())).status,400);assert.equal(broken.calls.length,2);
  const audio=setup({audio:true}), r=await audio.handler(request());assert.equal(r.status,200);assert.match((await r.json()).url,/supabase.co\/storage\//);assert.equal(audio.calls.length,3);
  const anonymous=new Request(request());anonymous.headers.delete('Authorization');assert.equal((await setup().handler(anonymous)).status,401);
});
