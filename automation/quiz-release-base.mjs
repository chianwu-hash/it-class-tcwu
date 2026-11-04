// Rebuild the exact source of a production deployment from its file tree (SHA1 per file).
// Local directories are only a cache: a file is used only when its SHA1 matches the deployment.
// usage: node quiz-release-base.mjs --tree <vercel files json> --out <dir> --search <dir;dir;...>
// Files not found locally are listed in <out>.missing.json for download from the deployment.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const args = process.argv.slice(2), value = k => args[args.indexOf(k) + 1];
const out = path.resolve(value('--out')), dirs = value('--search').split(';').filter(Boolean);
const raw = (await fs.readFile(value('--tree'), 'utf8')).replace(/^﻿/, '');
const tree = JSON.parse(raw);
const src = tree.find(n => n.name === 'src');
const files = new Map();
(function walk(nodes, prefix) { for (const n of nodes) { const p = prefix + n.name; if (n.type === 'directory') walk(n.children || [], p + '/'); else if (n.type === 'file') files.set(p, n.uid); } })(src.children, '');
const sha1 = b => createHash('sha1').update(b).digest('hex');
const SKIP = new Set(['node_modules', '.git', 'output', 'tmp', 'pgdata', '.chat-mode', '.vercel']);
// Index candidates once, keyed by relative path so the same path in each directory is tried first.
await fs.rm(out, { recursive: true, force: true }); await fs.mkdir(out, { recursive: true });
const missing = {}; let copied = 0;
for (const [rel, uid] of files) {
  let done = false;
  for (const d of dirs) {
    const candidate = path.join(d, rel);
    try { const b = await fs.readFile(candidate); if (sha1(b) === uid) { await fs.mkdir(path.dirname(path.join(out, rel)), { recursive: true }); await fs.writeFile(path.join(out, rel), b); done = true; copied++; break; } } catch {}
  }
  if (!done) missing[rel] = uid;
}
await fs.writeFile(out + '.tree.json', JSON.stringify(Object.fromEntries(files), null, 0));
await fs.writeFile(out + '.missing.json', JSON.stringify(missing, null, 1));
console.log(JSON.stringify({ total: files.size, copied, missing: Object.keys(missing).length, sample: Object.keys(missing).slice(0, 25) }, null, 1));
