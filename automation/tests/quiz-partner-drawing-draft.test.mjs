import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../../shared/partner-pilot/app.mjs',import.meta.url),'utf8');
function harness(failures=0){
 const events=[],bodies=[];let remain=failures;
 const c=vm.createContext({crypto:{randomUUID:()=>String(bodies.length)+'-request'},events,bodies,
  status:()=>{},controls:()=>{},renderPending:()=>{},renderRoom:()=>{},refresh:async()=>{},
  clearChannel:async()=>events.push('channel'),loadMe:async()=>true,home:()=>events.push('home'),
  accept:async()=>events.push('accept'),learning:{committed:()=>events.push('committed'),clear:()=>events.push('clear')},
  rpc:async p=>{bodies.push(structuredClone(p));if(remain-->0){const e=Error('offline');e.transient=true;throw e;}return {id:'room',revision:2};}});
 vm.runInContext("let pending=null,pendingSaveExit=true,busy=false,generation=0,room={id:'room'};"+['mutate','dispatchPending','sendPending'].map(name=>source.match(new RegExp('^async function '+name+'\\(.*$','m'))[0]).join('\n'),c);
 return {events,bodies,call:code=>vm.runInContext(code,c)};
}
test('save draft here stays in room and does not put UI options in RPC',async()=>{const h=harness();const r=await h.call("mutate({action:'save_draft',roomId:'room',state:{media:{}}},{stay:true})");assert.equal(r.ok,true);assert.deepEqual(h.events,['committed','accept']);assert.equal(h.bodies[0].stay,undefined);});
test('lost response retry keeps same request and stay-on-page intent',async()=>{const h=harness(1);const failed=await h.call("mutate({action:'save_draft',roomId:'room',state:{media:{}}},{stay:true})");assert.equal(failed.ok,false);assert.equal(failed.pending,true);const ok=await h.call('sendPending()');assert.equal(ok.ok,true);assert.equal(h.bodies[0].requestId,h.bodies[1].requestId);assert.deepEqual(h.events,['committed','accept']);});
test('existing save and exit still clears room and returns home',async()=>{const h=harness();const r=await h.call("mutate({action:'save_draft',roomId:'room',state:{media:{}}})");assert.equal(r.ok,true);assert.deepEqual(h.events,['committed','clear','channel','home']);});
