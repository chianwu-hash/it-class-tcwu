// Isolated synthetic UI only. No real auth, RPC proxy, student data or production writes.
import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),port=8856;
http.createServer(async(req,res)=>{try{const p=new URL(req.url,'http://localhost').pathname;let body;
 if(req.method!=='GET'||p.includes('..'))throw Error('not_found');
 if(p==='/shared/auth.js')body='export const supabase={};';
 else if(p==='/shared/navbar-auth.js')body='export function initNavbarAuth(o){queueMicrotask(()=>o.onSessionResolved({user:{id:"synthetic-teacher"}}));}';
 else if(p==='/shared/quiz-transport.mjs')body='export function createAuthenticatedTransport(){return async(_,args)=>args.p_action==="preview_list"?{papers:[{id:"fixture",grade:3,title:"合成試卷",enabled:true}]}:window.teacherFixture;}';
 else if(/^\/shared\/[A-Za-z0-9_./-]+$/.test(p)||/^\/automation\/fixtures\/true-false\.(html|mjs)$/.test(p))body=await fs.readFile(path.join(root,p));
 else throw Error('not_found');
 const ext=path.extname(p),mime={'.mjs':'text/javascript','.js':'text/javascript','.html':'text/html','.css':'text/css','.woff2':'font/woff2'};
 res.writeHead(200,{'Content-Type':(mime[ext]||'application/octet-stream')+'; charset=utf-8','Cache-Control':'no-store'});res.end(body);
 }catch{res.writeHead(404);res.end('not_found');}}).listen(port,'127.0.0.1',()=>console.log('Synthetic true/false UI: http://localhost:'+port+'/automation/fixtures/true-false.html'));
