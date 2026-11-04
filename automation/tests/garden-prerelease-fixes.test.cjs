const {test}=require('node:test'),assert=require('node:assert/strict');
const G=require('../../garden/src/garden-tree-path-v25.js'),Resume=require('../../garden/src/garden-cat-roam-resume.js'),Loop=require('../../garden/src/garden-cat-roaming-loop.js'),Assets=require('../../garden/src/garden-asset-status.js');
G.setDiagonalReady(true);
for(const seed of [1,101,303,1337,'classroom'])test('continuous grounded cat loops '+seed,()=>{
 let plan=G.makePlan(seed,180),resume=null;
 for(let cycle=1;cycle<=5;cycle++){
  const at=Loop.boundary(G,plan),end=resume?resume.stateAt(at):G.stateAt(plan,at),anchor={x:end.sceneX,y:end.sceneY,depth:end.depth,facing:end.facing};
  const next=Loop.next(G,Resume,seed,cycle,anchor),start=next.resume.stateAt(next.resume.time);
  assert.equal(start.sceneX,anchor.x);assert.equal(start.sceneY,anchor.y);assert.equal(start.depth,anchor.depth);assert.equal(start.facing,anchor.facing);assert.equal(start.spriteIndex,end.spriteIndex);assert.equal(start.spriteGroup,end.spriteGroup);assert.equal(start.behind,false);
  assert(next.at-next.resume.time>30000);
  let prev=start;for(let t=next.resume.time+25;t<next.resume.time+4000;t+=25){const s=next.resume.stateAt(t);assert(!s.behind);assert(Math.hypot(s.sceneX-prev.sceneX,s.sceneY-prev.sceneY)<5);prev=s;}
  plan=next.plan;resume=next.resume;
 }
});
test('asset reports are explicit and preserve fatal state',()=>{let latest;const a=Assets.create(x=>latest=x);a.report('flower','圖片暫時無法顯示',false);a.report('core','請重新讀取',true);assert.equal(latest.length,2);assert.equal(a.snapshot()[1].fatal,true)});
test('names map old catalog labels without species suffix',async()=>{const {petName,petUnlockLabel}=await import('../../shared/garden-pet-names.mjs');assert.deepEqual(['cat','dog','rabbit'].map(petName),['橘寶','布丁','蹦蹦']);assert.equal(petUnlockLabel('pet:cat','小貓與奶油貓耳陶屋'),'橘寶與奶油貓耳陶屋');});
