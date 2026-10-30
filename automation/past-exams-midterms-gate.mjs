import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const root='automation/output/past-exams-midterms',out=root+'/cloud',read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,'')),hash=b=>createHash('sha256').update(b).digest('hex');
const scope=read(root+'/publication-scope.json'),ids=scope.paperIds.filter(id=>id.startsWith('dingxi-113-1-'));
assert.equal(ids.length,10);
const qa=read(root+'/browser-all.private.json'),smoke=read(out+'/smoke.private.json'),registered=read(out+'/registered.private.json'),media=read(out+'/media.private.json'),files=read(out+'/live-files.private.json'),data=read(out+'/registered-data.private.json'),papers={};
assert.equal(qa.status,'passed');assert.equal(qa.reports.length,10);assert(smoke.passed&&smoke.studentRowsUnchanged&&smoke.papers===10&&smoke.disabled);assert(registered.passed&&registered.disabled&&registered.studentDataUnchanged);assert(media.passed);assert(files.passed&&files.files===254);assert(data.passed&&data.mode==='registered'&&data.oldVersionsUnchanged&&data.privateTables);
for(const id of ids){const b=read(root+'/'+id+'/bundle.private.json');assert.equal(b.provenance.qc.status,'verified');assert.equal(b.sha256,hash(JSON.stringify(b.document)));assert.equal(b.sha256,registered.papers[id]);assert.equal(b.sha256,media.papers[id]);assert.equal(b.sha256,qa.reports.find(r=>r.paperId===id)?.sha256);assert.deepEqual(qa.reports.find(r=>r.paperId===id)?.errors,[]);papers[id]=b.sha256;}
const log=fs.readFileSync(root+'/regression-final.log','utf8');const tests=Number(log.match(/tests (\d+)/)?.[1]);assert.equal(tests,22);assert.match(log,new RegExp('pass '+tests));assert.match(log,/fail 0/);assert.match(log,/skipped 0/);
const full=fs.readFileSync(root+'/regression.log','utf8');assert.match(full,/tests 73/);assert.match(full,/pass 73/);assert.match(full,/fail 0/);assert.match(full,/skipped 0/);
for(const name of ['catalog-local','catalog-candidate-authenticated','catalog-live']){const c=read(root+'/'+name+'/report.json');assert(c.passed&&c.checks.length===6);}
assert(read(root+'/english-semester-decision.private.json').authority.includes('使用者'));
const report={passed:true,papers,at:new Date().toISOString(),browserPapers:10,rollbackPapers:10,regression:73,followupRegression:tests,liveStaticFiles:254,oldImmutableVersionsPreserved:true,studentDataPreserved:true};
fs.writeFileSync(out+'/release-ready.private.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,papers:10}));
