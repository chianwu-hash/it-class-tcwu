// Home-row guide, viewed from above the learner's own hands (thumbs inward).
const keyFingers = {a:['left-pinky'],s:['left-ring'],d:['left-middle'],f:['left-index'],g:['left-index'],
  h:['right-index'],j:['right-index'],k:['right-middle'],l:['right-ring'],';':['right-pinky'],
  ' ':['left-thumb','right-thumb']};
for(const [keys,finger] of Object.entries({'qaz1`':'left-pinky','wsx2':'left-ring','edc3':'left-middle','rfvtgb45':'left-index','yhnujm67':'right-index','ik,8':'right-middle','ol.9':'right-ring',"p;/0-=[]\\'":'right-pinky'}))for(const key of keys)keyFingers[key]=[finger];
const shifted='~!@#$%^&*()_+{}|:"<>?';
const bases="`1234567890-=[]\\;',./";
export function physicalKey(key){return shifted.includes(key)?bases[shifted.indexOf(key)]:key.toLowerCase();}
export function needsShift(key){return /[A-Z]/.test(key)||shifted.includes(key);}
export function getTargetFingers(key) {
  const result=[...(keyFingers[physicalKey(key)]||[])];
  if(needsShift(key)&&result.length)result.push(result[0].startsWith('left')?'right-pinky':'left-pinky');
  return result;
}
export function fingerLabel(key){
  const names={'pinky':'小指','ring':'無名指','middle':'中指','index':'食指','thumb':'拇指'};
  if(key===' ')return '選慣用的拇指';
  return getTargetFingers(key).map((finger,i)=>`${finger.startsWith('left')?'左手':'右手'}${names[finger.split('-')[1]]}${i?'按 Shift':''}`).join('＋');
}

export function createTypingFingerGuide(container) {
  // Coordinates use the original 1536 × 1024 image, not viewport pixels.
  // One neutral bitmap stays fixed; only these ten SVG regions change state.
  const shapes = {
    pinky:'M88 412 Q75 365 86 328 Q95 292 123 292 Q159 292 171 331 L190 438 Q133 457 88 412 Z',
    ring:'M199 418 L193 273 Q188 218 211 195 Q236 170 265 191 Q291 210 294 264 L301 413 Q250 438 199 418 Z',
    middle:'M316 413 L319 217 Q320 140 350 130 Q383 116 406 147 Q427 175 426 226 L427 411 Q373 436 316 413 Z',
    index:'M443 417 L454 265 Q455 222 477 199 Q501 178 527 197 Q551 212 552 253 L546 438 Q497 453 443 417 Z',
    thumb:'M573 530 Q613 478 652 455 Q680 435 706 453 Q740 474 714 510 L638 605 Q600 582 573 530 Z',
  };
  const nails = {
    pinky:'M107 320 Q126 303 145 323 Q155 342 149 346 Q124 354 107 345 Q100 335 107 320 Z',
    ring:'M219 213 Q240 195 261 217 Q274 243 265 246 Q243 257 218 247 Q209 236 219 213 Z',
    middle:'M344 157 Q371 138 391 163 Q406 189 394 192 Q368 202 346 191 Q335 181 344 157 Z',
    index:'M483 220 Q503 202 525 222 Q539 246 529 251 Q504 261 482 249 Q475 236 483 220 Z',
    thumb:'M667 468 Q683 456 699 472 Q719 487 701 502 Q689 516 676 502 Q655 484 667 468 Z',
  };
  const hand = side => `<g transform="${side==='left'?'':'translate(1536 0) scale(-1 1)'}">
    ${Object.entries(shapes).map(([finger,d])=>`<g class="finger-region">
      <path class="hand-finger-border" data-finger-border="${side}-${finger}" d="${d}"/>
      <path class="hand-finger" data-finger="${side}-${finger}" d="${d}"/>
      <path class="hand-nail" d="${nails[finger]}"/>
    </g>`).join('')}
  </g>`;
  const asset = new URL('./images/typing-hands-neutral-v1.webp', import.meta.url).href;
  container.innerHTML=`<svg class="finger-hands" viewBox="0 60 1536 1024" role="img" aria-label="雙手指法提示">
    <image href="${asset}" x="0" y="0" width="1536" height="1024"/>
    ${hand('left')}${hand('right')}
    <text x="390" y="1040" text-anchor="middle">左手</text><text x="1146" y="1040" text-anchor="middle">右手</text>
  </svg>`;
  const svg=container.querySelector('svg');
  const fingers=[...svg.querySelectorAll('[data-finger]')];
  const borders=[...svg.querySelectorAll('[data-finger-border]')];
  return {update(key,label){
    const selected=getTargetFingers(key);
    fingers.forEach(el=>{
      const active=selected.includes(el.dataset.finger);
      el.classList.toggle('is-active',active);
      el.parentElement.classList.toggle('is-active',active);
      if (!active) el.parentElement.getAnimations().forEach(animation=>animation.cancel());
    });
    borders.forEach(el=>el.classList.toggle('is-active',selected.includes(el.dataset.fingerBorder)));
    svg.setAttribute('aria-label',`下一鍵${key===' '?'空白鍵':key.toUpperCase()}：${label}${key===' '?'，兩個拇指擇一，不必同時按':''}`);
  },press(key){
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const selected=getTargetFingers(key);
    fingers.filter(el=>selected.includes(el.dataset.finger)).forEach(el=>{
      const region=el.parentElement;
      region.getAnimations().forEach(animation=>animation.cancel());
      region.animate([{opacity:1},{opacity:.65},{opacity:1}],{duration:160,easing:'ease-out'});
    });
  }};
}
