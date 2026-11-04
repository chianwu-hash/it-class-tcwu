import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {isTextbookSource, filterTextbookFiles, checkTextbookSources} from '../../release/textbook-policy.mjs';
import {runPreflight} from '../../release/garden-preflight.mjs';
import {prepareTextbookFreeRelease} from '../prepare-textbook-free-release.mjs';
import {verifyDeploymentPayload} from '../lib/vercel-deployment-payload.mjs';

const textbook = 'grade3/S091-Google網路AI好幫手-PDF/S091_第1課-OK.pdf';
async function fixture(fn) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'textbook-release-'));
  try { await fn(root); } finally { await fs.rm(root, {recursive: true, force: true}); }
}
async function write(root, file, content) {
  await fs.mkdir(path.dirname(path.join(root, file)), {recursive: true});
  await fs.writeFile(path.join(root, file), content);
}
async function payload() {
  const files = [];
  for (const file of ['release/garden-preflight.mjs', 'release/garden-catalog.mjs', 'release/textbook-policy.mjs']) {
    files.push({file, sha: createHash('sha1').update(await fs.readFile(new URL('../../' + file, import.meta.url))).digest('hex')});
  }
  files.push({file: 'vercel.json', data: JSON.stringify({buildCommand: 'node release/garden-preflight.mjs', outputDirectory: '.', headers: [{source: '/', headers: []}]})});
  files.push({file: 'shared/auth.js', sha: 'unchanged-runtime-source'});
  return {name: 'it-class-tcwu', files};
}
test('textbook policy handles Windows, encoded paths and the separate reference library', () => {
  for (const file of [textbook, textbook.replaceAll('/', '\\'), encodeURI(textbook), encodeURIComponent(encodeURIComponent(textbook)), 'textbooks/grade3/it/S088-Windows11/book.pdf', 'grade6/S092-Canva魔法工作室PDF/new.pdf']) assert(isTextbookSource(file), file);
  for (const file of ['grade3/downloads/worksheet.pdf', 'assets/reward-tree/empty-tree-base-v1.png', 'prototypes/typing-foundation/level1/app.js', 'grade6/images/lesson.webp', 'downloads/100%.pdf']) assert(!isTextbookSource(file), file);
  assert.throws(() => isTextbookSource('../index.html'));
});
test('manifest filtering preserves every non-textbook entry, including unknown API metadata', () => {
  const files = [{file: textbook, sha: 'old-pdf'}, {file: 'index.html', sha: 'abc', extra: 12}, {file: 'downloads/a.pdf', data: 'hello', encoding: 'utf8'}];
  const result = filterTextbookFiles(files);
  assert.deepEqual(result.excluded, [textbook]);
  assert.deepEqual(result.files, files.slice(1));
  assert.equal(result.files[0], files[1]);
  assert.equal(files.length, 3);
});
test('cloud preflight blocks textbook sources before any database call', () => fixture(async root => {
  await write(root, textbook, '%PDF-test');
  let calls = 0;
  await assert.rejects(runPreflight({root, fetcher: async () => { calls++; throw Error('should not fetch'); }}), /課本來源/);
  assert.equal(calls, 0);
}));
test('new frozen release excludes textbooks and retains all application bytes and original sources', () => fixture(async root => {
  const source = path.join(root, 'source'), output = path.join(root, 'clean');
  await write(source, textbook, '%PDF-original');
  await write(source, 'textbooks/S088/book.pdf', '%PDF-reference');
  const keep = ['index.html', 'shared/auth.js', 'admin-learning.html', 'prototypes/typing-foundation/level1/app.js', 'downloads/worksheet.pdf', 'grade6/images/lesson.webp', 'api/quiz-diagnostics.js'];
  for (const file of keep) await write(source, file, Buffer.from([0, 1, 255, 18]));
  await write(source, '.vercelignore', '# Preserve existing rules\nprivate/\n');
  const result = await prepareTextbookFreeRelease(source, output);
  assert.equal(result.excluded.length, 2);
  for (const file of keep) assert.deepEqual(await fs.readFile(path.join(output, file)), await fs.readFile(path.join(source, file)));
  assert.equal(await fs.readFile(path.join(source, textbook), 'utf8'), '%PDF-original');
  await assert.rejects(fs.access(path.join(output, textbook)));
  assert((await fs.readFile(path.join(output, '.vercelignore'), 'utf8')).startsWith('# Preserve existing rules\nprivate/\n'));
  assert((await checkTextbookSources(output)).passed);
  await assert.rejects(prepareTextbookFreeRelease(source, output), /已存在/);
  await assert.rejects(prepareTextbookFreeRelease(source, path.join(source, 'nested')), /之外/);
}));
test('working Git repository cannot be mistaken for a frozen release', () => fixture(async root => {
  await fs.mkdir(path.join(root, 'source/.git'), {recursive: true});
  await assert.rejects(prepareTextbookFreeRelease(path.join(root, 'source'), path.join(root, 'clean')), /Git/);
  await assert.rejects(fs.access(path.join(root, 'clean')));
}));
test('API guard checks actual gate hashes, configuration and source entries', async () => {
  const valid = await payload();
  assert((await verifyDeploymentPayload(valid)).passed);
  await assert.rejects(verifyDeploymentPayload({...valid, files: [...valid.files, {file: textbook, sha: 'old-pdf'}]}), /課本來源/);
  const stale = structuredClone(valid); stale.files[0].sha = 'old-gate';
  await assert.rejects(verifyDeploymentPayload(stale), /過期/);
  const missing = structuredClone(valid); missing.files = missing.files.filter(entry => entry.file !== 'release/textbook-policy.mjs');
  await assert.rejects(verifyDeploymentPayload(missing), /缺少/);
  const override = {...valid, projectSettings: {buildCommand: 'echo bypass'}};
  await assert.rejects(verifyDeploymentPayload(override), /覆寫/);
  const oldConfig = structuredClone(valid); oldConfig.files.find(entry => entry.file === 'vercel.json').data = '{"buildCommand":"echo bypass"}';
  await assert.rejects(verifyDeploymentPayload(oldConfig), /未啟用/);
  await assert.rejects(verifyDeploymentPayload({...valid, files: [...valid.files, {...valid.files[0]}]}), /重複/);
});
test('API JSON preparation writes a new safe manifest and preserves source JSON', () => fixture(async root => {
  const original = await payload(); original.files.push({file: textbook, sha: 'old-pdf'});
  const input = path.join(root, 'input.json'), output = path.join(root, 'clean.json');
  await fs.writeFile(input, JSON.stringify(original));
  assert.equal((await prepareTextbookFreeRelease(input, output)).excluded.length, 1);
  const clean = JSON.parse(await fs.readFile(output, 'utf8'));
  assert.deepEqual(clean, {...original, files: original.files.slice(0, -1)});
  assert.deepEqual(JSON.parse(await fs.readFile(input, 'utf8')), original);
}));
test('PowerShell API entry blocks an unsafe deployment before calling Vercel and permits checked payloads', () => fixture(async root => {
  const input = path.join(root, 'input.json');
  const wrapper = path.resolve('automation/lib/admin-learning-vercel-api.ps1');
  const quote = value => "'" + value.replaceAll("'", "''") + "'";
  const command = "function vercel { Write-Output 'MOCK_VERCEL_CALLED'; $global:LASTEXITCODE=0 }; & " + quote(wrapper) + " -Endpoint '/v13/deployments' -Method POST -InputFile " + quote(input);
  const valid = await payload();
  await fs.writeFile(input, JSON.stringify({...valid, files: [...valid.files, {file: textbook, sha: 'old-pdf'}]}));
  const blocked = spawnSync('pwsh', ['-NoProfile', '-Command', command], {encoding: 'utf8', windowsHide: true});
  assert.notEqual(blocked.status, 0, blocked.error?.message);
  assert(!blocked.stdout.includes('MOCK_VERCEL_CALLED'));
  assert((blocked.stdout + blocked.stderr).includes('upload blocked'));
  await fs.writeFile(input, JSON.stringify(valid));
  const allowed = spawnSync('pwsh', ['-NoProfile', '-Command', command.replace('/v13/deployments', '/v13/deployments/')], {encoding: 'utf8', windowsHide: true});
  assert.equal(allowed.status, 0, allowed.stderr);
  assert(allowed.stdout.includes('MOCK_VERCEL_CALLED'));
}));
