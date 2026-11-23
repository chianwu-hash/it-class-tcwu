import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadBatch,readJson,practiceWriteIntent,freezeJson} from './lib/quiz-batch-plan.mjs';
const packetFile=path.resolve(process.argv[2]);
const {packet:p,counts:n}=await loadBatch(packetFile);
const cwd=fileURLToPath(new URL('../',import.meta.url)).replace(/[\\/]$/,'');
const file=s=>path.join(p.outputDir,p.prefix+'-'+s+'.private.json');
const script=s=>path.join(cwd,'automation',s);
const stage=(id,command,inputs,output,checks)=>({id,command,inputs:[packetFile,...inputs],outputs:[output],checks:checks.map(([key,value])=>({file:output,path:[key],equals:value}))});
const plan=await readJson(file('plan')),isolated=await readJson(file('isolated'));
await freezeJson(file('activate-intent'),practiceWriteIntent(plan,isolated,'activate'));
const gate=file('oauth-gate');
const manifest={schema:1,cwd,stateRoot:p.outputDir,batchPacket:packetFile,sources:p.candidates.map(c=>c.source),stages:[
 {...stage('oauth-gate',[process.execPath,script('verify-quiz-batch-receipt.mjs'),packetFile],[file('plan'),file('isolated'),file('oauth-proof'),script('verify-quiz-batch-receipt.mjs'),script('lib/quiz-batch-plan.mjs')],gate,[['passed',true],['sampleCount',n.samples]]),oauthReceipt:gate},
 stage('activate',['python',script('apply-quiz-practice-batch.py'),packetFile,'activate'],[file('plan'),file('ids'),file('isolated'),file('oauth-proof'),gate,file('activate-intent'),script('apply-quiz-practice-batch.py'),...['activate','readback','answers'].map(s=>path.join(p.outputDir,p.prefix+'-'+s+'.private.sql'))],file('activate-result'),[['passed',true],['visible',true],['questions',n.questions]]),
 stage('readback',['python',script('apply-quiz-practice-batch.py'),packetFile,'readback'],[file('activate-result'),file('plan'),file('ids'),file('isolated'),script('apply-quiz-practice-batch.py')],file('readback-result'),[['passed',true],['questions',n.questions],['references',n.questions]]),
]};
const manifestFile=file('manifest');await fs.writeFile(manifestFile,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({manifestFile,...n}));
