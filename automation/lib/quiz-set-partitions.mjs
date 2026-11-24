import assert from 'node:assert/strict';
/** Split one fixed accepted set into native groups; never split alternative sets. */
export function partitionSetField(field,accepted){
 assert.equal(field.input,'set');assert.ok(field.options.length>8&&field.options.length<=32);assert.equal(new Set(field.options.map(o=>o.id)).size,field.options.length);
 assert.equal(accepted.length,1,'Alternative sets require tuple coupling, not independent partitions');const values=accepted[0];assert.ok(Array.isArray(values)&&new Set(values).size===values.length&&values.every(v=>field.options.some(o=>o.id===v)));
 const count=Math.ceil(field.options.length/8),size=Math.ceil(field.options.length/count),fields=[],answers={},mapping=[];
 for(let from=0;from<field.options.length;from+=size){const options=structuredClone(field.options.slice(from,from+size)),id=field.id+'_g'+(fields.length+1);assert.ok(options.length>=2&&options.length<=8);fields.push({...structuredClone(field),id,label:field.label+'（第'+(from+1)+'–'+(from+options.length)+'項）',options});answers[id]=[values.filter(v=>options.some(o=>o.id===v))];mapping.push({field:id,sourceOptionIndices:options.map((_,i)=>from+i)});}
 assert.deepEqual(fields.flatMap(f=>f.options),field.options);return {fields,answers,mapping};
}
