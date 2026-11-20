import {fileURLToPath} from 'node:url';import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {randomBytes} from 'node:crypto';
import {setupProductionQuizDB} from './fixtures/production-quiz-db.mjs';
import {validateDrawing} from '../shared/drawing/contract.mjs';
const repo=fileURLToPath(new URL('../',import.meta.url)),ui=fileURLToPath(new URL('./quiz-original-task-preview/',import.meta.url));
const D=path.resolve(process.argv[2]??'');if(!process.argv[2]||!fs.existsSync(D+'/tasks.public.json'))throw Error('請提供私有試用資料目錄');process.chdir(repo);
const tasks=JSON.parse(fs.readFileSync(D+'/tasks.public.json')),reviews=JSON.parse(fs.readFileSync(D+'/reviews.private.json')),prefix='/trial/'+randomBytes(24).toString('hex')+'/',cookie=randomBytes(32).toString('hex');
const {db}=await setupProductionQuizDB({snapshot:true});await db.exec(fs.readFileSync(repo+'/supabase/quiz-original-drawing.sql','utf8'));await db.exec('create table public.original_trial_responses(task_id text primary key,value jsonb not null,reviewed boolean not null default false)');
const record=D+'/responses.private.json';if(fs.existsSync(record))for(const r of JSON.parse(fs.readFileSync(record)))await db.query('insert into public.original_trial_responses values($1,$2,$3)',[r.task_id,r.value,r.reviewed]);
const allowed={expression:['result','work'],vertical:['f1','f2','work'],grid:['work'],sector:['work'],color:['work'],measure:['choice','work'],graph:['x0','y0','plot0','x1','y1','plot1','discuss0','discuss1','discuss2','conclusion'],experiment:['observation0_0','observation0_1','observation1_0','observation1_1','observation2_0','observation2_1','discuss0','discuss1','discuss2','discuss3','conclusion0','conclusion1','conclusion2']};
function reviewFor(id,value){const review=structuredClone(reviews[id]),check=review.check;delete review.check;if(check){const correct=Object.entries(check).every(([key,expected])=>value[key]?.trim()===expected);review.correct=correct;review.verdict=correct?'答案欄答對了。請再對照自己的過程。':'答案欄請再核對，下方有完整參考解法。';}return review;}
const persist=async()=>{const rows=(await db.query('select * from public.original_trial_responses order by task_id')).rows;fs.writeFileSync(record+'.tmp',JSON.stringify(rows));fs.renameSync(record+'.tmp',record);};
const json=(res,status,obj)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj));};let port=0;
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};
const sourceAssets=new Set(JSON.stringify(tasks).match(/\.\/assets\/[a-f0-9]+\.[a-z]+/g)?.map(s=>s.slice(2))??[]),reviewAssets=new Set(JSON.stringify(reviews).match(/\.\/assets\/[a-f0-9]+\.[a-z]+/g)?.map(s=>s.slice(2))??[]);
const server=http.createServer(async(req,res)=>{try{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
 const u=new URL(req.url,'http://127.0.0.1:'+port);if(!u.pathname.startsWith(prefix))return json(res,403,{error:'沒有試用授權'});const route=decodeURIComponent(u.pathname.slice(prefix.length));
 if(route===''||route==='index.html')res.setHeader('Set-Cookie','original_trial='+cookie+'; HttpOnly; SameSite=Strict; Path='+prefix);
 else if(!req.headers.cookie?.split(';').some(s=>s.trim()==='original_trial='+cookie))return json(res,403,{error:'請由試用入口開啟'});
 if(req.method==='POST'){
  if(req.headers.origin!=='http://127.0.0.1:'+port)return json(res,403,{error:'來源不符'});
  if(!['api/save','api/review','api/edit'].includes(route))return json(res,404,{});let b='';for await(const chunk of req){b+=chunk;if(Buffer.byteLength(b)>1500000)return json(res,413,{});}const body=JSON.parse(b),task=tasks.find(t=>t.id===body.id);if(!task)return json(res,400,{error:'題目不存在'});
  if(Object.keys(body).some(k=>!['id','value'].includes(k))||!body.value||typeof body.value!=='object'||Array.isArray(body.value))return json(res,400,{error:'作答格式不符'});
  for(const [key,v]of Object.entries(body.value)){if(!allowed[task.kind].includes(key))return json(res,400,{error:'欄位不符'});const sketch=key==='work'&&task.kind!=='expression'||key.startsWith('plot');if(sketch){if(!v||typeof v!=='object'||Array.isArray(v))return json(res,400,{error:'圖形格式不符'});if(!(v.strokes?.length||v.marks?.length)){if(JSON.stringify(v)!=='{"version":2,"strokes":[],"marks":[]}')return json(res,400,{error:'圖形格式不符'});continue;}validateDrawing(v);if(!(await db.query('select public.quiz_sketch_valid($1) ok',[v])).rows[0].ok)return json(res,400,{error:'圖形無法保存'});}else if(typeof v!=='string'||[...v].length>250)return json(res,400,{error:'每欄最多250字'});}
  const checked=route==='api/review';await db.query('insert into public.original_trial_responses(task_id,value,reviewed)values($1,$2,$3)on conflict(task_id)do update set value=excluded.value,reviewed=excluded.reviewed',[task.id,body.value,checked]);await persist();const review=checked?reviewFor(task.id,body.value):undefined;
  return json(res,200,{saved:true,value:body.value,review});
 }
 if(req.method!=='GET')return json(res,405,{});
 if(route==='api/tasks')return json(res,200,tasks);
 if(route==='api/state'){const r=(await db.query('select * from public.original_trial_responses')).rows;return json(res,200,r.map(v=>({...v,review:v.reviewed?reviewFor(v.task_id,v.value):undefined})));}
 let file;if(route===''||route==='index.html')file=ui+'/index.html';else if(route==='app.mjs')file=ui+'/app.mjs';else if(route==='trial.css')file=ui+'/trial.css';else if(route.startsWith('shared/')&&!route.includes('..'))file=repo+'/'+route;
 else if(sourceAssets.has(route)||reviewAssets.has(route)){if(!sourceAssets.has(route)){const ids=Object.entries(reviews).filter(([,v])=>JSON.stringify(v).includes('./'+route)).map(([id])=>id);const permitted=(await db.query('select 1 from public.original_trial_responses where reviewed=true and task_id=any($1) limit 1',[ids])).rows.length;if(!permitted)return json(res,403,{});}file=D+'/'+route;}else return json(res,404,{});
 if(!file||!fs.existsSync(file)||!fs.statSync(file).isFile())return json(res,404,{});res.writeHead(200,{'Content-Type':mime[path.extname(file)]??'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);
 }catch(e){json(res,400,{error:e.message==='Unexpected end of JSON input'?'格式不完整':String(e.message).slice(0,180)});}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));port=server.address().port;const url='http://127.0.0.1:'+port+prefix;fs.writeFileSync(D+'/entry.private.json',JSON.stringify({url,port,pid:process.pid,started:new Date().toISOString()}));console.log('八題試用服務已啟動（僅本機、專屬入口）');
