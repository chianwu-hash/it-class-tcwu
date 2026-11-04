/* Local whole-pose peek layer; the accepted v10 plan and assets remain unchanged. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./garden-social-v10.js'));else root.GardenPeekV11=factory(root.GardenSocialV10);})(typeof self!=='undefined'?self:this,function(v10){
 'use strict';
 const makeStep=(group,frameIndex,mirror,durationMs,label)=>({group,frameIndex,mirror,durationMs,label});
 function makePlan(seed,seconds){
  const p=v10.makePlan(seed,seconds),segments=[];let t=0;
  for(const s of p.segments){let duration=s.t1-s.t0,sequence=null;
   if(s.phase==='peek'){
    const m=s.root.facing<0;
    sequence=[makeStep('walk',5,m,220,'站穩'),makeStep('front',0,m,220,'轉向鏡頭'),makeStep('front',1,false,220,'看向鏡頭'),makeStep('peek',0,false,2000,'半掩面看鏡頭'),makeStep('front',1,false,180,'縮回'),makeStep('front',0,m,180,'轉回'),makeStep('walk',5,m,180,'站好')];
    duration=Math.max(duration,3200);sequence[3].durationMs+=duration-3200;
   }
   segments.push({...s,t0:t,t1:t+duration,baseT0:s.t0,baseT1:s.t1,action:sequence?'peek-camera':s.action,sequence:sequence||s.sequence,sequenceMs:sequence?duration:s.sequenceMs,peekSequence:sequence});t+=duration;
  }
  return {base:p,segments,totalMs:t,seed:p.seed,version:'garden-peek-v11-1'};
 }
 function stateAt(p,ms){if(typeof ms!=='number'||!Number.isFinite(ms))throw TypeError('timeMs 必須是有限數字');const t=Math.max(0,Math.min(ms,p.totalMs));const seg=p.segments.find(s=>t>=s.t0&&t<s.t1)||p.segments[p.segments.length-1];const local=t-seg.t0;
  if(!seg.peekSequence){const st=v10.stateAt(p.base,Math.min(seg.baseT0+local,seg.baseT1-1e-6));return {...st,t,total:p.totalMs};}
  let acc=0,index=0;while(index<seg.peekSequence.length-1&&local>=acc+seg.peekSequence[index].durationMs){acc+=seg.peekSequence[index++].durationMs;}const f=seg.peekSequence[index];const st=v10.stateAt(p.base,seg.baseT0+1);
  return {...st,t,total:p.totalMs,walkSpeed:0,action:'peek-camera',actionLabel:'樹後半掩面看鏡頭',actionIndex:index,stepLabel:f.label,spriteGroup:f.group,spriteIndex:f.frameIndex,spriteMirror:f.mirror};
 }
 function summarize(p){return {...v10.summarize(p.base),version:p.version,totalMs:p.totalMs,segments:p.segments.map(s=>({index:s.index,phase:s.phase,action:s.action,t0:s.t0,t1:s.t1,behind:s.root.behind}))};}
 return {makePlan,stateAt,summarize,v9:v10.v9};
});
