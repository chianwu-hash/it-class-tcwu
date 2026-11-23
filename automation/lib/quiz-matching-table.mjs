import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateDocument} from '../../shared/quiz-document.mjs';
import {presentationSignature} from '../../shared/quiz-presentation-signature.mjs';
const cell=runs=>{assert.ok(runs.every(r=>r.type==='text'));return runs.map(r=>r.text).join('');};
const normal=s=>s.normalize('NFKC').replace(/\s/g,'');
export function weightInGrams(text){
 const value=normal(text),parts=[...value.matchAll(/(\d+)(公斤|公克|kg|g)/gi)];
 if(!parts.length||parts.map(p=>p[0]).join('')!==value)return null;
 return parts.reduce((n,p)=>n+Number(p[1])*(/公斤|kg/i.test(p[2])?1000:1),0);
}
/** Only a five-column, text-only matching scaffold with explicit original keys. */
export function matchingTableCandidate(src,review,catalog){
 const qc=src.question.content,ac=src.answer.content;
 assert.equal(qc.media.length,0);assert.equal(ac.media.length,0);assert.equal(review.logical_targets.length,1);
 const tables=qc.layout.filter(p=>p.type==='table');assert.equal(tables.length,1);
 assert.ok(qc.layout.every(p=>p.type==='table'||p.type==='paragraph'&&p.runs.every(r=>r.type==='text')));
 const rows=tables[0].rows;assert.ok(rows.length>=2&&rows.length<=8);
 const endpoints=rows.map(row=>{assert.equal(row.length,5);assert.equal(cell(row[1]).trim(),'‧');assert.equal(cell(row[2]).trim(),'');assert.equal(cell(row[3]).trim(),'‧');const left=cell(row[0]).trim(),right=cell(row[4]).trim();const lm=left.match(/^([①-⑧甲乙丙丁戊己庚辛])\s*([\s\S]+)$/u),rm=right.match(/^([ㄅㄆㄇㄈㄉㄊㄋㄌ])\s*([\s\S]+)$/u);assert.ok(lm&&rm);return {leftMark:lm[1],left:lm[2],rightMark:rm[1],right:rm[2]};});
 assert.equal(new Set(endpoints.map(e=>e.leftMark)).size,rows.length);assert.equal(new Set(endpoints.map(e=>e.rightMark)).size,rows.length);
 const pairs=[...ac.text.matchAll(/([①-⑧甲乙丙丁戊己庚辛])\s*(?:→|連|->)\s*([ㄅㄆㄇㄈㄉㄊㄋㄌ])/gu)];assert.equal(pairs.length,rows.length);
 const keys=new Map(pairs.map(m=>[m[1],m[2]]));assert.equal(keys.size,rows.length);const target=review.logical_targets[0];assert.equal(target.positions.length,rows.length);
 const options=endpoints.map((e,i)=>({id:'r'+(i+1),content:{text:e.right,media:[]}}));
 const answers={};const mapping=endpoints.map((e,i)=>{const mark=keys.get(e.leftMark),right=endpoints.findIndex(e=>e.rightMark===mark);assert.ok(right>=0);assert.equal(target.positions[i].kind,'single_choice');assert.equal(target.positions[i].reference_value,mark);const a=weightInGrams(e.left),b=weightInGrams(endpoints[right].right);if(a!==null)assert.equal(a,b,'教師配對與獨立換算不符');answers['f'+(i+1)]=[options[right].id];return {position:target.positions[i].position_id,leftMark:e.leftMark,rightMark:mark,rightIndex:right,arithmetic:a===null?'not_applicable_estimation':'equal_grams_verified'};});
 const header=qc.layout.filter(p=>p.type==='paragraph').map(p=>cell(p.runs)).join('\n').trim()||'把相同重量的連起來。';
 const promptText=qc.text.startsWith(header)?qc.text:header+'\n'+qc.text;
 const id='hlg3m_'+src.id.slice(-8)+'_mt'+createHash('sha256').update(JSON.stringify(qc)).digest('hex').slice(0,12);
 const explanation=target.student_explanation.replace(/[ㄅㄆㄇㄈㄉㄊㄋㄌ]/gu,mark=>{const endpoint=endpoints.find(e=>e.rightMark===mark);assert.ok(endpoint);return endpoint.right.replace(/\s+/g,'');});
 const q={id,type:'fields',prompt:{text:promptText,media:[]},fields:endpoints.map((e,i)=>({id:'f'+(i+1),label:e.left,input:'single',options:structuredClone(options)})),answer:{format:'fields-v1',fields:answers},explanation:{text:explanation,media:[]}};
 const doc=validateDocument({schema:1,title:'重量連線',catalog,blocks:[{id:'source_'+src.id.slice(-8),material:{text:'',media:[]},questions:[q]}]});
 const plan={signature:presentationSignature(q),boards:[{indices:q.fields.map((_,i)=>i),unique:false}],omit:[[header.length,promptText.length]],sourceSha256:src.source_files.find(f=>f.name==='preamble-question.docx.gz').sha256};
 return {candidate:{source:src.id,doc},plan,endpoints,mapping,target};
}
