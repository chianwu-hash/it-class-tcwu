import {resolveSession,isTeacher,beginCentralizedLogin} from './auth.js';
import {createFoundationProgress} from './typing-foundation-progress.js?v=20261006-google';
import {getLesson} from './typing-foundation-curriculum.mjs';
import {getZhuyinLesson} from './zhuyin-foundation-curriculum.mjs';
let records=[],session=null,busy=false,loadedCourse=null;
const $=id=>document.getElementById(id);
const api=courseId=>createFoundationProgress({courseId,getSession:()=>session});
async function load(){
 if(busy)return;busy=true;records=[];loadedCourse=null;$('rows').replaceChildren();$('export').disabled=true;
 const courseId=$('course').value;
 try{session=await resolveSession();if(!isTeacher(session))throw new Error('請先使用教師帳號登入。');
  records=await api(courseId).request('admin_list',{include_zhuyin:true});
  if(courseId!==$('course').value)return;
  loadedCourse=courseId;
  for(const row of records){
   const zh=row.lesson_key.startsWith('zhuyin-'),lesson=zh?getZhuyinLesson(row.lesson_key):getLesson(row.lesson_key);const lessonLabel=`${zh?'中打':'英打'}第 ${lesson.number} 關：${lesson.title}`;
   const tr=document.createElement('tr');tr.className='border-b';
   const rate=row.best_rate??row.best_wpm,unit=zh?(lesson.mode==='ime'?'字元／分':'鍵／分'):'WPM';
   const values=[`${row.display_name}（${row.learner_key}）`,lessonLabel,`${row.checkpoint}/5`,row.completed?'過關・1 片葉':'未過關',zh?'95%，速度僅記錄':`95%＋${courseId==='grade3-115-1'||row.starter?lesson.starterSpeed:lesson.speed} WPM`,row.completed_at?new Date(row.completed_at).toLocaleString('zh-TW'):'—',rate==null?'—':`${Number(rate).toFixed(1)} ${unit}`];
   for(const value of values){const td=document.createElement('td');td.className='p-3';td.textContent=value;tr.append(td);}
   const td=document.createElement('td'),button=document.createElement('button');button.textContent='重置這一關';button.className='border border-red-300 text-red-700 rounded p-2';
   button.onclick=async()=>{
    if(busy)return;
    if(!confirm(`重置 ${row.display_name}（${row.learner_key}）的${lessonLabel}？會收回此關成果；後續關卡暫停，補過本關後恢復。其他關已存成果與週次作業不變。`))return;
    busy=true;button.disabled=true;
    let message;
    try{session=await resolveSession();if(!isTeacher(session))throw new Error('教師登入已失效。');
     await api(courseId).request('admin_reset',{id:row.id,revision:row.revision});message='已重置此關，並留下教師操作紀錄。';
    }catch(error){message=`重置失敗：${error.message}`;}finally{busy=false;await load();$('status').textContent=message+' '+$('status').textContent;}
   };td.append(button);tr.append(td);$('rows').append(tr);
  }
  $('status').textContent=`已讀取 ${records.length} 筆基礎練習進度。重置會保留稽核歷史，不清除各週作業。`;$('export').disabled=false;
 }catch(error){$('status').textContent=error.message;}finally{busy=false;if(courseId!==$('course').value)load();}
}
$('login').onclick=()=>beginCentralizedLogin({returnTo:location.href});$('refresh').onclick=load;$('course').onchange=load;
$('export').onclick=()=>{
 if(!loadedCourse || loadedCourse!==$('course').value || busy)return;
 const cell=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';
 const values=[['課程','學生身分','姓名','關卡版本','通過小關','整關過關','過關時間','初學起步','最佳達標速度','速度單位','有效紀錄版本'],...records.map(r=>[loadedCourse,r.learner_key,r.display_name,r.lesson_key,r.checkpoint,r.completed,r.completed_at,r.starter,r.best_rate??r.best_wpm,r.rate_unit||'wpm',r.revision])];
 const url=URL.createObjectURL(new Blob(['\uFEFF'+values.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download=`基礎練習成果-${loadedCourse}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};load();
