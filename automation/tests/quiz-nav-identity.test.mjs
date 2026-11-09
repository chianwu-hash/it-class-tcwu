import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../../shared/grade6-nav-identity.js',import.meta.url),'utf8');
const a={id:'synthetic-a',email:'a@example.invalid'},b={id:'synthetic-b',email:'b@example.invalid'};
const row=(user=a)=>({email:user.email,class_code:'307',seat_no:30,display_name:user===a?'合成甲':'合成乙'});
const partial=(user=a)=>({role:'student',email:user.email,grade:3,class_code:'307'});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const flush=async()=>{for(let n=0;n<8;n++)await new Promise(r=>setImmediate(r));};
function fixture({provided=true,lookup=false}={}){
 const el={textContent:a.email,title:'',isConnected:true,removeAttribute(name){this[name]='';}};
 const state={session:{user:a},calls:[],read:async()=>({data:row()}),observer:null,revision:null};
 const context=vm.createContext({
  document:{getElementById:()=>el},window:{addEventListener(){}},
  MutationObserver:class{constructor(fn){state.observer=fn;}observe(){}disconnect(){}},
  resolveSession:async()=>state.session,
  onTestIdentityChange:fn=>{state.revision=fn;},
  supabase:{rpc:async(name,args)=>{state.calls.push({name,args,user:state.session?.user?.id});return state.read();}}
 });
 vm.runInContext(source.replace(/^import .*;\r?\n/gm,'').replaceAll('export function ','function ')+'\nglobalThis.api={provideNavIdentity,initGrade6NavIdentity};',context);
 const api=context.api;
 api.initGrade6NavIdentity({expanded:true,provided,lookup});
 return {...state,el,api,state,provide:(user=a,value=partial(user),fallback=true)=>api.provideNavIdentity({userId:user.id,email:user.email,row:value,lookupIfIncomplete:fallback}),
  switch(user){state.session=user?{user}:null;el.textContent=user?.email||'未登入';el.title='';state.observer();}};
}

test('完整頁面名冊與未 opt-in 的部分資料不加發 RPC',async()=>{
 const f=fixture();f.provide(a,row());await flush();
 assert.equal(f.el.textContent,'307 班 30 號 合成甲');assert.equal(f.state.calls.length,0);
 f.provide(a,partial(),false);await flush();assert.equal(f.state.calls.length,0);
});

test('考古部分身分僅補讀本人，快取可跨 navbar 重建與重複快照沿用',async()=>{
 const f=fixture();f.provide();await flush();
 assert.equal(f.state.calls.length,1);assert.equal(f.state.calls[0].name,'get_my_student_enrollment');
 assert.equal(f.state.calls[0].args.p_school_year,115);
 assert.equal(f.el.textContent,'307 班 30 號 合成甲');assert.match(f.el.title,/a@example.invalid$/);
 f.el.textContent=a.email;f.state.observer();f.api.initGrade6NavIdentity({expanded:true,provided:true});
 f.provide();await flush();assert.equal(f.state.calls.length,1);assert.equal(f.el.textContent,'307 班 30 號 合成甲');
});

test('補讀失敗、空名冊或不同 Email 保留目前 Email，重繪不重試',async()=>{
 for(const result of [()=>Promise.reject(Error('offline')),async()=>({data:null}),async()=>({data:row(b)})]){
  const f=fixture();f.state.read=result;f.provide();await flush();
  assert.equal(f.el.textContent,a.email);assert.equal(f.el.title,'');
  f.api.initGrade6NavIdentity({expanded:true,provided:true});await flush();assert.equal(f.state.calls.length,1);
 }
});

test('舊帳號延遲補讀不得覆蓋新帳號，僅替新頁面身分補讀',async()=>{
 const f=fixture(),wait=deferred();f.state.read=()=>wait.promise;f.provide();await flush();
 f.switch(b);f.state.read=async()=>({data:row(b)});f.provide(b);wait.resolve({data:row(a)});await flush();
 assert.equal(f.el.textContent,'307 班 30 號 合成乙');assert.match(f.el.title,/b@example.invalid$/);
 assert.equal(f.state.calls.length,2);
});

test('登出使延遲名冊失效，不能把未登入改成學生',async()=>{
 const f=fixture(),wait=deferred();f.state.read=()=>wait.promise;f.provide();await flush();
 f.switch(null);wait.resolve({data:row()});await flush();
 assert.equal(f.el.textContent,'未登入');assert.equal(f.state.calls.length,1);
});

test('換帳號但新頁面尚未提供身分時，舊 opt-in 不替新帳號讀名冊',async()=>{
 const f=fixture(),wait=deferred();f.state.read=()=>wait.promise;f.provide();await flush();
 f.switch(b);wait.resolve({data:row()});await flush();
 assert.equal(f.el.textContent,b.email);assert.equal(f.state.calls.length,1);
});

test('年級切換使進行中的補讀失效，不自動回填舊名冊',async()=>{
 const f=fixture(),wait=deferred();f.state.read=()=>wait.promise;f.provide();await flush();
 f.state.revision({userId:a.id});wait.resolve({data:row()});await flush();
 assert.equal(f.el.textContent,a.email);assert.equal(f.state.calls.length,1);
 f.state.read=async()=>({data:{...row(),class_code:'301'}});f.provide();await flush();
 assert.equal(f.el.textContent,'301 班 30 號 合成甲');assert.equal(f.state.calls.length,2);
});

test('同帳號年級切換信號清空快取，等待新的頁面 RPC 後才補讀',async()=>{
 const f=fixture();f.provide();await flush();f.state.revision({userId:a.id});await flush();
 assert.equal(f.el.textContent,a.email);assert.equal(f.state.calls.length,1);
 f.state.read=async()=>({data:{...row(),class_code:'301'}});f.provide();await flush();
 assert.equal(f.el.textContent,'301 班 30 號 合成甲');assert.equal(f.state.calls.length,2);
});

test('更新的完整頁面資料優先於先前尚未完成的 fallback',async()=>{
 const f=fixture(),wait=deferred();f.state.read=()=>wait.promise;f.provide();await flush();
 f.provide(a,{...row(),class_code:'301'});wait.resolve({data:row()});await flush();
 assert.equal(f.el.textContent,'301 班 30 號 合成甲');assert.equal(f.state.calls.length,1);
});

test('原有夥伴 lookup 模式仍只讀一次，後到的 provided initializer 不關閉 lookup',async()=>{
 const f=fixture({lookup:true});await flush();f.api.initGrade6NavIdentity({expanded:true,provided:true});await flush();
 assert.equal(f.el.textContent,'307 班 30 號 合成甲');assert.equal(f.state.calls.length,1);
});
