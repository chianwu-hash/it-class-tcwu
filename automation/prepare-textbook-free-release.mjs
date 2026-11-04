// Creates a NEW release copy or API manifest. Never uploads or edits the source.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isTextbookSource, filterTextbookFiles, checkTextbookSources} from '../release/textbook-policy.mjs';
import {verifyDeploymentPayload} from './lib/vercel-deployment-payload.mjs';

export async function prepareTextbookFreeRelease(source, output) {
  source = await fs.realpath(source);
  output = path.resolve(output);
  // Resolve the existing parent too, so a junction cannot lead back into source.
  output = path.join(await fs.realpath(path.dirname(output)), path.basename(output));
  const relative = path.relative(source, output);
  if (!relative || !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)) throw Error('輸出必須位於來源目錄之外');
  try { await fs.lstat(output); throw Error('輸出已存在，不可覆寫'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const stat = await fs.stat(source);
  if (stat.isFile()) {
    const payload = JSON.parse(await fs.readFile(source, 'utf8'));
    const result = filterTextbookFiles(payload.files);
    const next = {...payload, files: result.files};
    // An old source manifest needs the updated gate hashes too; do not invent them.
    await verifyDeploymentPayload(next);
    await fs.writeFile(output, JSON.stringify(next, null, 2) + '\n', {flag: 'wx'});
    return {kind: 'manifest', excluded: result.excluded, retained: result.files.length};
  }
  try { await fs.lstat(path.join(source, '.git')); throw Error('請使用完整凍結發布包，不可複製工作中的 Git 儲存庫'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const excluded = [];
  // Inventory first: fail before creating the output if links or special files exist.
  const files = [];
  async function inventory(relative = '') {
    for (const entry of await fs.readdir(path.join(source, relative), {withFileTypes: true})) {
      const file = relative ? relative + '/' + entry.name : entry.name;
      if (isTextbookSource(file)) { excluded.push(file); continue; }
      if (entry.isSymbolicLink() || !entry.isDirectory() && !entry.isFile()) throw Error('發布來源含連結或特殊檔案：' + file);
      if (entry.isDirectory()) await inventory(file); else files.push(file);
    }
  }
  await inventory();
  await fs.mkdir(output);
  for (const file of files) {
    await fs.mkdir(path.dirname(path.join(output, file)), {recursive: true});
    await fs.copyFile(path.join(source, file), path.join(output, file));
  }
  const ignorePath = path.join(output, '.vercelignore');
  let ignore = ''; try { ignore = await fs.readFile(ignorePath, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await fs.writeFile(ignorePath, ignore + '\n# Textbook source exclusion (Windows and POSIX)\ntextbooks/\n*S091-Google網路AI好幫手-PDF*\n*S092-Canva魔法工作室PDF*\n');
  await checkTextbookSources(output);
  return {kind: 'directory', excluded, retained: files.length, next: 'node automation/prepare-garden-release.mjs <output>'};
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 4) throw Error('用法：node automation/prepare-textbook-free-release.mjs <完整發布包或 API JSON> <新輸出路徑>');
    console.log(JSON.stringify(await prepareTextbookFreeRelease(...process.argv.slice(2)), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
