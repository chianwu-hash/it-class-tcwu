// Download selected files of a Vercel deployment by their SHA1 uid and verify each SHA1.
// usage: node automation/release-fetch-files.mjs --tree <vercel files json> --deployment <dpl_id> --out <dir> [--global-config <dir>] <path>...
// Uses the logged-in Vercel CLI (`vercel api`), so no token is read or printed by this script.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const args = process.argv.slice(2), flags = new Set(['--tree', '--deployment', '--out', '--global-config']);
const opt = k => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const paths = args.filter((a, i) => !flags.has(a) && !flags.has(args[i - 1]));
const tree = JSON.parse((await fs.readFile(opt('--tree'), 'utf8')).replace(/^\uFEFF/, ''));
const files = new Map();
(function walk(nodes, prefix) { for (const n of nodes) { const p = prefix + n.name; if (n.type === 'directory') walk(n.children || [], p + '/'); else if (n.type === 'file') files.set(p, n.uid); } })(tree.find(n => n.name === 'src').children, '');
const cfg = opt('--global-config') ? ['--global-config', opt('--global-config')] : [];
const result = { ok: [], failed: [] };
for (const rel of paths) {
  const uid = files.get(rel); if (!uid) { result.failed.push({ rel, reason: 'not_in_tree' }); continue; }
  try {
    const raw = execFileSync('cmd.exe', ['/d', '/c', 'vercel', ...cfg, 'api', `/v7/deployments/${opt('--deployment')}/files/${uid}`], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90000 });
    let body = raw; const text = raw.toString('utf8').trim();
    if (text.startsWith('{') && text.includes('"data"')) body = Buffer.from(JSON.parse(text).data, 'base64');
    if (createHash('sha1').update(body).digest('hex') !== uid) { result.failed.push({ rel, reason: 'sha1_mismatch' }); continue; }
    await fs.mkdir(path.dirname(path.join(opt('--out'), rel)), { recursive: true });
    await fs.writeFile(path.join(opt('--out'), rel), body); result.ok.push(rel);
  } catch (e) { result.failed.push({ rel, reason: String(e.message).slice(0, 200) }); }
}
console.log(JSON.stringify({ ok: result.ok.length, failed: result.failed }, null, 1));
process.exitCode = result.failed.length ? 1 : 0;
