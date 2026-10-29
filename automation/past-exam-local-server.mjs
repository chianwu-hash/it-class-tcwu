import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {randomBytes} from 'node:crypto';
import {createQuizDb,TEACHER,studentId} from './lib/quiz-local-db.mjs';
const root=process.cwd(),port=4420,origin=`http://127.0.0.1:${port}`,nonce=randomBytes(24).toString('hex');
const bundle=JSON.parse(fs.readFileSync('automation/output/past-exam-production/bundle.private.json','utf8'));
const db=await createQuizDb(undefined,{batch2:true,batch3:true,batch4:true});await db.exec(fs.readFileSync('supabase/quiz-past-exams.sql','utf8'));
await db.exec("update public.student_enrollments set class_code='301' where email in('student1@example.invalid','student2@example.invalid')");
await db.query('insert into public.quiz_past_papers values($1,$2,3,115,1,$3,null,true)',[bundle.paperId,TEACHER,bundle.document.title]);
const version=(await db.query('insert into public.quiz_past_versions(paper_id,sha256,document,provenance) values($1,$2,$3,$4) returning id',[bundle.paperId,bundle.sha256,bundle.document,bundle.provenance])).rows[0].id;await db.query('update public.quiz_past_papers set active_version=$1',[version]);
for(const a of bundle.assets)await db.query('insert into public.quiz_media_assets values($1,$2,$3,$4,$5)',[a.url,TEACHER,a.object_path,a.mime,a.bytes]);
const server=http.createServer(async(req,res)=>{const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};try{
 if(req.headers.host!==`127.0.0.1:${port}`)return send(403,{});const url=new URL(req.url,origin);
 if(req.method==='GET'&&url.pathname==='/__past/blank'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end('<!doctype html><html lang="zh-Hant"><title>考古題隔離驗收</title><body></body></html>');}
 if(req.method==='GET'&&url.pathname==='/__past/setup')return send(200,{nonce,version});
 if(req.method==='POST'&&url.pathname==='/__past/rpc'){
  if(req.headers['x-fixture-nonce']!==nonce)return send(403,{});let bytes='';for await(const chunk of req)bytes+=chunk;const {action,data,student=1,fast=false}=JSON.parse(bytes),uid=student==='teacher'?TEACHER:studentId(student);
  if(fast&&action==='submit')await db.query("update public.quiz_past_views set started_at=clock_timestamp()-interval '2 minutes' where attempt_id=$1 and group_id=$2",[data.attempt_id,data.group_id]);
  const result=await db.transaction(async tx=>{await tx.query("select set_config('quiz.test_uid',$1,true)",[uid]);await tx.exec('set local role authenticated');if(action==='media'){const a=(await tx.query('select public.quiz_media_access($1,$2) r',[data.url,data.attempt_id||null])).rows[0].r;return {url:origin+'/__past/image/'+data.url.split('/').at(-1)};}return (await tx.query('select public.quiz_past_action($1,$2) r',[action,{paper_id:bundle.paperId,...data}])).rows[0].r;});return send(200,result);
 }
 if(req.method==='GET'&&/^\/__past\/image\/[a-f0-9]{64}$/.test(url.pathname)){const a=bundle.assets.find(a=>a.hash===url.pathname.split('/').at(-1));if(!a)return send(404,{});res.writeHead(200,{'Content-Type':'image/png'});return res.end(fs.readFileSync(a.file));}
 if(req.method!=='GET'||!/^\/(shared\/[a-zA-Z0-9_./-]+|grade3\/115-1\/(past-exam\.html|past-exam-review\.html|navbar\.js|quiz-library\.html))$/.test(url.pathname)||url.pathname.includes('..'))return send(404,{});
 const file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+path.sep))return send(404,{});res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':file.endsWith('.woff2')?'font/woff2':'text/javascript; charset=utf-8','Cache-Control':'no-store'});res.end(fs.readFileSync(file));
}catch(e){send(400,{message:e.message});}});
server.listen(port,'127.0.0.1',()=>console.log(origin));process.on('SIGTERM',()=>server.close(async()=>{await db.close();process.exit(0);}));
