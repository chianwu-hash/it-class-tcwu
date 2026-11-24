import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateDocument} from '../../shared/quiz-document.mjs';
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
  const accepted={},fields=t.fields.map((f,j)=>{
   const pos=target.positions[j];assert.equal(f.position,pos.position_id);
   assert.deepEqual(f.teacherKey,pos.reference_value);assert.ok(f.independentCheck);
   assert.equal(f.input,pos.kind==='single_choice'?'single':pos.kind==='set'?'set':'math');
   if(f.input==='math'){assert.equal(String(f.value),String(pos.reference_value));accepted[f.id]=[String(f.value)];}
   else{
    assert.ok(f.options?.length>=2);assert.equal(new Set(f.options.map(o=>o.id)).size,f.options.length);
    const keys=Array.isArray(f.teacherKey)?f.teacherKey:[f.teacherKey];
    const ids=keys.map(k=>{const matches=f.options.filter(o=>o.sourceKey===k);assert.equal(matches.length,1);return matches[0].id;});
    accepted[f.id]=f.input==='set'?[ids]:ids;
   }
   mapping.push({position:pos.position_id,teacherKey:f.teacherKey,independentCheck:f.independentCheck});
   return {id:f.id,label:f.label,input:f.input,...(f.options?{options:f.options.map(({id,content})=>({id,content}))}:{})};
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
