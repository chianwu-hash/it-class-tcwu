import {wrongQuestionRef,wrongQuestionSearch} from '../../shared/quiz-wrong-route.mjs';

// Local adapter only: combine existing authorized wrong-question reads with one pinned past question.
export function createPastWrongReview({db,bundle,map,version,project,isPracticeSession}){
 const group=bundle.document.groups.find(g=>g.id===map.groupId),field=group.fields.find(f=>f.id===map.questionId);
 async function rpc(uid,name,data){return db.transaction(async tx=>{
  await tx.query("select set_config('quiz.test_uid',$1,true)",[uid]);await tx.exec('set local role authenticated');
  return (await tx.query(`select public.${name}($1) r`,[data])).rows[0].r;
 });}
 async function snapshotFor(uid,attemptId){return db.transaction(async tx=>{
  await tx.query("select set_config('quiz.test_uid',$1,true)",[uid]);await tx.exec('set local role authenticated');
  return project((await tx.query("select public.quiz_past_action('resume',$1) r",[{paper_id:bundle.paperId,attempt_id:attemptId}])).rows[0].r);
 });}
 async function pastItem(uid,attempt){
  let snapshot;try{snapshot=await snapshotFor(uid,attempt.id);}catch{return null;}
  const record=snapshot.records?.[group.id],result=record?.results.find(r=>r.questionId===field.id);
  if(snapshot.version!==version||result?.correct!==false||!record.learningReview)return null;
  const item={source_type:'past_exam',attempt_id:attempt.id,question_id:field.id,paper_id:bundle.paperId,version_id:version,group_id:group.id,
   answered_at:attempt.created_at,title:bundle.document.title,catalog:{...bundle.document.catalog,unit:bundle.document.title},number:1,
   source_label:group.sourceLabel,preview:group.promptContent.text.slice(0,160)};
  return {item,snapshot,record,result};
 }
 return {
  async read({uid,data={}}){
   if(data.source_type&&!['quiz','past_exam'].includes(data.source_type))throw Error('invalid_request');
   if((data.action||'list')==='detail'){
    if(data.source_type!=='past_exam')return rpc(uid,'quiz_wrong_questions',data);
    const ref=wrongQuestionRef(data);
    if(!ref||ref.paper_id!==bundle.paperId||ref.version_id!==version||ref.group_id!==group.id||ref.question_id!==field.id)throw Error('wrong_question_unavailable');
    const found=(await db.query('select id,created_at from public.quiz_past_attempts where id=$1 and user_id=$2 and paper_id=$3 and version_id=$4',[ref.attempt_id,uid,bundle.paperId,version])).rows[0];
    const detail=found&&await pastItem(uid,found);if(!detail)throw Error('wrong_question_unavailable');
    const {item,record,result,snapshot}=detail;
    return {...item,can_extend:false,question:{id:field.id,type:'single',prompt:group.promptContent,material:group.materialContent||{text:group.material||'',media:[]},options:group.choices.map(c=>({id:c.id,content:c.content||{text:c.text,media:[]}}))},
     response:record.responses.find(r=>r.questionId===field.id).value,review:{answer:{option_id:result.official},explanation:{text:map.explanation,media:[]},correct:false},
     past_review:{version:snapshot.version,group:{id:group.id,fields:[{id:field.id}]},record}};
   }
   // Validate the original request and identity using the existing SQL contract first.
   const checked=await rpc(uid,'quiz_wrong_questions',data);
   const first=await rpc(uid,'quiz_wrong_questions',{action:'list',grade:data.grade,page:0});
   const regular=[...first.items];
   for(let page=1;page*20<first.total;page++)regular.push(...(await rpc(uid,'quiz_wrong_questions',{action:'list',grade:data.grade,page})).items);
   const items=regular.filter(i=>!isPracticeSession(i.session_id)).map(i=>({...i,source_type:'quiz'}));
   if(Number(checked.grade)===3){
    const candidates=(await db.query('select id,created_at from public.quiz_past_attempts where user_id=$1 and paper_id=$2 and version_id=$3',[uid,bundle.paperId,version])).rows;
    for(const attempt of candidates){const found=await pastItem(uid,attempt);if(found)items.push(found.item);}
   }
   const subject=data.subject||'',unit=data.unit||'',page=Number(data.page||0);
   const facets=[...new Map(items.map(i=>{const f={subject:i.catalog?.subject||'未分類',unit:i.catalog?.unit||i.title};return [JSON.stringify(f),f];})).values()];
   const filtered=items.filter(i=>(!subject||(i.catalog?.subject||'未分類')===subject)&&(!unit||(i.catalog?.unit||i.title)===unit));
   filtered.sort((a,b)=>new Date(b.answered_at)-new Date(a.answered_at)||JSON.stringify([a.source_type,a.attempt_id,a.question_id]).localeCompare(JSON.stringify([b.source_type,b.attempt_id,b.question_id])));
   return {...checked,facets,total:filtered.length,items:filtered.slice(page*20,page*20+20)};
  },
  sourceProjection(snapshot,student){
   const record=snapshot?.records?.[group.id],review=record?.learningReview;if(!review)return snapshot;
   const {learningReview,...plain}=record;
   const result=record.results.find(r=>r.questionId===field.id);
   const ref={source_type:'past_exam',attempt_id:snapshot.attemptId,question_id:field.id,paper_id:bundle.paperId,version_id:version,group_id:group.id};
   return {...snapshot,records:{...snapshot.records,[group.id]:{...plain,learningExplanation:review.explanation,
    ...(result?.correct===false?{wrongReviewHref:'/grade3/115-1/quiz-library.html?'+wrongQuestionSearch(ref,'fixture_student='+student)+'#wrong'}:{})}}};
  }
 };
}
