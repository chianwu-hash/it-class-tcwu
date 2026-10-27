// 本機頁面、真實 Supabase Auth/RPC/Storage；不提供合成作答或本機資料庫路由。
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {createDriveTicketHandler} from './lib/quiz-drive-ticket-handler.mjs';
import vault from './lib/quiz-drive-worker-private.cjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const driveManifestPath=process.env.QUIZ_CLOUD_DRIVE_MANIFEST;
let driveHandler=null;
if(driveManifestPath){
  const manifest=JSON.parse(await readFile(driveManifestPath,'utf8'));
  const source=await readFile(resolve(root,'shared/auth.js'),'utf8');
  const supabaseUrl=source.match(/SUPABASE_URL = "([^"]+)"/)[1],publishableKey=source.match(/SUPABASE_ANON_KEY = "([^"]+)"/)[1];
  driveHandler=createDriveTicketHandler({supabaseUrl,publishableKey,manifest,ticketKey:vault.load().ticketKey,origins:['http://localhost:3000','http://127.0.0.1:3000']});
}
const mime = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.mjs':'text/javascript', '.woff':'font/woff', '.woff2':'font/woff2', '.ttf':'font/ttf' };
const callback = '<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>登入我的雲端測驗</title><link rel="stylesheet" href="/shared/quiz-library.css"><main><section class="panel"><h1>登入我的雲端測驗</h1><p id="login-status" role="status">正在確認 Google 登入…</p><a href="/grade6/115-1/quiz-library.html">返回選卷</a></section></main><script type="module" src="/shared/quiz-login-callback.mjs"></script></html>';
http.createServer(async (req, res) => {
  const send = (status, body, type='text/plain') => { res.writeHead(status, {'Content-Type': type+'; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}); res.end(body); };
  if (!['localhost:3000','127.0.0.1:3000'].includes(req.headers.host)) return send(403,'local_host_required');
  if(driveHandler && req.method==='POST' && new URL(req.url,'http://localhost:3000').pathname==='/__quiz-drive-media'){
    try{
      let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>12000)return send(413,'invalid_request');}
      const request=new Request(`http://${req.headers.host}/__quiz-drive-media`,{method:'POST',headers:{Origin:req.headers.origin||'',Authorization:req.headers.authorization||'','Content-Type':'application/json'},body});
      const response=await driveHandler(request);res.writeHead(response.status,Object.fromEntries(response.headers));return res.end(await response.text());
    }catch{return send(502,'media_unavailable');}
  }
  if (req.method !== 'GET') return send(405,'method_not_allowed');
  const pathname = new URL(req.url,'http://localhost:3000').pathname;
  if (pathname === '/' || pathname === '/unit-papers.html') { res.writeHead(302, {Location:'/grade6/115-1/quiz-library.html'}); return res.end(); }
  if (pathname === '/index.html') return send(200,callback,'text/html');
  const allowed = /^\/shared\/[A-Za-z0-9_-]+\.(js|mjs|css)$/.test(pathname)
    || /^\/shared\/fonts\/andika\/Andika-(Regular|Bold)\.woff2$/.test(pathname)
    || /^\/shared\/vendor\/katex\/(katex\.min\.(css|js)|fonts\/[A-Za-z0-9_-]+\.(woff2?|ttf))$/.test(pathname)
    || /^\/grade[36]\/115-1\/(index\.html|navbar\.js|quiz(-library)?\.html|week08\.html)$/.test(pathname);
  if (!allowed) return send(404,'not_found');
  try {
    let bytes=await readFile(resolve(root,'.'+pathname));
    if(driveHandler && pathname.endsWith('.html'))bytes=Buffer.from(bytes.toString('utf8').replace('<head>','<head><meta name="quiz-media-backend" content="drive">'));
    return send(200,bytes,mime[extname(pathname)]);
  }
  catch { return send(404,'not_found'); }
}).listen(3000,'127.0.0.1',()=>console.log('雲端作答入口：http://localhost:3000/grade6/115-1/quiz-library.html'));
