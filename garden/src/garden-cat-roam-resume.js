/* Scene integration: rejoin the seeded walk from the actual home-exit footpoint.
 * Preserve its approved gait; ease a small route offset over the next four seconds.
 * No teleport back to the pre-entry time, sprite interpolation, or new animation frames. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.GardenCatRoamResume=factory();})(typeof self!=='undefined'?self:this,function(){
  'use strict';
  function create(G,plan,anchor,options){
    var best=null,duration=4000;
    var limit=Math.min(plan.totalMs-duration,options&&Number.isFinite(options.before)?options.before:Infinity);
    for(var t=0;t<limit;t+=25){
      var s=G.stateAt(plan,t),z=G.stateAt(plan,t+duration);
      if(s.behind||s.phase!=='walk'||s.spriteGroup!=='walk'||s.spriteIndex!==5||s.facing!==anchor.facing||z.behind||z.phase!=='walk'||(z.sceneX-s.sceneX)*anchor.facing<=0)continue;
      var distance=Math.hypot(s.sceneX-anchor.x,s.sceneY-anchor.y);
      if(!best||distance<best.distance)best={t:t,state:s,distance:distance};
    }
    if(!best)throw Error('No safe cat roaming continuation');
    var dx=anchor.x-best.state.sceneX,dy=anchor.y-best.state.sceneY,dd=anchor.depth-best.state.depth;
    return {time:best.t,distance:best.distance,stateAt:function(t){
      if(t<best.t)return G.stateAt(plan,t);
      var s=G.stateAt(plan,t),u=Math.max(0,Math.min(1,(t-best.t)/duration)),k=1-u*u*(3-2*u);
      return Object.assign({},s,{sceneX:s.sceneX+dx*k,sceneY:s.sceneY+dy*k,depth:s.depth+dd*k});
    }};
  }
  return {create:create};
});
