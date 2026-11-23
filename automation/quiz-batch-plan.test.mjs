import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {workerIntent,freezeWorkerIntent,reconcileWorker,applyWorkerIntent} from './lib/quiz-worker-write.mjs';
import {batchCounts,expectedResponse,assertOAuthReceipt,practiceWriteIntent,freezeJson,validatePageBindings,recordBatchTime,preserveOAuthReceipt} from './lib/quiz-batch-plan.mjs';
const fixture=()=>{
 const baseline={files:{'worker.mjs':'worker source','assets.mjs':'export const assets = {"old":{"id":"one"}};'},settings:{bindings:[{name:'SECRET',type:'secret_text'}],compatibility_date:'2026-01-01'}};
 const files={...baseline.files,'assets.mjs':'export const assets = {"old":{"id":"one"},"new":{"id":"two"}};'};
 return workerIntent(baseline,files,{accountVerified:true,freePlanVerified:true,account:'fixture'});
};
test('Worker 回應中斷後只讀回完整檔案與設定，續跑不重送',async()=>{
 const intent=fixture();let current=intent.baseline,writes=0;
 const read=async()=>current,write=async()=>{writes++;current={files:intent.expectedFiles,settings:intent.baseline.settings};throw Error('response lost');};
 const result=await applyWorkerIntent(intent,{read,write,delay:async()=>{}});
 assert.ok(result.passed&&result.reconciled);assert.equal(writes,1);
 assert.ok((await applyWorkerIntent(intent,{read,write})).reused);assert.equal(writes,1);
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'worker-intent-')),file=path.join(folder,'intent.json');
 await freezeWorkerIntent(file,intent);await freezeWorkerIntent(file,intent);
 await assert.rejects(freezeWorkerIntent(file,{...intent,identity:{account:'another'}}));
});
test('Worker 不接受其他程式、既有索引或設定變動，未確認不重送',async()=>{
 const intent=fixture();assert.throws(()=>reconcileWorker(intent,{files:{...intent.expectedFiles,'worker.mjs':'changed'},settings:intent.baseline.settings}));
 assert.throws(()=>reconcileWorker(intent,{files:intent.expectedFiles,settings:{...intent.baseline.settings,bindings:[]}}));
 assert.throws(()=>workerIntent(intent.baseline,{...intent.expectedFiles,'assets.mjs':'export const assets = {"old":{"id":"wrong"}};'},intent.identity));
 let writes=0;await assert.rejects(applyWorkerIntent(intent,{read:async()=>intent.baseline,write:async()=>{writes++;},delay:async()=>{}}),/不自動重送/);assert.equal(writes,1);
});
const question={id:'q1',type:'fields',prompt:{text:'fixture',media:[]},explanation:{text:'fixture',media:[]},fields:[{id:'a',label:'A',input:'math'},{id:'b',label:'B',input:'math'}],answer:{format:'fields-v1',fields:{a:['1'],b:['0']}},work:{input:'expression',label:'fixture'}};
const candidate=i=>({source:'s'+i,doc:{schema:1,title:'Fixture',catalog:{school_year:'115',subject:'fixture',publisher:'fixture',volume:'fixture',unit:'1'},blocks:[{id:'b'+i,material:{text:'',media:[]},questions:[{...question,id:'q'+i}]}]}});
test('來源數推導 5% 抽樣與作答位置，OAuth 缺題或重複不能過關',()=>{
 const packet={schema:1,candidates:Array.from({length:25},(_,i)=>candidate(i)),samples:[{question_id:'q0'},{question_id:'q1'}]};
 const counts=batchCounts(packet);assert.deepEqual(counts,{sources:25,questions:25,positions:50,images:0,samples:2});
 assert.deepEqual(expectedResponse(question,'1/1=1'),{v:1,f:{a:'1',b:'0'},w:'1/1=1'});
 assert.throws(()=>expectedResponse(question));
 const batch={packet,counts,sha256:'fixed'},proof={passed:true,formalOAuth:true,packetSha:'fixed',sampleCount:2,samples:[{question:'q0'},{question:'q1'}]};
 assertOAuthReceipt(batch,proof);assert.throws(()=>assertOAuthReceipt(batch,{...proof,sampleCount:1}));assert.throws(()=>assertOAuthReceipt(batch,{...proof,samples:[{question:'q0'},{question:'q0'}]}));assert.throws(()=>assertOAuthReceipt(batch,{...proof,packetSha:'other'}));
});

test('SQL 寫入意圖在執行前固定，輸入或 SQL 換版不能覆寫',async()=>{
 const plan={packetSha:'packet',ids:{session:'session',samples:[{question_id:'q'}]}},isolated={packetSha:'packet',sql:{activate:'sqlsha'}};
 const intent=practiceWriteIntent(plan,isolated,'activate');assert.equal(intent.sqlSha,'sqlsha');
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'sql-intent-')),file=path.join(folder,'intent.json');
 await freezeJson(file,intent);await freezeJson(file,intent);
 await assert.rejects(freezeJson(file,{...intent,sqlSha:'changed'}));
 assert.throws(()=>practiceWriteIntent(plan,{...isolated,packetSha:'other'},'activate'));
});
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
test('清單生成器由批次推導 checks，事前意圖檔列入啟用 input SHA',async()=>{
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'quiz-manifest-'));
 const packet={schema:1,prefix:'fixture',outputDir:folder,candidates:Array.from({length:25},(_,i)=>candidate(i)),inputs:{},pages:[{id:'page1',printed:1,printedPages:[1],sha:'a'.repeat(64),verified:true}],studyRows:Array.from({length:25},(_,i)=>({question_id:'q'+i,primary:1,reference:[1],student_explanation:'fixture',teacher_notes:{reason:'fixture'}})),samples:[{source:'s0',question_id:'q0',work:'1/1=1'},{source:'s1',question_id:'q1',work:'1/1=1'}]};
 const bytes=JSON.stringify(packet),packetSha=createHash('sha256').update(bytes).digest('hex'),packetFile=path.join(folder,'packet.private.json');await fs.writeFile(packetFile,bytes);
 await fs.writeFile(path.join(folder,'fixture-plan.private.json'),JSON.stringify({packetSha,ids:{session:'fixed',samples:packet.samples}}));
 await fs.writeFile(path.join(folder,'fixture-isolated.private.json'),JSON.stringify({packetSha,passed:true,rollback_verified:true,sql:{activate:'frozen-sql'}}));
 const extraFile=path.join(folder,'extra.private.json'),artifact=path.join(folder,'artifact.txt');await fs.writeFile(artifact,'original');await fs.writeFile(extraFile,JSON.stringify({passed:true,packetSha,artifacts:{[artifact]:createHash('sha256').update('original').digest('hex')}}));
 const result=spawnSync(process.execPath,['automation/create-quiz-practice-manifest.mjs',packetFile,extraFile],{encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr);
 const manifest=JSON.parse(await fs.readFile(path.join(folder,'fixture-manifest.private.json'),'utf8'));
 const activation=manifest.stages.find(s=>s.id==='activate');assert.ok(activation.inputs.includes(path.join(folder,'fixture-activate-intent.private.json')));
 assert.ok(activation.checks.some(c=>c.path[0]==='questions'&&c.equals===25));assert.equal(manifest.stages[0].checks.find(c=>c.path[0]==='sampleCount').equals,2);
 const intent=JSON.parse(await fs.readFile(path.join(folder,'fixture-activate-intent.private.json'),'utf8'));assert.equal(intent.sqlSha,'frozen-sql');assert.equal(intent.packetSha,packetSha);
 assert.ok(manifest.stages[0].inputs.includes(extraFile));assert.ok(manifest.stages[0].command.includes(extraFile));
 await fs.writeFile(path.join(folder,'fixture-oauth-proof.private.json'),JSON.stringify({passed:true,formalOAuth:true,packetSha,sampleCount:2,samples:[{question:'q0'},{question:'q1'}]}));
 await fs.writeFile(artifact,'tampered');const denied=spawnSync(process.execPath,['automation/verify-quiz-batch-receipt.mjs',packetFile,extraFile],{encoding:'utf8',windowsHide:true});assert.notEqual(denied.status,0);await assert.rejects(fs.access(path.join(folder,'fixture-oauth-gate.private.json')));
});

test('跨頁可同 id 拆列，誤頁、歧義及同 id 換內容均拒絕',()=>{
 const a={id:'spread',printed:111,printedPages:[111,112],sha:'a'.repeat(64)},b={...a,printed:112};
 validatePageBindings([a,b]);
 assert.throws(()=>validatePageBindings([{...a,printed:113}]));
 assert.throws(()=>validatePageBindings([a,{...b,id:'other'}]));
 assert.throws(()=>validatePageBindings([a,{...b,printedPages:[112]}]));
 assert.throws(()=>validatePageBindings([a,{...b,sha:'b'.repeat(64)}]));
});
test('計時重跑保留第一次值，不變更固定收據',async()=>{
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'quiz-timing-'));
 const packet={outputDir:folder,prefix:'fixture',timing:{mode:'production',selectionStartedAt:'2026-01-01T00:00:00Z'}};
 const first=await recordBatchTime(packet,'hash','packet-validated'),second=await recordBatchTime(packet,'hash','packet-validated');assert.deepEqual(first,second);
 await assert.rejects(recordBatchTime(packet,'changed','packet-validated'));
});
test('OAuth 重驗保留首次固定收據，另存沿用紀錄',async()=>{
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'quiz-oauth-')),file=path.join(folder,'proof.json');
 const batch={sha256:'fixed',counts:{samples:1},packet:{samples:[{question_id:'q'}]}};
 const sample={source:'s',question:'q',session:'session',version:'v',package:'p',correct:true,saved_and_reopened:true,checks:[],reused_saved_answer:false};
 const proof={packetSha:'fixed',passed:true,formalOAuth:true,sampleCount:1,samples:[sample]};
 await preserveOAuthReceipt(file,batch,proof);const bytes=await fs.readFile(file);
 await preserveOAuthReceipt(file,batch,{...proof,samples:[{...sample,reused_saved_answer:true}]});assert.deepEqual(await fs.readFile(file),bytes);
 await assert.rejects(preserveOAuthReceipt(file,batch,{...proof,samples:[{...sample,session:'other'}]}));
});

test('筆跡作答使用原生 sketch 契約，樣本正解只有共用推導一份',()=>{
 const q={...question,work:{input:'sketch',label:'fixture'}},work={version:1,strokes:[[[0.1,0.1],[0.1,0.1],[0.8,0.8]]],colors:['#185e60']};
 assert.deepEqual(expectedResponse(q,work),{v:1,f:{a:'1',b:'0'},w:work});
 assert.throws(()=>expectedResponse(q,'text'));assert.throws(()=>expectedResponse(q,{version:1,strokes:[]}));
});
