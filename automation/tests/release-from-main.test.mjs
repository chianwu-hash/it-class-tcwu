import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { start, deploy, promote, abort, ReleaseError } from '../release-from-main.mjs';

const sha1 = s => createHash('sha1').update(s).digest('hex');
const tree = files => [{ name: 'src', type: 'directory', children: Object.entries(files).map(([name, body]) => ({ name, type: 'file', uid: sha1(body) })) }];
const MAIN = 'a'.repeat(40), PROD = 'dpl_prod', CAND = 'dpl_cand';

async function fakeEnv(over = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'release-gate-'));
  const files = {}, calls = [];
  const state = { head: MAIN, originMain: MAIN, dirty: '', production: PROD, alias: PROD,
    trees: { [PROD]: tree({ 'a.js': 'a\n', 'b.js': 'b\n' }), [CAND]: tree({ 'a.js': 'A\n', 'b.js': 'b\n' }) }, ...over };
  const env = {
    cwd: dir, state, calls,
    fetch: () => calls.push('fetch'), head: () => state.head, originMain: () => state.originMain, dirty: () => state.dirty,
    lockPath: 'lock', historyPath: 'history',
    readFile: async f => { if (!(f in files)) throw Object.assign(Error('missing'), { code: 'ENOENT' }); return files[f]; },
    createExclusive: async (f, t) => { if (f in files) throw Object.assign(Error('exists'), { code: 'EEXIST' }); files[f] = t; },
    writeFile: async (f, t) => { files[f] = t; }, appendFile: async (f, t) => { files[f] = (files[f] || '') + t; }, remove: async f => { delete files[f]; },
    productionId: () => state.production, aliasTarget: () => state.alias, tree: id => state.trees[id],
    deployCandidate: () => { calls.push('deploy'); return CAND; },
    promote: id => { calls.push('promote:' + id); state.production = id; state.alias = id; },
    now: () => '2026-11-04T00:00:00Z', files,
  };
  return env;
}
const blocked = (p, re) => assert.rejects(p, e => e instanceof ReleaseError && re.test(e.message));

test('正常流程：start → deploy → promote，promote 後釋放鎖並留下紀錄', async () => {
  const env = await fakeEnv();
  await start(env, { agent: 'codex', changed: ['a.js'], added: [], removed: [] });
  const d = await deploy(env, { agent: 'codex' });
  assert.equal(d.state, 'verified');
  const p = await promote(env, { agent: 'codex' });
  assert.equal(p.state, 'promoted');
  assert.deepEqual(env.calls.filter(c => c !== 'fetch'), ['deploy', 'promote:' + CAND]);
  assert.equal(env.files.lock, undefined);
  assert.match(env.files.history, /"state":"promoted"/);
  assert.match(p.handoffRow, /dpl_cand/);
});

test('有未 commit 修改的目錄不能發布', async () => {
  const env = await fakeEnv({ dirty: ' M shared/x.js' });
  await blocked(start(env, { agent: 'codex' }), /not clean/);
});

test('不是 origin/main（凍結包、功能分支、舊 commit）不能發布', async () => {
  const env = await fakeEnv({ head: 'b'.repeat(40) });
  await blocked(start(env, { agent: 'codex' }), /not origin\/main/);
});

test('別人正在發布時不能開始，也不能替別人 deploy、promote 或 abort', async () => {
  const env = await fakeEnv();
  await start(env, { agent: 'claude', changed: ['a.js'] });
  await blocked(start(env, { agent: 'codex' }), /held by claude/);
  await blocked(deploy(env, { agent: 'codex' }), /held by claude/);
  await blocked(promote(env, { agent: 'codex' }), /held by claude/);
  await blocked(abort(env, { agent: 'codex' }), /held by claude/);
});

test('start 之後正式版被別人改了：deploy 與 promote 都會擋下', async () => {
  const env = await fakeEnv();
  await start(env, { agent: 'codex', changed: ['a.js'] });
  env.state.production = 'dpl_someone_else';
  await blocked(deploy(env, { agent: 'codex' }), /production changed/);
  env.state.production = PROD;
  await deploy(env, { agent: 'codex' });
  env.state.production = 'dpl_someone_else';
  await blocked(promote(env, { agent: 'codex' }), /production changed/);
  assert.ok(!env.calls.some(c => c.startsWith('promote:')));
});

test('候選版多出未宣告的變更：deploy 標為 rejected，promote 被擋', async () => {
  const env = await fakeEnv();
  await start(env, { agent: 'codex', changed: [] });
  await blocked(deploy(env, { agent: 'codex' }), /does not match/);
  assert.match(env.files.lock, /"state": "rejected"/);
  await blocked(promote(env, { agent: 'codex' }), /no verified candidate/);
});

test('start 之後 origin/main 又前進：deploy 被擋，需 abort 重來', async () => {
  const env = await fakeEnv();
  await start(env, { agent: 'codex', changed: ['a.js'] });
  env.state.head = env.state.originMain = 'c'.repeat(40);
  await blocked(deploy(env, { agent: 'codex' }), /moved/);
  const a = await abort(env, { agent: 'codex' });
  assert.equal(a.aborted, true);
  assert.equal(env.files.lock, undefined);
  assert.match(env.files.history, /"state":"aborted"/);
});

test('只差換行的檔不算未宣告變更', async () => {
  const env = await fakeEnv();
  await fs.writeFile(path.join(env.cwd, 'b.js'), 'b\r\n');
  env.state.trees[CAND] = tree({ 'a.js': 'A\n', 'b.js': 'b\r\n' });
  await start(env, { agent: 'codex', changed: ['a.js'] });
  const d = await deploy(env, { agent: 'codex' });
  assert.equal(d.comparison.eolOnly, 1);
  assert.equal(d.state, 'verified');
});
