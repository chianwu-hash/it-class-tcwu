import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,createHmac} from 'node:crypto';
import {createDriveTicketHandler} from '../lib/quiz-drive-ticket-handler.mjs';
const hash='a'.repeat(64),uid='00000000-0000-4000-8000-000000000001',attempt='00000000-0000-4000-8000-000000000002';
const url=`https://quiz-media.invalid/${uid}/${hash}`,origin='http://localhost:3000',key=randomBytes(32).toString('base64url');
const asset={url,mime:'image/png',bytes:10},image={fileId:'approved-google-file',mime:'image/png',bytes:10,verified:true};
const config={supabaseUrl:'https://upxgyusodibaqcrocdzj.supabase.co',publishableKey:'public-key',manifest:{workerOrigin:'https://library.example.workers.dev',audience:'quiz-drive-media-library',assets:{[hash]:image}},ticketKey:key,origins:[origin]};
const req=(body={action:'read',url,attempt_id:attempt},headers={})=>new Request(origin+'/__quiz-drive-media',{method:'POST',headers:{Origin:origin,Authorization:'Bearer student-token',...headers},body:JSON.stringify(body)});
test('signed image capability follows real Auth and exact existing visibility RPC; no Storage or service key',async()=>{
 const calls=[];const handler=createDriveTicketHandler({...config,fetcher:async(target,options)=>{calls.push([target,options]);assert.equal(options.headers.Authorization,'Bearer student-token');assert.equal(options.headers.apikey,'public-key');return target.endsWith('/user')?Response.json({id:uid,email_confirmed_at:'2026-01-01'}):Response.json(asset);}});
 const r=await handler(req());assert.equal(r.status,200);const result=await r.json(),p=new URL(result.url).searchParams.get('ticket').split('.');
 const cap=JSON.parse(Buffer.from(p[0],'base64url'));assert.equal(cap.hash,hash);assert.equal(cap.fileId,image.fileId);assert.ok(cap.exp<=Date.now()/1000+301);
 assert.equal(p[1],createHmac('sha256',Buffer.from(key,'base64url')).update(p[0]).digest('base64url'));
 assert.deepEqual(JSON.parse(calls[1][1].body),{p_url:url,p_attempt:attempt});assert.equal(calls.length,2);assert.ok(calls.every(([url])=>!url.includes('/storage/')));
});
test('anonymous, invalid origin, invalid body denied before Google/Storage access',async()=>{
 const handler=createDriveTicketHandler({...config,fetcher:()=>{throw Error('must_not_call');}});
 assert.equal((await handler(req(undefined,{Authorization:''}))).status,401);
 assert.equal((await handler(req(undefined,{Origin:'https://evil.invalid'}))).status,403);
 assert.equal((await handler(req({action:'read',url:'https://evil.invalid',attempt_id:attempt}))).status,400);
});
test('unrevealed or foreign attempt denied by visibility RPC; never signs on RPC failure',async()=>{
 const handler=createDriveTicketHandler({...config,fetcher:async target=>target.endsWith('/user')?Response.json({id:uid,email_confirmed_at:'x'}):Response.json({message:'media_unavailable'},{status:400})});
 const r=await handler(req());assert.equal(r.status,403);assert.ok(!(await r.text()).includes('ticket='));
});
test('expired login and unexpected asset metadata fail closed',async()=>{
 for(const returned of [null,{...asset,url:'https://other.invalid'},{...asset,bytes:11}]){
  const handler=createDriveTicketHandler({...config,fetcher:async target=>target.endsWith('/user')?(returned?Response.json({id:uid,email_confirmed_at:'x'}):new Response(null,{status:401})):Response.json(returned)});
  assert.ok([401,403,503].includes((await handler(req())).status));
 }
});
test('audio keeps existing Supabase media path; unverified image cannot silently fall back',async()=>{
 const handler=createDriveTicketHandler({...config,fetcher:async target=>target.endsWith('/user')?Response.json({id:uid,email_confirmed_at:'x'}):Response.json({...asset,mime:'audio/mpeg'})});
 assert.deepEqual(await (await handler(req())).json(),{fallback:'supabase'});
 const other=createDriveTicketHandler({...config,manifest:{...config.manifest,assets:{}},fetcher:async target=>target.endsWith('/user')?Response.json({id:uid,email_confirmed_at:'x'}):Response.json(asset)});
 assert.equal((await other(req())).status,503);
});
