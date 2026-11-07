// Actual learning controller, synthetic snapshots only. No auth, database or RPC proxy.
import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
http.createServer(async(req,res)=>{try{const p=new URL(req.url,'http://localhost').pathname;if(req.method!=='GET'||p.includes('..'))throw Error();let body;
 if(p==='/')body=(await fs.readFile(path.join(root,'automation/fixtures/partner-focused.html'),'utf8')).replace('partner-focused.mjs','keepsake-growth-integration.mjs').replace('答題優先隔離預覽','紀念成長整合預覽');
 else if(/^\/shared\/[A-Za-z0-9_./-]+$/.test(p)||p==='/automation/fixtures/keepsake-growth-integration.mjs')body=await fs.readFile(path.join(root,p));else throw Error();
 const mime={'.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'};res.writeHead(200,{'Content-Type':(p==='/'?'text/html':mime[path.extname(p)]||'application/octet-stream')+'; charset=utf-8','Cache-Control':'no-store'});res.end(body);
 }catch{res.writeHead(404);res.end();}}).listen(8859,'127.0.0.1',()=>console.log('Synthetic integration http://localhost:8859/'));
