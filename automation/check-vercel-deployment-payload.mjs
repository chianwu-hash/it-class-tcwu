import fs from 'node:fs/promises';
import {verifyDeploymentPayload} from './lib/vercel-deployment-payload.mjs';
try {
  if (process.argv.length !== 3) throw Error('需要指定 Vercel 部署 JSON');
  console.log(JSON.stringify(await verifyDeploymentPayload(JSON.parse(await fs.readFile(process.argv[2], 'utf8')))));
} catch (error) { console.error(error.message); process.exitCode = 1; }
