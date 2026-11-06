import {paintPartnerKeepsake} from './quiz-partner-rewards.mjs?v=20261106-keepsake';
export {paintPartnerKeepsake};
export function bindRewardHover(canvas,hit){
 const cursor=canvas.style.cursor;
 canvas.addEventListener('pointermove',event=>{if(event.pointerType==='touch')return;const r=hit(event);canvas.title=r?.title||'';canvas.style.cursor=r?'pointer':cursor;});
 canvas.addEventListener('pointerleave',()=>{canvas.title='';canvas.style.cursor=cursor;});
}
export const REWARD_SOURCE_PALETTES=Object.freeze({
  english:Object.freeze({label:'英打',leaf:['#91caff','#3987d2','#245b9e'],flower:'#80b9f3',light:'#d8edff',center:'#ffe39b'}),
  zhuyin:Object.freeze({label:'中打',leaf:['#cab1ed','#9870cd','#68459d'],flower:'#b99ae7',light:'#eee3ff',center:'#ffe39b'})
});
export function rewardTrack(reward){
  if(reward?.track in REWARD_SOURCE_PALETTES)return reward.track;
  const key=reward?.activityKey||reward?.id||'';
  if(/(?:^|:)english-|foundation-english-/.test(key))return 'english';
  if(/(?:^|:)zhuyin-|foundation-zhuyin-/.test(key))return 'zhuyin';
  return null;
}
export function rewardPalette(reward,mode='source'){return mode==='source'?REWARD_SOURCE_PALETTES[rewardTrack(reward)]||null:null;}
export function sourceFlowerSvg(track){
  const p=REWARD_SOURCE_PALETTES[track];if(!p)return '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><radialGradient id="p"><stop stop-color="${p.light}"/><stop offset="1" stop-color="${p.flower}"/></radialGradient></defs>${Array.from({length:6},(_,i)=>`<ellipse cx="50" cy="27" rx="16" ry="24" fill="url(#p)" stroke="${p.flower}" stroke-width="1.4" transform="rotate(${i*60} 50 50)"/>`).join('')}<circle cx="50" cy="50" r="14" fill="${p.center}" stroke="#c99a42" stroke-width="1.4"/></svg>`;
}
export function paintSourceFlower(ctx,x,y,size,reward,mode='source'){
  if(paintPartnerKeepsake(ctx,x,y,size,reward))return true;
  const p=rewardPalette(reward,mode);if(!p)return false;
  ctx.save();ctx.translate(x,y);ctx.scale(size/100,size/100);
  for(let i=0;i<6;i++){ctx.save();ctx.rotate(i*Math.PI/3);const g=ctx.createRadialGradient(0,-12,2,0,-24,25);g.addColorStop(0,p.light);g.addColorStop(1,p.flower);ctx.fillStyle=g;ctx.strokeStyle=p.flower;ctx.lineWidth=1.4;ctx.beginPath();ctx.ellipse(0,-23,16,24,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();}
  ctx.fillStyle=p.center;ctx.strokeStyle='#c99a42';ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(0,0,14,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();return true;
}
