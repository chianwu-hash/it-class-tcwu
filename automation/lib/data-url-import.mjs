// Load browser ES modules from shared/*.js in Node tests. The repo has no "type": "module", so .js files
// would be read as CommonJS; inline each relative import as a data: URL instead, recursively.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const cache = new Map();
const dataUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');

export async function moduleUrl(file, overrides = {}) {
  const abs = path.resolve(file);
  if (overrides[abs]) return overrides[abs];
  if (cache.has(abs)) return cache.get(abs);
  let source = await readFile(abs, 'utf8');
  const specs = new Set([...source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)(['"])(\.{1,2}\/[^'"]+)\1/g)].map(m => m[2]));
  for (const spec of specs) {
    const target = await moduleUrl(path.join(path.dirname(abs), spec.split('?')[0]), overrides);
    source = source.split(`'${spec}'`).join(JSON.stringify(target)).split(`"${spec}"`).join(JSON.stringify(target));
  }
  const url = dataUrl(source);
  cache.set(abs, url);
  return url;
}

export const importModule = async (file, overrides) => import(await moduleUrl(file, overrides));
