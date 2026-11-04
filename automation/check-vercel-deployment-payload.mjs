import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {verifyDeploymentPayload} from './lib/vercel-deployment-payload.mjs';
import {loadProjectPolicy} from '../release/project-policy.mjs';
import {createReleaseReport, reportMarkdown} from './release-report.mjs';
try {
  if (![3, 5].includes(process.argv.length) || process.argv.length === 5 && process.argv[3] !== '--root') throw Error('需要指定 Vercel 部署 JSON，可加 --root <完整發布目錄>');
  const repository = fileURLToPath(new URL('../', import.meta.url));
  const root = process.argv[4] ? path.resolve(process.argv[4]) : repository;
  const manifest = JSON.parse(await fs.readFile(process.argv[2], 'utf8'));
  const policy = await loadProjectPolicy(repository);
  const gate = await verifyDeploymentPayload(manifest, {policy});
  const report = await createReleaseReport({manifest, root, policy});
  console.log(reportMarkdown(report));
  console.log(JSON.stringify({...gate, warningOnly: true, largeFileCount: report.largeFileCount, totalBytes: report.totalBytes}));
} catch (error) { console.error(error.message); process.exitCode = 1; }
