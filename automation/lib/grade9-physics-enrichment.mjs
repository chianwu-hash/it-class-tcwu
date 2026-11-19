import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateLearningMap} from './past-learning-map.mjs';
import {validateDocument} from '../../shared/quiz-document.mjs';

export const physicsQuestionNumbers={113:[1,2,3,4,5,6,7,8,9,14,15,16,20,21,22,23,24,25,26,27,31,32,33],114:[1,2,3,4,5,6,7,8,9,10,11,12,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32]};
export const documentHash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const copy=value=>structuredClone(value);
const typeset=s=>s.replace(/1／(81|6)/gu,(_,n)=>'$\\frac{1}{'+n+'}$').replaceAll('½','$\\frac{1}{2}$');

// A local conversion artifact only. No DB, network, publication or progress writes.
// Source-only changes must be independently reviewed before any registration.
export function buildPhysicsEnrichment({bundles,live,curation,publisherPool,practiceExplanations,publisherProof=[]}){
 assert.equal(curation.schema,1);assert.equal(curation.releaseStatus,'candidate-only');
 const expected=Object.entries(physicsQuestionNumbers).flatMap(([y,ns])=>ns.map(n=>y+'-'+String(n).padStart(2,'0'))).sort();
 const actual=curation.questions.map(r=>r.year+'-'+String(r.number).padStart(2,'0')).sort();assert.deepEqual(actual,expected,'exact physics scope required');
 const candidates=[],blocks=[],practices={},sources=new Map(publisherPool.map(r=>[r.source_item_id,r]));
 for(const [key,topic]of Object.entries(curation.topics)){
  assert.equal(topic.id,'g9-physics-'+key);assert(topic.title&&topic.points.length);
  if(!topic.practiceIds.length)continue;
  assert.equal(new Set(topic.practiceIds).size,2,'two distinct publisher questions required');
  const selected=topic.practiceIds.map(id=>{
   const row=sources.get(id);assert(row&&row.course_id==='115-1-g9-hanlin-science'&&row.checks.source_answer_verified,id);
   const q=copy(row.question);assert(practiceExplanations[id]?.trim(),id+' missing reviewed explanation');
   q.explanation={text:'補充解析：'+typeset(practiceExplanations[id]),media:[]};
   // Select only text-complete fixed sources; never strip source pictures to fit.
   for(const c of [q.prompt,...q.options.map(o=>o.content),row.question.explanation])assert.equal(c.media.length,0,id+' needs media verification');
   return {row,q};
  });
  const document={schema:1,title:'理化延伸：'+topic.title,catalog:{school_year:'115',subject:'自然',publisher:'翰林',volume:'9年級上學期（第五冊）',unit:topic.title,learning_performance:'',learning_content:''},blocks:[{id:'practice-'+key,material:{text:'',media:[]},questions:selected.map(r=>r.q)}]};
  validateDocument(document);
  practices[topic.id]={document,chapterName:topic.title,sha256:documentHash(document),sources:selected.map(({row,q})=>{const proof=publisherProof.find(p=>p.id===row.source_item_id),raw=proof?.sourceFiles.find(s=>s.path.endsWith('preamble-question.docx.gz'));return {sourceItemId:row.source_item_id,normalizedQuestionId:q.id,normalizedAnswer:q.answer.option_id,sourceVersion:row.source_version,publisherOriginalExplanation:copy(row.question.explanation),checks:copy(row.checks),...(raw?{sourceFile:raw.path,sha256:raw.sha256,sourceFiles:copy(proof.sourceFiles)}:{})};})};
 }
 for(const year of [113,114]){
  const paperId='zhongzheng-'+year+'-1-g9-exam2-science',baseline=bundles.find(b=>b.paperId===paperId),current=live.find(r=>r.id===paperId);assert(baseline&&current);
  assert.equal(documentHash(baseline.document),current.sha256,'source order/hash mismatch');assert.deepEqual(baseline.document,current.document,'live source changed');
  const document=copy(baseline.document),provenance=copy(baseline.provenance),reviews=curation.questions.filter(r=>r.year===year),byNumber=new Map(reviews.map(r=>[r.number,r])),concepts=new Map(),questions=[],scope=[];
  for(const group of document.groups){
   assert.equal(group.kind,'single');assert.equal(group.fields.length,1);const field=group.fields[0],n=Number(field.id.slice(-2)),review=byNumber.get(n),source=provenance.entries.find(e=>e.id===field.id);assert(source);
   let conceptIds,explanation;
   if(review){
    assert(review.explanation?.trim()&&review.misconception?.trim());
    conceptIds=review.topicKeys.map(key=>{const topic=curation.topics[key];assert(topic);concepts.set(topic.id,{id:topic.id,title:topic.title,connection:'從本題的「'+topic.title+'」核對解題關係。',points:topic.points.map(typeset),practiceCoverage:{available:topic.practiceIds.length,required:2},...(!topic.practiceIds.length?{practiceUnavailableReason:'已核對現有翰林九上題池，目前沒有兩題可直接對應此重點的可靠練習。'}:{})});return topic.id;});
    if(review.onlineClarification){
     assert(curation.review?.status==='completed','online clarification needs completed independent review');
     assert(review.onlineClarification.startsWith('線上補充說明（本平台新增，非原卷文字）：'));
     group.material=[group.material,review.onlineClarification].filter(Boolean).join('\n\n');
     group.materialContent={...(group.materialContent??{media:[]}),text:[group.materialContent?.text,review.onlineClarification].filter(Boolean).join('\n\n')};
    }
    source.explanationSource=curation.review?.status==='completed'?'Codex 補充解析，經 Claude 逐題複核':'Codex 補充解析，待獨立複核';
    source.physicsReview={reviewedBy:curation.review?.reviewedBy??['Codex'],originalSourceVersion:current.active_version,...(review.onlineClarification?{onlineClarification:review.onlineClarification}:{})};
    explanation=typeset(review.explanation+'\n\n容易混淆：'+review.misconception+(review.sourceNote?'\n\n原題核對：'+review.sourceNote:''));field.explanation=explanation;field.concept=review.topicKeys.map(k=>curation.topics[k].title).join('、');
    scope.push({questionId:field.id,status:review.reviewStatus??'source-reviewed',conceptIds,references:review.references??[],sourceNote:review.sourceNote??null});
    if(review.reviewStatus)blocks.push({paperId,questionId:field.id,status:review.reviewStatus,reason:review.sourceNote});
   }else{
    // Preserve the complete natural-science paper; geography/earth-science
    // material is inherited, never represented as freshly reviewed physics.
    const id='retained-'+year+'-'+field.id;conceptIds=[id];explanation=field.explanation;
    concepts.set(id,{id,title:field.concept,connection:'原卷既有學習內容。',points:[field.explanation]});scope.push({questionId:field.id,status:'outside-physics-scope-retained',conceptIds});
   }
   questions.push({groupId:group.id,questionId:field.id,selfCheck:false,expectedAnswer:field.answer,source:copy(source),conceptIds,explanation});
  }
  provenance.previousQc=copy(provenance.qc);provenance.qc={status:curation.review?.status==='completed'?'content-reviewed-awaiting-flow-verification':'candidate-awaiting-independent-review',reviewedBy:curation.review?.reviewedBy??['Codex'],reviewedPhysicsQuestions:reviews.length,retainedOutsideScope:scope.filter(r=>r.status==='outside-physics-scope-retained').length,operationTested:false,sourceVersion:current.active_version,sourceSha256:current.sha256};
  const bundle={paperId,document,provenance,sha256:documentHash(document),assets:copy(baseline.assets??[])};
  const map={schema:2,paperId,documentSha256:bundle.sha256,concepts:[...concepts.values()],questions};validateLearningMap({bundle,map});
  const packet={schema:2,sourcePaperId:paperId,sourceDocumentSha256:bundle.sha256,publisher:{name:'翰林',grade:9,volume:'第五冊',schoolYear:115},documents:Object.fromEntries(Object.entries(practices).filter(([id])=>concepts.has(id)))};
  candidates.push({bundle,map,packet,scope,sourceVersion:current.active_version,sourceSha256:current.sha256});
 }
 return {schema:1,status:'candidate-only',publicationBlocked:true,blockers:[...blocks,...(curation.review?.status==='completed'?[]:[{status:'independent-review-pending',reason:'尚無第二位審查者逐題複核紀錄，不得冒稱已完成獨立複核。'}]),{status:'formal-flow-unverified',reason:'尚未登錄新不可變版本；正式私有供圖、歷史作答與延伸練習入口未驗收。'}],candidates,practices};
}
