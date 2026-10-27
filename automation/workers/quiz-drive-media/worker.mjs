// Private Google Drive bytes never pass through Supabase.
import {assets as libraryAssets} from './assets.mjs';
const encoder=new TextEncoder();
let tokenCache=null;
const decode=value=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const hex=value=>Array.from(new Uint8Array(value),v=>v.toString(16).padStart(2,'0')).join('');
async function accessToken(env,fetcher){
 if(tokenCache?.expires>Date.now()+60000)return tokenCache.token;
 const r=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:env.DRIVE_CLIENT_ID,client_secret:env.DRIVE_CLIENT_SECRET,refresh_token:env.DRIVE_REFRESH_TOKEN,grant_type:'refresh_token'})});
 if(!r.ok)throw Error('drive_authorization_unavailable');
 const d=await r.json();if(!d.access_token)throw Error('drive_authorization_unavailable');
 tokenCache={token:d.access_token,expires:Date.now()+Number(d.expires_in||300)*1000};return tokenCache.token;
}
export function resetTokenCache(){tokenCache=null;}
async function downloadOriginal(fileId,token,fetcher){
 let target=new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`);
 for(let hop=0;hop<4;hop++){
  if(target.protocol!=='https:'||target.port||target.username||target.password||!(target.hostname==='www.googleapis.com'||target.hostname.endsWith('.googleusercontent.com')))throw Error('invalid_google_download');
  const r=await fetcher(target.href,{headers:target.hostname==='www.googleapis.com'?{Authorization:`Bearer ${token}`}:{},redirect:'manual'});
  if(![301,302,303,307,308].includes(r.status))return r;
  const next=r.headers.get('Location');if(!next)throw Error('invalid_google_download');
  target=new URL(next,target);
 }
 throw Error('google_redirect_limit');
}
export async function handleMedia(request,env,ctx={waitUntil(){}},{fetcher=fetch,cache=globalThis.caches?.default}={}){
 const url=new URL(request.url),origin=request.headers.get('Origin');
 const allowed=(env.ALLOWED_ORIGINS||'').split(',').filter(Boolean);
 const headers={'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','Cross-Origin-Resource-Policy':'cross-origin',...(origin&&allowed.includes(origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Expose-Headers':'X-Quiz-Media-Source,X-Quiz-Cache,X-Quiz-SHA256'}:{})};
 const fail=(status,error)=>Response.json({error},{status,headers});
 if(origin&&!allowed.includes(origin))return fail(403,'origin_not_allowed');
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, OPTIONS'}});
 if(request.method!=='GET')return fail(405,'method_not_allowed');
 if(url.pathname==='/health')return Response.json({service:env.MEDIA_AUDIENCE||'quiz-drive-media-poc',ready:!!(env.MEDIA_TICKET_KEY&&env.DRIVE_REFRESH_TOKEN)},{headers});
 const match=url.pathname.match(/^\/media\/([a-f0-9]{64})$/);if(!match)return fail(404,'not_found');
 let stage='ticket';
 try{
  const ticket=url.searchParams.get('ticket')||'';if(ticket.length>3000)return fail(401,'invalid_ticket');
  const parts=ticket.split('.');if(parts.length!==2)return fail(401,'invalid_ticket');
  const key=await crypto.subtle.importKey('raw',decode(env.MEDIA_TICKET_KEY),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('HMAC',key,decode(parts[1]),encoder.encode(parts[0])))return fail(401,'invalid_ticket');
  const cap=JSON.parse(new TextDecoder().decode(decode(parts[0]))),now=Math.floor(Date.now()/1000);
  if(cap.aud!==(env.MEDIA_AUDIENCE||'quiz-drive-media-poc')||cap.hash!==match[1]||!Number.isInteger(cap.exp)||cap.exp<=now||cap.exp>now+900||!['prompt','option','explanation','material'].includes(cap.role))return fail(401,'invalid_ticket');
  const assets=env.MEDIA_ASSETS?JSON.parse(env.MEDIA_ASSETS):libraryAssets,asset=assets[cap.hash];
  if(!asset||(cap.fileId!==undefined&&asset.fileId!==cap.fileId)||asset.mime!==cap.mime||asset.bytes!==cap.bytes)return fail(403,'asset_not_allowed');
  stage='cache';
  const cacheKey=new Request(`${url.origin}/__private-cache/${cap.hash}`);
  let stored=cache?await cache.match(cacheKey):null,cacheStatus=stored?'HIT':'MISS';
  if(!stored){
   stage='drive_authorization';const token=await accessToken(env,fetcher);
   stage='drive_download';
   const upstream=await downloadOriginal(asset.fileId,token,fetcher);
   if(!upstream.ok)return fail(upstream.status===429||upstream.status===403?503:502,'drive_unavailable');
   if(!/^image\/(png|jpeg|webp|gif)$/.test(asset.mime)||asset.bytes>8*1024*1024)return fail(502,'invalid_media');
   stage='original_integrity';const chunks=[];let total=0;
   for await(const chunk of upstream.body){total+=chunk.byteLength;if(total>asset.bytes||total>8*1024*1024)return fail(502,'invalid_media');chunks.push(chunk);}
   const bytes=new Uint8Array(total);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
   if(total!==asset.bytes||hex(await crypto.subtle.digest('SHA-256',bytes))!==cap.hash)return fail(502,'media_integrity_failed');
   stored=new Response(bytes,{headers:{'Content-Type':asset.mime,'Cache-Control':'public, max-age=600'}});
   stage='cache_write';if(cache)ctx.waitUntil(cache.put(cacheKey,stored.clone()));
  }
  return new Response(stored.body,{headers:{...headers,'Content-Type':asset.mime,'X-Quiz-Media-Source':'google-drive-via-cloudflare','X-Quiz-Cache':cacheStatus,'X-Quiz-SHA256':cap.hash}});
 }catch{return stage==='ticket'?fail(401,'invalid_ticket'):fail(502,`media_service_unavailable_${stage}`);}
}
export default {fetch:(request,env,ctx)=>handleMedia(request,env,ctx)};
