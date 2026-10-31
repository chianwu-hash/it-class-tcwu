/* Cat tap animation. Pure, finite state, no timers/storage/network/rewards. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.GardenCatTapV23=factory();})(typeof self!=='undefined'?self:this,function(){
 'use strict';
 const step=(group,frame,ms,mirror=false)=>({group,frame,ms,mirror});
 function body(kind){
  if(kind==='shake')return [step('shake',0,190),step('shake',2,120),step('shake',1,190),step('shake',2,120),step('shake',0,190),step('shake',2,120),step('shake',1,190),step('shake',2,240)];
  if(kind==='yawn')return [step('yawn',0,320),step('yawn',1,1100),step('yawn',2,360)];
  if(kind==='blink')return [step('blink',0,500),step('blink',1,150),step('blink',0,300),step('sit',0,200),step('blink',2,500)];
  if(kind==='stretch')return [step('stretch',0,360),step('stretch',1,1100),step('stretch',2,400)];
  return [step('wave',0,200),step('wave',1,220),step('wave',2,220),step('wave',3,320),step('wave',2,320),step('wave',1,220),step('wave',0,220)];
 }
 function sequence(kind,start){
  if(kind==='inside')return [step('rest',0,400),step('entry',3,350),step('turn',0,260),step('turn',1,260),step('insideShake',3,300),
   step('insideShake',0,220),step('insideShake',2,140),step('insideShake',1,220),step('insideShake',2,140),step('insideShake',0,220),step('insideShake',2,240),step('insideShake',3,300),
   step('insideYawn',0,360),step('insideYawn',1,1200),step('insideYawn',2,400),step('insideShake',3,300),
   step('turn',1,260),step('turn',0,260),step('entry',3,400),step('rest',0,500),step('rest',1,500)];
  const m=start.mirror;
  if(kind==='stretch')return [step('walk',5,250,m),...body(kind).map(s=>({...s,mirror:m})),step('walk',5,280,m)];
  const seated=start.group==='sit';
  return [...(seated?[]:[step('walk',5,220,m),step('front',0,240,m),step('front',1,240),step('front',2,240)]),step('sit',0,300),...body(kind),step('sit',0,400),
   ...(seated?[]:[step('front',2,240),step('front',1,240),step('front',0,240,m),step('walk',5,260,m)])];
 }
 function hash(s){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h>>>0;}
 function create(seed){
  let state='idle',pending=null,act=null,n=0,previous='',ignoredReason='',completed=null;
  function request(context,forced){
   if(state!=='idle'){ignoredReason='busy';return false;}
   if(!context.enabled||context.paused||context.reduced||context.transition){ignoredReason='unavailable';return false;}
   if(context.inside){if(!context.insideSafe){ignoredReason='door-transition';return false;}start('inside',context.pose);return true;}
   if(context.behind){ignoredReason='behind-tree';return false;}
   pending={ms:0,forced};state='pending';ignoredReason='';update(0,context);return true;
  }
  function start(kind,pose){
   n++;previous=kind;act={kind,pose:{...pose},steps:sequence(kind,pose),index:0,ms:0};pending=null;state='acting';ignoredReason='';
  }
  function update(dt,context){
   completed=null;
   if(state==='pending'){
    if(!context.enabled||context.reduced||context.transition||context.behind||context.inside){reset();return;}
    pending.ms+=dt;
    if(context.safe){const choices=context.available.filter(k=>k!==previous&&!(k==='stretch'&&context.pose.group==='sit'));if(!choices.length){reset();return;}const kind=choices.includes(pending.forced)?pending.forced:choices[hash(seed+'#tap#'+(n+1))%choices.length];start(kind,context.pose);}
    else if(pending.ms>2500){reset();ignoredReason='no-safe-pose';}
   }else if(state==='acting'){
    act.ms+=dt;
    while(act&&act.ms>=act.steps[act.index].ms){act.ms-=act.steps[act.index].ms;act.index++;if(act.index===act.steps.length){completed=act.kind;act=null;state='idle';}}
   }
  }
  function pose(){if(!act)return null;const f=act.steps[act.index];return {...act.pose,group:f.group,frame:f.frame,mirror:f.mirror,inside:act.kind==='inside',layer:act.kind==='inside'?'mid':'front'};}
  function reset(){state='idle';pending=null;act=null;completed=null;}
  return {request,update,pose,reset,frozen:()=>state==='acting',completed:()=>completed,snapshot:()=>({state,kind:act?.kind||null,index:act?.index??null,frame:pose(),n,previous,ignoredReason})};
 }
 return {create,sequence};
});
