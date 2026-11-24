import test from 'node:test';
import assert from 'node:assert/strict';
import {batchMediaAssets} from './lib/quiz-batch-media.mjs';
import {equalFraction} from './lib/quiz-matching-diagrams.mjs';

const fixture=()=>{
 const owner='82dfc4ec-8c68-47d9-aa25-8918080ca577',sha256='a'.repeat(64),url=`https://quiz-media.invalid/${owner}/${sha256}`;
 return {identities:{owner},candidates:[{doc:{media:[{kind:'image',url,mime:'image/png',bytes:32}]}}],mediaAssets:[{url,sha256,mime:'image/png',bytes:32,object_path:'private-fixture'}]};
};
test('private media requires complete, consistent descriptors',()=>{
 const p=fixture();assert.equal(batchMediaAssets(p).length,1);
 for(const mutate of [p=>p.mediaAssets=[],p=>p.mediaAssets[0].bytes=-1,p=>p.identities.owner='another-owner',p=>p.mediaAssets.push(p.mediaAssets[0])]){const changed=fixture();mutate(changed);assert.throws(()=>batchMediaAssets(changed));}
 const changed=fixture();changed.candidates.push({doc:{media:[{...changed.candidates[0].doc.media[0],kind:'audio'}]}});assert.throws(()=>batchMediaAssets(changed));
});
test('unillustrated batches still require no descriptors',()=>{assert.deepEqual(batchMediaAssets({candidates:[{doc:{}}]}),[]);const p=fixture();p.candidates=[{doc:{}}];assert.throws(()=>batchMediaAssets(p));});
test('fraction options compare exactly without changing their original forms',()=>{assert.ok(equalFraction('2/4','3/6'));assert.ok(equalFraction('10/10','1'));assert.equal(equalFraction('2/8','2/4'),false);assert.throws(()=>equalFraction('1/0','1'));});
