import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateDocument} from '../../shared/quiz-document.mjs';
import {presentationSignature} from '../../shared/quiz-presentation-signature.mjs';
import {emfTextRuns,emfMatchingColumns} from './quiz-emf-text.mjs';

export function divisionTextMatchingCandidate(src,review,catalog,emfBytes){
 assert.match(src.id,/^HL115G3M-[a-f0-9]{8}$/u);
 const qc=src.question.content;assert.equal(qc.media.length,1);assert.equal(src.answer.content.media.length,0);assert.equal(review.logical_targets.length,1);
 const columns=emfMatchingColumns(emfTextRuns(emfBytes));
 const left=columns.left.replace(/[０-９]/gu,c=>String(c.charCodeAt(0)-0xFF10));
 const leftParts=[...left.matchAll(/(?:\((\d)\)|(\d)○)([^]*?)(?=\(\d\)|\d○|$)/gu)];
 assert.equal(leftParts.map(m=>m[0]).join(''),left);assert.equal(leftParts.length,columns.count);
 const rightParts=[...columns.right.matchAll(/([ㄅㄆㄇㄈㄉㄊㄋㄌ])([^ㄅㄆㄇㄈㄉㄊㄋㄌ]+)/gu)];
 assert.equal(rightParts.map(m=>m[0]).join(''),columns.right);assert.equal(rightParts.length,columns.count);
 const endpoints=leftParts.map((m,i)=>{assert.equal(Number(m[1]??m[2]),i+1);assert.equal(rightParts[i][1],'ㄅㄆㄇㄈㄉㄊㄋㄌ'[i]);return {leftMark:String(i+1),left:m[3],rightMark:rightParts[i][1],right:rightParts[i][2]};});
 const target=review.logical_targets[0];assert.equal(target.positions.length,endpoints.length);
 const raw=src.answer.content.text.normalize('NFKC');
 const keyParts=[...raw.matchAll(/(?:\((\d)\)|([1-8]))\s*(?:→|->|連)?\s*([ㄅㄆㄇㄈㄉㄊㄋㄌ])/gu)];
 assert.equal(keyParts.length,endpoints.length);const keys=new Map(keyParts.map(m=>[Number(m[1]??m[2]),m[3]]));assert.equal(keys.size,endpoints.length);
 const equation=text=>{const m=text.normalize('NFKC').replace(/[()]/gu,'').match(/^(\d+)÷(\d+)(?:=(\d+)\.{3}(\d+))?$/u);assert.ok(m,'Unsupported equation endpoint');const n=Number(m[1]),d=Number(m[2]);assert.ok(d>0);if(m[3]!==undefined){assert.equal(Number(m[3]),Math.floor(n/d));assert.equal(Number(m[4]),n%d);}return {n,d};};
 const options=endpoints.map((e,i)=>({id:'r'+(i+1),content:{text:e.right,media:[]}}));options.forEach(o=>equation(o.content.text));const answers={};
 const mapping=endpoints.map((e,i)=>{const mark=keys.get(i+1),right=endpoints.findIndex(e=>e.rightMark===mark);assert.ok(right>=0);assert.equal(target.positions[i].kind,'single_choice');assert.equal(target.positions[i].reference_value,mark);const ns=[...e.left.matchAll(/\d+/g)].map(m=>Number(m[0]));assert.ok(ns.length===2||ns.length===4);const {n,d}=equation(endpoints[right].right);assert.equal(ns[0],n);assert.equal(ns[1],d);if(ns.length===4){assert.equal(ns[2],Math.floor(n/d));assert.equal(ns[3],n%d);}answers['f'+(i+1)]=[options[right].id];return {position:target.positions[i].position_id,leftMark:e.leftMark,rightMark:mark,rightIndex:right,arithmetic:'dividend_divisor_and_given_results_verified'};});
 const id='hlg3m_'+src.id.slice(-8)+'_md'+createHash('sha256').update(emfBytes).digest('hex').slice(0,12);
 const explanation=endpoints.map((e,i)=>`${i+1}：${e.left} → ${endpoints[mapping[i].rightIndex].right}`).join('\n');
 const q={id,type:'fields',prompt:{text:qc.text,media:[]},fields:endpoints.map((e,i)=>({id:'f'+(i+1),label:e.left,input:'single',options:structuredClone(options)})),answer:{format:'fields-v1',fields:answers},explanation:{text:explanation,media:[]}};
 const doc=validateDocument({schema:1,title:'除法情境連線',catalog,blocks:[{id:'source_'+src.id.slice(-8),material:{text:'',media:[]},questions:[q]}]});
 const plan={signature:presentationSignature(q),boards:[{indices:q.fields.map((_,i)=>i),unique:false}],omit:[],sourceSha256:src.source_files.find(f=>f.name==='preamble-question.docx.gz').sha256,emfSha256:createHash('sha256').update(emfBytes).digest('hex')};
 return {candidate:{source:src.id,doc},plan,endpoints,mapping,target,columns};
}
