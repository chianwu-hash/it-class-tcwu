import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';
const root=path.resolve('automation/output/admin-learning-release-20261101/publish');
http.createServer(async(req,res)=>{
 try{
  if(!['localhost:3000','127.0.0.1:3000'].includes(req.headers.host)||req.method!=='GET'){res.writeHead(403);return res.end();}
  let name=decodeURIComponent(new URL(req.url,'http://localhost:3000').pathname);if(name==='/')name='/admin-learning.html';
  if(name.split('/').some(x=>x.startsWith('.'))||!path.resolve(root,'.'+name).startsWith(root+path.sep)){res.writeHead(404);return res.end();}
  const bytes=await fs.readFile(path.resolve(root,'.'+name)),mime={'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf'}[path.extname(name)]||'application/octet-stream';
  res.writeHead(200,{'Content-Type':mime+'; charset=utf-8','Cache-Control':'no-store'});res.end(bytes);
 }catch{res.writeHead(404);res.end();}
}).listen(3000,'127.0.0.1',()=>console.log('正式發布候選（直接呼叫教師 RPC）：http://localhost:3000/admin-learning.html'));
