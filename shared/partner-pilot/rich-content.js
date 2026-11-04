import {renderContent} from './past-content.js';
import {initImageLightbox} from './image-lightbox.js';
export function createRichContent({getQuestion,getContext,loadMedia}){
 const cache=new Map();let observer=null,lastContext='',players=new Map();
 function contextKey(){const c=getContext();return c?c.room+':'+c.user+':'+c.view:'';}
 function playerKey(audio){const f=audio.closest('[data-rich-q]');const host=f?.closest('.thread'),place=host?'help-'+host.dataset.thread:f?.closest('[data-review-qid]')?'review':'own';return f?[place,f.dataset.richQ,f.dataset.richPart,f.dataset.richIndex,audio.dataset.quizMediaUrl,[...f.querySelectorAll('audio')].indexOf(audio)].join('|'):'';}
 function prepare(root){for(const a of players.values())a.pause();players.clear();const same=lastContext===contextKey();root.querySelectorAll('audio').forEach(a=>{if(same&&a.readyState>=1&&a.src)players.set(playerKey(a),a);else a.pause();});}
 const generationOf=c=>c.room+':'+c.user;
 const isActive=c=>{const next=getContext();return Boolean(next)&&generationOf(next)===generationOf(c);};
 // One cache per room view for every media read (rich text, manual-answer base images, own results),
 // so a re-render after a teammate's action does not download the same asset again.
 async function resolveFor(context,url){const match=/^https:\/\/partner-media\.invalid\/([a-f0-9]{64})$/.exec(url);if(!match||!isActive(context))throw Error('無法讀取這個媒體。');const k=generationOf(context)+':'+match[1];if(!cache.has(k)){const pending=loadMedia(context.room,match[1]).then(data=>{if(!(/^(image\/(png|jpeg|webp|gif)|audio\/(mpeg|wav|ogg))$/).test(data.mime)||typeof data.base64!=='string')throw Error('媒體格式不符。');return 'data:'+data.mime+';base64,'+data.base64.replace(/\s/g,'');}).catch(e=>{cache.delete(k);throw e;});cache.set(k,pending);}return cache.get(k);}
 async function resolve(url){const context=getContext();if(!context)throw Error('無法讀取這個媒體。');return resolveFor(context,url);}
 function mount(root){observer?.disconnect();const context=getContext();if(!context)return;lastContext=contextKey();
  const scope={active:()=>isActive(context),resolve:url=>resolveFor(context,url),observe:(element,begin)=>{element.__begin=begin;observer.observe(element);}};
  observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){observer.unobserve(entry.target);entry.target.__begin?.();}},{rootMargin:'350px'});
  root.querySelectorAll('[data-rich-q]').forEach(el=>{const q=getQuestion(Number(el.dataset.richQ));if(!q)return;const part=el.dataset.richPart,index=Number(el.dataset.richIndex);let content=part==='option'?q.rich?.options?.[index]:q.rich?.[part];if(!content){const text=part==='prompt'?q.text:part==='explanation'?q.explanation:part==='option'?q.options[index]:'';content={text:text||'',media:[]};}el.replaceChildren();try{renderContent(el,content,{mediaScope:scope,deferMedia:true});}catch{el.replaceChildren();el.setAttribute('role','alert');el.textContent='這段內容暫時無法顯示，請更新狀態後再試。';}el.querySelectorAll('img').forEach(img=>{img.setAttribute('data-partner-image','');img.tabIndex=0;img.setAttribute('role','button');img.setAttribute('aria-label',(img.alt||'題目圖片')+'，點擊放大');});});
  root.querySelectorAll('audio').forEach(a=>{const k=playerKey(a),old=players.get(k);if(old){const figure=a.closest('figure'),oldFigure=old.closest('figure');if(figure&&oldFigure){observer.unobserve(figure);figure.replaceWith(oldFigure);}else a.replaceWith(old);players.delete(k);}});for(const a of players.values())a.pause();players.clear();
  initImageLightbox({root:document,selector:'[data-partner-image]'});
 }
 function clear(){for(const a of document.querySelectorAll('#app audio')){a.pause();a.removeAttribute('src');a.load();}for(const a of players.values())a.pause();players.clear();lastContext='';observer?.disconnect();observer=null;cache.clear();document.querySelector('#lightbox-close')?.click();document.querySelector('#lightbox-img')?.removeAttribute('src');}
 return {prepare,mount,clear,resolve};
}
