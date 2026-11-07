// Local synthetic keepsake growth preview; no auth, database, RPC or production writes.
// Run: node automation/keepsake-growth-preview.mjs  →  http://localhost:8858/
import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const mime={'.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.html':'text/html','.woff2':'font/woff2'};
http.createServer(async(req,res)=>{try{const p=new URL(req.url,'http://localhost').pathname;if(req.method!=='GET'||p.includes('..'))throw Error();
 const file=p==='/'?'automation/fixtures/keepsake-growth.html':/^\/shared\/[A-Za-z0-9_./-]+\.(mjs|js|css)$/.test(p)?p.slice(1):null;if(!file)throw Error();
 const body=await fs.readFile(path.join(root,file));res.writeHead(200,{'Content-Type':(mime[path.extname(file)]||'application/octet-stream')+'; charset=utf-8','Cache-Control':'no-store'});res.end(body);
}catch{res.writeHead(404);res.end();}}).listen(8858,'127.0.0.1',()=>console.log('Synthetic keepsake growth http://localhost:8858/'));
