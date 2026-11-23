import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {loadBatch,readJson,assertOAuthReceipt,digest} from './lib/quiz-batch-plan.mjs';
const batch=await loadBatch(process.argv[2]),p=batch.packet;
const file=s=>path.join(p.outputDir,p.prefix+'-'+s+'.private.json');
const proof=await readJson(file('oauth-proof')),isolated=await readJson(file('isolated'));
assert.equal(isolated.packetSha,batch.sha256);assert.ok(isolated.passed&&isolated.rollback_verified);
assertOAuthReceipt(batch,proof);
const additionalProofs={};
for(const file of process.argv.slice(3)){const extra=await readJson(file);assert.ok(extra.passed&&extra.packetSha===batch.sha256,'補充驗收證據不符');for(const [artifact,sha] of Object.entries(extra.artifacts??{}))assert.equal(digest(await fs.readFile(artifact)),sha,'補充驗收附件已改變');additionalProofs[file]=digest(await fs.readFile(file));}
await fs.writeFile(file('oauth-gate'),JSON.stringify({...proof,additionalProofs,sourceReceiptSha:digest(await fs.readFile(file('oauth-proof')))},null,2)+'\n',{flag:'wx'});
