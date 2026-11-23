import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateDocument} from '../../shared/quiz-document.mjs';
const norm=s=>String(s).normalize('NFKC').replace(/\s/gu,'');
const category=s=>norm(s).replace(/(?:年級|風味|班|色)$/u,'');
const cell=runs=>{assert.ok(runs.every(r=>r.type==='text'));return runs.map(r=>r.text).join('');};
const grid=t=>t.rows.map(row=>row.map(cell));
const sum=xs=>xs.reduce((a,b)=>a+b,0);
const literal=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

export function solveStatisticsTotals(input){
 const a=input.map(row=>row.map(v=>v===null?null:Number(v))),R=a.length,C=a[0].length;assert.ok(R>=2&&C>=2&&a.every(r=>r.length===C));
 const equation=items=>{const unknown=items.filter(([r,c])=>a[r][c]===null);if(unknown.length!==1)return false;const [r,c,k]=unknown[0],known=sum(items.filter(([i,j])=>a[i][j]!==null).map(([i,j,k])=>a[i][j]*k)),value=-known/k;assert.ok(Number.isSafeInteger(value)&&value>=0);a[r][c]=value;return true;};
 let changed;do{changed=false;for(let r=0;r<R;r++)changed=equation(Array.from({length:C},(_,c)=>[r,c,c===C-1?-1:1]))||changed;for(let c=0;c<C;c++)changed=equation(Array.from({length:R},(_,r)=>[r,c,r===R-1?-1:1]))||changed;}while(changed);
 assert.ok(a.flat().every(n=>Number.isSafeInteger(n)&&n>=0),'Original givens do not determine the table');
 for(const row of a)assert.equal(sum(row.slice(0,-1)),row.at(-1));for(let c=0;c<C;c++)assert.equal(sum(a.slice(0,-1).map(r=>r[c])),a.at(-1)[c]);return a;
}

/** Text table completion plus bounded min/max, sum and difference questions. */
export function statisticsTableCandidate(src,review,catalog){
 assert.match(src.id,/^HL115G3M-[a-f0-9]{8}$/u);
 const qc=src.question.content,ac=src.answer.content;assert.equal(qc.media.length,0);assert.equal(ac.media.length,0);
 const teacherTables=ac.layout.filter(p=>p.type==='table');assert.equal(teacherTables.length,1);const expected=grid(teacherTables[0]);
 const sameHeaders=g=>g.length===expected.length&&g.every((r,i)=>r.length===expected[i].length&&norm(r[0])===norm(expected[i][0]))&&g[0].every((c,j)=>norm(c)===norm(expected[0][j]));
 const tables=qc.layout.filter(p=>p.type==='table'),originalTables=tables.filter(t=>sameHeaders(grid(t)));assert.equal(originalTables.length,1);const original=grid(originalTables[0]),rowNames=original.slice(1,-1).map(r=>r[0]),colNames=original[0].slice(1,-1);
 const parse=s=>{if(norm(s)==='')return null;assert.match(norm(s),/^\d+$/u);return Number(norm(s));};const givens=original.slice(1).map(r=>r.slice(1).map(parse));
 // Separate source tables may explicitly provide the otherwise blank inner grid.
 for(const t of tables.filter(t=>t!==originalTables[0]))for(const row of grid(t)){
  if(row.length!==2)throw Error('Unsupported supplementary source table');const c=colNames.findIndex(n=>category(row[0])===category(n));assert.ok(c>=0);
  for(const [r,name] of rowNames.entries()){const matches=[...row[1].matchAll(new RegExp(literal(name)+'\\s*(\\d+)\\s*人','gu'))];assert.equal(matches.length,1);const n=Number(matches[0][1]);assert.ok(givens[r][c]===null||givens[r][c]===n);givens[r][c]=n;}
 }
 const solved=solveStatisticsTotals(givens);assert.deepEqual(expected.slice(1).map(r=>r.slice(1).map(parse)),solved,'Teacher table and independent totals disagree');
 const blanks=[];for(let r=1;r<original.length;r++)for(let c=1;c<original[r].length;c++)if(!norm(original[r][c]))blanks.push({r:r-1,c:c-1,label:original[r][0]+'／'+original[0][c],value:solved[r-1][c-1]});
 const all=review.logical_targets.flatMap((target,index)=>target.positions.map(position=>({position,target,index})));assert.ok(new Set(all.map(x=>x.position.position_id)).size===all.length);assert.ok(blanks.length>0);
 for(const [i,b] of blanks.entries()){assert.equal(all[i].position.kind,'number');assert.equal(Number(all[i].position.reference_value),b.value);}
 const parts=new Map(),material=[];let part=null;
 for(const item of qc.layout){if(item.type==='table'){material.push(item);continue;}assert.equal(item.type,'paragraph');const text=cell(item.runs),m=norm(text).match(/^\((\d+)\)/u);if(m)part=Number(m[1]);if(part){if(!parts.has(part))parts.set(part,[]);parts.get(part).push(item);}else material.push(item);}
 const partText=i=>(parts.get(i)??[]).map(p=>cell(p.runs)).join('\n').trim();assert.equal(parts.size,review.logical_targets.length);
 const textOf=layout=>layout.map(p=>p.type==='table'?grid(p).map(r=>r.join('\t')).join('\n'):cell(p.runs)).join('\n');
 const digest=createHash('sha256').update(JSON.stringify(qc)).digest('hex').slice(0,12),base='hlg3m_'+src.id.slice(-8)+'_st'+digest,questions=[],mapping=[],links=[];
 const tableId=base+'_table',tableFields=blanks.map((b,i)=>({id:'c'+(i+1),label:b.label,input:'math'}));
 questions.push({id:tableId,type:'fields',prompt:{text:/完成.*表/u.test(partText(1))?partText(1):'完成共用材料中的統計表。',media:[]},fields:tableFields,answer:{format:'fields-v1',fields:Object.fromEntries(blanks.map((b,i)=>[tableFields[i].id,[String(b.value)]]))},explanation:{text:'依原表格的列、欄合計求出空格，並用另一方向的合計交叉核對。',media:[]}});
 blanks.forEach((b,i)=>mapping.push({position:all[i].position.position_id,question:tableId,field:tableFields[i].id,cell:[b.r,b.c],independent_value:b.value}));links.push({question_id:tableId,targets:[...new Set(all.slice(0,blanks.length).map(x=>x.target))]});
 const remaining=all.slice(blanks.length),R=rowNames.length,C=colNames.length,rowTotals=solved.slice(0,R).map(r=>r[C]),colTotals=solved[R].slice(0,C),total=solved[R][C];
 const hits=(names,text)=>names.map((name,index)=>({name,index,at:norm(text).indexOf(category(name))})).filter(h=>h.at>=0).sort((a,b)=>a.at-b.at);
 const extreme=(values,mode)=>{const n=mode==='min'?Math.min(...values):Math.max(...values);assert.equal(values.filter(v=>v===n).length,1,'Ambiguous tied category');return values.indexOf(n);};
 function independent(positions,text){
  const rh=hits(rowNames,text),ch=hits(colNames,text),s=norm(text);let comparison=null,arithmetic=null;
  if(rh.length===2&&ch.length===2){comparison=ch.map(h=>{const row=rh.find(r=>r.at>h.at);assert.ok(row);return {axis:'cell',name:row.name+'／'+h.name,value:solved[row.index][h.index]};});}
  else if(ch.length===2&&rh.length===0)comparison=ch.map(h=>({axis:'col',name:h.name,value:colTotals[h.index]}));
  else if(rh.length===2&&ch.length===0)comparison=rh.map(h=>({axis:'row',name:h.name,value:rowTotals[h.index]}));
  if(comparison){assert.notEqual(comparison[0].value,comparison[1].value);arithmetic=/合起/u.test(s)?sum(comparison.map(x=>x.value)):Math.abs(comparison[0].value-comparison[1].value);}
  else if(/(?:共.*(?:多少|幾)|總人數)/u.test(s)){assert.ok(rh.length<=1&&ch.length<=1,'Ambiguous total scope');arithmetic=rh.length===1&&ch.length===1?solved[rh[0].index][ch[0].index]:rh.length===1?rowTotals[rh[0].index]:ch.length===1?colTotals[ch[0].index]:total;}
  return positions.map(({position:p})=>{
   if(p.kind==='number'){assert.ok(arithmetic!==null,'Unsupported follow-up arithmetic');const add=/合起/u.test(s);return {value:arithmetic,method:comparison?(add?'sum':'difference'):'grand_total',detail:comparison?(add?comparison.map(x=>x.value).join('＋'):[...comparison.map(x=>x.value)].sort((a,b)=>b-a).join('－'))+'＝'+arithmetic:'合計人數為 '+total+'。'};}
   assert.ok(['single_choice','short_text'].includes(p.kind));const label=norm(p.source_part_locator),axis=/性別|顏色|才藝班/u.test(label)?'row':/風味|形狀|年級/u.test(label)?'col':null;assert.ok(axis,'Category axis requires an explicit source locator');
   const names=axis==='row'?rowNames:colNames;let values=axis==='row'?rowTotals:colTotals;if(axis==='col'&&rh.length===1)values=solved[rh[0].index].slice(0,C);if(axis==='row'&&ch.length===1)values=solved.slice(0,R).map(r=>r[ch[0].index]);
   const mode=/最少|較少/u.test(label)?'min':/最多|較多/u.test(label)?'max':/最少|較少/u.test(s)&&!/最多/u.test(s)?'min':'max';let index;
   if(comparison&&comparison.every(x=>x.axis===axis)){const i=extreme(comparison.map(x=>x.value),mode);index=names.indexOf(comparison[i].name);}else index=extreme(values,mode);
   const compared=comparison&&comparison.every(x=>x.axis===axis)?comparison:names.map((name,i)=>({name,value:values[i]}));return {value:names[index],domain:names,method:axis+'_'+mode,detail:compared.map(x=>x.name+'：'+x.value).join('、')+'；'+names[index]+(mode==='min'?'較少。':'較多。')};
  });
 }
 const rawParts=new Map(),teacherFollow=ac.layout.filter(p=>p.type==='paragraph').map(p=>cell(p.runs)).join('\n').normalize('NFKC');
 for(const m of teacherFollow.matchAll(/\((\d+)\)([^]*?)(?=\(\d+\)|$)/gu)){const index=Number(m[1]);assert.ok(!rawParts.has(index));rawParts.set(index,m[2]);}

 for(let index=0;index<review.logical_targets.length;index++){
  const positions=remaining.filter(x=>x.index===index);if(!positions.length)continue;const text=partText(index+1);assert.ok(text);const computed=independent(positions,text),id=base+'_q'+(index+1),fields=[],answers={};
  const raw=norm(rawParts.get(index+1)??'').split(/[;；]/u).filter(Boolean);assert.equal(raw.length,positions.length,'Teacher follow-up key must be complete');
  for(const [i,{position:p}] of positions.entries()){
   const result=computed[i];assert.equal(category(p.reference_value),category(result.value));assert.equal(category(raw[i]),category(p.reference_value));const fieldId='f'+(i+1),label=p.source_part_locator.replace(/\(\d+\)|小題|填空|空格/gu,'').trim();
   if(p.kind==='number'){fields.push({id:fieldId,label,input:'math'});answers[fieldId]=[String(result.value)];}
   else{const options=result.domain.map((name,j)=>({id:'o'+(j+1),content:{text:name,media:[]}}));const chosen=result.domain.findIndex(name=>category(name)===category(result.value));assert.ok(chosen>=0);fields.push({id:fieldId,label,input:'single',options});answers[fieldId]=[options[chosen].id];}
   mapping.push({position:p.position_id,question:id,field:fieldId,independent_method:result.method,independent_value:result.value});
  }
  questions.push({id,type:'fields',prompt:{text,media:[]},fields,answer:{format:'fields-v1',fields:answers},explanation:{text:positions.map((x,i)=>computed[i].detail).join('\n'),media:[]}});links.push({question_id:id,targets:[review.logical_targets[index]]});
 }
 questions[0].explanation.text+='\n'+rowNames.map((name,r)=>name+'：'+solved[r].slice(0,C).join('＋')+'＝'+rowTotals[r]).join('\n')+'\n'+colNames.map((name,c)=>name+'：'+solved.slice(0,R).map(row=>row[c]).join('＋')+'＝'+colTotals[c]).join('\n')+'\n合計：'+rowTotals.join('＋')+'＝'+total;
 assert.equal(mapping.length,all.length);const doc=validateDocument({schema:1,title:'統計表與比較',catalog,blocks:[{id:'source_'+src.id.slice(-8),material:{text:textOf(material),media:[],layout:material},questions}]});return {candidate:{source:src.id,doc},mapping,targets:links,solved,original,teacher:expected};
}
