// Isolated synthetic UI preview. Never proxies auth, RPCs, media credentials or production writes.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),port=Number(process.env.PORT||8816);
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp'};
http.createServer(async(req,res)=>{try{let p=new URL(req.url,'http://localhost').pathname;if(p==='/')p='/automation/fixtures/partner-focused.html';if(req.method!=='GET'||!(/^\/shared\/[A-Za-z0-9_./-]+$/.test(p)||/^\/automation\/fixtures\/partner-focused\.(html|mjs)$/.test(p))||p.includes('..')){res.writeHead(404);return res.end('not_found');}const file=path.resolve(root,'.'+p);if(!file.startsWith(root)){res.writeHead(403);return res.end();}const body=await readFile(file);res.writeHead(200,{'Content-Type':(mime[path.extname(p)]||'application/octet-stream')+'; charset=utf-8','Cache-Control':'no-store'});res.end(body);}catch{res.writeHead(404);res.end('not_found');}}).listen(port,'127.0.0.1',()=>console.log('Synthetic partner preview: http://localhost:'+port));
