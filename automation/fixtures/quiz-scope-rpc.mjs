// Synthetic catalog for local-only scope UI acceptance. No student data or real papers.
export function scopeCatalogRPC({route,body,grade,user}){
 const identity={class_code:grade+'01',seat_no:7,display_name:'合成同學',email:user+'@example.invalid'};
 if(route.includes('quiz_library_sessions')){
  const c={school_year:'115',volume:grade+'年級上學期',publisher:'翰林',subject:'數學'};
  const paper=(id,scope,extra={})=>({id,title:'合成'+id,catalog:{...c,unit:scope==='before'?'第1單元':'第6單元',practice_scope:scope},total:10,answered:0,correct:0,...extra});
  return{role:'student',grade,identity,sessions:[paper('teacher-before','before',{answered:3,correct:2}),paper('teacher-after','after'),paper('teacher-mixed','mixed'),paper('teacher-unknown',undefined,{catalog:{...c,unit:'尚未標示範圍'}}),paper('own-before','before',{generated:true,unit_ids:[1],saved_at:'2026-11-01T00:00:00Z',display_name:'合成舊自組卷'}),paper('own-after','after',{generated:true,unit_ids:[6],saved_at:'2026-11-12T00:00:00Z',display_name:'合成新自組卷'})]};
 }
 if(route.includes('quiz_past_action')&&body.p_action==='list')return{papers:[1,2].flatMap(exam=>[113,114].map(year=>({id:`synthetic-${grade}-${year}-${exam}`,grade,enabled:year===113,title:`合成${year}年原卷`,catalog:{sourceYear:year+'-1',exam,subject:'數學',edition:'合成版本',range:exam===1?'原期中範圍':'原期末範圍'}})))};
 if(route.includes('quiz_pool_catalog'))return{available:true,courses:[{id:'115-1-hanlin-g3-math',grade,subject:'數學',units:Array.from({length:9},(_,i)=>({id:i+1,title:'合成單元'+(i+1),count:20}))}],name_characters:[]};
 return null;
}
