import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('.');
http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1'),name=decodeURIComponent(url.pathname);
  if(req.method!=='GET'||!['localhost:4486','127.0.0.1:4486'].includes(req.headers.host)||!(name==='/admin-learning.html'||name.startsWith('/shared/'))||name.split('/').some(p=>p==='..'||p.startsWith('.')))throw Error('denied');
  const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep))throw Error('denied');
  const body=await fs.readFile(file),mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.woff2':'font/woff2','.ttf':'font/ttf','.woff':'font/woff'}[path.extname(file)]||'application/octet-stream';
  res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-store'});res.end(body);
 }catch{res.writeHead(404);res.end();}
}).listen(4486,'127.0.0.1',()=>console.log('Teacher RPC preview: http://localhost:4486/admin-learning.html'));
