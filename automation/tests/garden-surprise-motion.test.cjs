const test=require('node:test'),assert=require('node:assert/strict');
const S=require('../../garden/src/garden-pet-surprise-v1.js');
const C=require('../../garden/src/garden-cat-homes-v6.js');
const P=require('../../garden/src/garden-pets-homes-v6.js');
const V=require('../../garden/src/garden-pets-v2.js');
const manifest=require('../../garden/assets/processed/pet-homes-v2/manifest.json');
for(const species of ['cat','dog','rabbit'])test(species+' surprise hands off without position jump, return twice as fast',()=>{
 function simulate(speed){
  const sp=S.create({species,surpriseFrames:3});assert(sp.start({canEnter:true}).ok);
  let t=0;while(sp.phase()!=='handoff'&&t<4000){sp.update(10);t+=10}
  assert.equal(sp.phase(),'handoff');assert.equal(sp.pose().x,764);assert.equal(sp.pose().layer,'behind');
  let ctrl;
  if(species==='cat')ctrl=C.create({opening:{left:690,right:800,topAt:()=>520,bottomAt:()=>680,cabinLeft:605,cabinRight:865,cabinBase:680}});
  else {const h=manifest.homes[species];ctrl=P.create(species,'surprise-test',{v2:S.wrapV2(V,()=>sp),available:Object.keys(P.GROUPS).concat(['walk','stand','sniff','turn','hop','ears']),home:h.cabin,homeFrame:h.frame,weather:'thunder'})}
  let elapsed=0,first;
  for(;elapsed<30000;elapsed+=10){
   if(species==='cat')ctrl.update(10*speed,{wet:true,normal:sp.handoffNormal(0)});else ctrl.update(10*speed);
   const p=ctrl.pose(),snap=ctrl.snapshot();
   if(!first&&p){first=p;assert(Math.abs(p.x-764)<1);assert.equal(p.layer,'behind')}
   if(sp.phase()==='handoff'&&p)sp.finish();
   if(snap.mode==='inside'||['lazy','sleep','lazyAgain'].includes(snap.phase)){assert.equal(sp.controllerDtScale(snap),1);assert.equal(sp.phase(),'done');return elapsed+10}
  }
  assert.fail('did not enter home');
 }
 const normal=simulate(1),fast=simulate(2);assert(Math.abs(fast/normal-.5)<.04,{normal,fast});
});
test('missing art and reduced motion never start a surprise',()=>{
 for(const species of ['cat','dog','rabbit']){
  assert.equal(S.create({species,surpriseFrames:0}).start({}).ok,false);
  assert.equal(S.create({species,surpriseFrames:3}).start({reduced:true}).ok,false);
 }
});
