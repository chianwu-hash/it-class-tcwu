import assert from 'node:assert/strict';import {createHash} from 'node:crypto';

// The reviewed task must ask to divide all items equally between two people,
// without an additional item-count constraint. Keep the teacher's primary pair.
export function equalWeightPartitions(question,fieldIds,grams){
 const q=structuredClone(question);assert.equal(q.type,'fields');assert.equal(fieldIds.length,2);assert.equal(new Set(fieldIds).size,2);
 const fields=fieldIds.map(id=>q.fields.find(f=>f.id===id));assert.ok(fields.every(f=>f?.input==='set'));assert.deepEqual(fields[0].options,fields[1].options);
 const ids=fields[0].options.map(o=>o.id);assert.ok(ids.length>=2&&ids.length<=8&&new Set(ids).size===ids.length);assert.deepEqual(Object.keys(grams).sort(),ids.toSorted());assert.ok(ids.every(id=>Number.isSafeInteger(grams[id])&&grams[id]>0));
 const total=ids.reduce((n,id)=>n+grams[id],0);assert.ok(Number.isSafeInteger(total)&&total%2===0);assert.ok(!(q.answer.tuples??[]).some(t=>t.fields.some(id=>fieldIds.includes(id))));
 const primary=fieldIds.map(id=>{assert.equal(q.answer.fields[id].length,1);return q.answer.fields[id][0];});
 const valid=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length>0&&b.length>0&&new Set([...a,...b]).size===ids.length&&a.length+b.length===ids.length&&[...a,...b].every(id=>ids.includes(id))&&a.reduce((n,id)=>n+grams[id],0)===total/2;
 assert.ok(valid(...primary));const accepted=[Object.fromEntries(fieldIds.map((id,i)=>[id,primary[i]]))];
 const same=(a,b)=>JSON.stringify(a.toSorted())===JSON.stringify(b.toSorted());
 for(let mask=1;mask<(1<<ids.length)-1;mask++){const a=ids.filter((_,i)=>mask&(1<<i)),b=ids.filter(id=>!a.includes(id));if(!valid(a,b)||accepted.some(t=>same(t[fieldIds[0]],a)))continue;accepted.push({[fieldIds[0]]:a,[fieldIds[1]]:b});}
 assert.ok(accepted.length<=20);for(const id of fieldIds)q.answer.fields[id]=accepted.map(t=>t[id]);q.answer.tuples=[...(q.answer.tuples??[]),{fields:fieldIds,accepted}];
 q.id+='_e'+createHash('sha256').update(JSON.stringify(q.answer.tuples)).digest('hex').slice(0,8);return q;
}
