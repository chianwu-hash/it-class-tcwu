import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),port=8817,mime={'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.woff2':'font/woff2'};
http.createServer(async(req,res)=>{try{let p=new URL(req.url,'http://localhost').pathname;if(p==='/')p='/automation/fixtures/partner-media.html';if(req.method!=='GET'||p.includes('..')||!(/^\/shared\/[A-Za-z0-9_./-]+$/.test(p)||/^\/automation\/fixtures\/partner-media\.(html|mjs|css)$/.test(p))){res.writeHead(404);return res.end();}const target=path.resolve(root,'.'+p);if(!target.startsWith(root)){res.writeHead(403);return res.end();}const body=await readFile(target);res.writeHead(200,{'Content-Type':(mime[path.extname(p)]||'application/octet-stream')+'; charset=utf-8','Cache-Control':'no-store'});res.end(body);}catch{res.writeHead(404);res.end();}}).listen(port,'127.0.0.1',()=>console.log('Isolated media prototype: http://localhost:'+port));
