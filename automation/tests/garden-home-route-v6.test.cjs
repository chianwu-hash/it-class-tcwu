const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../garden'),C=require(root+'/src/garden-cat-homes-v6.js'),P=require(root+'/src/garden-pets-homes-v6.js'),V=require(root+'/src/garden-pets-v2.js'),G=require(root+'/src/garden-tree-path-v25.js'),Resume=require(root+'/src/garden-cat-roam-resume.js');
const manifest=JSON.parse(fs.readFileSync(root+'/assets/processed/pet-homes-v2/manifest.json'));
const normal={x:316.8,y:749.1,facing:1,safe:true,behind:false,planT:0};
function make(sp,h){const g=P.homeGeometry(h.cabin,h.frame);return sp==='cat'?C.create({diagonal:true,opening:{left:Math.max(g.opening[0].x,g.opening[3].x),right:Math.min(g.opening[1].x,g.opening[2].x),topAt:g.topAt,bottomAt:g.bottomAt,cabinLeft:g.rect.x,cabinRight:g.rect.x+g.rect.w,cabinBase:h.frame.base,insideOffsetX:h.frame.insideOffsetX||0}}):P.create(sp,303,{available:[...Object.keys(V.GROUPS[sp]),...Object.keys(P.GROUPS),'rear3qwalk','front3qwalk'],home:h.cabin,homeFrame:h.frame});}
function step(c,sp,wet){if(sp==='cat')c.update(16,{wet,normal});else{c.setWeather(wet?'downpour':'day');c.update(16);}}
function inside(c,sp){const s=c.snapshot();return sp==='cat'?['lazy','sleep','lazyAgain'].includes(s.phase):s.mode==='inside';}
for(const sp of ['cat','dog','rabbit'])for(const key of ['a','b','c'])test(sp+' '+key+' enters, stays resting, exits promptly at nearby footpoint',()=>{
 const h=manifest.variants?.[sp+'-'+key]||manifest.homes[sp],c=make(sp,h);let enter=0,exit=0;
 while(!inside(c,sp)&&enter<40000){step(c,sp,true);enter+=16}assert(inside(c,sp));
 for(let t=0;t<30000;t+=16){step(c,sp,true);assert(inside(c,sp),'rest must not start exiting with zero wait');}
 while(exit<20000){step(c,sp,false);exit+=16;const s=c.snapshot();if(s.phase==='landed'||s.mode==='roam')break;}
 assert(exit<13000,JSON.stringify({sp,key,exit}));const a=c.resumeAnchor();assert(a);assert(Math.hypot(a.x-687,a.y-745)<1);assert.equal(a.facing,-1);
 if(sp==='cat'){const p=c.pose(),anchor=c.takeResumeAnchor();assert.equal(c.pose(),null);assert.equal(p.x,anchor.x);}
 else{const p=c.pose();assert(Math.hypot(p.x-a.x,p.y-a.y)<2);}
});
G.setDiagonalReady(true);
for(const seed of [1,303,1337])test('cat resume is continuous seed '+seed,()=>{
 const plan=G.makePlan(seed,180),a={x:687,y:745,depth:1,facing:-1},r=Resume.create(G,plan,a),s=r.stateAt(r.time);
 assert.equal(s.sceneX,a.x);assert.equal(s.sceneY,a.y);assert.equal(s.depth,a.depth);assert.equal(s.spriteGroup,'walk');assert.equal(s.spriteIndex,5);assert.equal(s.facing,-1);assert(r.distance<50);
 let prev=s;for(let t=r.time+16;t<=r.time+4000;t+=16){const p=r.stateAt(t);assert(!p.behind);assert(Math.hypot(p.sceneX-prev.sceneX,p.sceneY-prev.sceneY)<3);prev=p;}
 assert.deepEqual(r.stateAt(r.time+4000),G.stateAt(plan,r.time+4000));
});
