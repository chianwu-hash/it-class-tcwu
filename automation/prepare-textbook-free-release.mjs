// Creates a NEW release copy or API manifest. Never uploads or edits the source.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isTextbookSource, filterTextbookFiles, checkTextbookSources} from '../release/textbook-policy.mjs';
import {verifyDeploymentPayload} from './lib/vercel-deployment-payload.mjs';
import {loadProjectPolicy, renderProjectIgnore, POLICY_PATH} from '../release/project-policy.mjs';

export async function prepareConfiguredRelease(source, output, {policyFile} = {}) {
  source = await fs.realpath(source);
  output = path.resolve(output);
  // Resolve the existing parent too, so a junction cannot lead back into source.
  output = path.join(await fs.realpath(path.dirname(output)), path.basename(output));
  const relative = path.relative(source, output);
  if (!relative || !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)) throw Error('輸出必須位於來源目錄之外');
  try { await fs.lstat(output); throw Error('輸出已存在，不可覆寫'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const stat = await fs.stat(source);
  const policy = await loadProjectPolicy(stat.isFile() ? path.dirname(source) : source, policyFile);
  if (stat.isFile()) {
    const payload = JSON.parse(await fs.readFile(source, 'utf8'));
    const result = filterTextbookFiles(payload.files, policy);
    const next = {...payload, files: result.files};
    // An old source manifest needs the updated gate hashes too; do not invent them.
    await verifyDeploymentPayload(next, {policy});
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
      if (isTextbookSource(file, policy)) { excluded.push(file); continue; }
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
  await fs.writeFile(ignorePath, renderProjectIgnore(ignore, policy));
  await fs.mkdir(path.dirname(path.join(output, POLICY_PATH)), {recursive: true});
  await fs.writeFile(path.join(output, POLICY_PATH), JSON.stringify(policy, null, 2) + '\n');
  await checkTextbookSources(output, policy);
  return {kind: 'directory', excluded, retained: files.length, next: 'node automation/prepare-garden-release.mjs <output>'};
}
// Preserve existing callers while the implementation is project-configured.
export const prepareTextbookFreeRelease = prepareConfiguredRelease;
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (![4, 5].includes(process.argv.length)) throw Error('用法：node automation/prepare-textbook-free-release.mjs <完整發布包或 API JSON> <新輸出路徑> [專案設定JSON]');
    console.log(JSON.stringify(await prepareTextbookFreeRelease(process.argv[2], process.argv[3], {policyFile: process.argv[4]}), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
