import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {realpathSync} from 'node:fs';
import {createLearningDb,learningCall,TEACHER,studentId} from './lib/admin-learning-local-db.mjs';

export async function startLearningServer({port=Number(process.env.ADMIN_LEARNING_PORT||4472)}={}){
  const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
  const {db}=await createLearningDb(),cookie=randomBytes(32).toString('hex');let origin;
  const allowed=new Set(['/admin-learning.html','/shared/admin-learning.css','/shared/admin-learning.mjs',
    '/shared/admin-learning-api.mjs','/shared/admin-learning-model.mjs','/shared/typing-foundation-curriculum.mjs',
    '/shared/zhuyin-foundation-curriculum.mjs','/shared/quiz-render.mjs','/shared/quiz-media.mjs',
    '/shared/vendor/katex/katex.min.css','/shared/vendor/katex/katex.min.js']);
  const server=http.createServer(async(req,res)=>{
    const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
    if(req.headers.host!==new URL(origin).host)return send(403,{error:'local_host_required'});
    const url=new URL(req.url,origin);
    try{
      if(req.method==='GET'&&url.pathname==='/__learning-local')return send(200,{local:true});
      if(req.method==='POST'&&['/__learning-rpc','/__learning-media'].includes(url.pathname)){
        const supplied=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('learning_local='))?.slice(15)||'';
        if(supplied.length!==cookie.length||!timingSafeEqual(Buffer.from(supplied),Buffer.from(cookie))||req.headers.origin!==origin)return send(403,{error:'local_session_required'});
        let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>8192)return send(413,{error:'invalid_request'});}
        const b=JSON.parse(text),who=req.headers['x-learning-role']==='student'?studentId(1):TEACHER;
        if(url.pathname==='/__learning-media'){
          const result=await db.transaction(async tx=>{
            await tx.query("select set_config('quiz.test_uid',$1,true)",[who]);await tx.exec('set local role authenticated');
            return(await tx.query('select public.admin_learning_media_access($1,$2,$3,$4) as asset',[b.course_id,b.student,b.session_id,b.url])).rows[0].asset;
          });
          return send(200,{url:`${origin}/__learning-demo-figure.svg`,...(!result?{error:'media_unavailable'}:{})});
        }
        return send(200,await learningCall(db,b.p_action,b.p_course_id,b.p_payload,who));
      }
      if(req.method!=='GET')return send(405,{error:'method_not_allowed'});
      if(url.pathname==='/__learning-demo-figure.svg'){
        res.writeHead(200,{'Content-Type':'image/svg+xml','Cache-Control':'no-store'});
        return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="360" height="110" viewBox="0 0 360 110"><rect width="360" height="110" fill="#f1f7fc"/><g stroke="#28618e" stroke-width="3"><path d="M20 20h160v70H20z" fill="#68b6dc"/><path d="M180 20h160v70H180z" fill="white"/><path d="M100 20v70M260 20v70"/></g></svg>');
      }
      const path=url.pathname==='/'?'/admin-learning.html':url.pathname;
      if(!allowed.has(path)&&!/^\/shared\/vendor\/katex\/fonts\/[A-Za-z0-9_-]+\.(woff2?|ttf)$/.test(path))return send(404,{error:'not_found'});
      const bytes=await readFile(resolve(root,`.${path}`)),type={'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf'}[extname(path)]||'application/octet-stream';
      res.writeHead(200,{'Content-Type':`${type}; charset=utf-8`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
        'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https:; media-src 'self' https:; font-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
        ...(path==='/admin-learning.html'?{'Set-Cookie':`learning_local=${cookie}; HttpOnly; SameSite=Strict; Path=/`}:{})});res.end(bytes);
    }catch(e){send(e.code==='ENOENT'?404:400,{error:e.code==='ENOENT'?'not_found':/^[a-z_]+$/.test(e.message)?e.message:'service_unavailable'});}
  });
  await new Promise((resolveStart,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolveStart);});
  origin=`http://127.0.0.1:${server.address().port}`;
  return{server,db,origin,close:async()=>{await new Promise(done=>server.close(done));await db.close();}};
}
if(process.argv[1]&&realpathSync(process.argv[1])===realpathSync(fileURLToPath(import.meta.url))){
  try{
    const instance=await startLearningServer();console.log(`本機學生學習檔案（純合成資料）：${instance.origin}/admin-learning.html?local=1`);
    process.once('SIGINT',async()=>{await instance.close();process.exit(0);});process.once('SIGTERM',async()=>{await instance.close();process.exit(0);});
  }catch(e){console.error(e.message);process.exitCode=1;}
}
