import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {randomBytes,createHash} from 'node:crypto';
export async function serveLearningFixture({db,source,bundle,uid1,uid2,root}){
 const nonce=randomBytes(20).toString('hex'),port=4501,origin='http://127.0.0.1:'+port,base=path.join(root,'baseline'),manifest=new Map(JSON.parse(fs.readFileSync(path.join(root,'complete-source-files.private.json'),'utf8')).map(f=>[f.file,f.sha])),overlays=new Set(JSON.parse(fs.readFileSync('automation/quiz-learning-runtime.json','utf8')));
 await db.query('delete from public.quiz_learning_leaves where user_id=$1',[uid1]);
 await db.query('delete from public.quiz_learning_credits where user_id=$1 and question_key=(select question_key from public.quiz_learning_credits where user_id=$1 order by created_at desc limit 1)',[uid1]);
 const auth=`export const SUPABASE_URL=${JSON.stringify(origin)},SUPABASE_ANON_KEY='fixture',TEACHER_EMAILS=[],AUTH_STORAGE_KEY='fixture';
 const selected=new URLSearchParams(location.search).get('fixture_student'),n=selected==='1'||selected==='2'?selected:sessionStorage.getItem('learning-fixture-user')||'1';sessionStorage.setItem('learning-fixture-user',n);
 let s={user:{id:n==='2'?${JSON.stringify(uid2)}:${JSON.stringify(uid1)},email:'fixture@example.invalid'},access_token:'fixture'};const cb=[];
 window.__learningAuth=next=>{s=next;cb.forEach(f=>f(next?'SIGNED_IN':'SIGNED_OUT',next));};
 export const resolveSession=async()=>s,getSession=async()=>s,isTeacher=()=>false,beginCentralizedLogin=async()=>{},signInWithGoogle=beginCentralizedLogin,signOutAndReload=async()=>window.__learningAuth(null);
 export const getStoredAccessToken=()=>s?.access_token||null,getHomeRedirectUrl=()=>'/grade3/115-1/index.html',getAdminRedirectUrl=()=>'/admin-progress.html',requireHttpForAuth=()=>true,storeLoginReturn=()=>{},consumePendingRedirect=()=>'/grade3/115-1/index.html',LOGIN_RETURN_KEY='fixture-return';
 const row={school_year:115,class_code:'301',seat_no:98,student_code:'fixture',grade:3,display_name:'合成學生'};
 const promise=data=>Object.assign(Promise.resolve({data,error:null}),{abortSignal(){return this;}});
 const query=()=>{const q=new Proxy({},{get:(_,key)=>key==='then'?promise([]).then.bind(promise([])):()=>q});return q;};
 export const supabase={rpc:()=>promise([row]),from:query,auth:{getSession:async()=>({data:{session:s}}),onAuthStateChange:f=>{cb.push(f);return {data:{subscription:{unsubscribe(){}}}};}}};`;
 const transport=`export function createAuthenticatedTransport({getSession}){return async(path,body)=>{const s=await getSession();if(!s?.user)throw Error('請先登入測試帳號。');const r=await fetch('/__learning/rpc',{method:'POST',headers:{'Content-Type':'application/json','X-Fixture':${JSON.stringify(nonce)}},body:JSON.stringify({path,body,student:s.user.id===${JSON.stringify(uid2)}?2:1})});const d=await r.json();if(!r.ok)throw Error(d.message||'fixture failed');return d;};}`;
 const whitelist=new Set(['quiz_action','quiz_entry_context','quiz_learning','quiz_rewards','quiz_wrong_questions','quiz_library_sessions','quiz_pool_catalog','quiz_past_action','quiz_compose','quiz_question_report']);
 const server=http.createServer(async(req,res)=>{
  const send=(status,value,type='application/json')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store'});res.end(type==='application/json'?JSON.stringify(value):value);};
  try{
   if(req.headers.host!=='127.0.0.1:'+port)return send(403,{});const url=new URL(req.url,origin);
   if(url.pathname==='/shared/auth.js')return send(200,auth,'text/javascript');if(url.pathname==='/shared/quiz-transport.mjs')return send(200,transport,'text/javascript');
   if(url.pathname==='/__learning/rpc'&&req.method==='POST'){
    if(req.headers['x-fixture']!==nonce)return send(403,{});let bytes='';for await(const b of req){bytes+=b;if(bytes.length>20000)return send(413,{});}
    const {path:p,body,student}=JSON.parse(bytes);if(![1,2].includes(student))return send(403,{});const uid=student===2?uid2:uid1;
    const name=p.split('/').at(-1);if(p==='/functions/v1/quiz-media'){
     await db.transaction(async tx=>{await tx.query("select set_config('quiz.test_uid',$1,true)",[uid]);await tx.exec('set local role authenticated');await tx.query('select public.quiz_media_access($1,$2)',[body.url,body.attempt_id]);});
     return send(200,{url:origin+'/__learning/image/'+body.url.split('/').at(-1)});
    }
    if(!whitelist.has(name))return send(400,{message:'fixture operation not supported'});
    const result=await db.transaction(async tx=>{await tx.query("select set_config('quiz.test_uid',$1,true)",[uid]);await tx.exec('set local role authenticated');const args=name==='quiz_action'||name==='quiz_past_action'?[body.p_action,body.p_data]:name==='quiz_pool_catalog'?[]:[body.p_data||{}];return (await tx.query('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') r',args)).rows[0].r;});return send(200,result);
   }
   if(url.pathname.startsWith('/__learning/image/')){const a=bundle.assets.find(a=>a.hash===url.pathname.split('/').at(-1));if(!a)return send(404,{});return send(200,fs.readFileSync(a.file),a.mime);}
   if(req.method!=='GET'||url.pathname.includes('..'))return send(404,{});const name=url.pathname.slice(1);let file=path.resolve(process.cwd(),name);if(!file.startsWith(process.cwd()+path.sep))return send(404,{});
   if(!overlays.has(name)){
    file=path.join(base,name);
    if(!fs.existsSync(file)){
     const sha=manifest.get(name);if(!sha)return send(404,{});const r=await fetch('https://it-class-tcwu.vercel.app/'+name);if(!r.ok)throw Error('baseline missing '+name);const bytes=Buffer.from(await r.arrayBuffer());if(createHash('sha1').update(bytes).digest('hex')!==sha)throw Error('baseline changed '+name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);
    }
   }
   const type=file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':file.endsWith('.webp')?'image/webp':file.endsWith('.png')?'image/png':file.endsWith('.woff2')?'font/woff2':'text/javascript';send(200,fs.readFileSync(file),type);
  }catch(e){send(400,{message:e.message});}
 });
 await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));console.log('Browser fixture ready '+origin);
 await new Promise(resolve=>process.once('SIGTERM',()=>server.close(resolve)));
}
