import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {dailyReport, weeklyReport, assertBatchStillCurrent, evaluateMetric} from '../lib/vercel-maintenance.mjs';
import {runMaintenance} from '../vercel-maintenance.mjs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const now='2026-11-04T03:00:00.000Z';
const config={version:1,project:{name:'course',id:'prj_course',teamId:'team_school',teamSlug:'school',accountEmail:'owner@example.com'},quotaBytes:{deploymentStorage:10_000_000_000,functionsStorage:10_000_000_000},snapshotMaxAgeMinutes:30,registryFile:'registry.json'};
const registry=()=>({version:1,projectId:'prj_course',entries:[]});
const metric=(bytes=100_000_000)=>({unit:'bytes',aggregation:'daily-maximum',points:[{date:'2026-11-03T00:00:00Z',totalBytes:11_000_000_000,projects:[{name:'course',bytes:11_000_000_000}]},{date:'2026-11-04T00:00:00Z',totalBytes:bytes,projects:[{name:'course',bytes}]}]});
const deployment=(id,overrides={})=>({id,projectId:'prj_course',url:'course-'+id+'.vercel.app',createdAt:Date.parse('2026-10-20T12:00:00Z'),readyState:'READY',target:null,branch:'closed-task',isRollbackCandidate:false,...overrides});
function snapshot(){return{version:1,collectedAt:now,identity:{...config.project},project:{id:'prj_course',name:'course',teamId:'team_school',productionId:'dpl_current'},coverage:{deploymentsComplete:true,aliasesComplete:true,domainsComplete:true},verification:{productionUnchanged:true,aliasesUnchanged:true,inventoryUnchanged:true,domainsUnchanged:true},deployments:[deployment('dpl_current',{target:'production'}),deployment('dpl_old')],aliases:[{name:'course.vercel.app',projectId:'prj_course',deploymentId:'dpl_current'}],domains:[{name:'course.vercel.app',projectId:'prj_course',redirect:null}],usage:{deploymentStorage:metric(),functionsStorage:metric()}};}
const finished=()=>({version:1,projectId:'prj_course',entries:[{id:'dpl_old',status:'completed',reason:'Task ended',evidence:'Reviewed completion record'}]});
const opts={now};

test('partial new day and 0B placeholders never imply restored storage',()=>{
 const s=snapshot();s.usage.deploymentStorage=metric(0);
 const r=dailyReport(s,config,null,opts);assert.equal(r.status,'unknown');assert.equal(r.metrics.deploymentStorage.recoveryConfirmed,false);assert.equal(r.metrics.deploymentStorage.latestCoherentCompletedDay.totalBytes,11_000_000_000);assert(r.notification.recommended);
});
test('partial positive total with a missing course project is still unknown',()=>{
 const m=metric();m.points[1]={date:'2026-11-04T00:00:00Z',totalBytes:24_800_352,projects:[{name:'course',bytes:0},{name:'other',bytes:24_800_352}]};
 assert.equal(evaluateMetric(m,config,'deploymentStorage',opts).status,'unknown');
});
test('coherent intraday data is provisional; reaching quota is actionable',()=>{
 assert.equal(evaluateMetric(metric(100),config,'deploymentStorage',opts).status,'provisional-within-limit');
 assert.equal(evaluateMetric(metric(10_000_000_000),config,'deploymentStorage',opts).status,'exceeded');
});
test('historical data, inconsistent sums, wrong units and invalid points remain unknown',()=>{
 for(const mutate of [m=>m.points.pop(),m=>m.points[1].totalBytes++,m=>m.unit='GB-month',m=>m.points[1].totalBytes=-1,m=>m.points.push(m.points[1])]){const m=metric();mutate(m);assert.equal(evaluateMetric(m,config,'deploymentStorage',opts).status,'unknown');}
});
test('daily notification suggestions are deduplicated, and lost state suggests again',()=>{
 const s=snapshot();s.usage.deploymentStorage=metric(0);const first=dailyReport(s,config,null,opts);
 assert(first.notification.recommended);assert(!dailyReport(s,config,first.nextState,opts).notification.recommended);assert(dailyReport(s,config,null,opts).notification.recommended);assert.equal(first.notification.sent,false);
});
test('wrong account/team/project or collection failure blocks assessment and all candidates',()=>{
 for(const mutate of [s=>s.identity.accountEmail='wrong',s=>s.identity.teamId='wrong',s=>s.identity.id='wrong',s=>s.collectionFailed=true]){const s=snapshot();mutate(s);assert.equal(dailyReport(s,config,null,opts).status,'blocked');const w=weeklyReport(s,config,finished(),opts);assert.equal(w.status,'blocked');assert.equal(w.candidates.length,0);}
});
test('unknown purposes are retained regardless of age',()=>{
 const w=weeklyReport(snapshot(),config,registry(),opts);assert.equal(w.candidates.length,0);assert.equal(w.retained.length,2);assert(w.retained.find(x=>x.id==='dpl_old').reviewNeeded);
});
test('positive completion evidence can produce a review-only candidate, never deletion authority',()=>{
 const w=weeklyReport(snapshot(),config,finished(),opts);assert.equal(w.candidates.length,1);assert.equal(w.candidates[0].id,'dpl_old');assert.equal(w.deletionAuthorized,false);assert.equal(w.actions.deletions,false);
});
test('an alias, rollback flag, production history or active task protects a completed entry',()=>{
 for(const mutate of [s=>s.aliases.push({name:'preview.vercel.app',projectId:'prj_course',deploymentId:'dpl_old'}),s=>s.deployments[1].isRollbackCandidate=true,s=>s.deployments[1].target='production',s=>s.deployments[1].readyState='BUILDING',s=>s.deployments[1].isRollbackCandidate=null]){const s=snapshot();mutate(s);assert.equal(weeklyReport(s,config,finished(),opts).candidates.length,0);}
 const r=finished();r.entries[0].status='active';assert.equal(weeklyReport(snapshot(),config,r,opts).candidates.length,0);
});
test('expired protected registration triggers review and is never an automatic candidate',()=>{
 const r=finished();r.entries[0].status='protected';r.entries[0].reviewAfter='2026-01-01T00:00:00Z';const w=weeklyReport(snapshot(),config,r,opts);assert.equal(w.candidates.length,0);assert(w.retained.find(x=>x.id==='dpl_old').reviewNeeded);
});
test('reviewed retired production is eligible only after explicit completion evidence and no rollback flag',()=>{
 const s=snapshot();s.deployments[1].target='production';const r=finished();assert.equal(weeklyReport(s,config,r,opts).candidates.length,0);r.entries[0].productionHistoryReviewed=true;assert.equal(weeklyReport(s,config,r,opts).candidates.length,1);s.deployments[1].isRollbackCandidate=true;assert.equal(weeklyReport(s,config,r,opts).candidates.length,0);
});
test('incomplete pagination and mid-collection changes block candidate generation',()=>{
 for(const mutate of [s=>s.coverage.deploymentsComplete=false,s=>s.coverage.aliasesComplete=false,s=>s.coverage.domainsComplete=false,s=>s.verification.productionUnchanged=false,s=>s.verification.aliasesUnchanged=false,s=>s.verification.inventoryUnchanged=false,s=>s.verification.domainsUnchanged=false]){const s=snapshot();mutate(s);assert.equal(weeklyReport(s,config,finished(),opts).candidates.length,0);}
});
test('usage missing does not block an otherwise safe authorized-purpose inventory',()=>{
 const s=snapshot();s.usage={};assert.equal(dailyReport(s,config,null,opts).status,'unknown');assert.equal(weeklyReport(s,config,finished(),opts).candidates.length,1);
});
test('missing protected versions and unresolved custom domains withdraw candidates',()=>{
 const r=finished();r.entries.push({id:'dpl_missing',status:'protected',reason:'Rollback',evidence:'Approval'});assert.equal(weeklyReport(snapshot(),config,r,opts).candidates.length,0);
 const s=snapshot();s.domains.push({name:'custom.example.com',projectId:'prj_course',redirect:null});assert.equal(weeklyReport(s,config,finished(),opts).status,'blocked');
});
test('old snapshots expire; changed aliases, registry and inventories invalidate fingerprints',()=>{
 const first=weeklyReport(snapshot(),config,finished(),opts);assert(assertBatchStillCurrent(first,first,opts));
 assert.throws(()=>assertBatchStillCurrent(first,first,{now:'2026-11-04T04:00:00Z'}));
 const s=snapshot();s.deployments.push(deployment('dpl_added'));const second=weeklyReport(s,config,finished(),opts);assert.throws(()=>assertBatchStillCurrent(first,second,opts));
 const r=finished();r.entries[0].reason='Changed purpose';assert.throws(()=>assertBatchStillCurrent(first,weeklyReport(snapshot(),config,r,opts),opts));
 const stale=snapshot();stale.collectedAt='2026-11-01T00:00:00Z';assert.equal(weeklyReport(stale,config,finished(),opts).status,'blocked');
});
test('invalid registry and duplicated deployment IDs are rejected conservatively',()=>{
 const r=finished();r.entries.push(r.entries[0]);assert.throws(()=>weeklyReport(snapshot(),config,r,opts));
 const s=snapshot();s.deployments.push(s.deployments[1]);assert.equal(weeklyReport(s,config,finished(),opts).candidates.length,0);
});
test('missing collection time returns a blocked inventory, not a usable candidate batch',()=>{
 const s=snapshot();delete s.collectedAt;const w=weeklyReport(s,config,finished(),opts);assert.equal(w.status,'blocked');assert.equal(w.candidates.length,0);assert.equal(w.batch.expiresAt,null);
});
test('there is no delete/deploy/schedule CLI mode or arbitrary method on the collector',()=>{
 const cli=fileURLToPath(new URL('../vercel-maintenance.mjs',import.meta.url));
 for(const mode of ['delete','deploy','schedule']){const r=spawnSync(process.execPath,[cli,mode],{encoding:'utf8'});assert.notEqual(r.status,0);}
 const collector=fileURLToPath(new URL('../collect-vercel-maintenance.cjs',import.meta.url));const r=spawnSync(process.execPath,[collector,'--method','DELETE'],{encoding:'utf8'});assert.notEqual(r.status,0);assert(r.stderr.includes('Invalid collector arguments'));
});
test('local runner writes all reports, reuses local state, and never overwrites an earlier run',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'maintenance-'));try{
  const s=snapshot();s.collectedAt=new Date().toISOString();s.usage.deploymentStorage.points.at(-1).date=new Date().toISOString().slice(0,10)+'T00:00:00Z';s.usage.deploymentStorage.points.at(-1).totalBytes=0;s.usage.deploymentStorage.points.at(-1).projects[0].bytes=0;
  const configFile=root+'/config.json',snapshotFile=root+'/snapshot.json',registryFile=root+'/registry.json',stateFile=root+'/state.json';
  await fs.writeFile(configFile,JSON.stringify(config));await fs.writeFile(snapshotFile,JSON.stringify(s));await fs.writeFile(registryFile,JSON.stringify(finished()));
  const first=await runMaintenance({snapshotFile,configFile,registryFile,stateFile,output:root+'/first'});assert(first.notificationRecommended);assert.equal(first.deletionAuthorized,false);
  for(const name of ['daily-usage.md','retained-deployments.md','cleanup-candidates.md'])await fs.access(root+'/first/'+name);
  assert(!(await runMaintenance({snapshotFile,configFile,registryFile,stateFile,output:root+'/second'})).notificationRecommended);
  await assert.rejects(runMaintenance({snapshotFile,configFile,registryFile,stateFile,output:root+'/first'}),/EEXIST/);
  await fs.writeFile(stateFile,'broken-json');assert((await runMaintenance({snapshotFile,configFile,registryFile,stateFile,output:root+'/third'})).notificationRecommended);
  assert((await fs.readdir(root)).some(name=>name.includes('.bak')));
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
