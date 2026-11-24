import assert from 'node:assert/strict';
/** Move explicitly reviewed common source images without losing adjacent text. */
export function shareSourceImageParagraphs(structure,indices){
 assert.ok(Array.isArray(indices)&&indices.length&&new Set(indices).size===indices.length&&indices.every(n=>Number.isInteger(n)&&n>=0));
 const material=structuredClone(structure.material),parts=new Map([...structure.parts].map(([k,v])=>[k,structuredClone(v)])),found=new Set();
 const scan=p=>{if(p.type==='paragraph')for(const r of p.runs)if(r.type==='image'&&indices.includes(r.media_index))found.add(r.media_index);};material.forEach(scan);
 for(const [part,layout] of parts){const kept=[];for(const p of layout){if(p.type!=='paragraph'){kept.push(p);continue;}const moving=p.runs.filter(r=>r.type==='image'&&indices.includes(r.media_index));if(!moving.length){kept.push(p);continue;}moving.forEach(r=>found.add(r.media_index));material.push({type:'paragraph',runs:moving});const rest=p.runs.filter(r=>!moving.includes(r));if(rest.length)kept.push({...p,runs:rest});}parts.set(part,kept);}
 assert.deepEqual(found,new Set(indices),'Reviewed common image missing from source paragraphs');return {material,parts};
}
