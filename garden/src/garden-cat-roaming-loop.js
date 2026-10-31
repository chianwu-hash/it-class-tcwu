/* Continue the approved seeded gait at a grounded, front-facing footfall.
 * Scene weather time is independent and is never restarted by this helper. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.GardenCatRoamingLoop=factory();})(typeof self!=='undefined'?self:this,function(){
 'use strict';
 function boundary(G,plan){
  for(var t=Math.floor((plan.totalMs-1)/25)*25;t>1000;t-=25){var s=G.stateAt(plan,t);if(!s.behind&&s.phase==='walk'&&s.spriteGroup==='walk'&&s.spriteIndex===5)return t;}
  throw Error('No safe cat cycle boundary');
 }
 function next(G,Resume,seed,cycle,anchor){
  // Some seeded routes have no four-second front walk in this facing.
  // Choose another native route rather than mirroring or teleporting the pet.
  for(var attempt=0;attempt<32;attempt++){
   var plan=G.makePlan(seed+'/cycle/'+cycle+'/'+attempt,180),at=boundary(G,plan),resume;
   try{resume=Resume.create(G,plan,anchor,{before:at-30000});}catch(e){continue;}
   return {plan:plan,at:at,resume:resume};
  }
  throw Error('No matching cat continuation route');
 }
 return {boundary:boundary,next:next};
});
