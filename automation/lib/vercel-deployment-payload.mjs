import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {assertDeploymentPayload} from '../../release/textbook-policy.mjs';

export async function verifyDeploymentPayload(payload) {
  const report = assertDeploymentPayload(payload);
  for (const file of ['release/garden-preflight.mjs', 'release/garden-catalog.mjs', 'release/textbook-policy.mjs']) {
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
