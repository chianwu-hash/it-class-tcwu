import fs from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {quizCall} from './quiz-local-db.mjs';
import {validateDocument} from '../../shared/quiz-document.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);

// Explicitly opt-in, loopback fixture. Reuses the existing schema1 SQL engine.
export async function createPastPublisherPractice({db,teacher,bundle,map,version,packet}){
 if(packet.schema!==1||packet.sourcePaperId!==bundle.paperId||packet.sourceDocumentSha256!==bundle.sha256||
  packet.sourceGroupId!==map.groupId||packet.sourceQuestionId!==map.questionId)throw Error('practice_source_mismatch');
 const published=new Map(),sessions=new Map(),starts=new Map(),receipts=new Map();
 for(const [conceptId,entry] of Object.entries(packet.documents)){
  if(!map.concepts.some(c=>c.id===conceptId)||hash(JSON.stringify(entry.document))!==entry.sha256)throw Error('practice_document_mismatch');
  validateDocument(entry.document);
  const questions=entry.document.blocks.flatMap(b=>b.questions);
  if(questions.length!==2||entry.sources.length!==2)throw Error('practice_requires_two_source_questions');
  for(const source of entry.sources){
   if(hash(fs.readFileSync(source.sourceFile))!==source.sha256||!questions.some(q=>q.id===source.normalizedQuestionId&&q.answer.option_id===source.normalizedAnswer))throw Error('practice_original_changed');
  }
  const bankId=randomUUID();await quizCall(db,teacher,'save',{bank_id:bankId,expected_revision:0,document:entry.document});
  const frozen=await quizCall(db,teacher,'publish',{bank_id:bankId,expected_revision:1});
  published.set(conceptId,{versionId:frozen.id,count:questions.length,sha256:entry.sha256});
 }
 async function ownSource(uid,data){
  if(!uuid(data.attempt_id)||data.version!==version||data.group_id!==map.groupId||data.question_id!==map.questionId||!published.has(data.concept_id))throw Error('practice_source_unavailable');
  return db.transaction(async tx=>{
   await tx.query("select set_config('quiz.test_uid',$1,true)",[uid]);await tx.exec('set local role authenticated');
   const snapshot=(await tx.query("select public.quiz_past_action('resume',$1) r",[{paper_id:bundle.paperId,attempt_id:data.attempt_id}])).rows[0].r;
   if(snapshot.version!==version||!snapshot.records[map.groupId]?.results.some(r=>r.questionId===map.questionId&&typeof r.correct==='boolean'))throw Error('practice_source_not_answered');
  });
 }
 async function start(uid,data,student){
  if(!uuid(data.request_id))throw Error('invalid_request');
  await ownSource(uid,data);
  const conf=JSON.stringify([data.attempt_id,data.version,data.group_id,data.question_id,data.concept_id]);
  const receiptKey=uid+'|'+data.request_id,previous=receipts.get(receiptKey);
  if(previous&&previous!==conf)throw Error('submission_conflict');
  receipts.set(receiptKey,conf);
  const key=uid+'|'+conf;
  if(!starts.has(key)){
   const pending=(async()=>{
    const prepared=published.get(data.concept_id),sessionId=randomUUID();
    // Classroom mode is ineligible for quiz leaves regardless of question count.
    await quizCall(db,teacher,'open',{session_id:sessionId,version_id:prepared.versionId,school_year:115,class_codes:['301'],reveal:'immediate',shuffle_questions:false,shuffle_options:false,access_mode:'classroom'});
    sessions.set(sessionId,{userId:uid,sourceAttempt:data.attempt_id,conceptId:data.concept_id});
    const params=new URLSearchParams({cloud:'1',session:sessionId,fixture_student:String(student),past_paper:bundle.paperId,past_attempt:data.attempt_id});
    return {sessionId,url:'/grade3/115-1/quiz.html?'+params,count:prepared.count,publisher:packet.publisher.name,awardEligible:false};
   })();
   starts.set(key,pending);pending.catch(()=>starts.delete(key));
  }
  return starts.get(key);
 }
 return {
  project(snapshot){
   const review=snapshot?.records?.[map.groupId]?.learningReview;if(!review)return snapshot;
   return {...snapshot,records:{...snapshot.records,[map.groupId]:{...snapshot.records[map.groupId],learningReview:{...review,concepts:review.concepts.map(c=>published.has(c.id)?{...c,practice:{available:true,count:published.get(c.id).count,publisher:packet.publisher.name,schoolYear:packet.publisher.schoolYear,chapter:packet.publisher.chapterName}}:c)}}}};
  },
  async call({uid,student,action,data}){
   if(action==='start')return start(uid,data,student);
   const session=sessions.get(data?.session_id);
   if(!session||session.userId!==uid)throw Error('practice_session_unavailable');
   if(action==='entry_context')return db.transaction(async tx=>{
    await tx.query("select set_config('quiz.test_uid',$1,true)",[uid]);await tx.exec('set local role authenticated');
    return (await tx.query('select public.quiz_entry_context($1) r',[data])).rows[0].r;
   });
   if(action!=='quiz'||!['join','resume','view_question','submit'].includes(data.quiz_action))throw Error('invalid_action');
   const {quiz_action,...payload}=data;
   return quizCall(db,uid,quiz_action,payload);
  }
 };
}
