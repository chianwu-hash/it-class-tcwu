let resolveMedia = null;
export const isSavedMedia = url => /^https:\/\/quiz-media\.invalid\/[0-9a-f-]{36}\/[0-9a-f]{64}$/.test(url);
export function configureQuizMedia(resolver) { resolveMedia = resolver; }
export async function resolveQuizMedia(url) {
  if (!isSavedMedia(url)) return url;
  if (!resolveMedia) throw new Error('媒體服務尚未就緒。');
  const resolver = resolveMedia; // Capture the resolver before awaiting/retrying.
  try {return await resolver(url);}catch(error){
    // Only retry this read on a transient service/network failure. Never replay writes
    // or retry an expired/changed login; the transport rechecks identity each time.
    if(!['media_unavailable','service_unavailable'].includes(error.code)&&!/^(連線逾時|網路中斷)/.test(error.message))throw error;
    await new Promise(resolve=>setTimeout(resolve,600));
    return resolver(url);
  }
}

const imageResolvers = new WeakMap();
export function bindQuizMedia(element, scope) { imageResolvers.set(element, scope); }
export function resolveQuizImage(image) {
  const url=image.dataset.quizMediaUrl || image.currentSrc || image.src;
  return imageResolvers.has(image) ? imageResolvers.get(image).resolve(url) : resolveQuizMedia(url);
}

// Memory only. Scope identity is immutable; a disposed view can never publish a ticket.
export function createMediaScope({context, read, valid=()=>true, ttl=45000, concurrency=3, now=Date.now}) {
  const identity=Object.freeze({...context}), cache=new Map(), pending=new Map(), jobs=[];
  let alive=true, running=0, observer;
  const active=()=>alive&&valid(identity);
  const expired=()=>Object.assign(new Error('登入身分或題目已變更。'),{code:'media_context_changed'});
  const pump=()=>{while(active()&&running<concurrency&&jobs.length){const job=jobs.shift();running++;Promise.resolve().then(()=>{if(!active())throw expired();return read(job.url,identity);}).then(job.resolve,job.reject).finally(()=>{running--;pump();});}};
  const resolve=async url=>{
    if(!active())throw expired();if(!isSavedMedia(url))return url;
    const hit=cache.get(url);if(hit&&hit.until>now())return hit.url;
    if(pending.has(url))return pending.get(url);
    const started=now();
    const promise=new Promise((resolve,reject)=>{jobs.push({url,resolve,reject});pump();}).then(value=>{
      if(!active())throw expired();
      const result=typeof value==='string'?{url:value}:value;
      // Start TTL at request start so queue/network time never extends capability life.
      const until=Math.min(started+ttl,result.expires_at ? Date.parse(result.expires_at)-10000 : Infinity);
      if(until>now())cache.set(url,{url:result.url,until});return result.url;
    }).finally(()=>pending.delete(url));
    pending.set(url,promise);return promise;
  };
  const callbacks=new Map();
  return {context:identity,active,resolve,
    observe(element,begin){
      if(typeof IntersectionObserver==='undefined'){queueMicrotask(()=>{if(active()&&element.isConnected)begin();});return;}
      observer??=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){const fn=callbacks.get(e.target);callbacks.delete(e.target);observer.unobserve(e.target);if(active())fn?.();}},{rootMargin:'100px'});
      callbacks.set(element,begin);observer.observe(element);
    },
    dispose(){alive=false;cache.clear();observer?.disconnect();callbacks.clear();for(const job of jobs.splice(0))job.reject(expired());},
  };
}
