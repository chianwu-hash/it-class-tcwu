import {validateWav,validateSketch} from './contract.mjs';
const LIMIT=1400000,UUID=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const digest=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
async function bounded(response,max=LIMIT){const reader=response.body?.getReader();if(!reader)throw Error('INVALID_MEDIA');const chunks=[];let size=0,timeout;const late=new Promise((_,reject)=>timeout=setTimeout(()=>reject(Error('MEDIA_UNAVAILABLE')),12000));try{for(;;){const {done,value}=await Promise.race([reader.read(),late]);if(done)break;size+=value.length;if(size>max)throw Error('INVALID_MEDIA');chunks.push(value);}const bytes=new Uint8Array(size);let i=0;for(const c of chunks){bytes.set(c,i);i+=c.length;}return bytes;}finally{clearTimeout(timeout);await reader.cancel().catch(()=>{});}}
function from64(text){if(typeof text!=='string'||text.length>1280060||text.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(text))throw Error('INVALID_MEDIA');let s;try{s=atob(text);}catch{throw Error('INVALID_MEDIA');}return Uint8Array.from(s,c=>c.charCodeAt(0));}
function to64(bytes){let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s);}
const canonical=value=>{validateSketch(value);return {version:1,strokes:value.strokes};};
export function createHandler({env,fetcher=fetch}){return async request=>{
 const origin=request.headers.get('origin')||'',allowed=origin==='https://it-class-tcwu.vercel.app'||/^https:\/\/it-class-tcwu-[a-z0-9]+-chianwu-4755s-projects\.vercel\.app$/.test(origin);
 const headers={'Content-Type':'application/json','Cache-Control':'private, no-store',Vary:'Origin',...(allowed?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'}:{})},send=(status,data)=>new Response(JSON.stringify(data),{status,headers});
 if(origin&&!allowed)return send(403,{error:'MEDIA_DENIED'});if(request.method==='OPTIONS')return send(allowed?200:403,{});if(request.method!=='POST')return send(405,{error:'METHOD_NOT_ALLOWED'});const bearer=request.headers.get('authorization');if(!/^Bearer \S+$/.test(bearer||''))return send(401,{error:'LOGIN_REQUIRED'});
 try{
  const key=(name,dict)=>env(name)||Object.values(JSON.parse(env(dict)||'{}'))[0],base=env('SUPABASE_URL'),anon=key('SUPABASE_ANON_KEY','SUPABASE_PUBLISHABLE_KEYS'),service=key('SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEYS');if(!base||!anon||!service)throw Error('MEDIA_UNAVAILABLE');
  const call=async(url,options={})=>{try{return await fetcher(url,{...options,redirect:'manual',signal:AbortSignal.timeout(15000)});}catch{throw Error('MEDIA_UNAVAILABLE');}},upstreamJSON=async(response,max)=>{try{return JSON.parse(new TextDecoder().decode(await bounded(response,max)));}catch{throw Error('MEDIA_UNAVAILABLE');}},userHeaders={apikey:anon,Authorization:bearer,'Content-Type':'application/json'},serviceHeaders={apikey:service,'Content-Type':'application/json',...(service.startsWith('sb_secret_')?{}:{Authorization:'Bearer '+service})};
  const auth=await call(base+'/auth/v1/user',{headers:userHeaders});if(!auth.ok){if(auth.status===401||auth.status===403)return send(401,{error:'LOGIN_REQUIRED'});throw Error('MEDIA_UNAVAILABLE');}
  const p=JSON.parse(new TextDecoder().decode(await bounded(request)));if(!UUID.test(p.roomId||''))throw Error('INVALID_MEDIA');
  const rpc=async(name,args,privileged=false)=>{const r=await call(base+'/rest/v1/rpc/'+name,{method:'POST',headers:privileged?serviceHeaders:userHeaders,body:JSON.stringify(args)});const value=await upstreamJSON(r);if(r.status>=500)throw Error('MEDIA_UNAVAILABLE');if(!r.ok)throw Error(/^[A-Z_]+$/.test(value.message||'')?value.message:'MEDIA_DENIED');return value;};
  if(p.action==='store'){
   if(!UUID.test(p.clientId||'')||!['ask','reply','chat'].includes(p.purpose)||!['audio_wav','drawing_v1'].includes(p.kind))throw Error('INVALID_MEDIA');
   let bytes,payload=null,meta;
   if(p.kind==='audio_wav'){bytes=from64(p.base64);const v=validateWav(bytes.buffer);meta={bytes:bytes.length,durationMs:Math.round(v.duration*1000),strokeCount:null};}
   else{payload=canonical(p.payload);bytes=new TextEncoder().encode(JSON.stringify(payload));meta={bytes:bytes.length,durationMs:null,strokeCount:payload.strokes.length};}
   const hash=await digest(bytes),intent=await rpc('quiz_partner_message_action',{p:{action:'intent',roomId:p.roomId,clientId:p.clientId,kind:p.kind,purpose:p.purpose,qid:p.qid,thread:p.thread,sha256:hash,...meta}});
   if(['ready','draft_saved'].includes(intent.state))return send(200,{attachment:{id:intent.id,kind:intent.kind,bytes:intent.bytes,durationMs:intent.durationMs,strokeCount:intent.strokeCount,state:intent.state}});
   if(intent.state!=='staging'||!UUID.test(intent.id||''))throw Error('MEDIA_DENIED');
   if(p.kind==='audio_wav'){
    const expected='rooms/'+p.roomId+'/attachments/'+intent.id+'.wav';if(intent.objectKey!==expected)throw Error('MEDIA_DENIED');const target=base+'/storage/v1/object/partner-message-media/'+expected.split('/').map(encodeURIComponent).join('/');
    const stored=await call(target,{method:'POST',headers:{...serviceHeaders,'Content-Type':'audio/wav','x-upsert':'false'},body:bytes});
    if(!stored.ok){const error=await upstreamJSON(stored,4000);if(stored.status!==409&&!['409','Duplicate'].includes(String(error.statusCode||error.error)))throw Error('MEDIA_UNAVAILABLE');const existing=await call(base+'/storage/v1/object/authenticated/partner-message-media/'+expected.split('/').map(encodeURIComponent).join('/'),{headers:serviceHeaders});if(!existing.ok||await digest(await bounded(existing,960044))!==hash)throw Error('MEDIA_UNAVAILABLE');}
   }
   const attachment=await rpc('quiz_partner_message_finalize',{p_id:intent.id,p_sha:hash,p_payload:payload},true);return send(200,{attachment});
  }
  if(p.action==='read'){
   if(!UUID.test(p.id||''))throw Error('INVALID_MEDIA');const descriptor=await rpc('quiz_partner_message_action',{p:{action:'describe',roomId:p.roomId,id:p.id}});
   if(descriptor.kind==='drawing_v1'){const payload=canonical(descriptor.payload);if(await digest(new TextEncoder().encode(JSON.stringify(payload)))!==descriptor.sha256)throw Error('MEDIA_UNAVAILABLE');return send(200,{kind:descriptor.kind,payload});}
   const expected='rooms/'+p.roomId+'/attachments/'+p.id+'.wav';if(descriptor.kind!=='audio_wav'||descriptor.objectKey!==expected||descriptor.bytes>960044)throw Error('MEDIA_DENIED');
   const response=await call(base+'/storage/v1/object/authenticated/partner-message-media/'+expected.split('/').map(encodeURIComponent).join('/'),{headers:serviceHeaders});if(!response.ok)throw Error('MEDIA_UNAVAILABLE');const bytes=await bounded(response,960044);let v;try{v=validateWav(bytes.buffer);}catch{throw Error('MEDIA_UNAVAILABLE');}if(v.byteLength!==descriptor.bytes||Math.round(v.duration*1000)!==descriptor.durationMs||await digest(bytes)!==descriptor.sha256)throw Error('MEDIA_UNAVAILABLE');return send(200,{kind:descriptor.kind,mime:'audio/wav',base64:to64(bytes)});
  }
  throw Error('INVALID_MEDIA');
 }catch(error){const code=/^[A-Z_]+$/.test(error?.message||'')?error.message:'INVALID_MEDIA';return send(code==='MEDIA_UNAVAILABLE'?503:['MEDIA_DENIED','NOT_MEMBER','ACCESS_DENIED'].includes(code)?403:400,{error:code});}
};}
