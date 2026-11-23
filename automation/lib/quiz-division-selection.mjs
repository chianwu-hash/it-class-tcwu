import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateDocument} from '../../shared/quiz-document.mjs';

/** Original quotient/remainder blanks plus selecting divisible expressions. */
export function divisionSelectionCandidate(src,review,catalog,{teacherMediaVerified=false}={}){
 assert.match(src.id,/^HL115G3M-[a-f0-9]{8}$/u);
 const qc=src.question.content,ac=src.answer.content;assert.equal(qc.media.length,0);assert.ok(ac.media.length===0||teacherMediaVerified,'Original teacher diagrams require separate verification');
 const lines=qc.text.trim().split('\n'),header=lines.shift();assert.match(header,/整除/u);
 const equations=lines.filter(s=>s.trim()).map((s,i)=>{const m=s.normalize('NFKC').replace(/\s/gu,'').match(/^(?:□|\(\))\((\d+)\)(\d+)÷(\d+)=\(\)\.{3}\(\)$/u);assert.ok(m,'Unsupported original blank layout');assert.equal(Number(m[1]),i+1);const n=Number(m[2]),d=Number(m[3]);assert.ok(d>0);return {original:s,index:i+1,n,d,quotient:Math.floor(n/d),remainder:n%d};});
 assert.ok(equations.length>=2&&equations.length<=8);
 const keys=[...ac.text.normalize('NFKC').matchAll(/\((\d+)\)([^]*?)(?=\(\d+\)|$)/gu)];assert.equal(keys.length,equations.length);
 const positions=review.logical_targets.flatMap(t=>t.positions.map(position=>({position,target:t}))),numbers=positions.filter(p=>p.position.kind==='number'),sets=positions.filter(p=>p.position.kind==='set');assert.equal(sets.length,1);assert.equal(numbers.length,2*equations.length);assert.equal(positions.length,numbers.length+1);
 const selected=equations.filter(e=>e.remainder===0).map(e=>e.index);
 const reviewed=sets[0].position.reference_value.map(v=>{const m=String(v).normalize('NFKC').match(/^\((\d+)\)$/u);assert.ok(m);return Number(m[1]);});assert.deepEqual([...reviewed].sort((a,b)=>a-b),selected);
 const digest=createHash('sha256').update(JSON.stringify(qc)).digest('hex').slice(0,12),base='hlg3m_'+src.id.slice(-8)+'_ds'+digest,questions=[],mapping=[],targets=[];
 for(const [i,e] of equations.entries()){
  const key=keys[i];assert.equal(Number(key[1]),e.index);const values=[...key[2].matchAll(/\d+/g)].map(m=>Number(m[0]));assert.deepEqual(values,[e.quotient,e.remainder]);assert.equal(/[ˇ✓✔√]/u.test(key[2]),e.remainder===0);
  assert.equal(Number(numbers[2*i].position.reference_value),e.quotient);assert.equal(Number(numbers[2*i+1].position.reference_value),e.remainder);
  const id=base+'_e'+e.index;questions.push({id,type:'fields',prompt:{text:`第（${e.index}）式：${e.n}÷${e.d}`,media:[]},fields:[{id:'q',label:'商',input:'math'},{id:'r',label:'餘數',input:'math'}],answer:{format:'fields-v1',fields:{q:[String(e.quotient)],r:[String(e.remainder)]}},explanation:{text:`${e.n}÷${e.d}＝${e.quotient}…${e.remainder}。${e.d}×${e.quotient}＋${e.remainder}＝${e.n}，餘數小於除數。`,media:[]}});
  for(const [j,field] of ['q','r'].entries())mapping.push({position:numbers[2*i+j].position.position_id,question:id,field,original:e.original});
  targets.push({question_id:id,targets:[...new Set([numbers[2*i].target,numbers[2*i+1].target])]});
 }
 const id=base+'_select';questions.push({id,type:'fields',prompt:{text:'把可以整除的原算式勾起來。',media:[]},fields:[{id:'divisible',label:'可整除的原算式（可複選）',input:'set',options:equations.map(e=>({id:'e'+e.index,content:{text:`（${e.index}）${e.n}÷${e.d}`,media:[]}}))}],answer:{format:'fields-v1',fields:{divisible:[selected.map(i=>'e'+i)]}},explanation:{text:'餘數為 0 的算式可以整除：'+equations.filter(e=>e.remainder===0).map(e=>`${e.n}÷${e.d}`).join('、')+'。',media:[]}});mapping.push({position:sets[0].position.position_id,question:id,field:'divisible',original:header});targets.push({question_id:id,targets:[sets[0].target]});
 const doc=validateDocument({schema:1,title:'商餘數與整除',catalog,blocks:[{id:'source_'+src.id.slice(-8),material:{text:header,media:[]},questions}]});
 return {candidate:{source:src.id,doc},equations,mapping,targets};
}
