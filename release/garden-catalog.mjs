// Shared with the manual audit; deliberately contains no credential or DB writer.
export const catalogKey=r=>[r.course_id,r.week_code,r.activity_key].join(':');
export function validateCatalog(rows){
 if(!Array.isArray(rows)||!rows.length||rows.length>10000)throw Error('任務目錄格式錯誤或為空');
 const keys=new Set();
 for(const r of rows){
  if(!r||!/^grade\d+-\d{3}-[12]$/.test(r.course_id)||!/^([0-9]{2}|foundation)$/.test(r.week_code)||!/^[-\w]+$/.test(r.activity_key)||!['typing','quiz','practical','foundation'].includes(r.kind)||!Number.isInteger(r.total_levels)||r.total_levels<1||r.total_levels>1000||![null,'boss'].includes(r.reward_mode))throw Error('任務目錄欄位無效');
  const key=catalogKey(r);if(keys.has(key))throw Error('任務目錄有重複活動：'+key);keys.add(key);
 }
 return rows;
}
export function expectedCatalog(courses,foundationKeys){
 if(!Array.isArray(courses)||!Array.isArray(foundationKeys)||!foundationKeys.length)throw Error('課程定義不完整');
 const rows=courses.flatMap(c=>c.activities.map(a=>({course_id:c.id,week_code:a.weekCode,activity_key:a.activityKey,kind:a.type,total_levels:a.totalLevels??1,reward_mode:a.rewardMode??null})));
 for(const course_id of ['grade3-115-1','grade6-115-1'])for(const activity_key of foundationKeys)rows.push({course_id,week_code:'foundation',activity_key,kind:'foundation',total_levels:1,reward_mode:null});
 return validateCatalog(rows);
}
export function compareCatalog(expected,actual){
 validateCatalog(expected);validateCatalog(actual);const server=new Map(actual.map(r=>[catalogKey(r),r]));
 const missing=[],mismatched=[];
 for(const r of expected){const found=server.get(catalogKey(r));if(!found)missing.push(catalogKey(r));else{const fields=['kind','total_levels','reward_mode'].filter(k=>r[k]!==found[k]);if(fields.length)mismatched.push({key:catalogKey(r),fields,expected:r,actual:found});}}
 const keys=new Set(expected.map(catalogKey));return {passed:missing.length===0&&mismatched.length===0,expected:expected.length,actual:actual.length,missing,mismatched,retainedHistorical:actual.filter(r=>!keys.has(catalogKey(r))).map(catalogKey)};
}
