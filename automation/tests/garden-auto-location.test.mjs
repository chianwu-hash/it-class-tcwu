import test from 'node:test';import assert from 'node:assert/strict';
import {startAutomaticLocation} from '../../shared/garden-auto-location.mjs';
function fixture(state){const permission=new EventTarget();permission.state=state;let geo=0,school=0,point='school',locating=false;const controller={locate(){geo++;locating=true},school(){school++;point='school';locating=false},snapshot:()=>({point:{id:point},locating})};return {permission,controller,permissions:{query:async q=>{assert.equal(q.name,'geolocation');return permission}},counts:()=>({geo,school}),change(s){permission.state=s;permission.dispatchEvent(new Event('change'))},resolved(){locating=false;point='nearby:25.02,121.52'}}}
test('首次 prompt 請求定位、既有 granted 直接定位、denied 不再詢問；無 Permissions API 由定位原生處理',async()=>{
 for(const state of ['granted','prompt','denied']){const f=fixture(state),a=startAutomaticLocation(f.controller,{permissions:f.permissions});await a.ready;assert.equal(f.counts().geo,state==='denied'?0:1);a.destroy()}
 for(const permissions of [{},{query:async()=>{throw Error('unsupported')}}]){const f=fixture('granted'),a=startAutomaticLocation(f.controller,{permissions});await a.ready;assert.equal(f.counts().geo,1);a.destroy()}
});
test('允許後切所在地；撤銷時取消定位並回學校；離頁後忽略權限變化',async()=>{
 const f=fixture('denied'),a=startAutomaticLocation(f.controller,{permissions:f.permissions});await a.ready;f.change('granted');assert.equal(f.counts().geo,1);f.change('denied');assert.equal(f.counts().school,1);f.change('granted');f.resolved();f.change('denied');assert.equal(f.counts().school,2);a.destroy();f.change('granted');assert.equal(f.counts().geo,2);
});
test('離頁早於權限回應，不呼叫定位也不留下監聽',async()=>{
 const f=fixture('granted');let resolve;const a=startAutomaticLocation(f.controller,{permissions:{query:()=>new Promise(r=>resolve=r)}});a.destroy();resolve(f.permission);await a.ready;f.change('granted');assert.equal(f.counts().geo,0);
});
