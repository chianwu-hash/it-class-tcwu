import http from 'node:http';
import {readFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve,dirname,extname} from 'node:path';
import {randomBytes,timingSafeEqual,createHash} from 'node:crypto';
import {createQuizDb,quizCall,studentId,TEACHER} from './lib/quiz-local-db.mjs';
import {createLocalMedia} from './lib/quiz-local-media.mjs';
const root=process.cwd(),port=Number(process.env.QUIZ_POOL_PORT||4380),origin=`http://127.0.0.1:${port}`;
const base=resolve(root,'automation/output/quiz/hanlin-g3-math-pool'),runtime=resolve(base,'runtime');await mkdir(runtime,{recursive:true});
const db=await createQuizDb(resolve(runtime,'db'));
await db.exec(await readFile('supabase/quiz-wrong-questions.sql','utf8'));await db.exec(await readFile('supabase/quiz-pool.sql','utf8'));
await db.query("update public.student_enrollments set class_code='301' where email like 'student%@example.invalid'");
const validation=JSON.parse(await readFile(resolve(base,'qa/structure-validation.json'),'utf8'));if(!validation.passed)throw Error('pool_validation_required');
const pool=JSON.parse(await readFile(resolve(base,'pool.json'),'utf8')),assets=JSON.parse(await readFile(resolve(base,'media-assets.json'),'utf8'));
if(pool.length!==validation.prepared)throw Error('pool_changed_after_validation');
if(createHash('sha256').update(await readFile(resolve(base,'pool.json'))).digest('hex')!==validation.pool_sha256)throw Error('pool_changed_after_validation');
await db.transaction(async tx=>{await tx.query('update public.quiz_question_pool set usable=false');for(const r of pool)await tx.query(`insert into public.quiz_question_pool values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true)
 on conflict(question_id) do update set question=excluded.question,checks=excluded.checks,source_version=excluded.source_version,group_key=excluded.group_key,unit_ids=excluded.unit_ids,knowledge_code=excluded.knowledge_code,knowledge_name=excluded.knowledge_name,difficulty=excluded.difficulty,publisher_explanation=excluded.publisher_explanation,usable=true`,[r.question_id,r.source_item_id,r.group_key,JSON.stringify(r.unit_ids),r.knowledge_code,r.knowledge_name,r.difficulty,r.source_version,r.publisher_explanation,JSON.stringify(r.question),JSON.stringify(r.checks)]);});
const mediaDir=resolve(runtime,'media');await mkdir(resolve(mediaDir,TEACHER),{recursive:true});
for(const [sha,a] of Object.entries(assets)){const bytes=await readFile(resolve(root,a.path));if(createHash('sha256').update(bytes).digest('hex')!==sha)throw Error('asset_changed');await copyFile(resolve(root,a.path),resolve(mediaDir,TEACHER,sha));await db.query('insert into public.quiz_media_assets values($1,$2,$3,$4,$5) on conflict(url) do nothing',[`https://quiz-media.invalid/${TEACHER}/${sha}`,TEACHER,`${TEACHER}/${sha}`,a.mime,a.bytes]);}
const media=createLocalMedia({db,directory:mediaDir,origin}),cookie=randomBytes(32).toString('hex');
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf'};
const server=http.createServer(async(req,res)=>{
 const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 if(req.headers.host!==`127.0.0.1:${port}`)return send(403,{error:'local_host_required'});
 const u=new URL(req.url,origin);
 try{
  if(req.method==='GET'&&u.pathname==='/__quiz-local')return send(200,{local:true,pool:true,grade:3});
  if(req.method==='GET'&&u.pathname.startsWith('/__quiz-file/')){const r=await media.read(u);res.writeHead(200,{'Content-Type':r.mime,'Cache-Control':'private,no-store'});return res.end(r.bytes);}
  if(req.method==='POST'&&['/__quiz-rpc','/__quiz-media'].includes(u.pathname)){
   const saved=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('quiz_pool='))?.slice(10)||'';
   if(req.headers.origin!==origin||saved.length!==cookie.length||!timingSafeEqual(Buffer.from(saved),Buffer.from(cookie)))return send(403,{error:'local_session_required'});
   const student=Number(req.headers['x-quiz-demo-student']);if(!Number.isInteger(student)||student<1||student>31)return send(401,{error:'student_required'});
   let body='';for await(const c of req){body+=c;if(Buffer.byteLength(body)>16000)return send(413,{error:'invalid_request'});}const {action,data={}}=JSON.parse(body);
   if(u.pathname==='/__quiz-media'){if(action!=='read')return send(403,{error:'teacher_required'});const r=await media.call(JSON.parse(body),`student-${student}`);return send(r.status,r.result);}
   if(['library_sessions','join','resume','submit'].includes(action))return send(200,await quizCall(db,studentId(student),action,data));
   const functions={compose:'quiz_compose',rename_paper:'quiz_rename_paper',delete_paper:'quiz_delete_paper',pool_catalog:'quiz_pool_catalog',wrong_questions:'quiz_wrong_questions'};if(!functions[action])return send(403,{error:'invalid_action'});
   const result=await db.transaction(async tx=>{await tx.query("select set_config('quiz.test_uid',$1,true)",[studentId(student)]);await tx.exec('set local role authenticated');return (await tx.query(action==='pool_catalog'?`select public.${functions[action]}() result`:`select public.${functions[action]}($1) result`,action==='pool_catalog'?[]:[JSON.stringify(data)])).rows[0].result;});return send(200,result);
  }
  if(req.method!=='GET')return send(405,{error:'method_not_allowed'});
  if(u.pathname==='/'){res.writeHead(302,{Location:'/grade3/115-1/quiz-library.html?local=1&student=1'});return res.end();}
  if(u.pathname==='/grade3/115-1/navbar.js'){
   res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});
   return res.end(`document.body.insertAdjacentHTML('afterbegin',window.__buildCourseNavbarHtml({activeWeeks:[],gradeLabel:'三年級數學｜本機測試',titleIconClass:'fa-solid fa-calculator',navClassName:'',containerClassName:'',titleClassName:'',linkClassName:'',currentWeekClassName:'',homeLabel:'選卷與組卷',homeHref:'quiz-library.html?local=1&student='+new URLSearchParams(location.search).get('student'),extraLinks:[]}));`);
  }
  if(!(/^\/shared\/[A-Za-z0-9_-]+\.(mjs|js|css)$/.test(u.pathname)||/^\/shared\/fonts\/andika\/Andika-(Regular|Bold)\.woff2$/.test(u.pathname)||/^\/shared\/vendor\/katex\/(katex.min\.(css|js)|fonts\/[A-Za-z0-9_-]+\.(woff2?|ttf))$/.test(u.pathname)||/^\/grade3\/115-1\/quiz(-library)?\.html$/.test(u.pathname)))return send(404,{error:'not_found'});
  let bytes=await readFile(resolve(root,'.'+u.pathname));if(u.pathname.endsWith('.html'))bytes=Buffer.from(bytes.toString('utf8').replace('<head>','<head><meta name="quiz-pool-local" content="1"><script src="/shared/course-navbar.js"></script>'));
  res.writeHead(200,{'Content-Type':mime[extname(u.pathname)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(u.pathname.endsWith('.html')?{'Set-Cookie':`quiz_pool=${cookie}; HttpOnly; SameSite=Strict; Path=/`}:{})});res.end(bytes);
 }catch(e){send(400,{error:e.code==='ENOENT'?'not_found':e.message});}
});
server.listen(port,'127.0.0.1',()=>console.log(`三上全冊題庫本機測試：${origin}/grade3/115-1/quiz-library.html?local=1&student=1`));
process.on('SIGINT',()=>server.close(async()=>{await db.close();process.exit(0);}));
