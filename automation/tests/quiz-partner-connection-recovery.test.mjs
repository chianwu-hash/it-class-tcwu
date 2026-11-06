import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../../shared/partner-pilot/app.mjs',import.meta.url),'utf8');
function harness(fail=false){
 const flags=[],events=[];
 const c=vm.createContext({flags,events,fail,learning:{setTransport:v=>flags.push(v)},rpc:async()=>{if(fail)throw Error('offline');return{id:'room',topic:'topic'};},accept:async()=>events.push('accepted'),status:()=>{},setTimeout:()=>1,$:()=>null,heldRevision:()=>false,sb:{removeChannel:async()=>{},channel:()=>({on(){return this;},subscribe(fn){c.callback=fn;}})}});
 vm.runInContext("let generation=0,room={id:'room',topic:'topic'},refreshing=false,again=false,subscriptionSerial=0,channel=null,topic=null,recoveryCount=0,recoveryTimer=null;"+['refresh','subscribe'].map(n=>source.match(new RegExp('^async function '+n+'\\(.*$','m'))[0]).join('\n'),c);
 return {flags,events,call:s=>vm.runInContext(s,c),callback:s=>c.callback(s)};
}
test('successful snapshot clears fetch failure without pretending realtime connected',async()=>{const h=harness();assert.equal(await h.call('refresh()'),true);assert.deepEqual(h.events,['accepted']);assert.equal(h.flags.at(-1).refreshBad,false);assert.ok(h.flags.every(x=>!Object.hasOwn(x,'syncBad')));});
test('failed snapshot exposes recovery without writing answers',async()=>{const h=harness(true);assert.equal(await h.call('refresh()'),undefined);assert.equal(h.flags.at(-1).refreshBad,true);assert.deepEqual(h.events,[]);});
test('realtime error and subscription recovery toggle only connection state',async()=>{const h=harness();await h.call('subscribe(room)');h.callback('CHANNEL_ERROR');assert.equal(h.flags.at(-1).syncBad,true);h.callback('SUBSCRIBED');assert.ok(h.flags.some(x=>x.syncBad===false));});
