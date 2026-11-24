import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateDocument} from '../../shared/quiz-document.mjs';
import {partitionSetField} from './quiz-set-partitions.mjs';
import {presentationSignature} from '../../shared/quiz-presentation-signature.mjs';

const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const reviewedSourceSignature=src=>sha({id:src.id,question:src.question,answer:src.answer,files:src.source_files});

// Source observations are fixed separately after inspecting the original and
// teacher key. Preserve every reviewed target/position; do not infer a single
// choice merely because the publisher calls the source a matching question.
export function reviewedFieldMapping(src,review,observation,{catalog,owner}){
 assert.equal(observation.sourceSignature,reviewedSourceSignature(src));
 assert.equal(observation.teacherRaw,src.answer.content.text);
 assert.equal(observation.visuallyReviewed,true);assert.equal(review.id,src.id);
 assert.equal(observation.targets.length,review.logical_targets.length);
 const plans={},variants={},mapping=[];
 const questions=observation.targets.map((t,i)=>{
  const target=review.logical_targets[i];assert.equal(t.target,target.target_id);
  assert.equal(t.fields.length,target.positions.length);assert.ok(t.fields.length>0);
  const accepted={},fields=t.fields.flatMap((f,j)=>{
   const pos=target.positions[j];assert.equal(f.position,pos.position_id);
   assert.deepEqual(f.teacherKey,pos.reference_value);assert.ok(f.independentCheck);
   assert.equal(f.input,pos.kind==='single_choice'&&f.asText?'text':pos.kind==='single_choice'?'single':pos.kind==='set'?'set':['short_text','text'].includes(pos.kind)?'text':'math');
   if(f.asText){
    assert.equal(pos.kind,'single_choice');assert.ok(f.sourceOptions?.length>8&&f.sourceOptions.length<=32);assert.equal(f.sourceOptions.filter(o=>o.sourceKey===pos.reference_value).length,1);assert.equal(new Set(f.sourceOptions.map(o=>o.sourceKey)).size,f.sourceOptions.length);assert.ok(!f.options);
    const aliases=new Map();for(const o of f.sourceOptions){assert.ok(o.aliases?.length&&o.aliases.includes(String(o.sourceKey)));for(const alias of o.aliases){assert.ok(typeof alias==='string'&&alias.trim());const key=alias.trim();assert.ok(!aliases.has(key)||aliases.get(key)===o.sourceKey,'An alias collides with another source option');aliases.set(key,o.sourceKey);}}
    for(const alias of f.accepted??[String(f.value)])assert.equal(aliases.get(alias.trim()),pos.reference_value,'Accepted text must identify the correct source option');
    const evidence=f.sourceDomainEvidence;assert.equal(evidence?.sourceSignature,observation.sourceSignature);assert.ok(Number.isInteger(evidence.sourceMediaIndex)&&evidence.sourceMediaIndex>=0);assert.equal(src.question.content.media[evidence.sourceMediaIndex]?.url.split('/').at(-1).replace(/\.png$/u,''),evidence.sourceSha256);assert.match(evidence.decodedSha256,/^[a-f0-9]{64}$/u);const domainURL=evidence.url;assert.equal(domainURL?.split('/').at(-1),evidence.decodedSha256);
    const visible=c=>c.media?.some((m,index)=>m.url===domainURL&&(!c.layout||c.layout.some(p=>(p.type==='paragraph'?p.runs:p.rows.flat(2)).some(r=>r.type==='image'&&r.media_index===index))));assert.ok(typeof domainURL==='string'&&[observation.material,t.prompt].some(visible),'Full source option domain must remain visible');
   }
   if(['math','text'].includes(f.input)){assert.ok(!/[\$\\]/u.test(f.label),'Answer field labels are plain text; put formulas in prompt content');assert.equal(String(f.value),String(pos.reference_value));accepted[f.id]=f.accepted??[String(f.value)];assert.ok(Array.isArray(accepted[f.id])&&accepted[f.id][0]===String(f.value)&&accepted[f.id].every(v=>typeof v==='string'&&v.trim()));}
   else{
    assert.ok(f.options?.length>=2);assert.equal(new Set(f.options.map(o=>o.id)).size,f.options.length);
    const keys=Array.isArray(f.teacherKey)?f.teacherKey:[f.teacherKey];
    const ids=keys.map(k=>{const matches=f.options.filter(o=>o.sourceKey===k);assert.equal(matches.length,1);return matches[0].id;});
    accepted[f.id]=f.input==='set'?[ids]:ids;
   }
   mapping.push({position:pos.position_id,teacherKey:f.teacherKey,independentCheck:f.independentCheck});
   const field={id:f.id,label:f.label,input:f.input,...(f.options?{options:f.options.map(({id,content})=>({id,content}))}:{})};
   if(f.partitionSet){assert.equal(f.input,'set');assert.ok(!t.boards?.length&&!t.work);assert.equal(t.plainNativeFields,true,'Partitions require reviewed native fields without index-based presentation');const split=partitionSetField(field,accepted[f.id]);delete accepted[f.id];Object.assign(accepted,split.answers);mapping.at(-1).native_partitions=split.mapping;return split.fields;}return [field];
  });
  const q={id:`hlg3m_${src.id.slice(-8)}_rf${sha({source:observation.sourceSignature,target:t}).slice(0,12)}`,type:'fields',prompt:structuredClone(t.prompt),fields,answer:{format:'fields-v1',fields:accepted},explanation:structuredClone(t.explanation),...(t.work?{work:structuredClone(t.work)}:{})};
  if(t.boards?.length){
   const seen=new Set();for(const b of t.boards){assert.ok(b.indices.length);for(const k of b.indices){assert.ok(Number.isInteger(k)&&fields[k]&&['single','set'].includes(fields[k].input));assert.ok(!seen.has(k));seen.add(k);}const opts=fields[b.indices[0]].options;for(const k of b.indices)assert.deepEqual(fields[k].options,opts);}
   const partner=structuredClone(q);const project=v=>{if(!v||typeof v!=='object')return;if(typeof v.url==='string'&&v.url.startsWith(`https://quiz-media.invalid/${owner}/`))v.url='https://partner-media.invalid/'+v.url.split('/').at(-1);for(const c of Object.values(v))if(typeof c==='object')project(c);};project(partner);
   plans[q.id]={signature:presentationSignature(q),boards:structuredClone(t.boards),omit:structuredClone(t.omit??[]),sourceSha256:src.source_files.find(f=>f.name==='preamble-question.docx.gz').sha256};variants[q.id]=[presentationSignature(partner)];
  }
  return q;
 });
 const doc=validateDocument({schema:1,title:observation.title,catalog,blocks:[{id:'source_'+src.id.slice(-8),material:structuredClone(observation.material),questions}]});
 return {candidate:{source:src.id,doc},plans,variants,mapping};
}
