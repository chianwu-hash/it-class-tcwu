import test from 'node:test';import assert from 'node:assert/strict';
import {diagramMatchingCandidate} from './lib/quiz-matching-diagrams.mjs';
import {matchingPresentation} from '../shared/quiz-matching-presentation.mjs';
import {matchingSources} from '../shared/quiz-matching-sources.mjs';
const fixture=()=>{
 const id='HL115G3M-00000001',hash='a'.repeat(64);
 const src={id,question:{content:{text:'連連看。'}},answer:{content:{text:'答案：(１)ㄅ；(２)ㄆ'}}};
 const proof={source:id,sourcePngSha256:hash,croppedImagesVisuallyReviewed:true,numbersAndConnectorDotsExcluded:true,originalFilesVerified:[{path:'preamble-question.docx.gz',sha256:'b'.repeat(64)}],rightValues:['2/4','3/6','1/4'],unit:'',crops:[0,1].map(i=>({index:i+1,pixelsUnchanged:true,sourcePngSha256:hash,sha256:String(i+1).repeat(64),size:[100,100]})),mapping:[0,1].map(i=>({leftIndex:i,position:`${id}/target-1/position-${i+1}`,rightIndex:i,observedFraction:'1/2',teacherKey:'ㄅㄆ'[i],fixedReviewKey:'ㄅㄆ'[i],equivalentRightIndices:[0,1]}))};
 return {src,proof,options:{catalog:{},owner:'82dfc4ec-8c68-47d9-aa25-8918080ca577'}};
};
test('teacher keys bind primary order; equal original options remain accepted',()=>{
 const {src,proof,options}=fixture(),built=diagramMatchingCandidate(src,proof,options),q=built.candidate.doc.blocks[0].questions[0];
 assert.deepEqual(q.answer.fields,{f1:['r1','r2'],f2:['r2','r1']});
 matchingSources[q.id]=built.plan;
 try{const shown=matchingPresentation(q);assert.equal(shown.passage.media.length,0);assert.equal(shown.passage.text,src.question.content.text);assert.equal(shown.boards[0].left[0].content.media[0].url,q.prompt.media[0].url);assert.equal(shown.boards[0].unique,false);}finally{delete matchingSources[q.id];}
 const wrong=fixture();wrong.proof.mapping[0].rightIndex=1;assert.throws(()=>diagramMatchingCandidate(wrong.src,wrong.proof,wrong.options),/Teacher option order/);
 const forged=fixture();forged.proof.mapping[0].teacherKey=forged.proof.mapping[0].fixedReviewKey='ㄆ';assert.throws(()=>diagramMatchingCandidate(forged.src,forged.proof,forged.options));
});
test('review correction is explicit, original teacher remains authoritative',()=>{
 const {src,proof,options}=fixture();proof.mapping[0].fixedReviewKey='ㄇ';assert.throws(()=>diagramMatchingCandidate(src,proof,options));
 options.correction={source:src.id,position:proof.mapping[0].position,oldFixedKey:'ㄇ',correctedKey:'ㄅ',observedFraction:'1/2',passed:true};assert.equal(diagramMatchingCandidate(src,proof,options).mapping[0].teacherKey,'ㄅ');
 options.correction.correctedKey='ㄆ';assert.throws(()=>diagramMatchingCandidate(src,proof,options));
});
test('missing crop approval, reordered positions or omitted equivalent options are rejected',()=>{
 for(const change of [p=>p.croppedImagesVisuallyReviewed=false,p=>p.mapping[0].leftIndex=1,p=>p.mapping[0].equivalentRightIndices=[0]]){const {src,proof,options}=fixture();change(proof);assert.throws(()=>diagramMatchingCandidate(src,proof,options));}
});
