import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {coverage,fingerprint} from './review.mjs';
const [beforeFile,afterFile,reviewFile,out]=process.argv.slice(2);
const before=JSON.parse(await fs.readFile(beforeFile,'utf8')),raw=await fs.readFile(afterFile,'utf8');
const afterRaw=JSON.parse(raw.slice(raw.indexOf('{'))),after=afterRaw.rows?.[0]?.snapshot||afterRaw,review=JSON.parse(await fs.readFile(reviewFile,'utf8'));
const reviewHash=fingerprint(review);
assert.equal(after.pool.length,930);assert.equal(fingerprint(before.courses),fingerprint(after.courses));assert.equal(fingerprint(before.functions),fingerprint(after.functions));
const prior=new Map(before.pool.map(p=>[p.question_id,p])),expected=new Map(review.assignments.map(a=>[a.question_id,a]));
for(const p of after.pool){
 const old=prior.get(p.question_id),a=expected.get(p.question_id);assert(old&&a);
 assert.equal(p.knowledge_code,a.knowledge_code);assert.equal(p.knowledge_name,a.knowledge_name);assert.equal(p.knowledge_reliable,a.knowledge_reliable);
 assert.equal(p.checks.knowledge_review.review_sha256,reviewHash);assert.equal(fingerprint(p.question),a.question_sha256);
 const unchanged=p=>{const c=structuredClone(p);for(const key of ['row_db_md5','knowledge_code','knowledge_name','knowledge_reliable'])delete c[key];delete c.checks.knowledge_review;delete c.checks.knowledge_reliable;return c;};
 assert.equal(fingerprint(unchanged(p)),fingerprint(unchanged(old)));
}
assert.deepEqual(coverage(after.pool),review.coverage);
const result={passed:true,questions_unchanged:930,course_definitions_unchanged:4,rpc_definitions_unchanged:3,review_sha256:reviewHash,coverage:coverage(after.pool)};
await fs.writeFile(out,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
