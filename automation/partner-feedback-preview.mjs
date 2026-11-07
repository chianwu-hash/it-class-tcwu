// Local synthetic UI; no auth, database, RPC or production writes.
import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
http.createServer(async(req,res)=>{try{const p=new URL(req.url,'http://localhost').pathname;if(req.method!=='GET'||p.includes('..'))throw Error();let body;
 if(p==='/')body=(await fs.readFile(path.join(root,'automation/fixtures/partner-focused.html'),'utf8')).replace('partner-focused.mjs','partner-feedback.mjs');
 else if(/^\/shared\/[A-Za-z0-9_./-]+$/.test(p)||p==='/automation/fixtures/partner-feedback.mjs')body=await fs.readFile(path.join(root,p));else throw Error();
 const ext=path.extname(p),mime={'.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'};res.writeHead(200,{'Content-Type':(p==='/'?'text/html':mime[ext]||'application/octet-stream')+'; charset=utf-8','Cache-Control':'no-store'});res.end(body);
 }catch{res.writeHead(404);res.end();}}).listen(8857,'127.0.0.1',()=>console.log('Synthetic feedback http://localhost:8857/'));
