import fs from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {quizCall} from './quiz-local-db.mjs';
import {validateDocument} from '../../shared/quiz-document.mjs';
import {learningEntries,learningConcepts} from './past-learning-map.mjs';
import {wrongQuestionSearch} from '../../shared/quiz-wrong-route.mjs';
import {createPastExtensionRewards} from './past-extension-rewards.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);

// Explicitly opt-in, loopback fixture. Reuses the existing schema1 SQL engine.
export async function createPastPublisherPractice({db,teacher,bundle,map,version,packet,wrongEntryOnly=false,extensionRewards=false,learningTerm={schoolYear:115,semester:1}}){
 const entries=learningEntries(map);
 if(packet.schema!==map.schema||packet.sourcePaperId!==bundle.paperId||packet.sourceDocumentSha256!==bundle.sha256||
  (map.schema===1&&(packet.sourceGroupId!==map.groupId||packet.sourceQuestionId!==map.questionId)))throw Error('practice_source_mismatch');
 const published=new Map(),sessions=new Map(),starts=new Map(),receipts=new Map();
 const rewards=extensionRewards?await createPastExtensionRewards({db,packet}):null;
 for(const [conceptId,entry] of Object.entries(packet.documents)){
  if(!entries.some(e=>learningConcepts(map,e).some(c=>c.id===conceptId))||hash(JSON.stringify(entry.document))!==entry.sha256)throw Error('practice_document_mismatch');
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
  const entry=entries.find(e=>e.groupId===data.group_id&&e.questionId===data.question_id&&learningConcepts(map,e).some(c=>c.id===data.concept_id));
  if(!uuid(data.attempt_id)||data.version!==version||!entry||!published.has(data.concept_id))throw Error('practice_source_unavailable');
  await db.transaction(async tx=>{
   await tx.query("select set_config('quiz.test_uid',$1,true)",[uid]);await tx.exec('set local role authenticated');
   const snapshot=(await tx.query("select public.quiz_past_action('resume',$1) r",[{paper_id:bundle.paperId,attempt_id:data.attempt_id}])).rows[0].r;
   if(snapshot.version!==version||!snapshot.records[entry.groupId]?.results.some(r=>r.questionId===entry.questionId&&typeof r.correct==='boolean'))throw Error('practice_source_not_answered');
   if(data.entry_mode==='review'){
    if(!rewards||!snapshot.practice?.complete||entry.selfCheck)throw Error('practice_review_unavailable');
   }else if((wrongEntryOnly||rewards)&&!snapshot.records[entry.groupId].results.some(r=>r.questionId===entry.questionId&&r.correct===false))throw Error('practice_source_not_wrong');
  });return entry;
 }
 async function start(uid,data,student){
  if(!uuid(data.request_id))throw Error('invalid_request');
  const entry=await ownSource(uid,data);
  if(data.entry_mode&&data.entry_mode!=='review')throw Error('invalid_entry_mode');
  const conf=JSON.stringify([data.attempt_id,data.version,data.group_id,data.question_id,data.concept_id,data.entry_mode||'wrong',Boolean(data.retake)]);
  const receiptKey=uid+'|'+data.request_id,previous=receipts.get(receiptKey);
  if(previous&&previous!==conf)throw Error('submission_conflict');
  receipts.set(receiptKey,conf);
  const key=uid+'|'+conf+(rewards&&data.retake?'|'+data.request_id:'');
  if(!starts.has(key)){
   const pending=(async()=>{
    const prepared=published.get(data.concept_id),sessionId=randomUUID();
    // Classroom mode is ineligible for quiz leaves regardless of question count.
    await quizCall(db,teacher,'open',{session_id:sessionId,version_id:prepared.versionId,school_year:115,class_codes:['301'],reveal:'immediate',shuffle_questions:false,shuffle_options:false,access_mode:'classroom'});
    if(rewards)await rewards.register({sessionId,uid,sourceAttempt:data.attempt_id,conceptId:data.concept_id,mode:data.entry_mode||'wrong',...learningTerm});
    sessions.set(sessionId,{userId:uid,sourceAttempt:data.attempt_id,conceptId:data.concept_id});
    const params=new URLSearchParams(wrongEntryOnly?wrongQuestionSearch({source_type:'past_exam',attempt_id:data.attempt_id,paper_id:bundle.paperId,version_id:version,group_id:entry.groupId,question_id:entry.questionId}):{past_paper:bundle.paperId,past_attempt:data.attempt_id});
    if(data.entry_mode==='review'){
     for(const name of [...params.keys()])params.delete(name);
     params.set('learning_attempt',data.attempt_id);params.set('learning_concept',data.concept_id);
    }
    params.set('cloud','1');params.set('session',sessionId);params.set('fixture_student',String(student));
    return {sessionId,url:'/grade3/115-1/quiz.html?'+params,count:prepared.count,publisher:packet.publisher.name,awardEligible:false,extensionEligible:Boolean(rewards)};
   })();
   starts.set(key,pending);pending.catch(()=>starts.delete(key));
  }
  return starts.get(key);
 }
 return {
  rewards,
  async review({uid,attemptId}){
   if(!rewards)throw Error('practice_review_unavailable');
   if(!attemptId){
    const rows=(await db.query(`select id,score,max_score,created_at from public.quiz_past_attempts where user_id=$1 and paper_id=$2 and version_id=$3 and completed_at is not null order by created_at desc`,[uid,bundle.paperId,version])).rows;
    return {title:bundle.document.title,attempts:rows};
   }
   const data={attempt_id:attemptId,version,entry_mode:'review'};
   const concepts=[];let authorized=false;
   for(const concept of map.concepts||[...new Map(entries.flatMap(e=>learningConcepts(map,e).map(c=>[c.id,c]))).values()]){
    const e=entries.find(e=>!e.selfCheck&&learningConcepts(map,e).some(c=>c.id===concept.id));if(!e||!published.has(concept.id))continue;
    if(!authorized){await ownSource(uid,{...data,group_id:e.groupId,question_id:e.questionId,concept_id:concept.id});authorized=true;}
    concepts.push({...structuredClone(concept),count:published.get(concept.id).count,source:{...data,group_id:e.groupId,question_id:e.questionId,concept_id:concept.id}});
   }
   return {title:bundle.document.title,attemptId,concepts};
  },
  isPracticeSession:sessionId=>sessions.has(sessionId),
  project(snapshot){
   if(!snapshot?.records)return snapshot;
   const add=review=>({...review,concepts:review.concepts.map(c=>published.has(c.id)?{...c,practice:{available:true,count:published.get(c.id).count,publisher:packet.publisher.name,schoolYear:packet.publisher.schoolYear,chapter:packet.documents[c.id].chapterName||packet.publisher.chapterName}}:c)});
   const records={...snapshot.records};
   for(const [id,record] of Object.entries(records)){
    if(record.learningReview)records[id]={...record,learningReview:add(record.learningReview)};
    if(record.learningReviews)records[id]={...records[id],learningReviews:Object.fromEntries(Object.entries(record.learningReviews).map(([qid,review])=>[qid,add(review)]))};
   }return {...snapshot,records};
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
   if(rewards&&quiz_action==='submit'&&!await rewards.ready(uid,data.session_id,data.question_id))return {warning:'answer_too_fast',retry_after:2};
   const result=await quizCall(db,uid,quiz_action,payload);
   if(rewards&&quiz_action==='view_question')await rewards.view(uid,data.session_id,data.question_id);
   if(rewards&&['join','resume','submit'].includes(quiz_action))result.extension=await rewards.reconcile(uid,data.session_id);
   return result;
  }
 };
}
