import http from 'node:http';
import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes,randomUUID} from 'node:crypto';
import {createOpenSelfReviewDb} from './lib/quiz-open-self-review-fixture.mjs';
import {TEACHER,studentId,quizCall} from './lib/quiz-local-db.mjs';
import {newDocument,content,validateDocument} from '../shared/quiz-document.mjs';

// Loopback-only synthetic PostgreSQL + actual UI modules. No production credentials.
const output=process.argv[2];if(!output)throw Error('Expected a private fixture-info output path.');
const root=path.resolve('.'),key=randomBytes(24).toString('hex'),db=await createOpenSelfReviewDb();let session,drop=false;const traces=[];
async function reset(){
 const document=newDocument();document.title='開放作答與自評';document.catalog.volume='6年級上學期';document.catalog.subject='國語';
 const q={id:'open',type:'open',prompt:content('請用「努力」造一句完整的句子，再寫下你自己的練習方法。'),explanation:content('造句只要符合詞義、語意通順即可，參考例句不是唯一答案。'),fields:[{id:'sentence',label:'原第1空：用「努力」造句',input:'text'},{id:'idea',label:'原第2空：我的練習方法',input:'text'}],answer:{format:'self-review-v1',fields:{sentence:{examples:['秘密參考例句42：我努力完成今天的練習。'],criteria:['句子含有努力，詞義合適','句子完整、語意通順']},idea:{examples:['我會把困難的地方分段練習。'],criteria:['寫出自己的練習方法']}}}};
 document.blocks=[{id:'b1',material:content(),questions:[q]},{id:'b2',material:content(),questions:[{id:'auto',type:'short',prompt:content('這是接續的一題。請輸入「甲」。'),explanation:content('這題仍由後端核對原本的固定答案。'),answer:{accepted:['甲']}}]}];validateDocument(document);await db.query('select public.quiz_validate($1)',[document]);const bank=randomUUID(),version=randomUUID();session=randomUUID();
 await db.query('insert into public.quiz_banks(id,owner_id,draft)values($1,$2,$3)',[bank,TEACHER,document]);await db.query('insert into public.quiz_versions(id,bank_id,revision,document)values($1,$2,1,$3)',[version,bank,document]);await db.query("insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options,access_mode)values($1,$2,$3,115,'[\"603\"]','immediate',false,false,'practice')",[session,TEACHER,version]);drop=false;return session;
}
await reset();
const mime={'.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
const send=(res,status,value,type='application/json; charset=utf-8')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(type.startsWith('application/json')?JSON.stringify(value):value);};
const html=()=>`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>開放作答與自評</title><link rel="stylesheet" href="/shared/quiz-workshop/generated/quiz.css"><link rel="stylesheet" href="/shared/quiz-fields.css"><style>body{margin:0;background:#f6f5fc}.student-wrap{max-width:1080px;margin:auto;padding:18px;box-sizing:border-box}.hidden{display:none!important}</style><main class="student-wrap"><h1>開放作答與自評</h1><div id="lock">請先登入學校帳號，才能作答並保留進度。</div><div id="content" hidden><div id="questions" data-subject="國語"></div></div></main><script type="module">
import {initServerQuiz} from '/shared/quiz-server.mjs';
let uid=null;const key=${JSON.stringify(key)},sid=${JSON.stringify(session)};
const post=async(route,body)=>{const r=await fetch(route,{method:'POST',headers:{'Content-Type':'application/json','x-fixture-key':key},body:JSON.stringify(body)});const value=await r.json();if(!r.ok){const e=new Error(value.error);e.code=value.error;throw e;}return value;};
const request=async(action,data)=>{const value=await post('/rpc',{uid,action,data});window.lastSnapshot=value;return value;};
const app=initServerQuiz({selectors:{container:'questions',lock:'lock',content:'content'},server:{sessionId:sid,request}});
window.fixture={async login(n){uid=n?${JSON.stringify(studentId(1))}.slice(0,-1)+n:null;await app.handleAuthChange(uid?{user:{id:uid}}:null);},async refresh(){await app.refresh();},async dropNextSelfCheck(){await post('/control',{action:'drop'});},async inspect(){return post('/inspect',{uid});},ready:true};
</script></html>`;
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1');if(req.headers.host!==`127.0.0.1:${server.address().port}`)return send(res,403,{error:'fixture_guard_required'});
  if(url.pathname==='/'&&url.searchParams.get('token')===key){res.setHeader('Set-Cookie',`open_fixture=${key}; HttpOnly; SameSite=Strict; Path=/`);return send(res,200,html(),'text/html; charset=utf-8');}
  if(!String(req.headers.cookie||'').split(';').some(v=>v.trim()===`open_fixture=${key}`))return send(res,403,{error:'fixture_guard_required'});
  if(req.method==='POST'){
   if(req.headers['x-fixture-key']!==key||req.headers['content-type']!=='application/json')return send(res,403,{error:'fixture_guard_required'});
   let text='';for await(const chunk of req){text+=chunk;if(text.length>12000)return send(res,413,{error:'fixture_body_too_large'});}const body=JSON.parse(text);
   if(url.pathname==='/control'&&body.action==='drop'){drop=true;return send(res,200,{ok:true});}
   if(![studentId(1),studentId(2),null].includes(body.uid))return send(res,403,{error:'synthetic_identity_required'});
   if(url.pathname==='/inspect'){
    const rows=(await db.query('select r.status,r.self_rating,r.self_note,r.request_id,r.self_check_request_id from public.quiz_open_responses r join public.quiz_attempts a on a.id=r.attempt_id where a.session_id=$1 and a.user_id=$2',[session,body.uid])).rows;return send(res,200,{rows,traces});
   }
   if(url.pathname!=='/rpc'||body.data?.session_id!==session)return send(res,403,{error:'fixture_scope_required'});
   traces.push({uid:body.uid,action:body.action,question_id:body.data.question_id,request_id:body.data.request_id});
   const result=await quizCall(db,body.uid,body.action,body.data);
   if(body.action==='self_check'&&drop){drop=false;return send(res,503,{error:'模擬：自評已送達，但回應遺失。'});}
   return send(res,200,result);
  }
  if(req.method!=='GET')return send(res,405,{error:'method_not_allowed'});
  if(url.pathname==='/favicon.ico'){res.writeHead(204);return res.end();}
  // Reward notices are outside this UI fixture; SQL tests cover the real award policy.
  if(url.pathname==='/shared/garden-unlock-notice.mjs')return send(res,200,'export function afterGardenReward(){}','text/javascript; charset=utf-8');
  const file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+path.sep)||!mime[path.extname(file)])return send(res,404,{error:'not_found'});
  return send(res,200,await readFile(file),mime[path.extname(file)]);
 }catch(error){return send(res,400,{error:error.message});}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
await writeFile(output,JSON.stringify({port:server.address().port,url:`http://127.0.0.1:${server.address().port}/?token=${key}`,session,synthetic_only:true}),'utf8');console.log('Guarded open-response fixture ready.');
let closing=false;async function close(){if(closing)return;closing=true;server.close();await db.close();process.exit(0);}process.once('SIGTERM',close);process.once('SIGINT',close);
