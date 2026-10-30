// Compare two deployment file trees (vercel api /v6/deployments/<id>/files output).
// usage: node quiz-release-compare.mjs <production tree> <candidate tree> <allowed file>...
// Exit 0 only if the candidate differs from production in exactly the allowed files.
import fs from 'node:fs/promises';
const [prodPath, candPath, ...allowed] = process.argv.slice(2);
const flatten = async file => {
  const tree = JSON.parse((await fs.readFile(file, 'utf8')).replace(/^﻿/, '')), out = new Map();
  (function walk(nodes, prefix) { for (const n of nodes) { const p = prefix + n.name; if (n.type === 'directory') walk(n.children || [], p + '/'); else if (n.type === 'file') out.set(p, n.uid); } })(tree.find(n => n.name === 'src').children, '');
  return out;
};
const prod = await flatten(prodPath), cand = await flatten(candPath);
const removed = [...prod.keys()].filter(k => !cand.has(k)), added = [...cand.keys()].filter(k => !prod.has(k));
const changed = [...prod.keys()].filter(k => cand.has(k) && cand.get(k) !== prod.get(k)).sort();
const expected = [...allowed].sort();
const ok = !removed.length && !added.length && JSON.stringify(changed) === JSON.stringify(expected);
console.log(JSON.stringify({ ok, production: prod.size, candidate: cand.size, removed, added, changed, missingFromChange: expected.filter(f => !changed.includes(f)), unexpected: changed.filter(f => !expected.includes(f)) }, null, 1));
process.exitCode = ok ? 0 : 1;
