import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
/** Reviewed child prompts may separate independent fields, never a coupled tuple. */
export function splitReviewedFields(question,groups){
 assert.equal(question.type,'fields');assert.ok(!question.work);assert.ok(groups.length>=2);const ids=question.fields.map(f=>f.id),covered=groups.flatMap(g=>g.fields);assert.equal(covered.length,ids.length);assert.equal(new Set(covered).size,ids.length);assert.deepEqual(covered,ids,'Reviewed subquestions must retain original field order');
 for(const t of question.answer.tuples??[])assert.ok(groups.some(g=>t.fields.every(id=>g.fields.includes(id))),'Cannot separate an atomic answer tuple');
 return groups.map(g=>{assert.ok(g.fields.length&&g.prompt&&g.explanation);const answer={format:'fields-v1',fields:Object.fromEntries(g.fields.map(id=>[id,structuredClone(question.answer.fields[id])]))},tuples=(question.answer.tuples??[]).filter(t=>t.fields.every(id=>g.fields.includes(id)));if(tuples.length)answer.tuples=structuredClone(tuples);return {...structuredClone(question),id:question.id+'_s'+createHash('sha256').update(JSON.stringify(g)).digest('hex').slice(0,10),prompt:structuredClone(g.prompt),fields:question.fields.filter(f=>g.fields.includes(f.id)).map(f=>structuredClone(f)),answer,explanation:structuredClone(g.explanation)};});
}
