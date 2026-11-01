import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {realpathSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createLearningReadOnlyReader} from './lib/admin-learning-readonly-reader.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const callback='<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Google 登入｜學生學習檔案</title><link rel="stylesheet" href="/shared/admin-learning.css"><main class="wrap"><section class="card"><h1>登入學生學習檔案</h1><p id="login-status" role="status">正在確認 Google 登入…</p><a href="/admin-learning.html">返回學習檔案</a></section></main><script type="module" src="/shared/quiz-login-callback.mjs"></script></html>';
export async function startLearningLiveServer({port=3000,reader=null,fetcher=fetch}={}){
  let boundPort=port;
  const authSource=await readFile(resolve(root,'shared/auth.js'),'utf8');
  const base=authSource.match(/SUPABASE_URL = "([^"]+)"/)[1],key=authSource.match(/SUPABASE_ANON_KEY = "([^"]+)"/)[1];
  const send=(res,status,data,type='application/json')=>{res.writeHead(status,{'Content-Type':`${type}; charset=utf-8`,'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});res.end(type==='application/json'?JSON.stringify(data):data);};
  const server=http.createServer(async(req,res)=>{
    if(![`localhost:${boundPort}`,`127.0.0.1:${boundPort}`].includes(req.headers.host))return send(res,403,{error:'local_host_required'});
    const url=new URL(req.url,`http://${req.headers.host}`);
    try{
      if(req.method==='POST'&&['/__learning-live','/__learning-live-media'].includes(url.pathname)){
        if(req.headers.origin!==url.origin)return send(res,403,{error:'origin_denied'});
        const bearer=req.headers.authorization;if(!/^Bearer \S+$/.test(bearer||''))return send(res,401,{error:'session_expired'});
        let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>8192)return send(res,413,{error:'invalid_request'});}
        const input=JSON.parse(raw),isMedia=url.pathname==='/__learning-live-media';
        const body=isMedia?{p_action:'media',p_course_id:input.course_id,p_payload:{...input.student,session_id:input.session_id,url:input.url}}:input;
        const allowed=['roster','profile','weekly','typing','typing_events','papers','paper',...(reader?['rewards','class_rewards','garden_status']:[]),...(isMedia?['media']:[])];
        if(!allowed.includes(body.p_action)||!['grade3-115-1','grade6-115-1'].includes(body.p_course_id)||!body.p_payload||typeof body.p_payload!=='object')return send(res,400,{error:'invalid_request'});
        const headers={apikey:key,Authorization:bearer,'Content-Type':'application/json'};
        const userResponse=await fetcher(`${base}/auth/v1/user`,{headers,signal:AbortSignal.timeout(10000)});
        if(!userResponse.ok)return send(res,401,{error:'session_expired'});
        const user=await userResponse.json();if(!user.email_confirmed_at||user.email?.toLowerCase()!=='chianwu@gmail.com')return send(res,403,{error:'teacher_required'});
        const teacherResponse=await fetcher(`${base}/rest/v1/rpc/is_teacher`,{method:'POST',headers,body:'{}',signal:AbortSignal.timeout(10000)});
        if(!teacherResponse.ok||await teacherResponse.json()!==true)return send(res,403,{error:'teacher_required'});
        if(reader){
          const result=await reader(body,{user});
          if(!isMedia)return send(res,200,result);
          if(result.available!==true)return send(res,403,{error:'media_unavailable'});
          // Reuse the already-deployed read signer. Its existing asset-owner
          // permission remains in force; no new Edge deployment or storage key.
          const signed=await fetcher(`${base}/functions/v1/quiz-media`,{method:'POST',headers,
            body:JSON.stringify({action:'read',url:input.url,attempt_id:null}),signal:AbortSignal.timeout(12000)});
          const data=await signed.json();if(!signed.ok||typeof data.url!=='string')return send(res,403,{error:'media_unavailable'});
          return send(res,200,{url:data.url});
        }
        // Use the production RPC only if it already exists; never create or deploy it.
        const response=await fetcher(`${base}/rest/v1/rpc/admin_learning_action`,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
        if(response.status===404)return send(res,501,{error:'live_reader_unavailable'});
        return send(res,response.status,await response.json());
      }
      if(req.method!=='GET')return send(res,405,{error:'method_not_allowed'});
      if(url.pathname==='/'){res.writeHead(302,{Location:'/admin-learning.html'});return res.end();}
      if(url.pathname==='/index.html')return send(res,200,callback,'text/html');
      const path=url.pathname,allowed=path==='/admin-learning.html'||/^\/shared\/[A-Za-z0-9_-]+\.(js|mjs|css)$/.test(path)
        ||/^\/shared\/vendor\/katex\/(katex\.min\.(css|js)|fonts\/[A-Za-z0-9_-]+\.(woff2?|ttf))$/.test(path);
      if(!allowed)return send(res,404,{error:'not_found'});
      let bytes=await readFile(resolve(root,`.${path}`));
      if(path==='/admin-learning.html')bytes=Buffer.from(bytes.toString('utf8').replace('<head>','<head><meta name="admin-learning-backend" content="local-readonly">'));
      const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf'}[extname(path)]||'application/octet-stream';
      send(res,200,bytes,mime);
    }catch(e){const known=['invalid_request','invalid_action','invalid_class','invalid_page','student_required','student_unavailable','paper_unavailable','progress_unavailable','unsupported_document'];
      send(res,e.code==='ENOENT'?404:known.includes(e.message)?400:502,{error:e.code==='ENOENT'?'not_found':known.includes(e.message)?e.message:'live_reader_unavailable'});}
  });
  await new Promise((done,fail)=>{server.once('error',fail);server.listen(port,'127.0.0.1',done);});
  boundPort=server.address().port;return{server,origin:`http://127.0.0.1:${boundPort}`,close:()=>new Promise(done=>server.close(done))};
}
if(process.argv[1]&&realpathSync(process.argv[1])===realpathSync(fileURLToPath(import.meta.url))){
  try{const reader=await createLearningReadOnlyReader();const app=await startLearningLiveServer({reader});console.log('本機真實登入／唯讀紀錄驗證：http://localhost:3000/admin-learning.html');
    for(const sig of ['SIGINT','SIGTERM'])process.once(sig,async()=>{await app.close();process.exit(0);});}
  catch(e){console.error(e.message);process.exitCode=1;}
}
