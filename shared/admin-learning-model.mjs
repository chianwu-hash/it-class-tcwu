import {lessons} from './typing-foundation-curriculum.mjs';
import {zhuyinLessons} from './zhuyin-foundation-curriculum.mjs';

export const lessonName=key=>{
  const english=lessons.findIndex(x=>x.key===key),chinese=zhuyinLessons.findIndex(x=>x.key===key);
  return english>=0?`英打第 ${english+1} 關・${lessons[english].title}`:chinese>=0?`中打第 ${chinese+1} 關・${zhuyinLessons[chinese].title}`:`未識別關卡（${key}）`;
};
export const unitLabel=unit=>({wpm:'WPM',keys_per_minute:'鍵／分',characters_per_minute:'字元／分'}[unit]||'單位未記錄');
export const rateLabel=(value,unit)=>value==null?'未記錄':`${Number(value).toFixed(1)} ${unitLabel(unit)}`;
export const timeLabel=value=>value?new Date(value).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}):'尚無紀錄';
export const fullTime=value=>value?new Date(value).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false}):'尚無紀錄';
export function paperStatus(p){
  if(!p.attempt_id&&p.started_at===null)return '尚未開始';
  return Number(p.answered)===Number(p.total)&&Number(p.total)>0?'已完成':'作答中';
}
export const paperAccuracy=p=>Number(p.answered)>0?`${p.correct} / ${p.answered} 題（${Math.round(Number(p.correct)/Number(p.answered)*100)}%）`:'尚無已答題目';
export function typingPolicy(row,course){
  if(row.track==='zhuyin')return '小關 90%・綜合 95%；速度僅記錄';
  const speed=course==='grade3-115-1'||row.starter?row.starter_speed:row.speed;
  return `小關 90%・綜合 95%＋${speed} WPM`;
}
export function orderedOptions(question,order){
  const options=question.options||[];
  if(!Array.isArray(order))return options;
  return [...order.map(id=>options.find(o=>o.id===id)).filter(Boolean),...options.filter(o=>!order.includes(o.id))];
}
export const optionLetter=(question,order,id)=>{
  const index=orderedOptions(question,order).findIndex(o=>o.id===id);
  return index<0?'選項已無法對應':String.fromCharCode(65+index);
};
export function responseLabel(question,order,value,answered=true){
  if(!answered)return '尚未作答';
  if(question.type==='single')return `選項 ${optionLetter(question,order,value)}`;
  if(typeof value==='string')return value;
  if(typeof value==='boolean')return value?'是':'否';
  if(Array.isArray(value))return value.map(v=>String(v)).join('、');
  return '此題的作答格式需專用檢視；已保存原始紀錄。';
}
