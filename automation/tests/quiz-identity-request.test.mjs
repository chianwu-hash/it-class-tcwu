import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,copyFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

test('同帳號換年級：舊 RPC 與媒體作用域失效，新身分請求仍可使用',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'quiz-identity-request-'));
 const keys=['location','document','fetch','localStorage','fixtureSession'];
 const previous=Object.fromEntries(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 try{
  await writeFile(join(dir,'package.json'),JSON.stringify({type:'module'}));
  for(const file of ['quiz-api.mjs','quiz-media.mjs','quiz-transport.mjs','connection-diagnostics.mjs','test-identity-state.mjs'])
   await copyFile(new URL('../../shared/'+file,import.meta.url),join(dir,file));
  await writeFile(join(dir,'auth.js'),`export const SUPABASE_URL='https://fixture.invalid',SUPABASE_ANON_KEY='synthetic';export const supabase={auth:{getSession:async()=>({data:{session:globalThis.fixtureSession}})}};`);
  globalThis.location={hostname:'fixture.invalid'};globalThis.document={querySelector:()=>null};
  const values=new Map();globalThis.localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
  globalThis.fixtureSession={user:{id:'same-user'},access_token:'synthetic'};
 let release,requested,delay=true;
  const started=new Promise(r=>requested=r);
  globalThis.fetch=async()=>{requested();if(delay)await new Promise(r=>release=r);return Response.json({sessions:[],grade:6});};
  const {createQuizRequest}=await import(pathToFileURL(join(dir,'quiz-api.mjs')));
  const {publishTestIdentityChange}=await import(pathToFileURL(join(dir,'test-identity-state.mjs'))+'?v=20261030-identity-sync');
  const request=await createQuizRequest({getSession:()=>globalThis.fixtureSession});
  const scope=request.createMediaScope({user_id:'same-user',attempt_id:'attempt'},{valid:()=>true});
  assert.equal(scope.active(),true);
  const old=request('library_sessions');await started;
  publishTestIdentityChange('same-user');release();
  assert.equal(scope.active(),false);
  await assert.rejects(old,e=>e.code==='identity_changed');
  await assert.rejects(scope.resolve('https://quiz-media.invalid/30000000-0000-4000-8000-000000000009/'+ 'a'.repeat(64)),/身分|媒體|失效/);
  delay=false;
  assert.equal((await request('library_sessions')).grade,6);
 }finally{
  for(const [k,v] of Object.entries(previous))if(v)Object.defineProperty(globalThis,k,v);else delete globalThis[k];
  await rm(dir,{recursive:true,force:true});
 }
});
