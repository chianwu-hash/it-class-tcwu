import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {solveStatisticsTotals} from './quiz-statistics-table.mjs';
import {validateDocument} from '../../shared/quiz-document.mjs';
const norm=s=>String(s).normalize('NFKC').replace(/\s/gu,'');
const key=s=>norm(s).replace(/(?:型|車|年級)$/u,'');
const text=p=>p.runs.map(r=>{assert.equal(r.type,'text');return r.text;}).join('');
const grid=t=>t.rows.map(row=>row.map(runs=>text({runs})));
const sum=a=>a.reduce((a,b)=>a+b,0);
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');

/** Reviewed semantic contracts describe operations, never their numerical answers. */
export function statisticsContractCandidate(src,review,catalog,contract,{teacherImageBytes}={}){
 const qc=src.question.content,ac=src.answer.content;
 assert.equal(hash(qc),contract.questionSha256);assert.equal(qc.media.length,0);assert.equal(Boolean(ac.media.length),Boolean(contract.teacherImage),'Teacher image declaration must match the original answer');
 if(ac.media.length){assert.equal(ac.media.length,1);assert.equal(contract.teacherImage?.visuallyVerified,true);assert.equal(ac.media[0].url.split('/').at(-1),contract.teacherImage.sourceSha256+'.png');assert.equal(createHash('sha256').update(teacherImageBytes).digest('hex'),contract.teacherImage.decodedSha256);}
 const tables=qc.layout.filter(p=>p.type==='table');assert.equal(tables.length,1);const original=grid(tables[0]);
 const rowNames=original.slice(1,-1).map(r=>r[0]),hasTotal=/^合計/u.test(norm(original[0].at(-1))),colNames=original[0].slice(1,hasTotal?-1:undefined);
 assert.deepEqual(rowNames.map(norm),contract.rows.map(norm));assert.deepEqual(colNames.map(norm),contract.columns.map(norm));
 const R=rowNames.length,C=colNames.length,parse=s=>{if(!norm(s))return null;assert.match(norm(s),/^\d+$/u);return Number(norm(s));};
 const givens=original.slice(1).map(row=>row.slice(1).map(parse));if(!hasTotal)for(const row of givens)row.push(null);
 const solved=solveStatisticsTotals(givens),teacherTables=ac.layout.filter(p=>p.type==='table');assert.ok(teacherTables.length<=1);
 if(teacherTables.length){const expected=grid(teacherTables[0]);assert.deepEqual(expected.map(r=>r.map(norm)),original.map((row,r)=>row.map((v,c)=>r&&c?String(solved[r-1][c-1]):norm(v))),'Teacher completed table differs from independently solved source');}
 else if(contract.teacherImage)assert.deepEqual(solved,contract.teacherImage.values,'Teacher image table disagrees with source arithmetic');
 else assert.equal(contract.derivedTable,true,'Missing teacher table requires an explicit derived-key contract');
 const material=[],parts=new Map();let part=null;
 for(const p of qc.layout){if(p.type==='table'){material.push(p);continue;}assert.equal(p.type,'paragraph');const m=norm(text(p)).match(/^\((\d+)\)/u);if(m)part=Number(m[1]);if(part){if(!parts.has(part))parts.set(part,[]);parts.get(part).push(p);}else material.push(p);}
 assert.equal(parts.size,review.logical_targets.length);const teacherParts=new Map();
 for(const m of ac.layout.filter(p=>p.type==='paragraph').map(p=>text({...p,runs:p.runs.filter(r=>r.type==='text')})).join('\n').normalize('NFKC').matchAll(/\((\d+)\)([^]*?)(?=\(\d+\)|$)/gu))teacherParts.set(Number(m[1]),norm(m[2]).split(/[;；,，]/u).filter(Boolean));
 const rowTotals=solved.slice(0,R).map(r=>r[C]),colTotals=solved[R].slice(0,C),total=solved[R][C];
 function evaluate(op){
  const row=i=>{assert.ok(Number.isInteger(i)&&i>=0&&i<R);return i;},col=i=>{assert.ok(Number.isInteger(i)&&i>=0&&i<C);return i;};
  if(op.kind==='cell')return solved[row(op.row)][col(op.column)];
  if(op.kind==='rowTotal')return rowTotals[row(op.row)];if(op.kind==='columnTotal')return colTotals[col(op.column)];if(op.kind==='total')return total;
  if(op.kind==='difference'){const a=evaluate(op.first),b=evaluate(op.second);assert.ok(Number.isInteger(a)&&Number.isInteger(b)&&a>=b,'Directed difference conflicts with source');return a-b;}
  if(op.kind==='subtractLiteral'){const a=evaluate(op.from);assert.ok(Number.isSafeInteger(op.amount)&&op.amount>=0&&a>=op.amount);const prompt=norm(parts.get(op.part).map(text).join('\n'));assert.ok(prompt.includes(norm(op.literal)));assert.ok(norm(op.literal).includes(String(op.amount)));return a-op.amount;}
  if(op.kind==='sameRowTotal'){row(op.row);assert.ok(norm(parts.get(op.part).map(text).join('\n')).includes(norm(rowNames[op.row])));const found=rowNames.filter((_,i)=>i!==op.row&&rowTotals[i]===rowTotals[op.row]);assert.equal(found.length,1);return found[0];}
  if(['monthExtreme','matchingMonth'].includes(op.kind)){
   assert.deepEqual(rowNames.map(norm),Array.from({length:12},(_,i)=>(i+1)+'月'));
   if(op.kind==='monthExtreme'){assert.ok(['min','max'].includes(op.mode));const value=op.mode==='min'?Math.min(...rowTotals):Math.max(...rowTotals);assert.equal(rowTotals.filter(v=>v===value).length,1);return rowTotals.indexOf(value)+1;}
   assert.ok(norm(parts.get(op.part).map(text).join('\n')).includes(String(op.value)+'人'));const found=rowTotals.flatMap((n,i)=>n===op.value?[i+1]:[]);assert.equal(found.length,op.count);assert.ok(Number.isInteger(op.index)&&op.index>=0&&op.index<found.length);return found[op.index];
  }
  const values=op.axis==='row'?(op.scope===undefined?rowTotals:solved.slice(0,R).map(r=>r[col(op.scope)])):(op.scope===undefined?colTotals:solved[row(op.scope)].slice(0,C));
  assert.ok(['row','column'].includes(op.axis));const names=op.axis==='row'?rowNames:colNames;
  if(op.kind==='extremes'){assert.ok(['min','max'].includes(op.mode));const value=op.mode==='min'?Math.min(...values):Math.max(...values);return names.filter((_,i)=>values[i]===value);}
  if(op.kind==='extreme'){assert.ok(['min','max'].includes(op.mode));const value=op.mode==='min'?Math.min(...values):Math.max(...values);assert.equal(values.filter(v=>v===value).length,1,'Tied extreme requires an exception');return op.value?value:names[values.indexOf(value)];}
  if(op.kind==='rank'){assert.equal(new Set(values).size,values.length,'Tied rank requires an exception');assert.ok(Number.isInteger(op.index)&&op.index>=0&&op.index<values.length);return names.map((name,i)=>({name,n:values[i]})).sort((a,b)=>b.n-a.n)[op.index].name;}
  if(op.kind==='columnsCompare'){assert.equal(op.axis,'column');row(op.firstRow);row(op.secondRow);assert.ok(['equal','greater'].includes(op.relation));const found=colNames.filter((_,c)=>op.relation==='equal'?solved[op.firstRow][c]===solved[op.secondRow][c]:solved[op.firstRow][c]>solved[op.secondRow][c]);if(op.single){assert.equal(found.length,1);return found[0];}return found;}
  throw Error('Unsupported statistics operation');
 }
 const base='hlg3m_'+src.id.slice(-8)+'_sc'+hash(qc).slice(0,12),questions=[],mapping=[],links=[],covered=new Set();
 const positions=review.logical_targets.flatMap(t=>t.positions),byId=new Map(positions.map(p=>[p.position_id,p]));assert.equal(byId.size,positions.length);
 const allBlanks=[];for(let r=1;r<original.length;r++)for(let c=1;c<original[r].length;c++)if(!norm(original[r][c]))allBlanks.push([r-1,c-1]);
 const ordered=contract.tableCells??allBlanks.map(([row,column])=>({row,column}));assert.deepEqual(ordered.map(x=>[x.row,x.column].join(',')).sort(),allBlanks.map(x=>x.join(',')).sort());
 const tableId=base+'_table',tableFields=[],tableAnswers={};
 for(const [i,cell] of ordered.entries()){
  const value=solved[cell.row][cell.column],id='c'+(i+1),position=cell.position===undefined?null:positions[cell.position];
  if(position){assert.equal(position.kind,'number');assert.equal(Number(position.reference_value),value);assert.ok(!covered.has(position.position_id));covered.add(position.position_id);}
  else assert.equal(contract.derivedTable,true);
  tableFields.push({id,label:original[cell.row+1][0]+'／'+original[0][cell.column+1],input:'math'});tableAnswers[id]=[String(value)];mapping.push({position:position?.position_id??src.id+'/derived-table/'+id,question:tableId,field:id,cell:[cell.row,cell.column],independent_value:value,key_origin:position?'teacher_and_fixed_review':contract.teacherImage?'teacher_image_and_arithmetic':'derived_arithmetic',teacher_key_present:Boolean(position||contract.teacherImage),fixed_review_position_present:Boolean(position)});
 }
 const tablePart=contract.tablePart,tablePrompt=tablePart?parts.get(tablePart).map(text).join('\n'):'依共用材料的指示完成統計表。';
 questions.push({id:tableId,type:'fields',prompt:{text:tablePrompt,media:[]},fields:tableFields,answer:{format:'fields-v1',fields:tableAnswers},explanation:{text:'依原表列欄合計計算。\n'+rowNames.map((name,r)=>name+'：'+solved[r].slice(0,C).join('＋')+'＝'+rowTotals[r]).join('\n')+'\n'+colNames.map((name,c)=>name+'：'+solved.slice(0,R).map(r=>r[c]).join('＋')+'＝'+colTotals[c]).join('\n')+'\n合計：'+total,media:[]}});
 links.push({question_id:tableId,targets:review.logical_targets});let derivedCrossCheck=false;
 for(const spec of contract.questions){
  const target=review.logical_targets[spec.part-1],prompt=parts.get(spec.part).map(text).join('\n'),raw=teacherParts.get(spec.part);assert.ok(raw);const remaining=target.positions.filter(p=>!covered.has(p.position_id));assert.equal(raw.length,remaining.length,'Teacher raw keys must cover every follow-up position');
  remaining.forEach((p,i)=>assert.equal(key(raw[i]),key(p.reference_value)));const id=base+'_q'+spec.part,fields=[],answers={},details=[];
  for(const [i,f] of spec.fields.entries()){
   const selected=f.positions.map(index=>target.positions[index]);assert.ok(selected.length&&selected.every(p=>remaining.includes(p)&&!covered.has(p.position_id)));const result=evaluate(f.operation),fid='f'+(i+1),domain=f.domain==='rows'?rowNames:f.domain==='columns'?colNames:null;
   if(Array.isArray(result)){
    assert.ok(domain);assert.deepEqual([...result].map(key).sort(),selected.map(p=>key(p.reference_value)).sort());assert.ok(result.length>0);fields.push({id:fid,label:selected.map(p=>p.source_part_locator).join('／'),input:'set',options:domain.map((name,j)=>({id:'o'+(j+1),content:{text:name,media:[]}}))});answers[fid]=[result.map(name=>'o'+(domain.indexOf(name)+1))];
   }else{
    assert.equal(selected.length,1);assert.equal(key(result),key(selected[0].reference_value));if(typeof result==='number'){assert.equal(selected[0].kind,'number');fields.push({id:fid,label:selected[0].source_part_locator,input:'math'});answers[fid]=[String(result)];}
    else{assert.ok(domain&&domain.includes(result));fields.push({id:fid,label:selected[0].source_part_locator,input:'single',options:domain.map((name,j)=>({id:'o'+(j+1),content:{text:name,media:[]}}))});answers[fid]=['o'+(domain.indexOf(result)+1)];}
   }
   for(const p of selected){covered.add(p.position_id);mapping.push({position:p.position_id,question:id,field:fid,independent_operation:f.operation,independent_value:result,key_origin:'teacher_and_fixed_review',teacher_key_present:true});}
   details.push(selected.map(p=>p.source_part_locator).join('／')+'：'+(Array.isArray(result)?result.join('、'):result));
   if(!teacherTables.length&&['total','rowTotal','columnTotal','extreme'].includes(f.operation.kind))derivedCrossCheck=true;
  }
  assert.ok(remaining.every(p=>covered.has(p.position_id)));questions.push({id,type:'fields',prompt:{text:prompt,media:[]},fields,answer:{format:'fields-v1',fields:answers},explanation:{text:'依原表列欄合計計算並比較。\n'+details.join('\n'),media:[]}});links.push({question_id:id,targets:[target]});
 }
 assert.equal(covered.size,positions.length);if(!teacherTables.length)assert.ok(derivedCrossCheck,'A teacher key must cross-check derived totals');
 const shown=new Set([...(tablePart?[tablePart]:[]),...contract.questions.map(q=>q.part)]);assert.deepEqual([...shown].sort(),[...parts.keys()].sort());
 const materialText=material.map(p=>p.type==='table'?grid(p).map(r=>r.join('\t')).join('\n'):text(p)).join('\n');
 const doc=validateDocument({schema:1,title:'統計表與資料比較',catalog,blocks:[{id:'source_'+src.id.slice(-8),material:{text:materialText,media:[],layout:material},questions}]});
 return {candidate:{source:src.id,doc},mapping,targets:links,solved,original,teacher_table_present:Boolean(teacherTables.length),derivedCrossCheck};
}
