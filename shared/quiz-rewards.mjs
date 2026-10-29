import {createQuizRequest} from './quiz-api.mjs?v=20261029-load-batch1';
export async function quizTreeData(session,courseId){
 const request=await createQuizRequest({getSession:()=>session}),data=await request('rewards',{course_id:courseId});
 return {activities:data.awards.map(a=>({courseId,weekCode:'00',activityKey:'practice_'+a.id,type:'quiz',label:'考前練功房・'+a.title,pageHref:`/grade${a.grade}/115-1/quiz.html?cloud=1&session=${a.session_id}`})),rows:data.awards.map(a=>({course_id:courseId,week_code:'00',activity_key:'practice_'+a.id,completed:true,score:Math.round(a.correct*100/a.total),updated_at:a.awarded_at}))};
}
