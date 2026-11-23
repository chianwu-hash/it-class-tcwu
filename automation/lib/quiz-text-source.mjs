import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {validateDocument} from '../../shared/quiz-document.mjs';
export const sourceText=p=>p.runs.map(r=>{assert.equal(r.type,'text');return r.text;}).join('');
export const sourceNorm=s=>String(s).normalize('NFKC').replace(/\s/gu,'').replace(/^\$\\frac\{(\d+)\}\{(\d+)\}\$$/u,'$1/$2');
export function textSourceParts(src){const qc=src.question.content,ac=src.answer.content;assert.equal(qc.media.length,0);assert.equal(ac.media.length,0);const material=[],parts=new Map();let index=null;for(const p of qc.layout){if(p.type==='table'){material.push(p);continue;}assert.equal(p.type,'paragraph');const m=sourceNorm(sourceText(p)).match(/^\((\d+)\)/u);if(m)index=Number(m[1]);if(index){if(!parts.has(index))parts.set(index,[]);parts.get(index).push(p);}else material.push(p);}if(!parts.size){assert.ok(material.every(p=>p.type==='paragraph'));parts.set(1,material.splice(0));}return {material,parts,prompt:i=>parts.get(i).map(sourceText).join('\n'),intro:material.filter(p=>p.type==='paragraph').map(sourceText).join('\n')};}
function canonical(value){const s=String(value),m=s.match(/^(\d+)\/(\d+)$/u);if(!m)return s;let a=Number(m[1]),b=Number(m[2]);assert.ok(b>0);let x=a,y=b;while(y)[x,y]=[y,x%y];return b/x===1?String(a/x):a/x+'/'+(b/x);}
export function buildTextSourceCandidate(src,review,catalog,structure,computed,method){
 assert.equal(computed.length,review.logical_targets.length);assert.equal(structure.parts.size,computed.length);const rawParts=new Map(),answer=src.answer.content.text.normalize('NFKC');for(const m of answer.matchAll(/\((\d+)\)([^]*?)(?=\(\d+\)|$)/gu)){assert.ok(!rawParts.has(Number(m[1])));rawParts.set(Number(m[1]),m[2]);}if(!rawParts.size){const finals=[...answer.matchAll(/(?:^|\n)答[:：]([^\n]+)/gu)];assert.equal(finals.length,1);rawParts.set(1,finals[0][1]);}
 const base='hlg3m_'+src.id.slice(-8)+'_ts'+createHash('sha256').update(JSON.stringify(src.question.content)).digest('hex').slice(0,12),questions=[],mapping=[],targets=[];
 for(const [index,result] of computed.entries()){
  const target=review.logical_targets[index];assert.equal(result.values.length,target.positions.length);const raw=rawParts.get(index+1);assert.ok(raw);const teacher=raw.split(/[;；]/u).map(s=>s.trim()).filter(Boolean);assert.equal(teacher.length,result.values.length);const id=base+'_q'+(index+1),fields=[],answers={};
  for(const [i,item] of result.values.entries()){
   const p=target.positions[i],fid='f'+(i+1),label=item.label??p.source_part_locator;
   if(p.kind==='set'){
    assert.ok(Array.isArray(item.value)&&Array.isArray(item.domain));assert.equal(new Set(item.domain).size,item.domain.length);assert.ok(item.domain.length>=2&&item.domain.length<=16);assert.deepEqual(item.value.map(sourceNorm).sort(),p.reference_value.map(sourceNorm).sort());assert.deepEqual(item.value.map(sourceNorm).sort(),teacher[i].split(/[、,，]/u).map(sourceNorm).filter(Boolean).sort());
    const groups=item.domain.length<=8?[item.domain]:[item.domain.slice(0,Math.ceil(item.domain.length/2)),item.domain.slice(Math.ceil(item.domain.length/2))],ids=[];
    for(const [g,group] of groups.entries()){const f=fid+'g'+(g+1);ids.push(f);fields.push({id:f,label:groups.length===1?label+'（可複選）':label+'第'+(g+1)+'組（可複選；沒有符合項目請選「這些選項都不選」）',input:'set',options:group.map(name=>({id:'o'+(item.domain.indexOf(name)+1),content:{text:name,media:[]}}))});answers[f]=[group.filter(name=>item.value.includes(name)).map(name=>'o'+(item.domain.indexOf(name)+1))];}
    mapping.push({position:p.position_id,question:id,fields:ids,original_domain:item.domain,independent_value:item.value});
   }else{
    assert.ok(['number','fraction','short_text','single_choice'].includes(p.kind));assert.equal(sourceNorm(item.value),sourceNorm(p.reference_value));assert.equal(sourceNorm(item.value),sourceNorm(teacher[i]));const input=['number','fraction'].includes(p.kind)?'math':'text';fields.push({id:fid,label,input});answers[fid]=[String(item.value)];mapping.push({position:p.position_id,question:id,field:fid,independent_value:item.value,canonical_answer:input==='math'?canonical(item.value):String(item.value),primary_answer:answers[fid][0],source_kind:p.kind});
   }
  }
  questions.push({id,type:'fields',prompt:{text:structure.prompt(index+1),media:[]},fields,answer:{format:'fields-v1',fields:answers},explanation:{text:result.explanation,media:[]}});targets.push({question_id:id,targets:[target]});
 }
 const material=structure.material,materialText=material.map(p=>p.type==='table'?p.rows.map(row=>row.map(r=>sourceText({runs:r})).join('\t')).join('\n'):sourceText(p)).join('\n');const doc=validateDocument({schema:1,title:'閱讀資料與計算',catalog,blocks:[{id:'source_'+src.id.slice(-8),material:{text:materialText,media:[],...(material.length?{layout:material}:{})},questions}]});return {candidate:{source:src.id,doc},mapping,targets,method};
}
