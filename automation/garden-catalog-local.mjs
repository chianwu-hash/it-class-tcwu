import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {randomBytes} from 'node:crypto';
import {setupCatalogFixture} from './lib/garden-catalog-fixture.mjs';
const snapshot=process.env.GARDEN_CATALOG_SNAPSHOT;if(!snapshot)throw Error('snapshot_required');
const {db,model,call}=await setupCatalogFixture(snapshot),root=process.cwd(),nonce=randomBytes(24).toString('hex'),port=4466;
const html=`<!doctype html><html lang="zh-Hant-TW"><meta charset="utf-8"><title>努力樹升級驗收</title><link rel="stylesheet" href="/shared/effort-garden-v2.css"><style>body{max-width:1000px;margin:auto;background:#eaf8ef;font:16px system-ui}.profile-card{padding:16px}button{min-height:44px}</style><h1>努力樹自動成長驗收</h1><p>隔離資料：62 葉、10 花</p><aside class="profile-card">測試同學</aside><div id="stage">第一級努力樹</div><script type="module">import{createGardenUpgrade}from'/shared/effort-garden-v2.mjs';import{supabase,fixtureSession}from'/shared/auth.js';const app=createGardenUpgrade({supabase,getSession:()=>fixtureSession,stage:document.getElementById('stage'),onSelect:()=>{}});const{data}=await supabase.rpc('model');window.fixtureApp=app;await app.render(data,'grade3-115-1');</script>`;
const auth=`const session={user:{id:'00000000-0000-4000-8000-000000000001',email:'student@example.invalid'}};export const fixtureSession=session;export const getSession=async()=>({session});export const isTeacher=()=>false;export const supabase={rpc:async(name,args={})=>{const r=await fetch('/__fixture',{method:'POST',headers:{'Content-Type':'application/json','X-Fixture-Nonce':'${nonce}'},body:JSON.stringify({name,args})});const data=await r.json();return r.ok?{data,error:null}:{data:null,error:data}}};`;
http.createServer(async(req,res)=>{const send=(s,b,type='application/json')=>{res.writeHead(s,{'Content-Type':type,'Cache-Control':'no-store'});res.end(type==='application/json'&&!Buffer.isBuffer(b)?JSON.stringify(b):b)};try{
 if(req.headers.host!==`127.0.0.1:${port}`)return send(403,{});const u=new URL(req.url,`http://127.0.0.1:${port}`);
 if(u.pathname==='/__fixture'&&req.method==='POST'){
  if(req.headers['x-fixture-nonce']!==nonce)return send(403,{});let body='';for await(const c of req){body+=c;if(body.length>2000)return send(413,{})}const {name,args={}}=JSON.parse(body);let r;
  if(name==='model')r=model;
  else if(name==='garden_growth')r=await call(args.p_action||'get');
  else if(name==='garden_companions')r=(await db.query('select garden_companions($1,$2,$3) r',[args.p_course_id,args.p_action,args.p_data])).rows[0].r;
  else if(name==='garden_tree_skin')r=(await db.query('select garden_tree_skin($1) r',[args.p_skin])).rows[0].r;
  else if(name==='garden_unlock_notice')r=null;
  else if(name==='report')r={growth:(await db.query('select grown_at,seen_at,jsonb_array_length(baseline) as rewards from garden_growth')).rows};
  else return send(400,{});return send(200,r);
 }
 if(u.pathname==='/')return send(200,html,'text/html; charset=utf-8');
 if(u.pathname==='/shared/auth.js')return send(200,auth,'text/javascript');
 if(u.pathname==='/shared/effort-garden-v2.mjs')return send(200,fs.readFileSync(snapshot+'/effort-garden-v2.mjs'),'text/javascript');
 if(u.pathname==='/api/garden-weather')return send(503,{});
 if(req.method!=='GET'||!/^\/(garden|shared|assets)\//.test(u.pathname))return send(404,{});
 const file=path.resolve(root,'.'+u.pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return send(404,{});
 send(200,fs.readFileSync(file),({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png'}[path.extname(file)]||'application/octet-stream'));
}catch(e){send(400,{message:e.message})}}).listen(port,'127.0.0.1',()=>console.log('http://127.0.0.1:'+port));
