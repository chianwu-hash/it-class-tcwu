import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';

test('同一開關關閉接收端：舊頁面回傳正常204且不寫日誌，來源限制保留',async()=>{
 const require=createRequire(import.meta.url),handler=require('../../api/quiz-diagnostics.js');let logs=0;const log=console.log;
 const response=()=>({code:null,ended:false,setHeader(){},status(code){this.code=code;return this;},end(){this.ended=true;return this;}});
 try{
  console.log=()=>logs++;
  const res=response();await handler({method:'POST',headers:{origin:'https://it-class-tcwu.vercel.app'},body:{release:'20261029-load-batch3',events:[{phase:'probe'}]}},res);
  assert.equal(res.code,204);assert.equal(res.ended,true);assert.equal(logs,0);
  const denied=response();await handler({method:'POST',headers:{origin:'https://example.invalid'}},denied);assert.equal(denied.code,403);
 }finally{console.log=log;}
});

test('偵錯預設關閉：沒有儲存、監聽、計時器、UUID、診斷回傳，原請求與錯誤照常傳遞',async()=>{
 const names=['window','document','sessionStorage','location','navigator','setTimeout','setInterval','performance','crypto','fetch'],saved=names.map(k=>Object.getOwnPropertyDescriptor(globalThis,k));
 const unexpected=()=>{throw Error('disabled_diagnostics_side_effect');};
 try{
  const values={window:{addEventListener:unexpected},document:{addEventListener:unexpected},sessionStorage:{getItem:unexpected,setItem:unexpected},location:{hostname:'it-class-tcwu.vercel.app',pathname:'/grade3/115-1/quiz.html'},navigator:{},setTimeout:unexpected,setInterval:unexpected,performance:{now:unexpected},crypto:{randomUUID:unexpected},fetch:unexpected};
  for(const [key,value] of Object.entries(values))Object.defineProperty(globalThis,key,{configurable:true,value});
  const diagnostics=await import('../../shared/connection-diagnostics.mjs?off-test');
  assert.equal(diagnostics.DIAGNOSTICS_ENABLED,false);
  for(let i=0;i<100;i++){diagnostics.diagnoseStep('probe')();diagnostics.diagnoseResult('error');}
  await diagnostics.flushDiagnostics();assert.deepEqual(diagnostics.exportDiagnostics().events,[]);assert.equal(diagnostics.exportDiagnostics().enabled,false);
  const response={ok:true},fetcher=async()=>response;assert.equal(diagnostics.diagnosticFetch(fetcher),fetcher);assert.equal(await diagnostics.diagnosticFetch(fetcher)('https://upxgyusodibaqcrocdzj.supabase.co/rest/v1/rpc/quiz_action'),response);
  const failure=Error('network_failure'),failed=async()=>{throw failure;};await assert.rejects(diagnostics.diagnosticFetch(failed)(),error=>error===failure);
 }finally{for(const [i,name] of names.entries())if(saved[i])Object.defineProperty(globalThis,name,saved[i]);else delete globalThis[name];}
});
test('診斷事件批次持久化，離頁同步保留，沒有逐事件寫入',async()=>{
 const names=['window','document','sessionStorage','location','navigator'],saved=names.map(k=>Object.getOwnPropertyDescriptor(globalThis,k));
 const listeners=new Map();let writes=0,value;
 try{
  for(const [key,item] of Object.entries({window:{addEventListener:(k,f)=>listeners.set(k,f)},document:{readyState:'loading',hidden:true,visibilityState:'hidden',addEventListener:(k,f)=>listeners.set(k,f)},sessionStorage:{getItem:()=>null,setItem:(_k,v)=>{writes++;value=JSON.parse(v);}},location:{hostname:'localhost',pathname:'/quiz.html'},navigator:{onLine:true}}))Object.defineProperty(globalThis,key,{configurable:true,value:item});
  // Exercise the real module with only its explicit deployment switch enabled.
  const source=await readFile(new URL('../../shared/connection-diagnostics.mjs',import.meta.url),'utf8');assert.match(source,/export const DIAGNOSTICS_ENABLED = false;/);
  const diagnostics=await import('data:text/javascript,'+encodeURIComponent(source.replace('export const DIAGNOSTICS_ENABLED = false;','export const DIAGNOSTICS_ENABLED = true;')));
  assert.equal(diagnostics.DIAGNOSTICS_ENABLED,true);
  for(let i=0;i<80;i++)diagnostics.diagnoseStep('probe')();
  assert.equal(writes,0);await new Promise(r=>setTimeout(r,1100));assert.equal(writes,1);assert.equal(value.events.length,161);
  diagnostics.diagnoseResult('offline');listeners.get('visibilitychange')();assert.equal(writes,2);assert.equal(value.events.at(-1).phase,'visibility');
  listeners.get('pagehide')();
 }finally{for(const [i,name] of names.entries())if(saved[i])Object.defineProperty(globalThis,name,saved[i]);else delete globalThis[name];}
});
