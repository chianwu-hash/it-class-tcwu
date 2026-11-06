import test from 'node:test';import assert from 'node:assert/strict';
import {paintPartnerKeepsake} from '../../shared/quiz-partner-rewards.mjs';
import {bindRewardHover} from '../../shared/reward-source-colors.mjs';
import {createAwardTracker} from '../../shared/partner-pilot/outcome-model.mjs';
test('manual celebration replay accepts server-owned existing award without minting another award',()=>{
 const a={id:'award',leaves:1,flowers:0,earnedHere:true},r={id:'room',exercise:{finished:true,award:a}},viewer={id:'me'},t=createAwardTracker();assert.equal(t.update(r,viewer),null);
 const before=JSON.stringify(r);assert.equal(t.replay(r,viewer).replay,true);assert.equal(t.update(r,viewer).leaves,1);assert.equal(JSON.stringify(r),before);t.dismiss();assert.equal(t.update(r,viewer),null);
 r.exercise.finished=false;assert.equal(t.replay(r,viewer),null);
});
test('canvas partner leaf and flower preserve distinctive gold outline; ordinary rewards are untouched',()=>{
 const old=globalThis.Path2D;globalThis.Path2D=class {constructor(path){this.path=path}};
 try{for(const kind of ['quiz-leaf','flower']){const calls=[],ctx=new Proxy({},{get:(o,k)=>o[k]??((...args)=>calls.push([k,...args])),set:(o,k,v)=>(o[k]=v,true)});assert(paintPartnerKeepsake(ctx,10,20,36,{sourceType:'partner',kind}));assert.equal(ctx.strokeStyle,'#b88632');assert(calls.some(x=>x[0]==='fill'));assert.equal(calls.filter(x=>x[0]==='save').length,calls.filter(x=>x[0]==='restore').length);}
 const ctx={};assert.equal(paintPartnerKeepsake(ctx,0,0,36,{kind:'flower',sourceType:'past_exam'}),false);assert.deepEqual(ctx,{});
 }finally{globalThis.Path2D=old;}
});
test('second-level hover shows reward source and leaves touch click behavior unchanged',()=>{
 const handlers={},canvas={title:'',style:{cursor:''},addEventListener:(k,fn)=>handlers[k]=fn};let hit=true;
 bindRewardHover(canvas,()=>hit?{title:'夥伴練功・合成題組 紀念葉'}:null);handlers.pointermove({pointerType:'mouse'});assert.match(canvas.title,/合成題組/);assert.equal(canvas.style.cursor,'pointer');hit=false;handlers.pointermove({pointerType:'mouse'});assert.equal(canvas.title,'');
 hit=true;handlers.pointermove({pointerType:'touch'});assert.equal(canvas.title,'');handlers.pointermove({pointerType:'mouse'});handlers.pointerleave();assert.equal(canvas.title,'');assert(!handlers.click);
});
