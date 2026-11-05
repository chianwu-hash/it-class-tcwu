import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createHandler } from '../../supabase/functions/quiz-partner-pilot-media/handler.mjs';
const bytes=Uint8Array.from([137,80,78,71,13,10,26,10]),hash=createHash('sha256').update(bytes).digest('hex');
const room='00000000-0000-4000-8000-000000000001',alias='c'.repeat(64),origin='https://it-class-tcwu.vercel.app';
const source='https://quiz-media.invalid/'+room+'/'+hash;
function fixture({backend='auto',mime='image/png',imageBackend='drive',deny=false,corrupt=false,oversize=false}={}) {
 const calls=[];
 const env=n=>({SUPABASE_URL:'https://example.invalid',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'private',QUIZ_IMAGE_BACKEND:imageBackend,QUIZ_DRIVE_ORIGIN:'https://dingxi-quiz-drive-library.nblm-book-audio.workers.dev',QUIZ_DRIVE_TICKET_KEY:'A'.repeat(43)})[n];
 const handler=createHandler({env,fetcher:async(url,options)=>{
  calls.push({url,options});
  if(url.endsWith('/auth/v1/user'))return Response.json({id:room});
  if(url.includes('/rpc/'))return deny?Response.json({error:'denied'},{status:403}):Response.json({path:'g6-english-u3-20261030-'+hash,mime,bytes:bytes.length,sha256:hash,url:source,backend});
  return new Response(corrupt?new Uint8Array(bytes.length):oversize?new Uint8Array(100):bytes);
 }});
 const request=(headers={})=>new Request('https://example.invalid/media',{method:'POST',headers:{origin,authorization:'Bearer student','content-type':'application/json',...headers},body:JSON.stringify({roomId:room,hash:alias})});
 return {handler,request,calls};
}
test('URL alias differs from content digest; authorized Drive images return original base64 contract',async()=>{
 const f=fixture(),r=await f.handler(f.request());assert.equal(r.status,200);
 assert.deepEqual(await r.json(),{mime:'image/png',base64:Buffer.from(bytes).toString('base64')});
 assert.equal(r.headers.get('cache-control'),'private, no-store');
 const worker=f.calls.at(-1);assert(worker.url.includes('/media/'+hash+'?ticket='));assert.equal(worker.options.headers,undefined);
 assert.equal(worker.options.redirect,'manual');assert.equal(JSON.parse(f.calls[1].options.body).p_hash,alias);
});
test('existing Storage media use source digest and retain service credential at Supabase only',async()=>{
 const f=fixture({backend:'supabase'}),r=await f.handler(f.request());assert.equal(r.status,200);
 assert(f.calls.at(-1).url.startsWith('https://example.invalid/storage/'));assert.equal(f.calls.at(-1).options.headers.Authorization,'Bearer private');
});
test('native audio and native images with Drive disabled retain Storage routing',async()=>{
 for(const opts of [{mime:'audio/mpeg'},{imageBackend:'supabase'}]){
  const f=fixture(opts),r=await f.handler(f.request());assert.equal(r.status,200);assert(f.calls.at(-1).url.includes('/storage/'));
 }
});
test('denied member/unrevealed media never reach storage or Drive',async()=>{
 const f=fixture({deny:true}),r=await f.handler(f.request());assert.equal(r.status,403);assert.equal(f.calls.length,2);
});
test('corrupt and oversized bytes never return image data',async()=>{
 for(const opts of [{corrupt:true},{oversize:true}]){const f=fixture(opts),r=await f.handler(f.request());assert(r.status>=500);assert(!JSON.stringify(await r.json()).includes('base64'));}
});
test('untrusted origins and missing login are rejected before network',async()=>{
 const f=fixture();assert.equal((await f.handler(f.request({origin:'https://evil.invalid'}))).status,403);
 assert.equal((await f.handler(f.request({authorization:''}))).status,401);assert.equal(f.calls.length,0);
});
