import test from 'node:test';
import assert from 'node:assert/strict';
test('診斷事件批次持久化，離頁同步保留，沒有逐事件寫入',async()=>{
 const names=['window','document','sessionStorage','location','navigator'],saved=names.map(k=>Object.getOwnPropertyDescriptor(globalThis,k));
 const listeners=new Map();let writes=0,value;
 try{
  for(const [key,item] of Object.entries({window:{addEventListener:(k,f)=>listeners.set(k,f)},document:{readyState:'loading',hidden:true,visibilityState:'hidden',addEventListener:(k,f)=>listeners.set(k,f)},sessionStorage:{getItem:()=>null,setItem:(_k,v)=>{writes++;value=JSON.parse(v);}},location:{hostname:'localhost',pathname:'/quiz.html'},navigator:{onLine:true}}))Object.defineProperty(globalThis,key,{configurable:true,value:item});
  const diagnostics=await import('../../shared/connection-diagnostics.mjs?batch-test');
  for(let i=0;i<80;i++)diagnostics.diagnoseStep('probe')();
  assert.equal(writes,0);await new Promise(r=>setTimeout(r,1100));assert.equal(writes,1);assert.equal(value.events.length,161);
  diagnostics.diagnoseResult('offline');listeners.get('visibilitychange')();assert.equal(writes,2);assert.equal(value.events.at(-1).phase,'visibility');
  listeners.get('pagehide')();
 }finally{for(const [i,name] of names.entries())if(saved[i])Object.defineProperty(globalThis,name,saved[i]);else delete globalThis[name];}
});
