import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac,randomBytes} from 'node:crypto';
import {handleMedia,resetTokenCache} from '../workers/quiz-drive-media/worker.mjs';
const bytes=Buffer.from('test-image-bytes'),hash=createHash('sha256').update(bytes).digest('hex'),key=randomBytes(32);
const asset={fileId:'only-approved-image',mime:'image/png',bytes:bytes.length};
const env={MEDIA_TICKET_KEY:key.toString('base64url'),MEDIA_ASSETS:JSON.stringify({[hash]:asset}),ALLOWED_ORIGINS:'http://127.0.0.1:4350',DRIVE_CLIENT_ID:'test-client',DRIVE_CLIENT_SECRET:'test-secret',DRIVE_REFRESH_TOKEN:'test-refresh'};
function ticket(change={}){const body=Buffer.from(JSON.stringify({aud:'quiz-drive-media-poc',hash,...asset,role:'explanation',exp:Math.floor(Date.now()/1000)+300,...change})).toString('base64url');return body+'.'+createHmac('sha256',key).update(body).digest('base64url');}
const req=t=>new Request(`https://example.workers.dev/media/${hash}${t?'?ticket='+t:''}`,{headers:{Origin:env.ALLOWED_ORIGINS}});
test('reject missing/forged/expired/mismatched tickets before touching Drive or cache',async()=>{
 for(const t of ['',ticket({exp:1}),ticket({fileId:'other-file'}),ticket().slice(0,-5)+'wrong',ticket({hash:'0'.repeat(64)})]){
  let calls=0;const r=await handleMedia(req(t),env,{}, {fetcher:()=>{calls++;throw Error();},cache:{match(){calls++;}}});
  assert.ok([401,403].includes(r.status));assert.equal(calls,0);
 }
});
test('private approved original fetched from Drive, verified and cached; warm read still requires ticket',async()=>{
 resetTokenCache();let reads=0;let stored;const tasks=[];
 const cache={match:async()=>stored?.clone(),put:async(_,r)=>{stored=r;}};
 const fetcher=async(url,options)=>{
  assert.ok(!String(url).includes('supabase'));
  if(String(url).includes('oauth2'))return Response.json({access_token:'memory-only',expires_in:3600});
  reads++;assert.equal(options.headers.Authorization,'Bearer memory-only');return new Response(bytes);
 };
 const first=await handleMedia(req(ticket()),env,{waitUntil:p=>tasks.push(p)},{fetcher,cache});
 assert.equal(first.status,200);assert.equal(first.headers.get('X-Quiz-Cache'),'MISS');assert.equal(first.headers.get('Cache-Control'),'private, no-store');assert.deepEqual(Buffer.from(await first.arrayBuffer()),bytes);await Promise.all(tasks);
 const next=await handleMedia(req(ticket()),env,{}, {fetcher,cache});assert.equal(next.headers.get('X-Quiz-Cache'),'HIT');assert.equal(reads,1);
 const denied=await handleMedia(req(''),env,{}, {fetcher,cache});assert.equal(denied.status,401);
});
test('fail closed on modified upstream content and disallowed Origin',async()=>{
 resetTokenCache();
 const bad=await handleMedia(req(ticket()),env,{}, {fetcher:async url=>String(url).includes('oauth2')?Response.json({access_token:'x'}):new Response(Buffer.alloc(bytes.length)),cache:null});assert.equal(bad.status,502);
 const denied=await handleMedia(new Request(req(ticket()),{headers:{Origin:'https://untrusted.invalid'}}),env);assert.equal(denied.status,403);
});
test('Google media redirect stays on approved HTTPS hosts and never forwards bearer to content host',async()=>{
 resetTokenCache();const seen=[];
 const r=await handleMedia(req(ticket()),env,{waitUntil(){}},{cache:null,fetcher:async(url,options)=>{
  if(String(url).includes('oauth2'))return Response.json({access_token:'private-google-token'});
  seen.push([String(url),options.headers.Authorization]);
  return String(url).includes('www.googleapis.com')?new Response(null,{status:302,headers:{Location:'https://test.googleusercontent.com/download'}}):new Response(bytes);
 }});
 assert.equal(r.status,200);assert.equal(seen[0][1],'Bearer private-google-token');assert.equal(seen[1][1],undefined);
 resetTokenCache();const denied=await handleMedia(req(ticket()),env,{}, {cache:null,fetcher:async url=>String(url).includes('oauth2')?Response.json({access_token:'x'}):new Response(null,{status:302,headers:{Location:'https://attacker.invalid/'}})});assert.equal(denied.status,502);
});
