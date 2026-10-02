const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const source=fs.readFileSync('shared/auth.js','utf8');
 const url=source.match(/SUPABASE_URL = "([^"]+)"/)[1],key=source.match(/SUPABASE_ANON_KEY = "([^"]+)"/)[1];
 for(const [action,course,payload,expected] of [
  ['load','grade6-115-1',{},'student_required'],
  ['load','grade6-115-1',{lesson_key:'zhuyin-home-v1'},'student_required'],
  ['list','grade6-115-1',{include_zhuyin:true},'student_required'],
  ['admin_list','grade6-115-1',{include_zhuyin:true},'teacher_required'],
  ['admin_list','grade3-115-1',{},'teacher_required'],
  ['load','grade3-115-1',{},'course_not_open'],
  ['load','grade3-115-1',{lesson_key:'zhuyin-home-v1'},'course_not_open'],
  ['start','grade3-115-1',{class_code:'999',seat_no:99,birthday_code:'0000'},'course_not_open']
 ]){
  const response=await fetch(url+'/rest/v1/rpc/typing_foundation_action',{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({p_action:action,p_course_id:course,p_payload:payload})});
  const data=await response.json();assert.equal(response.ok,false);assert.equal(data.message,expected);
 }
 const direct=await fetch(url+'/rest/v1/typing_foundation_progress?select=id',{headers:{apikey:key,Authorization:`Bearer ${key}`}});
 assert.equal(direct.ok,false);
 console.log('PASS: live Data API schema available; anonymous student/teacher reads rejected; Grade 3 disabled; direct table read denied. No live writes.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
