// Compare two deployment file trees (vercel api /v6/deployments/<id>/files output).
// usage: node quiz-release-compare.mjs <production tree> <candidate tree> [changed file...]
//          [--added a,b] [--removed a,b] [--eol-dir <candidate source dir>]
//   changed file...  files expected to change content (positional, as before)
//   --added/--removed  files expected to be new / deleted in the candidate (comma separated, repeatable)
//   --eol-dir  the directory the candidate was uploaded from; unexpected changes whose local bytes match the
//              production SHA1 after CRLF/LF conversion are reported as eolOnly instead of failing.
// Exit 0 only if added, removed and (non-eol) changed files are exactly the declared ones.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export function flattenTree(tree) {
  const out = new Map();
  (function walk(nodes, prefix) { for (const n of nodes) { const p = prefix + n.name; if (n.type === 'directory') walk(n.children || [], p + '/'); else if (n.type === 'file') out.set(p, n.uid); } })(tree.find(n => n.name === 'src').children, '');
  return out;
}

export async function flatten(file) {
  return flattenTree(JSON.parse((await fs.readFile(file, 'utf8')).replace(/^﻿/, '')));
}

const sha1 = b => createHash('sha1').update(b).digest('hex');
const eolVariants = b => { const lf = Buffer.from(b.toString('latin1').replace(/\r\n/g, '\n'), 'latin1'); return [lf, Buffer.from(lf.toString('latin1').replace(/\n/g, '\r\n'), 'latin1')]; };

export async function compareTrees(prod, cand, { changed: expChanged = [], added: expAdded = [], removed: expRemoved = [], eolDir } = {}) {
  const sort = a => [...new Set(a)].sort();
  const removed = sort([...prod.keys()].filter(k => !cand.has(k))), added = sort([...cand.keys()].filter(k => !prod.has(k)));
  const changedAll = sort([...prod.keys()].filter(k => cand.has(k) && cand.get(k) !== prod.get(k)));
  const declared = new Set(expChanged), eolOnly = [], changed = [];
  for (const f of changedAll) {
    if (!declared.has(f) && eolDir) {
      try { const b = await fs.readFile(path.join(eolDir, f)); if (eolVariants(b).some(v => sha1(v) === prod.get(f))) { eolOnly.push(f); continue; } } catch {}
    }
    changed.push(f);
  }
  const diff = (actual, expected) => ({ missing: sort(expected).filter(f => !actual.includes(f)), unexpected: actual.filter(f => !expected.includes(f)) });
  const c = diff(changed, expChanged), a = diff(added, expAdded), r = diff(removed, expRemoved);
  const ok = ![c, a, r].some(x => x.missing.length || x.unexpected.length);
  return { ok, production: prod.size, candidate: cand.size, removed, added, changed, eolOnly,
    // kept for older callers
    missingFromChange: c.missing, unexpected: c.unexpected,
    addedCheck: a, removedCheck: r };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), positional = [], lists = { added: [], removed: [] }; let eolDir;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--added' || args[i] === '--removed') lists[args[i].slice(2)].push(...args[++i].split(',').filter(Boolean));
    else if (args[i] === '--eol-dir') eolDir = args[++i];
    else positional.push(args[i]);
  }
  const [prodPath, candPath, ...changed] = positional;
  const result = await compareTrees(await flatten(prodPath), await flatten(candPath), { changed, ...lists, eolDir });
  console.log(JSON.stringify(result, null, 1));
  process.exitCode = result.ok ? 0 : 1;
}
