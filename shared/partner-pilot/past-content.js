import {renderContent as base} from './official-render.js';
import {underlineTextParts} from './quiz-past-underlines.js';
import {applySourceCrop} from './quiz-source-crop.js';
export function renderContent(host,content,options){
 const parts=!content?.layout&&content?.underlines?.length?underlineTextParts(content.text,content.underlines):[];let box;
 if(parts.some(p=>p.underline)){box=document.createElement('div');box.className='preview-content';for(const p of parts){const n=document.createElement(p.underline?'u':'span'),temp=document.createElement('div');base(temp,{text:p.text,media:[]},options);n.append(...temp.firstElementChild.childNodes);box.append(n);}host.append(box);if(content.media?.length)base(box,{text:'',media:content.media},options);}else box=base(host,content,options);
 const media=content?.media||[],entries=content?.layout?content.layout.flatMap(p=>(p.type==='paragraph'?p.runs:p.rows.flat(2)).filter(r=>r.type==='image').map(r=>media[r.media_index])):media.filter(m=>m.kind==='image');
 const images=[...box.querySelectorAll('img[data-quiz-media-url]')];entries.forEach((m,i)=>{if(m?.viewBox&&images[i]){const wrapper=document.createElement('span');images[i].before(wrapper);wrapper.append(images[i]);applySourceCrop(wrapper,images[i],m.viewBox);}});return box;
}
