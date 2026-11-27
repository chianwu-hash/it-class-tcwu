import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {trialInventory, trialSlot} from '../lib/deployment-cleanup-trial.mjs';
import {cliReader, paginate, collectInventory} from '../lib/deployment-cleanup-collector.mjs';
import {runTrial, validateTrialConfig} from '../deployment-cleanup-trial.mjs';

const NOW = '2026-11-28T03:00:00.000Z', DAY = 86400000;
const project = {id:'prj_eJ1qle57xyilS5MKy6ZS6OuYtyFb',name:'it-class-tcwu',teamId:'team_SOhQ0oysg6ZGV9vs3RryW2CB',teamSlug:'chianwu-4755s-projects',accountEmail:'chianwu@gmail.com'};
const config = {version:1,project,snapshotMaxAgeMinutes:30,quotaBytes:{deploymentStorage:1e10,functionsStorage:1e10},trial:{startDate:'2026-11-28',days:7}};
const dep = (id, age, sha, extra={}) => ({id,projectId:project.id,createdAt:Date.parse(NOW)-age*DAY,readyState:'READY',target:'production',commitSha:sha.repeat(40),isRollbackCandidate:false,...extra});
function fixture() {
  const deployments = [dep('dpl_current',0.1,'a'),dep('dpl_previousA',2,'b'),dep('dpl_sameCommit',1,'b'),dep('dpl_previousB',3,'c'),dep('dpl_daily',6,'d'),dep('dpl_old',9,'e'),dep('dpl_recent',0.3,'f'),dep('dpl_unknown',10,'f',{target:null}),dep('dpl_error',4,'f',{readyState:'ERROR'})];
  const snapshot = {version:1,collectedAt:NOW,identity:project,project:{id:project.id,name:project.name,teamId:project.teamId,productionId:'dpl_current'},deployments,aliases:[{name:'it-class-tcwu.vercel.app',projectId:project.id,deploymentId:'dpl_current'}],domains:[{name:'it-class-tcwu.vercel.app',projectId:project.id,redirect:null}],coverage:{deploymentsComplete:true,aliasesComplete:true,domainsComplete:true,releaseHistoryComplete:true},verification:{productionUnchanged:true,inventoryUnchanged:true,aliasesUnchanged:true,domainsUnchanged:true,retentionUnchanged:true,releaseIdle:true}};
  const history=deployments.filter(d=>!['dpl_unknown','dpl_error','dpl_recent'].includes(d.id)).map(d=>({candidate:d.id,commit:d.commitSha,state:'promoted',alias:d.id,comparison:{ok:true},mainAncestor:true,promotedAt:new Date(d.createdAt).toISOString(),rollback:d.id==='dpl_current'?'dpl_sameCommit':null}));
  const registry={version:1,projectId:project.id,entries:deployments.filter(d=>d.id!=='dpl_unknown').map(d=>({id:d.id,status:'completed',reason:'Explicitly completed',evidence:'Reviewed completion',productionHistoryReviewed:true}))};
  return {snapshot,history,registry};
}
const report = f => trialInventory(f.snapshot,config,f.registry,f.history,{now:NOW});

test('正式版、前兩個不同 commit、七天每日基線與24小時版本取聯集保護',()=>{
  const f=fixture(),r=report(f);
  assert.equal(r.status,'review-only');
  assert.deepEqual(r.rollbackVersions.map(d=>d.id),['dpl_sameCommit','dpl_previousB']);
  for(const id of ['dpl_current','dpl_sameCommit','dpl_previousB','dpl_daily','dpl_recent']) assert(r.retained.some(d=>d.id===id),id);
  assert.deepEqual(r.candidates.map(d=>d.id).sort(),['dpl_error','dpl_old']);
  assert(Object.values(r.protectionCheck).every(Boolean)); assert.equal(r.actions.deletions,false);
});
test('建置成功但未上線、非 main、來源 commit 不符不能冒充可回復驗收版本',()=>{
  for(const mutate of [f=>f.history.forEach(r=>r.state='verified'),f=>f.history.forEach(r=>r.mainAncestor=false),f=>f.history.forEach(r=>r.commit='9'.repeat(40))]){
    const f=fixture();mutate(f);const r=report(f);assert.equal(r.status,'blocked');assert.equal(r.candidates.length,0);assert.equal(r.protectionCheck.rollbackTargetsRetained,false);
  }
});
test('發布日誌混有 aborted／無時間紀錄時仍按真正上線時間選最近兩版',()=>{
  const f=fixture();f.history.reverse();f.history.splice(2,0,{state:'aborted',candidate:'dpl_aborted'});f.history.splice(4,0,{state:'verified',promotedAt:'invalid'});
  assert.deepEqual(report(f).rollbackVersions.map(d=>d.id),['dpl_sameCommit','dpl_previousB']);
});
test('保護條件不因日期或用途已完成被解除，未知用途不列候選',()=>{
  const f=fixture();f.snapshot.aliases.push({name:'legacy.vercel.app',projectId:project.id,deploymentId:'dpl_old'});
  let r=report(f);assert(!r.candidates.some(d=>d.id==='dpl_old'));assert(r.retained.some(d=>d.id==='dpl_unknown'));
  f.snapshot.aliases.pop();f.snapshot.deployments.find(d=>d.id==='dpl_old').isRollbackCandidate=true;
  assert(!report(f).candidates.some(d=>d.id==='dpl_old'));
});
test('兩份快照、網域、發布鎖、保留設定或發布紀錄不完整時撤回候選',()=>{
  for(const [group,key] of [['coverage','aliasesComplete'],['coverage','deploymentsComplete'],['coverage','domainsComplete'],['coverage','releaseHistoryComplete'],['verification','releaseIdle'],['verification','retentionUnchanged'],['verification','productionUnchanged'],['verification','inventoryUnchanged']]){
    const f=fixture();f.snapshot[group][key]=false;const r=report(f);assert.equal(r.status,'blocked',key);assert.equal(r.candidates.length,0,key);
  }
});
test('歷史明確保留版本消失時不擅自註銷，候選全部撤回',()=>{
  const f=fixture();f.registry.entries.push({id:'dpl_missing',status:'protected',reason:'Explicit baseline',evidence:'Prior approval'});
  const r=report(f);assert.equal(r.status,'blocked');assert.equal(r.candidates.length,0);assert.equal(r.missingRegistered.length,1);
});
test('預覽與失敗版本保留三天，正式歷史保留七天',()=>{
  for(const [target,readyState,days] of [[null,'READY',3],['production','ERROR',3],['production','READY',7]]){
    const f=fixture(),d=f.snapshot.deployments.find(d=>d.id==='dpl_old');Object.assign(d,{target,readyState,createdAt:Date.parse(NOW)-(days-.01)*DAY});f.history=f.history.filter(h=>h.candidate!==d.id);
    assert(!report(f).candidates.some(d=>d.id==='dpl_old'));
    d.createdAt=Date.parse(NOW)-(days+.01)*DAY;assert(report(f).candidates.some(d=>d.id==='dpl_old'));
  }
});
test('Asia/Taipei 七天邊界、超過試行期限與重複日期',()=>{
  assert.equal(trialSlot(config,'2026-11-27T15:59:59Z').allowed,false);
  assert.equal(trialSlot(config,'2026-11-27T16:00:00Z').day,1);
  assert.equal(trialSlot(config,'2026-12-04T15:59:59Z').day,7);
  assert.equal(trialSlot(config,'2026-12-04T16:00:00Z').allowed,false);
});
test('唯讀 API 白名單拒絕刪除／設定端點和其他帳號團隊範圍',async()=>{
  const get=cliReader({cliEntry:'unused',cwd:'.',project});
  for(const endpoint of ['/v13/deployments/dpl_old','/v10/projects/x','https://example.com','/v6/deployments?teamId=wrong&projectId='+project.id,'/v4/aliases?teamId='+project.teamId]) await assert.rejects(get(endpoint));
});
test('分頁重複、不完整、網路錯誤不得被當成空清單',async()=>{
  await assert.rejects(paginate(async()=>({deployments:[],pagination:{next:1}}),'/v6/deployments?x=1','deployments'),/重複/);
  await assert.rejects(paginate(async()=>({deployments:Array(100).fill({})}),'/v6/deployments?x=1','deployments'),/完整分頁/);
  await assert.rejects(paginate(async()=>{throw Error('network')},'/v6/deployments?x=1','deployments'),/network/);
});
test('來源必須以正式 alias 為準，不能採 targets.production',async()=>{
  let projectReads=0;const f=fixture();const raw=d=>({uid:d.id,...d,meta:{gitCommitSha:d.commitSha}});
  const get=async url=>{const route=new URL(url,'https://api.vercel.com').pathname;if(route==='/v2/user')return{user:{email:project.accountEmail}};if(route==='/v9/projects/'+project.id){projectReads++;return{id:project.id,name:project.name,accountId:project.teamId,targets:{production:{id:'dpl_wrong'}},deploymentExpiration:{expirationDays:30}}}if(route.includes('/domains'))return{domains:[{name:'it-class-tcwu.vercel.app'}],pagination:{next:null}};if(route==='/v4/aliases/it-class-tcwu.vercel.app')return{projectId:project.id,deploymentId:'dpl_current'};if(route==='/v4/aliases')return{aliases:[{alias:'it-class-tcwu.vercel.app',projectId:project.id,deploymentId:'dpl_current'}],pagination:{next:null}};if(route==='/v6/deployments')return{deployments:f.snapshot.deployments.map(raw),pagination:{next:null}};throw Error(url)};
  const r=await collectInventory({get,project,readLocal:()=>({lockExists:false,history:[],historyComplete:true,historyHash:'same'})});assert.equal(r.snapshot.project.productionId,'dpl_current');assert.equal(r.snapshot.verification.productionUnchanged,true);assert.equal(projectReads,2);
});
test('有發布鎖時不查雲端，沒有任何寫入途徑',async()=>{
  let calls=0;const r=await collectInventory({get:async()=>{calls++},project,readLocal:()=>({lockExists:true,history:[]})});assert.equal(calls,0);assert(r.snapshot.collectionFailed);
  const cli=fileURLToPath(new URL('../deployment-cleanup-trial.mjs',import.meta.url));for(const flag of ['--delete','--apply','--method','--deploy'])assert.notEqual(spawnSync(process.execPath,[cli,flag],{encoding:'utf8'}).status,0);
});
test('立即驗證不耗用試行次數；七天報告保留、同日重入不覆寫，第八天不取數',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'deployment-cleanup-trial-'));
  try{
    const c={...config,repo:path.join(root,'repo'),outputRoot:path.join(root,'private-reports'),registryFile:path.join(root,'registry.json'),cliEntry:path.join(root,'vc.js'),globalConfig:path.join(root,'credentials')};await fs.mkdir(c.repo);const f=fixture();await fs.writeFile(c.registryFile,JSON.stringify(f.registry));const file=path.join(root,'config.json');await fs.writeFile(file,JSON.stringify(c));
    let calls=0;const collector=async()=>{calls++;return{snapshot:f.snapshot,history:f.history}};
    assert.equal((await runTrial({configFile:file,check:true,now:NOW,collector})).status,'review-only');await assert.rejects(fs.access(path.join(c.outputRoot,'trial-state.json')));
    for(let i=0;i<7;i++){const now=new Date(Date.parse(NOW)+i*DAY);f.snapshot.collectedAt=now.toISOString();const r=await runTrial({configFile:file,now,collector});assert.equal(r.day,i+1);assert.equal(r.deletions,false);assert((await fs.readFile(path.join(r.output,'summary.md'),'utf8')).includes('目前正式版本'));assert.equal((await runTrial({configFile:file,now,collector})).status,'already-recorded');}
    const count=calls;assert.equal((await runTrial({configFile:file,now:new Date(Date.parse(NOW)+7*DAY),collector})).status,'outside-trial');assert.equal(calls,count);assert.equal(JSON.parse(await fs.readFile(path.join(c.outputRoot,'trial-state.json'))).completedDates.length,7);
    assert.throws(()=>validateTrialConfig({...c,outputRoot:path.join(c.repo,'private')}));
  }finally{await fs.rm(root,{recursive:true,force:true})}
});

test('試行疊加保護條件也不能掩蓋已封存部署重新出現',()=>{
 const f=fixture(),e=f.registry.entries.find(e=>e.id==='dpl_current');e.status='archived';e.archive={archivedAt:NOW,previousStatus:'protected',reason:'Previously missing',evidence:'Historical audit',deploymentChecks:[{status:404,checkedAt:NOW},{status:404,checkedAt:NOW}],aliasReferenceCount:0,currentProduction:false};const r=report(f);assert.equal(r.status,'blocked');assert.equal(r.candidates.length,0);assert.equal(r.reappearedArchived[0].id,'dpl_current');assert(r.protectionCheck.currentProductionRetained);
});

test('CLI只有精確的Deployment not found (404)回覆可標為不存在',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'deployment-target-status-'));
 try{const entry=path.join(root,'fake-cli.cjs');const get=cliReader({cliEntry:entry,cwd:root,project});for(const message of ['Error: Forbidden (403)\n','Error: Unauthorized (401)\n','Error: network failure\n','Error: other item not found (404)\n']){await fs.writeFile(entry,'process.stderr.write('+JSON.stringify(message)+');process.exit(1)');await assert.rejects(get.deploymentStatus('dpl_gone'),/不能認定不存在/);}await fs.writeFile(entry,'if(process.argv[process.argv.indexOf("--method")+1]!=="GET")process.exit(2);process.stderr.write("Error: Deployment not found (404)\\n");process.exit(1)');assert.equal((await get.deploymentStatus('dpl_gone')).status,404);await assert.rejects(get.deploymentStatus('../other'));}finally{await fs.rm(root,{recursive:true,force:true})}
});
