import {lessons} from './typing-foundation-curriculum.mjs';
import {zhuyinLessons} from './zhuyin-foundation-curriculum.mjs';
export function foundationTreeData(progress,courseId) {
  const records=Array.isArray(progress)?progress:progress?[progress]:[];
  return {activities:[...lessons,...zhuyinLessons].map(lesson=>({type:'foundation',courseId,weekCode:'foundation',activityKey:lesson.key,
    pageHref:`/grade${courseId.startsWith('grade3')?'3':'6'}/115-1/${lesson.track==='zhuyin'?'zhuyin':'typing'}-foundation.html?lesson=${lesson.key}`,label:`${lesson.track==='zhuyin'?'中打':'英打'}第 ${lesson.number} 關：${lesson.title}`})),
    rows:records.map(record=>({course_id:courseId,week_code:'foundation',activity_key:record.lesson_key||lessons[0].key,
      completed:record.completed,updated_at:record.completed_at||record.updated_at,current_level:record.checkpoint}))};
}
