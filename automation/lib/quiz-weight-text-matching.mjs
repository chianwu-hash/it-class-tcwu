import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {weightInGrams} from './quiz-matching-table.mjs';
import {emfTextRuns,emfMatchingColumns} from './quiz-emf-text.mjs';
import {validateDocument} from '../../shared/quiz-document.mjs';
import {presentationSignature} from '../../shared/quiz-presentation-signature.mjs';

export function weightExpressionGrams(text){
 const s=text.normalize('NFKC').replace(/\s/gu,'').replace(/[−－]/gu,'-'),parts=s.split(/([+×-])/u);let value;
 if(parts.length===1)value=weightInGrams(s);
 else{assert.equal(parts.length,3);const a=weightInGrams(parts[0]);assert.ok(a!==null);if(parts[1]==='×'){assert.match(parts[2],/^\d+$/u);value=a*Number(parts[2]);}else{const b=weightInGrams(parts[2]);assert.ok(b!==null);value=parts[1]==='+'?a+b:a-b;}}
 assert.ok(Number.isSafeInteger(value)&&value>=0,'Only explicit weight expressions are accepted');return value;
}

export function weightTextMatchingCandidate(src,review,catalog,sourceBytes,{checkedTranscription}={}){
 assert.match(src.id,/^HL115G3M-[a-f0-9]{8}$/u);const qc=src.question.content,ac=src.answer.content;assert.equal(qc.media.length,1);assert.equal(ac.media.length,0);assert.equal(review.logical_targets.length,1);
 const hash=createHash('sha256').update(sourceBytes).digest('hex');assert.equal(qc.media[0].url.split('/').at(-1).replace(/\.png$/u,''),hash);
 let left,right,method;
 if(checkedTranscription){assert.equal(checkedTranscription.sourceSha256,hash);assert.equal(checkedTranscription.visuallyVerified,true);({left,right}=checkedTranscription);method='verified_original_transcription';}
 else{const cols=emfMatchingColumns(emfTextRuns(sourceBytes)),l=cols.left.replace(/[０-９]/gu,c=>String(c.charCodeAt(0)-0xFF10)),ls=[...l.matchAll(/\((\d+)\)([^]*?)(?=\(\d+\)|$)/gu)],rs=[...cols.right.matchAll(/([ㄅㄆㄇㄈㄉㄊㄋㄌ])([^ㄅㄆㄇㄈㄉㄊㄋㄌ]+)/gu)];assert.equal(ls.map(m=>m[0]).join(''),l);assert.equal(rs.map(m=>m[0]).join(''),cols.right);assert.equal(ls.length,cols.count);assert.equal(rs.length,cols.count);ls.forEach((m,i)=>assert.equal(Number(m[1]),i+1));rs.forEach((m,i)=>assert.equal(m[1],'ㄅㄆㄇㄈㄉㄊㄋㄌ'[i]));left=ls.map(m=>m[2]);right=rs.map(m=>m[2]);method='original_unicode_vector_text';}
 assert.ok(left.length>=2&&left.length<=8);assert.equal(left.length,right.length);right.forEach(weightExpressionGrams);
 for(const text of left)assert.equal(right.filter(r=>weightExpressionGrams(r)===weightExpressionGrams(text)).length,1,'Each left weight must have exactly one equivalent right option');
 const target=review.logical_targets[0];assert.equal(target.positions.length,left.length);const pairs=[...ac.text.normalize('NFKC').matchAll(/(?:\((\d+)\)|(\d+))\s*(?:→|->|連)?\s*([ㄅㄆㄇㄈㄉㄊㄋㄌ])/gu)];assert.equal(pairs.length,left.length);const keys=new Map(pairs.map(m=>[Number(m[1]??m[2]),m[3]]));assert.equal(keys.size,left.length);
 const options=right.map((text,i)=>({id:'r'+(i+1),content:{text,media:[]}})),answers={},mapping=[];
 left.forEach((text,i)=>{const mark=keys.get(i+1),j='ㄅㄆㄇㄈㄉㄊㄋㄌ'.indexOf(mark);assert.ok(j>=0&&j<right.length);assert.equal(target.positions[i].kind,'single_choice');assert.equal(target.positions[i].reference_value,mark);assert.equal(weightExpressionGrams(text),weightExpressionGrams(right[j]));answers['f'+(i+1)]=[options[j].id];mapping.push({position:target.positions[i].position_id,leftMark:i+1,rightMark:mark,rightIndex:j,grams:weightExpressionGrams(text),independent_arithmetic:true});});
 const id='hlg3m_'+src.id.slice(-8)+'_mw'+hash.slice(0,12),q={id,type:'fields',prompt:{text:qc.text,media:[]},fields:left.map((label,i)=>({id:'f'+(i+1),label,input:'single',options:structuredClone(options)})),answer:{format:'fields-v1',fields:answers},explanation:{text:left.map((text,i)=>text+'＝'+right[mapping[i].rightIndex]).join('\n'),media:[]}},doc=validateDocument({schema:1,title:'重量等值連線',catalog,blocks:[{id:'source_'+src.id.slice(-8),material:{text:'',media:[]},questions:[q]}]});
 const plan={signature:presentationSignature(q),boards:[{indices:q.fields.map((_,i)=>i),unique:false}],omit:[],sourceSha256:src.source_files.find(f=>f.name==='preamble-question.docx.gz').sha256,vectorSha256:hash};
 return {candidate:{source:src.id,doc},plan,mapping,target,left,right,method};
}
