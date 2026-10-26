// 本機頁面、真實 Supabase Auth/RPC/Storage；不提供合成作答或本機資料庫路由。
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const mime = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.mjs':'text/javascript', '.woff':'font/woff', '.woff2':'font/woff2', '.ttf':'font/ttf' };
const callback = '<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>登入我的雲端測驗</title><link rel="stylesheet" href="/shared/quiz-library.css"><main><section class="panel"><h1>登入我的雲端測驗</h1><p id="login-status" role="status">正在確認 Google 登入…</p><a href="/grade6/115-1/quiz-library.html">返回選卷</a></section></main><script type="module" src="/shared/quiz-login-callback.mjs"></script></html>';
http.createServer(async (req, res) => {
  const send = (status, body, type='text/plain') => { res.writeHead(status, {'Content-Type': type+'; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}); res.end(body); };
  if (!['localhost:3000','127.0.0.1:3000'].includes(req.headers.host)) return send(403,'local_host_required');
  if (req.method !== 'GET') return send(405,'method_not_allowed');
  const pathname = new URL(req.url,'http://localhost:3000').pathname;
  if (pathname === '/' || pathname === '/unit-papers.html') { res.writeHead(302, {Location:'/grade6/115-1/quiz-library.html'}); return res.end(); }
  if (pathname === '/index.html') return send(200,callback,'text/html');
  const allowed = /^\/shared\/[A-Za-z0-9_-]+\.(js|mjs|css)$/.test(pathname)
    || /^\/shared\/vendor\/katex\/(katex\.min\.(css|js)|fonts\/[A-Za-z0-9_-]+\.(woff2?|ttf))$/.test(pathname)
    || /^\/grade[36]\/115-1\/(index\.html|navbar\.js|quiz(-library)?\.html|week08\.html)$/.test(pathname);
  if (!allowed) return send(404,'not_found');
  try { return send(200, await readFile(resolve(root,'.'+pathname)),mime[extname(pathname)]); }
  catch { return send(404,'not_found'); }
}).listen(3000,'127.0.0.1',()=>console.log('雲端作答入口：http://localhost:3000/grade6/115-1/quiz-library.html'));
