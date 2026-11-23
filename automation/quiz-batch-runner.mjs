import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const sha = value => createHash('sha256').update(value).digest('hex');
const readJson = async file => JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, ''));

async function fingerprints(files) {
  const result = {};
  for (const file of files) result[file] = sha(await fs.readFile(file));
  return result;
}

function outside(root, file) {
  const relative = path.relative(root, file);
  return path.isAbsolute(relative) || relative === '..' || relative.startsWith('..' + path.sep);
}

async function atomicJson(file, value) {
  const temp = file + '.' + process.pid + '.tmp';
  await fs.writeFile(temp, JSON.stringify(value, null, 2) + '\n', {encoding: 'utf8', flag: 'wx'});
  await fs.rename(temp, file);
}

async function execute(stage, cwd, log) {
  const handle = await fs.open(log, 'wx');
  try {
    await new Promise((resolve, reject) => {
      const child = spawn(stage.command[0], stage.command.slice(1), {
        cwd, shell: false, windowsHide: true, stdio: ['ignore', handle.fd, handle.fd],
      });
      child.once('error', reject);
      child.once('exit', (code, signal) => {
        if (code === 0) resolve();
        else reject(new Error(`階段 ${stage.id} 執行失敗，代碼 ${code ?? signal}，請查看私有紀錄。`));
      });
    });
  } finally {
    await handle.close();
  }
}

async function verifyOutput(stage) {
  const hashes = await fingerprints(stage.outputs);
  for (const check of stage.checks) {
    const data = await readJson(check.file);
    const actual = check.path.reduce((value, key) => value?.[key], data);
    if (JSON.stringify(actual) !== JSON.stringify(check.equals)) {
      throw Error(`階段 ${stage.id} 的收據檢查未通過。`);
    }
  }
  return hashes;
}

export async function runBatch(manifestFile, through, recoveryFile) {
  const root = await fs.realpath(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
  const input = await fs.readFile(manifestFile);
  const manifest = JSON.parse(input.toString('utf8').replace(/^\uFEFF/, ''));
  if (manifest.schema !== 1 || !Array.isArray(manifest.sources) || !manifest.sources.length) throw Error('批次清單格式不符。');
  if (new Set(manifest.sources).size !== manifest.sources.length) throw Error('批次來源重複。');
  const cwd = await fs.realpath(manifest.cwd);
  if (cwd !== root) throw Error('批次工作目錄與執行器不符。');
  const stateRoot = await fs.realpath(manifest.stateRoot);
  if (!outside(root, stateRoot)) throw Error('批次證據須存於儲存庫外。');
  if (!Array.isArray(manifest.stages) || !manifest.stages.length) throw Error('缺少批次階段。');
  const ids = new Set();
  for (const stage of manifest.stages) {
    if (!/^[a-z][a-z0-9-]*$/.test(stage.id) || ids.has(stage.id)) throw Error('階段識別碼不符。');
    ids.add(stage.id);
    if (!Array.isArray(stage.command) || !stage.command.length || stage.command.some(s => typeof s !== 'string')) throw Error('缺少結構化執行命令。');
    if (!Array.isArray(stage.inputs) || !Array.isArray(stage.outputs) || !stage.outputs.length || !Array.isArray(stage.checks) || !stage.checks.length) throw Error('階段須宣告輸入、輸出及收據檢查。');
    for (const output of stage.outputs) {
      const parent = await fs.realpath(path.dirname(output));
      if (!path.isAbsolute(output) || !outside(root, path.join(parent, path.basename(output)))) throw Error('輸出須使用儲存庫外的絕對路徑。');
    }
    if (stage.checks.some(c => !stage.outputs.includes(c.file) || !Array.isArray(c.path))) throw Error('檢查須對應已宣告的輸出。');
  }
  if (through && !ids.has(through)) throw Error('指定的截止階段不存在。');
  const batchId = sha(input);
  const folder = path.join(stateRoot, batchId);
  await fs.mkdir(folder, {recursive: true});
  const lock = path.join(folder, 'running.lock');
  const locked = await fs.open(lock, 'wx');
  try {
    await locked.writeFile(JSON.stringify({pid: process.pid, started: new Date().toISOString()}));
    const frozen = path.join(folder, 'manifest.private.json');
    try { await fs.writeFile(frozen, input, {flag: 'wx'}); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    if (sha(await fs.readFile(frozen)) !== batchId) throw Error('固定批次清單遭修改。');
    const stateFile = path.join(folder, 'state.private.json');
    let state;
    try { state = await readJson(stateFile); }
    catch (error) { if (error.code !== 'ENOENT') throw error; state = {batchId, stages: {}}; }
    if (state.batchId !== batchId) throw Error('批次狀態識別不符。');
    let previous = batchId;
    for (const stage of manifest.stages) {
      const inputs = await fingerprints(stage.inputs);
      const signature = sha(JSON.stringify({stage, previous, inputs}));
      const old = state.stages[stage.id];
      if (old?.status === 'complete') {
        if (signature !== old.signature) throw Error(`階段 ${stage.id} 輸入已改變，請建立新批次清單。`);
        const outputs = await verifyOutput(stage);
        if (JSON.stringify(outputs) !== JSON.stringify(old.outputs)) throw Error(`階段 ${stage.id} 輸出已改變。`);
        console.log(JSON.stringify({stage: stage.id, reused: true}));
      } else {
        if (old?.status === 'running' || old?.status === 'failed') {
          if (!recoveryFile) throw Error(`階段 ${stage.id} 需要先讀回檢查，避免重複寫入。`);
          const recovery = await readJson(recoveryFile);
          if (recovery.batchId !== batchId || recovery.stage !== stage.id || recovery.signature !== signature || recovery.safeToRetry !== true || !recovery.evidence || !Object.keys(recovery.evidence).length) throw Error('恢復收據未綁定目前階段及輸入。');
          const current = await fingerprints(Object.keys(recovery.evidence));
          if (JSON.stringify(current) !== JSON.stringify(recovery.evidence)) throw Error('恢復證據已改變。');
          state.history ??= [];
          state.history.push({stage: stage.id, previous: old, recovery: {file: recoveryFile, sha256: sha(await fs.readFile(recoveryFile))}});
          if (recovery.mode === 'accept-readback') {
            const outputs = await verifyOutput(stage);
            state.stages[stage.id] = {status: 'complete', signature, outputs, recoveredByReadback: true, finished: new Date().toISOString()};
            await atomicJson(stateFile, state);
            console.log(JSON.stringify({stage: stage.id, recoveredByReadback: true}));
            previous = signature;
            if (stage.id === through) break;
            continue;
          }
        }
        for (const output of stage.outputs) {
          try { await fs.access(output); throw Error(`輸出已存在，請先核對階段 ${stage.id} 的既有收據。`); }
          catch (error) { if (error.code !== 'ENOENT') throw error; }
        }
        const log = path.join(folder, stage.id + '.' + Date.now() + '.private.log');
        state.stages[stage.id] = {status: 'running', signature, started: new Date().toISOString()};
        await atomicJson(stateFile, state);
        try {
          await execute(stage, cwd, log);
          const outputs = await verifyOutput(stage);
          state.stages[stage.id] = {...state.stages[stage.id], status: 'complete', outputs, finished: new Date().toISOString()};
          await atomicJson(stateFile, state);
          console.log(JSON.stringify({stage: stage.id, reused: false}));
        } catch (error) {
          state.stages[stage.id].status = 'failed';
          await atomicJson(stateFile, state);
          throw error;
        }
      }
      previous = signature;
      if (stage.id === through) break;
    }
    return {batchId, sources: manifest.sources.length, oauthSamples: Math.max(1, Math.ceil(manifest.sources.length * 0.05)), stateFile};
  } finally {
    await locked.close();
    await fs.unlink(lock);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [manifest, through, recovery] = process.argv.slice(2);
  if (!manifest) throw Error('請提供私有批次清單路徑。');
  console.log(JSON.stringify(await runBatch(manifest, through, recovery)));
}
