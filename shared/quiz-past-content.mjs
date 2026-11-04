import {renderContent} from './quiz-render.mjs';
import {underlineTextParts} from './quiz-past-underlines.mjs?v=20261102-transcribed';
import {applySourceCrop} from './quiz-source-crop.mjs?v=20261102-transcribed';

function cropMedia(box,content){
 const media=content?.media||[];
 const entries=content?.layout?content.layout.flatMap(part=>(part.type==='paragraph'?part.runs:part.rows.flat(2)).filter(run=>run.type==='image').map(run=>media[run.media_index])):media.filter(m=>m.kind==='image');
 const images=[...box.querySelectorAll('img[data-quiz-media-url]')];
 entries.forEach((m,i)=>{const img=images[i];if(!img||!m?.viewBox)return;const link=document.createElement('a');link.href='#';link.dataset.imageLightbox='';img.before(link);link.append(img);applySourceCrop(link,img,m.viewBox);});
}
export function renderLocalContent(host,content,options={}){
 const settings={imageLoading:'lazy',...options};let box;
 const parts=!content?.layout&&content?.underlines?.length?underlineTextParts(content.text,content.underlines):[];
 if(parts.some(p=>p.underline)){
  box=document.createElement('div');box.className='preview-content';
  for(const part of parts){const span=document.createElement(part.underline?'u':'span'),temporary=document.createElement('div');renderContent(temporary,{text:part.text,media:[]},settings);span.append(...temporary.firstElementChild.childNodes);box.append(span);}
  host.append(box);if(content.media?.length)renderContent(box,{text:'',media:content.media},settings);
 }else box=renderContent(host,content,settings);
 cropMedia(box,content);return box;
}
