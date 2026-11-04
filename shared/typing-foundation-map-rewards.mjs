import {FOUNDATION_MILESTONES,foundationMilestones} from './typing-foundation-milestones.mjs';
import {REWARD_SOURCE_PALETTES,sourceFlowerSvg} from './reward-source-colors.mjs';
let iconId=0;
function icon(kind,track){const span=document.createElement('span');span.className='foundation-map-icon';span.setAttribute('aria-hidden','true');const p=REWARD_SOURCE_PALETTES[track];
 if(kind==='flower'){const id=`map-petal-${++iconId}`;span.innerHTML=sourceFlowerSvg(track).replace('id="p"',`id="${id}"`).replaceAll('url(#p)',`url(#${id})`);}
 else span.innerHTML=`<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M5 27C-1 11 11 3 28 3C29 19 22 30 5 27Z" fill="${p.leaf[1]}" stroke="${p.leaf[2]}" stroke-width="1.5"/><path d="M4 29L23 9M10 23L9 15M16 17L23 18" fill="none" stroke="${p.light}" stroke-width="1.5" stroke-linecap="round"/></svg>`;
 return span;
}
export function initFoundationMapRewards(map,track){
 if(!document.getElementById('foundation-map-rewards-css')){const link=document.createElement('link');link.id='foundation-map-rewards-css';link.rel='stylesheet';link.href=new URL('./typing-foundation-map-rewards.css?v=20261102-icons',import.meta.url).href;document.head.append(link);}
 map.dataset.rewardTrack=track;map.style.setProperty('--map-reward-color',REWARD_SOURCE_PALETTES[track].leaf[2]);map.style.setProperty('--map-reward-bg',REWARD_SOURCE_PALETTES[track].light);
 const legend=map.querySelector('p')||document.createElement('p');legend.className='foundation-map-legend';legend.replaceChildren();
 const leaf=document.createElement('span'),flower=document.createElement('span');leaf.append(icon('leaf',track),' 每大關一片過關葉');flower.append(icon('flower',track),' 標有花朵的關卡：完成第 1 關至該關，另得一朵里程碑花');legend.append(leaf,flower);if(!legend.parentElement)map.append(legend);
 const note=document.createElement('span');note.className='foundation-map-note';note.textContent='依序解鎖；已過關可重練，花葉不重複領取。';legend.append(note);
}
export function decorateFoundationLesson(button,{track,lesson,records=[]}){
 const label=button.textContent,title=document.createElement('span');title.className='foundation-map-title';title.textContent=label;
 const rewards=document.createElement('span');rewards.className='foundation-map-rewards';
 const leafEarned=records.some(r=>r.lesson_key===lesson.key&&r.completed===true),milestone=FOUNDATION_MILESTONES.find(m=>m.track===track&&m.end===lesson.number);
 const descriptions=[];
 function badge(kind,earned,text,description){const tag=document.createElement('span');tag.className='foundation-map-reward';tag.dataset.rewardKind=kind;tag.dataset.earned=String(earned);tag.title=description;tag.append(icon(kind,track),`${earned?'✓ ':''}${text}`);rewards.append(tag);descriptions.push(description);}
 badge('leaf',leafEarned,'過關葉',`本大關過關後可得一片葉子；${leafEarned?'已取得':'尚未取得'}`);
 if(milestone){const earned=foundationMilestones(records).find(m=>m.key===milestone.key).earned;badge('flower',earned,'里程碑花',`完成第 1～${milestone.end} 大關的全部關卡，另得一朵${milestone.title}里程碑花；${earned?'已取得':'尚未取得'}`);}
 button.replaceChildren(title,rewards);button.setAttribute('aria-label',`${label}；${descriptions.join('；')}`);
}
