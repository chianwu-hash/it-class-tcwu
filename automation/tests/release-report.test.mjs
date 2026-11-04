import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createReleaseReport, reportMarkdown, inspectManifest} from '../release-report.mjs';
import {DEFAULT_POLICY, POLICY_PATH, loadProjectPolicy, validatePolicy, isExcluded, checkExcludedSources, renderProjectIgnore} from '../../release/project-policy.mjs';
import {prepareTextbookFreeRelease} from '../prepare-textbook-free-release.mjs';
import {verifyDeploymentPayload} from '../lib/vercel-deployment-payload.mjs';

async function fixture(fn) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'release-report-'));
  try { await fn(root); } finally { await fs.rm(root, {recursive: true, force: true}); }
}
async function write(root, file, bytes) {
  await fs.mkdir(path.dirname(path.join(root, file)), {recursive: true});
  await fs.writeFile(path.join(root, file), bytes);
}
async function sparse(root, file, size) {
  await write(root, file, ''); const handle = await fs.open(path.join(root, file), 'r+');
  try { await handle.truncate(size); } finally { await handle.close(); }
}
const digest = bytes => createHash('sha1').update(bytes).digest('hex');
const script = fileURLToPath(new URL('../release-report.mjs', import.meta.url));

test('20MB boundary is strict and warnings never cause a failed report or CLI exit', () => fixture(async root => {
  for (const [file, size] of [['below.pdf', 19_999_999], ['exact.pdf', 20_000_000], ['above.pdf', 20_000_001]]) await sparse(root, file, size);
  const manifest = {files: ['below.pdf', 'exact.pdf', 'above.pdf'].map(file => ({file}))};
  const report = await createReleaseReport({manifest, root});
  assert(report.passed); assert(report.warningOnly); assert.equal(report.largeFileCount, 1);
  assert.equal(report.largeFiles[0].file, 'above.pdf'); assert.equal(report.totalBytes, 60_000_000);
  assert(reportMarkdown(report).includes('不會因檔案超過門檻而阻止發布'));
  const baseline = {files: report.files.map(entry => ({file: entry.file, sha: entry.sha, size: entry.sizeBytes}))};
  const repeat = await createReleaseReport({manifest, root, baseline, policy: {...DEFAULT_POLICY, purposes: {'above.pdf': '必要教材'}}});
  assert.equal(repeat.largeFiles[0].status, 'unchanged'); assert.equal(repeat.largeFiles[0].purpose, '必要教材'); assert.equal(repeat.deltaBytes, 0);
  baseline.files.find(entry => entry.file === 'above.pdf').sha = digest('older-version');
  assert.equal((await createReleaseReport({manifest, root, baseline})).largeFiles[0].status, 'changed');
  await write(root, 'upload.json', JSON.stringify(manifest));
  const result = spawnSync(process.execPath, [script, '--manifest', root + '/upload.json', '--root', root], {encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr); assert(result.stdout.includes('above.pdf'));
}));

test('no project configuration means textbooks and all PDF types are allowed', () => fixture(async root => {
  await write(root, 'textbooks/book.pdf', '%PDF-source');
  const policy = await loadProjectPolicy(root);
  assert.deepEqual(policy.exclusions, []); assert(!isExcluded('textbooks/book.pdf', policy));
  assert((await checkExcludedSources(root)).passed);
  assert((await createReleaseReport({root, manifest: {files: [{file: 'textbooks/book.pdf'}]}})).passed);
  const output = root + '-copy';
  try {
    await prepareTextbookFreeRelease(root, output);
    assert.equal(await fs.readFile(output + '/textbooks/book.pdf', 'utf8'), '%PDF-source');
    assert.deepEqual((await loadProjectPolicy(output)).exclusions, []);
    assert(!(await fs.readFile(output + '/.vercelignore', 'utf8')).includes('textbooks'));
  } finally { await fs.rm(output, {recursive: true, force: true}); }
}));

test('project exclusions affect only explicitly configured root paths', () => fixture(async root => {
  const policy = validatePolicy({version: 1, exclusions: [{path: 'private', kind: 'directory', reason: 'Project-only reference'}]});
  await write(root, POLICY_PATH, JSON.stringify(policy));
  await write(root, 'private/book.pdf', '%PDF');
  await write(root, 'public/private/book.pdf', '%PDF-allowed');
  assert(isExcluded('private\\book.pdf', policy)); assert(!isExcluded('public/private/book.pdf', policy));
  await assert.rejects(createReleaseReport({root, manifest: {files: [{file: 'private/book.pdf'}]}}), /專案明確排除/);
  assert((await createReleaseReport({root, manifest: {files: [{file: 'public/private/book.pdf'}]}})).passed);
}));

test('invalid, missing explicit, and misspelled configuration never fall back silently', () => fixture(async root => {
  await assert.rejects(loadProjectPolicy(root, root + '/absent.json'), /無法讀取/);
  await write(root, POLICY_PATH, '{broken'); await assert.rejects(loadProjectPolicy(root), /無法讀取/);
  await write(root, POLICY_PATH, '{"version":1,"exclusion":[]}'); await assert.rejects(loadProjectPolicy(root), /未知欄位/);
  assert.throws(() => validatePolicy({version: 1, exclusions: [{path: '../private', kind: 'directory', reason: 'bad'}]}), /路徑/);
  for (const project of ['', null, {}, {teamId: 'without-project'}]) assert.throws(() => validatePolicy({version: 1, project}), /身份設定無效/);
}));

test('manifest boundaries ignore unrelated worktree files and reject missing, changed or unsafe inputs', () => fixture(async root => {
  await write(root, 'index.html', 'published'); await sparse(root, 'unrelated.pdf', 21_000_000);
  const manifest = {files: [{path: 'index.html', sha: digest('published'), size: 9}]};
  const report = await createReleaseReport({root, manifest});
  assert.equal(report.fileCount, 1); assert.equal(report.largeFileCount, 0); assert.equal(report.totalBytes, 9);
  await assert.rejects(inspectManifest({files: [{file: 'missing.html'}]}, root), /ENOENT/);
  await assert.rejects(inspectManifest({files: [{file: 'index.html', sha: digest('wrong')}]}, root), /SHA 不符/);
  await assert.rejects(inspectManifest({files: [{file: 'index.html', size: 0}]}, root), /大小不符/);
  for (const file of ['../index.html', '/index.html', 'C:/index.html', '%2e%2e/index.html']) await assert.rejects(inspectManifest({files: [{file}]}, root));
  await assert.rejects(inspectManifest({files: [{file: 'index.html'}, {file: './index.html'}]}, root), /重複/);
}));

test('linked files cannot escape the selected root', () => fixture(async root => {
  await fs.mkdir(root + '/source'); await fs.mkdir(root + '/outside'); await write(root, 'outside/index.html', 'external');
  await fs.symlink(root + '/outside', root + '/source/link', process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(inspectManifest({files: [{file: 'link/index.html'}]}, root + '/source'), /連結/);
}));

test('actual inline UTF-8/base64 byte sizes and hashes are checked without disk files', () => fixture(async root => {
  const content = '課程教材'; const bytes = Buffer.from(content);
  const manifest = {files: [{file: 'lesson.txt', data: bytes.toString('base64'), encoding: 'base64', sha: digest(bytes)}]};
  const report = await createReleaseReport({manifest, root});
  assert.equal(report.totalBytes, bytes.length);
  await assert.rejects(inspectManifest({files: [{file: 'lesson.txt', data: content, encoding: 'invalid'}]}), /編碼/);
}));

test('baselines calculate exact deltas; missing baseline sizes stay unknown', () => fixture(async root => {
  const baseline = {files: [{file: 'same.txt', data: 'same'}, {file: 'changed.txt', data: 'old'}, {file: 'removed.txt', data: 'bye'}]};
  const manifest = {files: [{file: 'same.txt', data: 'same'}, {file: 'changed.txt', data: 'new-content'}, {file: 'new.txt', data: 'added'}]};
  const report = await createReleaseReport({manifest, root, baseline});
  assert.deepEqual(report.changes, {added: ['new.txt'], removed: ['removed.txt'], changed: ['changed.txt'], unchanged: ['same.txt']});
  assert.equal(report.baselineBytes, 10); assert.equal(report.totalBytes, 20); assert.equal(report.deltaBytes, 10);
  const unknown = await createReleaseReport({manifest, root, baseline: {files: [{file: 'same.txt', sha: digest('same')}]}});
  assert.equal(unknown.baselineBytes, null); assert.equal(unknown.deltaBytes, null); assert(unknown.limitations.some(note => note.includes('缺少大小')));
}));

test('wrong project or team still blocks while file purposes never authorize publishing', () => fixture(async root => {
  const policy = validatePolicy({version: 1, project: {name: 'correct', id: 'prj_correct', teamId: 'team_correct'}, purposes: {'video.mp4': 'Necessary teaching video'}});
  await write(root, POLICY_PATH, JSON.stringify(policy));
  await assert.rejects(createReleaseReport({root, manifest: {name: 'wrong', files: [{file: 'a', data: 'a'}]}}), /專案身份/);
  await assert.rejects(createReleaseReport({root, manifest: {name: 'correct', teamId: 'wrong', files: [{file: 'a', data: 'a'}]}}), /團隊身份/);
  const generic = await loadProjectPolicy(root); assert.equal(generic.purposes['video.mp4'], 'Necessary teaching video');
}));

test('managed ignore rules track the policy without removing unrelated project rules', () => {
  const policy = validatePolicy({version: 1, exclusions: [{path: 'private', kind: 'directory', reason: 'reference'}], legacyIgnorePatterns: ['old-rule/']});
  const initial = renderProjectIgnore('node_modules/\nold-rule/\n', policy);
  assert(initial.includes('node_modules/')); assert(initial.includes('private/')); assert(!initial.includes('old-rule/'));
  const changed = renderProjectIgnore(initial, DEFAULT_POLICY);
  assert(changed.includes('node_modules/')); assert(!changed.includes('private/'));
  assert.equal(renderProjectIgnore(changed, DEFAULT_POLICY), changed);
});

test('CLI will not overwrite source manifests or previous evidence', () => fixture(async root => {
  const input = root + '/upload.json'; const bytes = JSON.stringify({files: [{file: 'index.html', data: 'hello'}]});
  await fs.writeFile(input, bytes);
  const result = spawnSync(process.execPath, [script, '--manifest', input, '--root', root, '--out', input], {encoding: 'utf8'});
  assert.notEqual(result.status, 0); assert.equal(await fs.readFile(input, 'utf8'), bytes);
}));
