import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {assertDeploymentPayload} from '../../release/textbook-policy.mjs';
import {GATE_FILES, POLICY_PATH, loadProjectPolicy, validatePolicy} from '../../release/project-policy.mjs';

export async function verifyDeploymentPayload(payload, {policy, root = process.cwd()} = {}) {
  policy ??= await loadProjectPolicy(root);
  policy = validatePolicy(policy);
  const report = assertDeploymentPayload(payload, policy);
  const policyEntry = payload.files.find(entry => entry.file === POLICY_PATH);
  if (!policyEntry || policyEntry.data === undefined) throw Error('發布清單必須內嵌專案發布設定，不能沿用未知 SHA');
  const embedded = JSON.parse(Buffer.from(policyEntry.data, policyEntry.encoding === 'base64' ? 'base64' : 'utf8').toString('utf8'));
  const sort = value => Array.isArray(value) ? value.map(sort) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, sort(value[k])])) : value;
  if (JSON.stringify(sort(validatePolicy(embedded))) !== JSON.stringify(sort(policy))) throw Error('發布清單的專案設定與本機核對設定不符');
  for (const file of GATE_FILES) {
    const entry = payload.files.find(entry => entry.file === file);
    const expected = createHash('sha1').update(await fs.readFile(new URL('../../' + file, import.meta.url))).digest('hex');
    const actual = entry.data !== undefined
      ? createHash('sha1').update(Buffer.from(entry.data, entry.encoding === 'base64' ? 'base64' : 'utf8')).digest('hex')
      : entry.sha;
    if (actual !== expected) throw Error('發布關卡內容過期或不符，已阻擋上傳：' + file);
  }
  const configEntry = payload.files.find(entry => entry.file === 'vercel.json');
  // Require inline configuration: a SHA alone cannot prove the build was not overridden.
  if (configEntry.data === undefined) throw Error('vercel.json 必須提供可核對的 data，不能只沿用舊 SHA');
  const config = JSON.parse(Buffer.from(configEntry.data, configEntry.encoding === 'base64' ? 'base64' : 'utf8').toString('utf8'));
  if (config.builds || config.buildCommand !== 'node release/garden-preflight.mjs' || config.outputDirectory !== '.') throw Error('vercel.json 未啟用完整發布關卡');
  return report;
}
