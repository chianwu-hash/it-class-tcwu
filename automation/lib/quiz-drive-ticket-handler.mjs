import {createHmac} from 'node:crypto';
const savedUrl=x=>typeof x==='string'&&/^https:\/\/quiz-media\.invalid\/[0-9a-f-]{36}\/[a-f0-9]{64}$/.test(x);
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(x);
// Local dev gateway: real Supabase Auth and existing visibility RPC, no service key.
export function createDriveTicketHandler({supabaseUrl,publishableKey,manifest,ticketKey,origins,fetcher=fetch}){
 if(supabaseUrl!=='https://upxgyusodibaqcrocdzj.supabase.co'||!/^https:\/\/[a-z0-9.-]+\.workers\.dev$/.test(manifest.workerOrigin))throw Error('invalid_gateway_configuration');
 return async request=>{
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  const send=(status,data)=>new Response(JSON.stringify(data),{status,headers});
  if(!origins.includes(request.headers.get('Origin')))return send(403,{error:'origin_denied'});
  if(request.method!=='POST')return send(405,{error:'method_not_allowed'});
  const bearer=request.headers.get('Authorization');if(!/^Bearer \S+$/.test(bearer||''))return send(401,{error:'login_required'});
  try{
   const text=await request.text();if(Buffer.byteLength(text)>12000)return send(413,{error:'invalid_request'});
   const body=JSON.parse(text);
   if(body.action!=='read'||!savedUrl(body.url)||(body.attempt_id!=null&&!uuid(body.attempt_id)))return send(400,{error:'invalid_request'});
   const authHeaders={apikey:publishableKey,Authorization:bearer};
   const userResponse=await fetcher(`${supabaseUrl}/auth/v1/user`,{headers:authHeaders,redirect:'error',signal:AbortSignal.timeout(15000)});
   if(!userResponse.ok)return send(401,{error:'login_required'});
   const user=await userResponse.json();if(!uuid(user.id)||!user.email_confirmed_at)return send(401,{error:'login_required'});
   const response=await fetcher(`${supabaseUrl}/rest/v1/rpc/quiz_media_access`,{method:'POST',headers:{...authHeaders,'Content-Type':'application/json'},body:JSON.stringify({p_url:body.url,p_attempt:body.attempt_id||null}),redirect:'error',signal:AbortSignal.timeout(15000)});
   if(!response.ok)return send(403,{error:'media_unavailable'});
   const asset=await response.json();
   if(asset.url!==body.url||!asset.mime||!Number.isInteger(asset.bytes))return send(403,{error:'media_unavailable'});
   if(asset.mime.startsWith('audio/'))return send(200,{fallback:'supabase'});
   const hash=new URL(asset.url).pathname.split('/').at(-1),image=manifest.assets[hash];
   if(!asset.mime.startsWith('image/')||!image?.verified||image.mime!==asset.mime||image.bytes!==asset.bytes)return send(503,{error:'media_unavailable'});
   const payload=Buffer.from(JSON.stringify({aud:manifest.audience,hash,fileId:image.fileId,mime:image.mime,bytes:image.bytes,role:'material',exp:Math.floor(Date.now()/1000)+300})).toString('base64url');
   const signature=createHmac('sha256',Buffer.from(ticketKey,'base64url')).update(payload).digest('base64url');
   return send(200,{url:`${manifest.workerOrigin}/media/${hash}?ticket=${payload}.${signature}`});
  }catch{return send(502,{error:'media_unavailable'});}
 };
}
