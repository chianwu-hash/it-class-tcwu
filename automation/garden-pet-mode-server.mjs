// Isolated local acceptance server. No cloud tokens, student data or production writes.
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {randomBytes} from 'node:crypto';
import {setup,growth,leaves} from './lib/garden-level2-local-db.mjs';
const db=await setup(),root=process.cwd(),port=Number(process.env.GARDEN_LOCAL_PORT||4460),nonce=randomBytes(24).toString('hex'),cid='grade3-115-1';
await db.query("select set_config('test.flowers',$1,false)",[JSON.stringify([{id:'past:00000000-0000-4000-8000-000000000099'}])]);await leaves(db,48);await growth(db);await db.query("update garden_growth set seen_at=now()");await db.exec('update garden_item_notices set seen_at=now()');
const stub=`const session={user:{id:'00000000-0000-4000-8000-000000000001',email:'student@example.invalid'}};export const getSession=async()=>({session});export const isTeacher=()=>false;let nonce;export const supabase={rpc:async(name,args)=>{try{nonce??=(await (await fetch('/__garden/setup')).json()).nonce;const r=await fetch('/__garden/rpc',{method:'POST',headers:{'Content-Type':'application/json','X-Fixture-Nonce':nonce},body:JSON.stringify({name,args})});const data=await r.json();return r.ok?{data,error:null}:{data:null,error:data}}catch(e){return {error:e}}}};export const fixtureSession=session;`;
const server=http.createServer(async(req,res)=>{const send=(s,x)=>{res.writeHead(s,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(x))};try{
 if(req.headers.host!==`127.0.0.1:${port}`)return send(403,{});const u=new URL(req.url,`http://127.0.0.1:${port}`);
 if(u.pathname==='/__garden/setup')return send(200,{nonce});
 if(req.method==='POST'&&u.pathname==='/__garden/rpc'){
  if(req.headers['x-fixture-nonce']!==nonce)return send(403,{});let body='';for await(const c of req){body+=c;if(body.length>50000)return send(413,{})}const {name,args={}}=JSON.parse(body);let r;
  if(name==='fixture-notice'){await db.exec("update garden_item_notices set seen_at=null,claim_id=null,claim_until=null where item_key in ('pet:dog','home:cat:c')");r={ok:true};
  }else if(name==='fixture'){
   if(!Number.isInteger(args.leaves)||args.leaves<0||args.leaves>200)return send(400,{});await leaves(db,args.leaves);await growth(db);r={ok:true};
  }else if(name==='model'){
   const g=await growth(db);const rewards=g.order.map((x,i)=>({...x,title:x.sourceType==='past_exam'?'期中綜合練習・考古花':x.kind==='flower'?'第 '+(i+1)+' 份開花成果':'第 '+(i+1)+' 份練習成果',href:'/grade3/115-1/week01.html',leafKind:x.kind==='quiz-leaf'?'quiz':'typing'}));
   r={rewards,stats:{leafCount:rewards.filter(x=>x.kind!=='flower').length,flowerCount:rewards.filter(x=>x.kind==='flower').length},pendingLeaves:[{id:'pending-leaf',title:'下一份練習',href:'/grade3/115-1/week01.html'}],pendingFlowers:[{id:'pending-flower',title:'魔王關',href:'/grade3/115-1/week01.html'}]};
  }else if(name==='garden_growth')r=(await db.query('select garden_growth($1,$2) r',[args.p_course_id,args.p_action||'get'])).rows[0].r;
  else if(name==='garden_companions')r=(await db.query('select garden_companions($1,$2,$3) r',[args.p_course_id,args.p_action,args.p_data])).rows[0].r;
  else if(name==='garden_tree_skin')r=(await db.query('select garden_tree_skin($1) r',[args.p_skin])).rows[0].r;
  else if(name==='garden_unlock_notice')r=(await db.query('select garden_unlock_notice($1,$2,$3) r',[args.p_course_id,args.p_action,args.p_claim])).rows[0].r;
  else return send(400,{});return send(200,r);
 }
 if(u.pathname==='/api/garden-weather')return send(503,{message:'Local fixture uses time fallback; no cloud weather requests.'});
 let body,mime;if(u.pathname==='/shared/auth.js'){body=stub;mime='text/javascript'}else{
  const pathname=u.pathname==='/'?'/automation/fixtures/garden-level2.html':u.pathname;
  if(req.method!=='GET'||!/^\/(garden\/|shared\/|assets\/reward-tree\/|automation\/fixtures\/garden-level2\.html)/.test(pathname)||pathname.includes('..'))return send(404,{});
  const p=path.resolve(root,'.'+pathname);if(!p.startsWith(root+path.sep)||!fs.existsSync(p))return send(404,{missing:pathname});body=fs.readFileSync(p);mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css','.webp':'image/webp','.png':'image/png'}[path.extname(p)]||'application/octet-stream';
 }
 res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-store'});res.end(body);
 }catch(e){send(400,{message:e.message})}});
server.listen(port,'127.0.0.1',()=>console.log(`http://127.0.0.1:${port}/`));process.on('SIGTERM',()=>server.close(async()=>{await db.close();process.exit(0)}));
