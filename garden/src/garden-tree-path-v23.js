/* Local candidate: turn outside both root silhouettes before changing layers.
 * Pure wrapper: original seeded route/gait and accepted media stay intact. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./garden-peek-v11.js'));else root.GardenTreePathV23=factory(root.GardenPeekV11);})(typeof self!=='undefined'?self:this,function(base){
 'use strict';
 const T={x:755,y:694}, TURN_MS=2860, PEEK_MS=2125;
 const mix=(a,b,p)=>a+(b-a)*p, clamp=p=>Math.max(0,Math.min(1,p));
 function makePlan(seed,seconds){
  const p=base.makePlan(seed,seconds),core=p.base.base.base,segments=[];let t=0,peeked=false;
  function push(s,d,extra){segments.push({...s,...extra,t0:t,t1:t+d});t+=d;}
  p.segments.forEach((s,i)=>{
   const c=core.segments[s.index],a=base.stateAt(p,s.t0+.01),z=base.stateAt(p,s.t1-.01),next=p.segments[i+1];
   const channel=c.kind==='walk'&&c.edges.some(e=>e==='F5-B1'||e==='B1-F5');
   const entryTurn=s.phase==='turn'&&a.x===750&&next&&core.segments[next.index].edges?.includes('F5-B1');
   const extra={sourceT0:s.t0,sourceT1:s.t1,channel,entryTurn,peeked,exit:false};
   if(s.phase==='peek'){
    push(s,1000,{...extra,peekTurn:true});
    push(s,PEEK_MS,{...extra,approachPeek:true});
    push(s,s.t1-s.t0,extra);peeked=true;
   }else{
    push(s,entryTurn?TURN_MS:s.t1-s.t0,extra);
    if(s.phase==='walk')peeked=false;
   }
   if(channel&&z.x===750)push(s,1100,{...extra,exit:true,entryTurn:false,channel:false,peeked:false});
  });
  return {base:p,segments,totalMs:t,seed:p.seed,version:'garden-tree-path-v23'};
 }
 function front(x,y){
  if(x<=520)return {x:480+(x-380)*.68,y:725+(y-690)*.45+16};
  const u=clamp((x-520)/230);
  return {x:(1-u)*(1-u)*575+2*(1-u)*u*675+u*u*T.x,y:(1-u)*(1-u)*745+2*(1-u)*u*745+u*u*T.y};
 }
 function back(x){return x<=530?{x:mix(500,630,clamp((x-410)/120)),y:680}:{x:mix(630,710,clamp((x-530)/160)),y:680};}
 function stateAt(p,ms){
  if(!Number.isFinite(ms))throw TypeError('timeMs 必須是有限數字');
  const t=Math.max(0,Math.min(ms,p.totalMs)),s=p.segments.find(s=>t>=s.t0&&t<s.t1)||p.segments.at(-1),local=t-s.t0;
  const time=s.sourceT0+Math.min(local,s.sourceT1-s.sourceT0-.001),st=base.stateAt(p.base,time);
  let pt,behind=st.behind,depth=st.depth;
  if(s.peekTurn){const f=Math.min(4,Math.floor(local/200));return {...st,t,total:p.totalMs,sceneX:500,sceneY:680,depth:.86,behind:true,phase:'turn',action:'peek-turn',spriteGroup:['walk','front','front','front','walk'][f],spriteIndex:[5,0,1,0,5][f],spriteMirror:f<2,facing:f<2?-1:1};}
  if(s.entryTurn||s.exit){
   const f=Math.min(s.exit?4:12,Math.floor(local/220));
   const groups=s.exit?['walk','front','front','front','walk']:['walk','rear','rear','rear','rear','turnBridge','turnBridge','turnBridge','rear','rear','rear','rear','walk'];
   const frames=s.exit?[5,0,1,0,5]:[5,0,1,2,3,0,1,2,3,2,1,0,5];
   const m=!s.exit&&f>=8;
   return {...st,t,total:p.totalMs,sceneX:T.x,sceneY:T.y,depth:.86,behind:s.exit?f<2:f>=6,phase:'turn',action:'tree-turn',actionLabel:s.exit?'轉向鏡頭回到樹前':'轉身繞到樹後',spriteGroup:groups[f],spriteIndex:frames[f],spriteMirror:m,facing:m?-1:1};
  }
  if(s.approachPeek){
   const u=clamp(local/PEEK_MS),e=u*u*(3-2*u);
   return {...st,t,total:p.totalMs,sceneX:mix(500,565,e),sceneY:mix(680,706,e),depth:.86,behind:true,phase:'walk',action:'peek-approach',actionLabel:'慢慢走到樹旁探頭',spriteGroup:'walk',spriteIndex:(5+Math.floor(local/212.5))%10,spriteMirror:false,facing:1};
  }
  if(s.phase==='peek'||(s.peeked&&s.phase==='hide')){pt={x:565,y:706};behind=true;depth=.86;}
  else if(s.channel){
   if(st.x>=530){const u=clamp((st.x-530)/220);pt={x:mix(630,T.x,u),y:mix(680,T.y,u)};}else if(s.peeked){const u=clamp((st.x-410)/120);pt={x:mix(565,630,u),y:mix(706,680,u)};}else pt=back(st.x);
   behind=true;depth=.86;
  }else if(st.y<690){
   pt=back(st.x);behind=true;depth=.86;
   if(s.peeked&&s.phase==='walk'&&st.x<=530){const u=clamp((st.x-410)/120);pt={x:mix(565,630,u),y:mix(706,680,u)};}
  }else{pt=front(st.x,st.y);behind=false;if(st.x>520)depth=mix(st.depth,.86,clamp((st.x-520)/230));}
  return {...st,t,total:p.totalMs,sceneX:pt.x,sceneY:pt.y,behind,depth};
 }
 return {makePlan,stateAt,summarize:p=>({...base.summarize(p.base),version:p.version,totalMs:p.totalMs}),v9:base.v9};
});
