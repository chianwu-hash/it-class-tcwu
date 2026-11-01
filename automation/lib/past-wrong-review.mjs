import {wrongQuestionRef,wrongQuestionSearch} from '../../shared/quiz-wrong-route.mjs';
import {learningEntries} from './past-learning-map.mjs';

// Local-only adapter. Every past row is reconstructed from an authorized resume.
export function createPastWrongReview({db,bundle,map,version,project,isPracticeSession,grade=Number(bundle.document.catalog?.grade||3)}){
 const entries=learningEntries(map),groups=new Map(bundle.document.groups.map(g=>[g.id,g]));
 const entryFor=ref=>entries.find(e=>e.groupId===ref.group_id&&e.questionId===ref.question_id);
 const reviewFor=(record,qid)=>record?.learningReviews?.[qid]||(record?.learningReview?.source.questionId===qid?record.learningReview:null);
 const refFor=(attempt,e)=>({source_type:'past_exam',attempt_id:attempt,question_id:e.questionId,paper_id:bundle.paperId,version_id:version,group_id:e.groupId});
 const valueText=(value,g)=>{
  if(g.kind==='mark')return value?'勾選':'不勾選';
  if(Array.isArray(value))return value.join(g.kind==='sequence'?' → ':g.kind==='short'?' 或 ':'、');
  return String(value);
 };
 async function rpc(uid,name,data){return db.transaction(async tx=>{
  await tx.query("select set_config('quiz.test_uid',$1,true)",[uid]);await tx.exec('set local role authenticated');
  return (await tx.query(`select public.${name}($1) r`,[data])).rows[0].r;
 });}
 async function snapshotFor(uid,attemptId){return db.transaction(async tx=>{
  await tx.query("select set_config('quiz.test_uid',$1,true)",[uid]);await tx.exec('set local role authenticated');
  return project((await tx.query("select public.quiz_past_action('resume',$1) r",[{paper_id:bundle.paperId,attempt_id:attemptId}])).rows[0].r);
 });}
 function pastItems(attempt,snapshot){
  if(snapshot.version!==version)return [];
  const found=[];
  for(const entry of entries){
   const group=groups.get(entry.groupId),field=group.fields.find(f=>f.id===entry.questionId),record=snapshot.records?.[group.id],result=record?.results.find(r=>r.questionId===field.id),review=reviewFor(record,field.id);
   if(result?.correct!==false||!review||['annotation','manual'].includes(group.kind))continue;
   const item={...refFor(attempt.id,entry),answered_at:attempt.created_at,title:bundle.document.title,catalog:{...bundle.document.catalog,unit:bundle.document.title},number:bundle.document.groups.indexOf(group)+1,
    source_label:group.sourceLabel,field_label:/^\d{1,2}$/.test(field.label)?field.label:String(group.fields.indexOf(field)+1),preview:((group.promptContent?.text||group.materialContent?.text||group.material||'')+(group.kind==='single'?'':' '+field.text)).slice(0,160)};
   found.push({item,entry,group,field,record,result,review});
  }return found;
 }
 return {
  async read({uid,data={}}){
   if(data.source_type&&!['quiz','past_exam'].includes(data.source_type))throw Error('invalid_request');
   if((data.action||'list')==='detail'){
    if(data.source_type!=='past_exam')return rpc(uid,'quiz_wrong_questions',data);
    const ref=wrongQuestionRef(data);
    if(!ref||ref.paper_id!==bundle.paperId||ref.version_id!==version||!entryFor(ref))throw Error('wrong_question_unavailable');
    const attempt=(await db.query('select id,created_at from public.quiz_past_attempts where id=$1 and user_id=$2 and paper_id=$3 and version_id=$4',[ref.attempt_id,uid,bundle.paperId,version])).rows[0];
    if(!attempt)throw Error('wrong_question_unavailable');
    const snapshot=await snapshotFor(uid,attempt.id),detail=pastItems(attempt,snapshot).find(d=>d.item.question_id===ref.question_id&&d.item.group_id===ref.group_id);
    if(!detail)throw Error('wrong_question_unavailable');
    const {item,group,field,record,result,review}=detail;
    const material=structuredClone(group.materialContent||{text:group.material||'',media:[]});
    for(const asset of group.assets||[])if(!material.media.some(m=>m.url===asset.url))material.media.push({kind:'image',url:asset.url,alt:asset.alt});
    const prompt=structuredClone(group.promptContent||{text:group.prompt||'',media:[]});
    if(group.kind!=='single')prompt.text=[prompt.text,field.text,(group.choices||[]).map(c=>c.id+'：'+c.text).join('；')].filter(Boolean).join('\n');
    const response=record.responses.find(r=>r.questionId===field.id).value;
    return {...item,can_extend:false,question:{id:field.id,type:group.kind==='single'?'single':'past',past_kind:group.kind,prompt,material,options:group.kind==='single'?group.choices.map(c=>({id:c.id,content:c.content||{text:c.text,media:[]}})):[]},
     response,response_text:valueText(response,group),answer_text:valueText(result.official,group),review:{answer:{option_id:result.official},explanation:{text:review.explanation,media:[]},correct:false},
     past_review:{version:snapshot.version,group:{id:group.id,fields:[{id:field.id}]},record:{...record,learningReview:review}}};
   }
   const checked=await rpc(uid,'quiz_wrong_questions',data);
   const first=await rpc(uid,'quiz_wrong_questions',{action:'list',grade:data.grade,page:0}),regular=[...first.items];
   for(let page=1;page*20<first.total;page++)regular.push(...(await rpc(uid,'quiz_wrong_questions',{action:'list',grade:data.grade,page})).items);
   const items=regular.filter(i=>!isPracticeSession(i.session_id)).map(i=>({...i,source_type:'quiz'}));
   if(Number(checked.grade)===grade){
    const candidates=(await db.query('select id,created_at from public.quiz_past_attempts where user_id=$1 and paper_id=$2 and version_id=$3',[uid,bundle.paperId,version])).rows;
    for(const attempt of candidates){let snapshot;try{snapshot=await snapshotFor(uid,attempt.id);}catch{continue;}items.push(...pastItems(attempt,snapshot).map(d=>d.item));}
   }
   const subject=data.subject||'',unit=data.unit||'',page=Number(data.page||0);
   const facets=[...new Map(items.map(i=>{const f={subject:i.catalog?.subject||'未分類',unit:i.catalog?.unit||i.title};return [JSON.stringify(f),f];})).values()];
   const filtered=items.filter(i=>(!subject||(i.catalog?.subject||'未分類')===subject)&&(!unit||(i.catalog?.unit||i.title)===unit));
   filtered.sort((a,b)=>new Date(b.answered_at)-new Date(a.answered_at)||JSON.stringify([a.source_type,a.attempt_id,a.question_id]).localeCompare(JSON.stringify([b.source_type,b.attempt_id,b.question_id])));
   return {...checked,facets,total:filtered.length,items:filtered.slice(page*20,page*20+20)};
  },
  sourceProjection(snapshot,student){
   if(!snapshot?.records||snapshot.version!==version)return snapshot;
   const records={...snapshot.records};
   for(const group of bundle.document.groups){
    const record=records[group.id];if(!record)continue;
    const {learningReview,learningReviews,...plain}=record;
    const reviews=learningReviews|| (learningReview?{[learningReview.source.questionId]:learningReview}:{});
    const explanations=Object.entries(reviews).map(([qid,review])=>{
     const result=record.results.find(r=>r.questionId===qid),entry=entries.find(e=>e.questionId===qid);
     const field=group.fields.find(f=>f.id===qid);
     return {questionId:qid,label:group.fields.length>1?(/^\d{1,2}$/.test(field.label)?field.label:String(group.fields.indexOf(field)+1)):null,text:review.explanation,selfCheck:['annotation','manual'].includes(group.kind),
      ...(result?.correct===false?{wrongReviewHref:'/grade3/115-1/quiz-library.html?'+wrongQuestionSearch(refFor(snapshot.attemptId,entry),'fixture_student='+student)+'#wrong'}:{})};
    });
    records[group.id]=map.schema===1&&explanations.length?{...plain,learningExplanation:explanations[0].text,...(explanations[0].wrongReviewHref?{wrongReviewHref:explanations[0].wrongReviewHref}:{})}:{...plain,...(explanations.length?{learningExplanations:explanations}:{})};
   }return {...snapshot,records};
  }
 };
}
