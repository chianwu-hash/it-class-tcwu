/* 小貓一般繞樹的朝向改善：以 garden-tree-path-v23 為基底的純 wrapper，舊檔保留不動。
 * 只改「步行時用哪張圖」：位置、時間、換層、原轉身、探頭都照 V23 的輸出，不重算。
 * 讀 V23 實際 sceneX/sceneY 的切線：r = |dy/dx| >= 0.25 用斜向步態，否則保留原側走。
 * 素材沒到（setDiagonalReady 未開）時，輸出和 V23 相同，只多 diagonalGait:false。 */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./garden-tree-path-v23.js'));else root.GardenTreePathV25=factory(root.GardenTreePathV23);})(typeof self!=='undefined'?self:this,function(base){
 'use strict';
 const THRESHOLD=.25, WINDOW_MS=120, BRIDGE_MS=200, SCAN_MS=50, MIN_MOVE=1.2, MAX_MOVE=30;
 let ready=false, frameMs=200;
 /** 兩組斜向圖都載到才開。frameMs 由 manifest 來。 */
 function setDiagonalReady(v,opts){ready=!!v;if(opts&&opts.frameMs>0)frameMs=opts.frameMs;return ready;}
 function makePlan(seed,seconds){return {...base.makePlan(seed,seconds),version:'garden-tree-path-v25'};}
 const segAt=(p,t)=>p.segments.find(s=>t>=s.t0&&t<s.t1)||p.segments.at(-1);
 const isWalk=st=>(st.spriteGroup||'walk')==='walk'&&st.phase==='walk';
 /** t 附近的切線。只取同一段內；太短算沒在走，太長是路線接縫，都不判斷方向。 */
 function classAt(p,seg,t){
  const a=base.stateAt(p,Math.max(seg.t0,t-WINDOW_MS)),z=base.stateAt(p,Math.min(seg.t1-.01,t+WINDOW_MS));
  const dx=z.sceneX-a.sceneX,dy=z.sceneY-a.sceneY,L=Math.hypot(dx,dy);
  if(!(L>=MIN_MOVE)||L>MAX_MOVE)return null;
  const r=Math.abs(dy)/Math.max(Math.abs(dx),1e-6);
  return {kind:r<THRESHOLD?'side':dy<0?'rear':'front',dir:dx<0?-1:1,r};
 }
 const same=(a,b)=>!!a&&!!b&&a.kind===b.kind&&a.dir===b.dir;
 /** 進入斜向的前 200ms 與回到側走的後 200ms 用真轉身格；緊接原轉身時不加，原轉身自己會接。 */
 function bridgeOf(p,seg,t,c){
  for(let d=SCAN_MS;d<=BRIDGE_MS;d+=SCAN_MS){
   const tb=t-d;
   if(tb<seg.t0||!same(classAt(p,seg,tb),c))return {phase:'in',ms:d-SCAN_MS};
  }
  for(let d=SCAN_MS;d<=BRIDGE_MS;d+=SCAN_MS){
   const tf=t+d;
   if(tf>=seg.t1)return null;
   if(!same(classAt(p,seg,tf),c))return {phase:'out',ms:d-SCAN_MS};
  }
  return null;
 }
 function stateAt(p,ms){
  const st=base.stateAt(p,ms);
  if(!ready||!isWalk(st))return {...st,diagonalGait:false};
  const t=st.t,seg=segAt(p,t),c=classAt(p,seg,t);
  if(!c||c.kind==='side')return {...st,diagonalGait:false,tangentR:c?c.r:null};
  const side=c.dir<0?'left':'right',heading=side+(c.kind==='rear'?'-rear-3/4':'-front-3/4'),br=bridgeOf(p,seg,t,c);
  const out={...st,spriteMirror:c.dir<0,facing:c.dir,diagonalGait:true,gaitKind:c.kind,gaitHeading:heading,tangentR:c.r};
  if(br){
   out.spriteGroup=c.kind==='rear'?'rear':'front';
   out.spriteIndex=c.kind==='rear'?(br.ms<100?0:1):0;
   out.gaitBridge=br.phase;
   return out;
  }
  out.spriteGroup=c.kind==='rear'?'rear3qwalk':'front3qwalk';
  out.spriteIndex=Math.floor((t-seg.t0)/frameMs)%8;
  return out;
 }
 /** 給 QA：逐段列出斜向的時間範圍，不靠素材是否載入。 */
 function inspectTangents(p,step){
  const dt=step>0?step:100,spans=[];let cur=null;
  for(let t=0;t<p.totalMs;t+=dt){
   const st=base.stateAt(p,t),seg=segAt(p,t),c=isWalk(st)?classAt(p,seg,t):null,key=c&&c.kind!=='side'?c.kind+c.dir:null;
   if(cur&&cur.key!==key){cur.t1=t;spans.push(cur);cur=null;}
   if(key&&!cur)cur={key,kind:c.kind,dir:c.dir,t0:t,x0:st.sceneX,y0:st.sceneY,behind:!!st.behind,r:c.r};
  }
  if(cur){cur.t1=p.totalMs;spans.push(cur);}
  return spans;
 }
 return {makePlan,stateAt,setDiagonalReady,isDiagonalReady:()=>ready,inspectTangents,THRESHOLD,summarize:p=>({...base.summarize(p),version:p.version}),v9:base.v9};
});
