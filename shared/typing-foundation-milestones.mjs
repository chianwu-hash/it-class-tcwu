import {lessons} from './typing-foundation-curriculum.mjs';
import {zhuyinLessons} from './zhuyin-foundation-curriculum.mjs';

// Versioned skill milestones; keep original lesson/leaf identities unchanged.
export const FOUNDATION_TRACKS = Object.freeze({english:lessons,zhuyin:zhuyinLessons});
export const FOUNDATION_MILESTONES = Object.freeze([
  ...[[4,'字母整合'],[9,'數字與符號'],[12,'英打綜合成果']].map(([end,title])=>({track:'english',end,title})),
  ...[[5,'注音鍵位'],[8,'詞語與選字'],[12,'完整表達']].map(([end,title])=>({track:'zhuyin',end,title}))
].map(m=>Object.freeze({...m,key:`foundation-${m.track}-m${String(m.end).padStart(2,'0')}-v1`,
  label:m.track==='english'?'英打':'中打',lessonKeys:Object.freeze(FOUNDATION_TRACKS[m.track].slice(0,m.end).map(l=>l.key))})));

export function foundationMilestones(progress=[]){
  const records=new Map((Array.isArray(progress)?progress:[]).map(r=>[r.lesson_key,r]));
  return FOUNDATION_MILESTONES.map(m=>{
    const completed=m.lessonKeys.filter(key=>records.get(key)?.completed===true);
    const earned=completed.length===m.lessonKeys.length;
    const times=m.lessonKeys.map(key=>Date.parse(records.get(key)?.completed_at||records.get(key)?.updated_at||''));
    return {...m,completed:completed.length,earned,nextLesson:m.lessonKeys.find(key=>records.get(key)?.completed!==true),
      earnedAt:earned&&times.every(Number.isFinite)?new Date(Math.max(...times)).toISOString():null};
  });
}

export function foundationMilestoneTreeData(progress,courseId){
  const milestones=foundationMilestones(progress),grade=courseId.startsWith('grade3')?'3':'6';
  return {activities:milestones.map(m=>({type:'foundation-milestone',sourceType:'foundation',track:m.track,
    courseId,weekCode:'foundation',activityKey:m.key,label:`${m.label}里程碑・${m.title}`,requiredLessons:m.end,
    pageHref:`/grade${grade}/115-1/${m.track==='english'?'typing':'zhuyin'}-foundation.html?lesson=${m.nextLesson||m.lessonKeys.at(-1)}`})),
    rows:milestones.map(m=>({course_id:courseId,week_code:'foundation',activity_key:m.key,completed:m.earned,score:m.completed,updated_at:m.earnedAt}))};
}
