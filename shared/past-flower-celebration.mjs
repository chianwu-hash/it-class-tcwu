let active=null;
export function stopPastFlowerCelebration(){active?.cleanup();active=null}
export function celebratePastFlower(courseId){
 stopPastFlowerCelebration();
 const dialog=document.createElement('dialog');dialog.className='past-flower-celebration';
 dialog.setAttribute('aria-labelledby','past-flower-title');
 const style=document.createElement('style');style.textContent=`.past-flower-celebration{width:min(470px,90vw);border:2px solid #b7d7a8;border-radius:26px;padding:25px;background:#f5ffeb;color:#294b3d;text-align:center;font-family:system-ui}.past-flower-celebration::backdrop{background:#12382d77}.past-flower-celebration img{width:130px;height:130px;object-fit:contain;animation:past-flower-bloom 1.2s ease-out}.past-flower-celebration a,.past-flower-celebration button{display:inline-block;font:inherit;margin:6px;padding:12px;border-radius:12px;border:1px solid #27816b;color:#135b4b;background:white;text-decoration:none;min-height:44px;cursor:pointer}@keyframes past-flower-bloom{0%{transform:scale(.2) rotate(-25deg);opacity:0}65%{transform:scale(1.12) rotate(5deg)}100%{transform:scale(1);opacity:1}}@media(prefers-reduced-motion:reduce){.past-flower-celebration img{animation:none}}`;
 const img=document.createElement('img');img.src='/assets/reward-tree/flowers/flower-forest.png';img.alt='考古花';
 const title=document.createElement('h2');title.id='past-flower-title';title.textContent='完成整份挑戰，開出考古花！';
 const text=document.createElement('p');text.textContent='你完成了一次完整的綜合練習。回看看這次找到的線索，再繼續前進吧！';
 const link=document.createElement('a');link.href='/my-tree.html?course='+encodeURIComponent(courseId);link.textContent='去努力樹看看';
 const close=document.createElement('button');close.type='button';close.textContent='查看這次作答';close.onclick=()=>dialog.close();
 dialog.append(img,title,text,link,close);document.head.append(style);document.body.append(dialog);active=dialog;
 dialog.cleanup=()=>{dialog.remove();style.remove();if(active===dialog)active=null};dialog.addEventListener('close',dialog.cleanup,{once:true});dialog.showModal();close.focus();
}
