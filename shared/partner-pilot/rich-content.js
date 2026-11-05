import {renderContent} from './past-content.js';
import {initImageLightbox} from './image-lightbox.js';
export function createRichContent({getQuestion,getContext,loadMedia}){
 const cache=new Map();let observer=null;const observed=new Set();
 function prepare(root){root.querySelectorAll('audio').forEach(a=>a.pause());for(const el of observed)if(root.contains(el)){observer?.unobserve(el);observed.delete(el);}}
 const generationOf=c=>c.room+':'+c.user;
 const isActive=c=>{const next=getContext();return Boolean(next)&&generationOf(next)===generationOf(c);};
 // One cache per room view for every media read (rich text, manual-answer base images, own results),
 // so a re-render after a teammate's action does not download the same asset again.
 async function resolveFor(context,url){const match=/^https:\/\/partner-media\.invalid\/([a-f0-9]{64})$/.exec(url);if(!match||!isActive(context))throw Error('無法讀取這個媒體。');const k=generationOf(context)+':'+match[1];if(!cache.has(k)){const pending=loadMedia(context.room,match[1]).then(data=>{if(!(/^(image\/(png|jpeg|webp|gif)|audio\/(mpeg|wav|ogg))$/).test(data.mime)||typeof data.base64!=='string')throw Error('媒體格式不符。');return 'data:'+data.mime+';base64,'+data.base64.replace(/\s/g,'');}).catch(e=>{cache.delete(k);throw e;});cache.set(k,pending);}return cache.get(k);}
 async function resolve(url){const context=getContext();if(!context)throw Error('無法讀取這個媒體。');return resolveFor(context,url);}
 function mount(root){const context=getContext();if(!context)return;
  observer??=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){observer.unobserve(entry.target);observed.delete(entry.target);entry.target.__begin?.();}},{rootMargin:'350px'});
  for(const el of observed)if(!el.isConnected){observer.unobserve(el);observed.delete(el);}
  const scope={active:()=>isActive(context),resolve:url=>resolveFor(context,url),observe:(element,begin)=>{element.__begin=begin;observed.add(element);observer.observe(element);}};
  root.querySelectorAll('[data-rich-q]:not([data-rich-mounted])').forEach(el=>{const q=getQuestion(Number(el.dataset.richQ));if(!q)return;const part=el.dataset.richPart,index=Number(el.dataset.richIndex);let content=part==='option'?q.rich?.options?.[index]:q.rich?.[part];if(!content){const text=part==='prompt'?q.text:part==='explanation'?q.explanation:part==='option'?q.options[index]:'';content={text:text||'',media:[]};}el.replaceChildren();try{renderContent(el,content,{mediaScope:scope,deferMedia:true});el.dataset.richMounted='true';}catch{el.replaceChildren();el.setAttribute('role','alert');el.textContent='這段內容暫時無法顯示，請更新狀態後再試。';}el.querySelectorAll('img').forEach(img=>{img.setAttribute('data-partner-image','');img.tabIndex=0;img.setAttribute('role','button');img.setAttribute('aria-label',(img.alt||'題目圖片')+'，點擊放大');});});
  initImageLightbox({root:document,selector:'[data-partner-image]'});
 }
 function clear(){for(const a of document.querySelectorAll('#app audio,#camp-dialog audio')){a.pause();a.removeAttribute('src');a.load();}observer?.disconnect();observer=null;observed.clear();cache.clear();document.querySelector('#lightbox-close')?.click();document.querySelector('#lightbox-img')?.removeAttribute('src');}
 return {prepare,mount,clear,resolve};
}
