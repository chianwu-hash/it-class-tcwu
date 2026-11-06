// Synthetic identities + real local SQL, production app/UI. Never uses real auth or outbound APIs.
import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {setupMatchDB} from './fixtures/partner-match-db.mjs';
import {setupReviewDB} from './fixtures/partner-review-db.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),port=Number(process.env.PORT||8840);let queue=Promise.resolve();
async function setup(){const f=await setupMatchDB();await f.db.exec('update partner_pilot.match_settings set enabled=true');return f;}
let f=await setup();
const serial=fn=>{const p=queue.then(fn);queue=p.catch(()=>{});return p;};
const stubs={
 '/__qa/auth.mjs':`const actor=Number(new URL(location.href).searchParams.get('actor'))||5;export const supabase={auth:{onAuthStateChange(){}},realtime:{async setAuth(){}},channel(topic){let fn,bc;return {state:'joined',on(a,b,callback){fn=callback;return this;},subscribe(callback){bc=new BroadcastChannel('synthetic-partner-team');bc.onmessage=e=>{if(topic.includes(e.data.room_id))fn({payload:e.data});};this.close=()=>bc.close();queueMicrotask(()=>callback('SUBSCRIBED'));return this;}};},async removeChannel(c){c.close?.();}};export const fixtureSession={user:{id:'00000000-0000-4000-8000-'+String(actor).padStart(12,'0')},access_token:'synthetic-only'};`,
 '/__qa/navbar.mjs':`import {fixtureSession} from '/__qa/auth.mjs';export function initNavbarAuth({onSessionResolved}){if(new URL(location.href).searchParams.has('loggedout')){queueMicrotask(()=>onSessionResolved(null));const button=document.createElement('button');button.id='simulate-login';button.textContent='模擬完成登入（僅本機）';button.onclick=()=>onSessionResolved(fixtureSession);document.body.prepend(button);}else queueMicrotask(()=>onSessionResolved(fixtureSession));}`,
 '/__qa/transport.mjs':`export function createAuthenticatedTransport(){const actor=new URL(location.href).searchParams.get('actor')||5;const bc=new BroadcastChannel('synthetic-partner-team');return async(path,body)=>{const response=await fetch(path.endsWith('quiz_partner_match_action')?'/__qa/match':'/__qa/action',{method:'POST',headers:{'Content-Type':'application/json','x-prototype-session':'synthetic-team-only','x-prototype-actor':actor},body:JSON.stringify(body.p)});const data=await response.json();if(!response.ok)throw Object.assign(Error(data.error),{code:data.error});if(data.id&&data.revision)bc.postMessage({room_id:data.id,revision:data.revision});else if(body.p.action==='leave')bc.postMessage({room_id:body.p.roomId,revision:Number.MAX_SAFE_INTEGER});return data;};}`
};
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.woff2':'font/woff2'};
http.createServer(async(req,res)=>{const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};try{
 const url=new URL(req.url,'http://localhost'),p=url.pathname;
 if(stubs[p]){res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});return res.end(stubs[p]);}
 if(p==='/__qa/reset'){if(req.method!=='POST'||req.headers['x-prototype-session']!=='synthetic-team-only')return json(403,{});await serial(async()=>{await f.db.close();f=await setup();});return json(200,{ok:true});}
 if(p==='/__qa/action'||p==='/__qa/match'||p==='/__qa/expire'){
  if(req.method!=='POST'||req.headers['x-prototype-session']!=='synthetic-team-only')return json(403,{});let text='';for await(const chunk of req){text+=chunk;if(text.length>500000)throw Error('TOO_LARGE');}const body=JSON.parse(text),n=Number(req.headers['x-prototype-actor']);if(!Number.isInteger(n)||n<1||n>45)return json(403,{});
  if(p==='/__qa/expire'){await serial(f.expire);return json(200,{ok:true});}
  return json(200,await serial(()=>f.call(n,body,p==='/__qa/action')));
 }
 if(req.method!=='GET'||p.includes('..'))return json(404,{});
 let body;
 if(p==='/'||p==='/grade3/115-1/partner-practice.html'){
  body=await fs.readFile(path.join(root,'grade3/115-1/partner-practice.html'),'utf8');body=body.replace(/<link[^>]+https:[^>]+>/g,'').replace(/<script src="navbar[^>]+><\/script>/,'').replaceAll('../../shared/','/shared/');
 }else if(p.startsWith('/shared/')){body=await fs.readFile(path.join(root,p));if(p==='/shared/partner-pilot/app.mjs')body=body.toString().replace("'../auth.js'","'/__qa/auth.mjs'").replace("'../navbar-auth.js'","'/__qa/navbar.mjs'").replace("'../quiz-transport.mjs'","'/__qa/transport.mjs'");}
 else return json(404,{});
 res.writeHead(200,{'Content-Type':(mime[path.extname(p)]||'text/html')+'; charset=utf-8','Cache-Control':'no-store'});res.end(body);
 }catch(e){json(400,{error:e.message});}}).listen(port,'127.0.0.1',()=>console.log(`Synthetic team app: http://localhost:${port}/?actor=5 and /?actor=6`));
