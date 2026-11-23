import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {runBatch} from './quiz-batch-runner.mjs';

test('續跑核對輸入及輸出並跳過已完成命令，鎖拒絕同批並行', async () => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'quiz-batch-'));
  const input = path.join(folder, 'input.txt');
  const output = path.join(folder, 'proof.private.json');
  const command = path.join(folder, 'phase.mjs');
  await fs.writeFile(input, 'original');
  await fs.writeFile(command, `import fs from 'node:fs/promises';await fs.writeFile(${JSON.stringify(output)},'{"passed":true}',{flag:'wx'});`);
  const manifestFile = path.join(folder, 'batch.private.json');
  const manifest = {
    schema: 1, sources: ['one'], cwd: process.cwd(), stateRoot: folder,
    stages: [{id: 'verify', command: [process.execPath, command], inputs: [input, command], outputs: [output], checks: [{file: output, path: ['passed'], equals: true}]}],
  };
  await fs.writeFile(manifestFile, JSON.stringify(manifest));
  const first = await runBatch(manifestFile);
  assert.equal(first.oauthSamples, 1);
  assert.deepEqual(await runBatch(manifestFile), first);
  await fs.writeFile(input, 'changed');
  await assert.rejects(runBatch(manifestFile), /輸入已改變/);
  await fs.writeFile(input, 'original');
  await fs.writeFile(output, '{"passed":false}');
  await assert.rejects(runBatch(manifestFile), /收據檢查未通過/);
  await fs.writeFile(output, '{"passed":true}');
  const hash = createHash('sha256').update(await fs.readFile(manifestFile)).digest('hex');
  const lock = path.join(folder, hash, 'running.lock');
  await fs.writeFile(lock, 'another worker', {flag: 'wx'});
  await assert.rejects(runBatch(manifestFile), {code: 'EEXIST'});
  assert.equal(await fs.readFile(lock, 'utf8'), 'another worker');
});

test('失敗的寫入階段留存狀態，續跑先要求讀回，避免盲目重送', async () => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'quiz-batch-fail-'));
  const output = path.join(folder, 'proof.private.json');
  const manifestFile = path.join(folder, 'batch.private.json');
  await fs.writeFile(manifestFile, JSON.stringify({
    schema: 1, sources: ['one'], cwd: process.cwd(), stateRoot: folder,
    stages: [{id: 'write', command: [process.execPath, '-e', 'process.exit(2)'], inputs: [], outputs: [output], checks: [{file: output, path: ['passed'], equals: true}]}],
  }));
  await assert.rejects(runBatch(manifestFile), /執行失敗/);
  await assert.rejects(runBatch(manifestFile), /需要先讀回檢查/);
  const batchId = createHash('sha256').update(await fs.readFile(manifestFile)).digest('hex');
  const state = JSON.parse(await fs.readFile(path.join(folder, batchId, 'state.private.json'), 'utf8'));
  // 模擬遠端已寫入、命令回應失敗，由另外一次讀回產生證據。
  await fs.writeFile(output, '{"passed":true}');
  const proof = path.join(folder, 'readback.private.json');
  await fs.writeFile(proof, '{"remoteExact":true}');
  const recoveryFile = path.join(folder, 'recover.private.json');
  await fs.writeFile(recoveryFile, JSON.stringify({
    batchId, stage: 'write', signature: state.stages.write.signature, mode: 'accept-readback', safeToRetry: true,
    evidence: {[proof]: createHash('sha256').update(await fs.readFile(proof)).digest('hex')},
  }));
  await runBatch(manifestFile, 'write', recoveryFile);
  const recovered = JSON.parse(await fs.readFile(path.join(folder, batchId, 'state.private.json'), 'utf8'));
  assert.equal(recovered.stages.write.recoveredByReadback, true);
  assert.equal(recovered.stages.write.started, state.stages.write.started);
  assert.ok(recovered.stages.write.finished && recovered.stages.write.recoveredAt);
  assert.equal(recovered.history[0].previous.status, 'failed');
});
