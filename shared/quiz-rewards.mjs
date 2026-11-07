import {createQuizRequest} from './quiz-api.mjs?v=20261102-learning';
import {wholeQuizLeaves} from './quiz-leaf-credit.mjs';
import {partnerTreeData} from './quiz-partner-rewards.mjs';
export async function quizTreeData(session,courseId){
 const request=await createQuizRequest({getSession:()=>session}),data=await request('rewards',{course_id:courseId});
 return quizRewardTreeData(data,courseId);
}
// Shared projection: teacher previews and student trees must have identical reward IDs.
export function quizRewardTreeData(data,courseId){
 const {leaves,pendingHalf}=wholeQuizLeaves((data.awards||[]).filter(a=>a.source_type!=='past_exam'));
 const flowers=data.flowers||[];
 const source=a=>`/grade${a.grade}/115-1/past-exam.html?paper=${encodeURIComponent(a.paper_id)}&attempt=${encodeURIComponent(a.attempt_id)}`;
 const flowerActivities=flowers.map(a=>({courseId,weekCode:'00',activityKey:'practice_'+a.id,type:'past-exam-flower',label:'考前練功坊・'+a.title,pageHref:source(a),sourceLinks:[{title:a.title,href:source(a)}]}));
 const flowerRows=flowers.map(a=>({course_id:courseId,week_code:'00',activity_key:'practice_'+a.id,completed:true,score:a.source_type==='learning'?null:a.total?Math.round(a.correct*100/a.total):null,updated_at:a.awarded_at}));
 const partner=partnerTreeData(data.partner,courseId);
 return {pendingHalf,learning:data.learning,activities:leaves.map(a=>({courseId,weekCode:'00',activityKey:'practice_'+a.id,type:a.source_type==='learning'?'learning-leaf':'quiz',label:'考前練功坊・'+a.title,
  sourceLinks:a.sources.map(s=>({title:s.title,href:s.source_type==='learning'?`/grade${s.grade}/115-1/quiz-library.html#wrong`:`/grade${s.grade}/115-1/quiz.html?cloud=1&session=${s.session_id}`})),
  pageHref:a.source_type==='learning'?`/grade${a.grade}/115-1/quiz-library.html#wrong`:`/grade${a.grade}/115-1/quiz.html?cloud=1&session=${a.session_id}`})).concat(flowerActivities,partner.activities),rows:leaves.map(a=>({course_id:courseId,week_code:'00',activity_key:'practice_'+a.id,completed:true,score:a.source_type==='learning'?null:a.total?Math.round(a.correct*100/a.total):null,updated_at:a.awarded_at})).concat(flowerRows,partner.rows)};
}
