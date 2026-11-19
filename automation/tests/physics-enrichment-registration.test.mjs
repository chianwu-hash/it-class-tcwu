import test from 'node:test';import assert from 'node:assert/strict';
import {documentHash} from '../lib/grade9-physics-enrichment.mjs';
import {physicsRegistrationSql} from '../lib/physics-enrichment-registration.mjs';
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
function synthetic(){
 const practices=Array.from({length:14},(_,i)=>{const document={synthetic:i};return {concept:'topic-'+i,bank:uuid(100+i),version:uuid(200+i),document,sha256:documentHash(document),sources:[1,2].map(n=>({sourceFile:'synthetic-'+n,sha256:'a'.repeat(64)}))};});
 const papers=[113,114].map((y,i)=>{const document={groups:[{id:'g'}]},sha=documentHash(document),version=uuid(10+i),previousVersion=uuid(20+i),hash='b'.repeat(64),paperId=`zhongzheng-${y}-1-g9-exam2-science`;return {paperId,owner:uuid(1),previousVersion,previousSha:'c'.repeat(64),previousPartnerId:'past-'+previousVersion,version,bundle:{document,sha256:sha,provenance:{qc:{status:'content-reviewed-awaiting-flow-verification',reviewedBy:['Codex','Claude']}}},map:{documentSha256:sha,concepts:practices.map(r=>({id:r.concept}))},partner:{id:'past-'+version,source_version:version,content_key:'same-original-'+y},questions:[{question:{id:1000+i,rich:{prompt:{media:[{url:'https://partner-media.invalid/'+hash}]}},explanation:"synthetic student's text"},item:{number:1}}],allocation:{version,document_sha:sha},mediaMap:[{hash,source_url:'https://quiz-media.invalid/'+uuid(1)+'/'+hash}]};});
 return {schema:1,papers,practices};
}
test('registration emits data-only stages, exact activation guards and non-destructive rollback',()=>{
 const plan=synthetic(),stage=physicsRegistrationSql(plan,'stage'),activate=physicsRegistrationSql(plan,'activate'),rollback=physicsRegistrationSql(plan,'rollback');
 assert(stage.includes("synthetic student''s text"));assert(stage.includes('enabled) values('));assert(activate.includes('PHYSICS_MEDIA_CHANGED'));assert(activate.includes('PHYSICS_ALLOCATION_CHANGED'));assert(activate.includes('PHYSICS_TOPIC_CHANGED'));assert(rollback.includes('is distinct from'));assert(!rollback.includes('delete'));
 for(const sql of [stage,activate,rollback]){assert(sql.startsWith('begin;'));assert(sql.endsWith('commit;\n'));assert(!/\b(create\s+(?:or replace\s+)?function|grant|alter\s+table|delete\s+from|quiz_past_answers|quiz_answers|auth\.users)\b/i.test(sql));}
});
test('missing image coverage, a foreign owner, changed source bytes or reserved SQL delimiters reject registration',()=>{
 for(const corrupt of [p=>p.papers[0].mediaMap.pop(),p=>p.papers[1].owner=uuid(99),p=>p.practices[0].document.synthetic='changed',p=>p.papers[0].questions[0].question.explanation='$ready$']){const p=synthetic();corrupt(p);assert.throws(()=>physicsRegistrationSql(p,'stage'));}
});
