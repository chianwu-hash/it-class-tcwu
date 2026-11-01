import { signDriveImage } from '../quiz-media/drive-ticket.mjs';

// Separate read-only endpoint; no change to student media or quiz write paths.
export function createHandler({env,fetcher=fetch}) {
  return async request=>{
    const origin=request.headers.get('origin'),origins=(env('QUIZ_ALLOWED_ORIGINS')||'').split(',');
    const cors=origin&&origins.includes(origin)?{'Access-Control-Allow-Origin':origin,Vary:'Origin',
      'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'}:{};
    const send=(status,data)=>new Response(status===204?null:JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
    if(origin&&!origins.includes(origin))return send(403,{error:'origin_denied'});
    if(request.method==='OPTIONS')return send(204,null);
    if(request.method!=='POST')return send(405,{error:'method_not_allowed'});
    try{
      const bodyText=await request.text();if(bodyText.length>4096)return send(413,{error:'invalid_request'});
      const b=JSON.parse(bodyText),bearer=request.headers.get('authorization');
      if(!/^Bearer \S+$/.test(bearer||''))return send(401,{error:'login_required'});
      const base=env('SUPABASE_URL'),key=env('SUPABASE_ANON_KEY')||Object.values(JSON.parse(env('SUPABASE_PUBLISHABLE_KEYS')||'{}'))[0];
      const service=env('SUPABASE_SERVICE_ROLE_KEY')||Object.values(JSON.parse(env('SUPABASE_SECRET_KEYS')||'{}'))[0];
      if(!base||!key||!service)throw new Error('service_unavailable');
      const call=(url,options)=>fetcher(url,{...options,redirect:'manual',signal:AbortSignal.timeout(10000)});
      // JWT verification and teacher/roster/version/asset binding happen in the RPC.
      const permission=await call(`${base}/rest/v1/rpc/admin_learning_media_access`,{method:'POST',headers:{apikey:key,Authorization:bearer,'Content-Type':'application/json'},
        body:JSON.stringify({p_course_id:b.course_id,p_student:b.student,p_session:b.session_id,p_url:b.url})});
      if(!permission.ok)return send(403,{error:'media_unavailable'});
      const asset=await permission.json();if(asset.url!==b.url||!/^image\/|^audio\//.test(asset.mime)||!asset.object_path)throw new Error('media_unavailable');
      if(env('QUIZ_IMAGE_BACKEND')==='drive'&&asset.mime.startsWith('image/'))return send(200,{url:await signDriveImage(asset,env)});
      const signed=await call(`${base}/storage/v1/object/sign/quiz-media/${asset.object_path}`,{method:'POST',headers:{apikey:service,
        ...(service.startsWith('sb_secret_')?{}:{Authorization:`Bearer ${service}`}), 'Content-Type':'application/json'},body:JSON.stringify({expiresIn:60})});
      if(!signed.ok)throw new Error('media_unavailable');
      const {signedURL}=await signed.json();if(typeof signedURL!=='string'||!signedURL.startsWith('/object/sign/quiz-media/'))throw new Error('media_unavailable');
      return send(200,{url:`${base}/storage/v1${signedURL}`});
    }catch{return send(400,{error:'media_unavailable'});}
  };
}
