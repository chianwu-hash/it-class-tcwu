import fs from 'node:fs/promises';
import path from 'node:path';

// Shared by local packaging, API manifests and the cloud build gate.
export const TEXTBOOK_DIRECTORIES = ['textbooks', 'S091-Google網路AI好幫手-PDF', 'S092-Canva魔法工作室PDF'];
export function isTextbookSource(file) {
  if (typeof file !== 'string' || !file) throw Error('發布檔案路徑無效');
  let normalized = file;
  for (let i = 0; i < 3; i++) {
    let decoded;
    try { decoded = decodeURIComponent(normalized); } catch { break; }
    if (decoded === normalized) break;
    normalized = decoded;
  }
  const parts = normalized.normalize('NFC').replaceAll('\\', '/').split('/');
  if (parts.includes('..')) throw Error('發布路徑不可含有 ..');
  return parts.some(part => TEXTBOOK_DIRECTORIES.some(dir => dir.toLowerCase() === part.toLowerCase()));
}
export function filterTextbookFiles(files) {
  if (!Array.isArray(files)) throw Error('發布清單必須包含 files 陣列');
  const excluded = [], retained = [];
  for (const entry of files) (isTextbookSource(entry.file) ? excluded : retained).push(entry);
  return {files: retained, excluded: excluded.map(entry => entry.file)};
}
export function assertDeploymentPayload(payload) {
  const result = filterTextbookFiles(payload.files);
  const names = new Set();
  for (const entry of payload.files) {
    const name = entry.file.normalize('NFC').replaceAll('\\', '/').replace(/^\.\//, '');
    if (names.has(name)) throw Error('發布清單有重複路徑，已阻擋上傳：' + name);
    names.add(name);
  }
  if (result.excluded.length) throw Error('發布清單含課本來源，已阻擋上傳：' + result.excluded.join(', '));
  if (payload.builds || payload.projectSettings?.buildCommand && payload.projectSettings.buildCommand !== 'node release/garden-preflight.mjs' || payload.projectSettings?.outputDirectory && payload.projectSettings.outputDirectory !== '.') throw Error('發布清單覆寫建置關卡，已阻擋上傳');
  for (const file of ['release/garden-preflight.mjs', 'release/garden-catalog.mjs', 'release/textbook-policy.mjs', 'vercel.json']) {
    if (!payload.files.some(entry => entry.file === file)) throw Error('發布清單缺少必要關卡：' + file);
  }
  return {passed: true, fileCount: result.files.length};
}
export async function checkTextbookSources(root) {
  const excluded = [];
  async function walk(relative = '') {
    for (const entry of await fs.readdir(path.join(root, relative), {withFileTypes: true})) {
      if (['.git', 'node_modules', '.vercel'].includes(entry.name)) continue;
      const file = relative ? relative + '/' + entry.name : entry.name;
      if (isTextbookSource(file)) { excluded.push(file); continue; }
      if (entry.isSymbolicLink()) throw Error('發布包不可含符號連結：' + file);
      if (entry.isDirectory()) await walk(file);
    }
  }
  await walk();
  if (excluded.length) throw Error('發布包含課本來源，發布已阻擋：' + excluded.join(', '));
  return {passed: true, excludedCount: 0};
}
