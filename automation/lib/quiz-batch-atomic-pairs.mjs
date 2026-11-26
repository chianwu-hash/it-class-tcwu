import assert from 'node:assert/strict';import {createHash} from 'node:crypto';

// Call only after the source establishes that both directions/orders are valid.
// Preserve the two source slots; accepting either value in each slot alone would
// wrongly accept a duplicated station or a duplicated month.
export function reverseAtomicPair(question,fieldIds){
 const q=structuredClone(question);assert.equal(q.type,'fields');assert.equal(fieldIds.length,2);assert.equal(new Set(fieldIds).size,2);
 const fields=fieldIds.map(id=>q.fields.find(f=>f.id===id));assert.ok(fields.every(Boolean));assert.equal(fields[0].input,fields[1].input);assert.ok(['math','text','single','set'].includes(fields[0].input));
 const set=fields[0].input==='set';if(['single','set'].includes(fields[0].input))assert.deepEqual(fields[0].options,fields[1].options);
 const values=fieldIds.map(id=>{assert.equal(q.answer.fields[id].length,1);const v=q.answer.fields[id][0];if(set){assert.ok(Array.isArray(v)&&new Set(v).size===v.length&&v.every(x=>typeof x==='string'&&fields[0].options.some(o=>o.id===x)));}else assert.equal(typeof v,'string');return v;});assert.notEqual(JSON.stringify(set?values[0].toSorted():values[0]),JSON.stringify(set?values[1].toSorted():values[1]));
 assert.ok(!(q.answer.tuples??[]).some(t=>t.fields.some(id=>fieldIds.includes(id))));
 for(const [i,id] of fieldIds.entries())q.answer.fields[id]=[values[i],values[1-i]];
 q.answer.tuples=[...(q.answer.tuples??[]),{fields:fieldIds,accepted:[Object.fromEntries(fieldIds.map((id,i)=>[id,values[i]])),Object.fromEntries(fieldIds.map((id,i)=>[id,values[1-i]]))]}];
 q.id+='_p'+createHash('sha256').update(JSON.stringify(q.answer.tuples)).digest('hex').slice(0,8);
 return q;
}

export function atomicPairCases(question,response){
 const correct=[],incorrect=[];
 const tuples=question.answer.tuples??[];
 const same=(id,a,b)=>{const set=question.fields.find(f=>f.id===id).input==='set';return JSON.stringify(set?a.toSorted():a)===JSON.stringify(set?b.toSorted():b);};
 const matches=(tuple,values)=>tuple.accepted.some(a=>tuple.fields.every(id=>same(id,a[id],values[id])));
 for(const tuple of tuples){
  assert.ok(tuple.fields.length>=2&&tuple.fields.every(id=>question.fields.some(f=>f.id===id&&['math','text','single','set'].includes(f.input))));
  for(const accepted of tuple.accepted.slice(1)){
   const next=structuredClone(response);Object.assign(next.f,structuredClone(accepted));
   if(tuples.every(rule=>matches(rule,next.f))&&!correct.some(x=>JSON.stringify(x)===JSON.stringify(next)))correct.push(next);
  }
  for(const a of tuple.accepted)for(const b of tuple.accepted)for(const id of tuple.fields){const mixed={...a,[id]:b[id]};if(matches(tuple,mixed))continue;const next=structuredClone(response);Object.assign(next.f,structuredClone(mixed));if(!incorrect.some(x=>JSON.stringify(x)===JSON.stringify(next)))incorrect.push(next);}
 }
 return {correct,incorrect};
}
