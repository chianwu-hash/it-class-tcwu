// Compare a Vercel deployment file tree (SHA1 per file) with a local directory or a git ref, file by file.
// usage: node automation/release-tree-diff.mjs --tree <vercel files json> [--dir . | --ref <git ref>] [--json out.json]
// Each production file is: same (byte-identical), eol (identical after CRLF/LF conversion), different, or missing.
// Exit 0 when nothing is different or missing (eol-only differences are reported, not fatal: with
// core.autocrlf=true a Windows checkout turns LF files into CRLF, so deploy from a byte-exact copy, see dev-sop.md).
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const dir = path.resolve(opt('--dir', '.')), ref = opt('--ref');
const tree = JSON.parse((await fs.readFile(opt('--tree'), 'utf8')).replace(/^﻿/, ''));
const files = new Map();
(function walk(nodes, prefix) { for (const n of nodes) { const p = prefix + n.name; if (n.type === 'directory') walk(n.children || [], p + '/'); else if (n.type === 'file') files.set(p, n.uid); } })(tree.find(n => n.name === 'src').children, '');
const sha1 = b => createHash('sha1').update(b).digest('hex');
const eolVariants = b => { const lf = Buffer.from(b.toString('latin1').replace(/\r\n/g, '\n'), 'latin1'); return [lf, Buffer.from(lf.toString('latin1').replace(/\n/g, '\r\n'), 'latin1')]; };
const read = async rel => ref ? execFileSync('git', ['show', `${ref}:${rel}`], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }) : fs.readFile(path.join(dir, rel));
const out = { same: [], eol: [], different: [], missing: [] };
for (const [rel, uid] of files) {
  let b; try { b = await read(rel); } catch { out.missing.push(rel); continue; }
  if (sha1(b) === uid) out.same.push(rel); else if (eolVariants(b).some(v => sha1(v) === uid)) out.eol.push(rel); else out.different.push(rel);
}
const report = { production: files.size, same: out.same.length, eol: out.eol.sort(), different: out.different.sort(), missing: out.missing.sort() };
if (opt('--json')) await fs.writeFile(opt('--json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify({ production: report.production, same: report.same, eolOnly: report.eol.length, different: report.different, missing: report.missing }, null, 1));
process.exitCode = out.different.length || out.missing.length ? 1 : 0;
