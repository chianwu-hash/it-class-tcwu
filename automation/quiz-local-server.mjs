import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createQuizDb, quizCall, TEACHER, studentId } from './lib/quiz-local-db.mjs';
import { createLocalMedia } from './lib/quiz-local-media.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.QUIZ_LOCAL_PORT || 4340);
const origin = `http://127.0.0.1:${port}`;
const dataDir = resolve(process.env.QUIZ_LOCAL_DATA || resolve(root, 'tmp/quiz-local-db'));
await mkdir(dataDir, { recursive: true });
const db = await createQuizDb(dataDir);
for(const file of ['quiz-wrong-questions.sql','quiz-pool.sql','quiz-rewards.sql','quiz-load-batch1.sql','quiz-load-batch2.sql'])await db.exec(await readFile(resolve(root,'supabase',file),'utf8'));
const baseMedia = createLocalMedia({ db, directory: resolve(dataDir, '../quiz-local-media'), origin });
const media = process.env.QUIZ_DRIVE_WORKER_MANIFEST
  ? await (await import('./lib/quiz-drive-worker-media.mjs')).createDriveWorkerMedia({base:baseMedia,manifestPath:process.env.QUIZ_DRIVE_WORKER_MANIFEST})
  : baseMedia;
const cookie = randomBytes(32).toString('hex');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };
const server = http.createServer(async (req, res) => {
  const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
  if (req.headers.host !== `127.0.0.1:${port}`) return send(403, { error: 'local_host_required' });
  const url = new URL(req.url, origin);
  try {
    if (req.method === 'GET' && url.pathname === '/__quiz-local') return send(200, { local: true });
    if (req.method === 'GET' && url.pathname.startsWith('/__quiz-file/')) {
      const saved = await media.read(url);
      res.writeHead(200, { 'Content-Type': saved.mime, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }); return res.end(saved.bytes);
    }
    if (req.method === 'POST' && ['/__quiz-rpc', '/__quiz-media'].includes(url.pathname)) {
      const value = req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith('quiz_local='))?.slice(11) || '';
      if (value.length !== cookie.length || !timingSafeEqual(Buffer.from(value), Buffer.from(cookie)) || req.headers.origin !== origin) return send(403, { error: 'local_session_required' });
      let body = ''; for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 1050000) return send(413, { error: 'document_too_large' }); }
      const parsed = JSON.parse(body), { action, data } = parsed;
      const demoStudent = req.headers['x-quiz-demo-student'];
      if (url.pathname === '/__quiz-media') {
        const n = Number(demoStudent);
        if (demoStudent !== undefined && (!Number.isInteger(n) || n < 1 || n > 31 || action !== 'read')) return send(403, { error: 'teacher_required' });
        const saved = await media.call(parsed, demoStudent === undefined ? 'teacher' : `student-${n}`);
        return send(saved.status, saved.result);
      }
      if (demoStudent !== undefined) {
        const n = Number(demoStudent);
        if (!Number.isInteger(n) || n < 1 || n > 31 || !['join', 'resume', 'submit'].includes(action)) return send(403, { error: 'student_required' });
        return send(200, await quizCall(db, studentId(n), action, data));
      }
      if(['version_list','version_get'].includes(action))return send(200,await db.transaction(async tx=>{await tx.query("select set_config('quiz.test_uid',$1,true)",[TEACHER]);await tx.exec('set local role authenticated');return (await tx.query('select public.quiz_version_browser($1) result',[JSON.stringify({...data,action:action==='version_get'?'get':'list'})])).rows[0].result;}));
      if (!['list', 'get', 'save', 'publish', 'versions', 'sessions', 'open', 'monitor', 'close'].includes(action)) return send(403, { error: 'teacher_required' });
      return send(200, await quizCall(db, TEACHER, action, data));
    }
    if (req.method !== 'GET') return send(405, { error: 'method_not_allowed' });
    const pathname = url.pathname === '/' ? '/admin-quiz.html' : url.pathname;
    const allowed = ['/admin-quiz.html', '/grade6/115-1/quiz.html'].includes(pathname) || /^\/shared\/(quiz-[a-z-]+\.(css|mjs|js)|vendor\/katex\/(katex\.min\.(css|js)|fonts\/[A-Za-z0-9_-]+\.(woff2?|ttf)))$/.test(pathname);
    const authFiles = ['/shared/auth.js', '/shared/navbar-auth.js', '/shared/course-navbar.js', '/shared/grade6-nav-identity.js', '/shared/nav-identity.js', '/grade6/115-1/navbar.js'];
    if (!allowed && !authFiles.includes(pathname) && !['/shared/image-lightbox.js', '/shared/image-lightbox.css'].includes(pathname)) return send(404, { error: 'not_found' });
    const bytes = await readFile(resolve(root, `.${pathname}`));
    res.writeHead(200, { 'Content-Type': `${types[extname(pathname)] || 'application/octet-stream'}; charset=utf-8`,
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
      ...(['/admin-quiz.html', '/grade6/115-1/quiz.html'].includes(pathname) ? { 'Set-Cookie': `quiz_local=${cookie}; HttpOnly; SameSite=Strict; Path=/` } : {}) }); res.end(bytes);
  } catch (error) { send(400, { error: error.code === 'ENOENT' ? 'not_found' : error.message }); }
});
server.listen(port, '127.0.0.1', () => console.log(`本機題庫工作臺：${origin}/admin-quiz.html?local=1`));
async function stop() { server.close(async () => { await db.close(); process.exit(0); }); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
