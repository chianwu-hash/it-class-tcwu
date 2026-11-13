// Loopback-only synthetic catalog. Independent state per preview namespace and user.
import {createHash} from 'node:crypto';
const uid=key=>{const h=createHash('sha256').update(key).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4000-8000-${h.slice(12,24)}`;};
const stores=new Map();
const attempts=new Map();
function seed(grade,kind){
 const defs=grade===3?[
 ['國語','第7課　淡水小鎮'],['國語','第8課　安平古堡參觀記'],['國語','第9課　馬太鞍的巴拉告'],['國語','第10課　狐狸的故事'],['國語','第11課　巨人的花園'],['國語','第12課　樹奶奶'],
 ['數學','第6單元：除法'],['數學','第7單元：公斤與公克'],['數學','第8單元：分數'],['數學','第9單元：列表與規律'],['自然','第3單元　風與空氣'],['自然','第4單元　奇妙的溶解']
 ]:[['國語','第7課　課文練習'],['數學','第5單元：小數除法'],['數學','第6單元：比與比值'],['自然','第3單元　流水與地形'],['自然','第4單元　電磁鐵']];
 const c={school_year:'115',volume:grade+'年級上學期',publisher:'合成版本',practice_scope:'after'};
 const rows=defs.flatMap(([subject,unit],i)=>[10,20].map(total=>({id:`home-${grade}-${i}-${total}`,title:unit,catalog:{...c,subject,unit},total,answered:kind==='new'?0:i===6&&total===20?3:i===7&&total===10?4:i===10&&total===10?3:0,correct:1,generated:false,version_id:'synthetic-v1',distribution:{easy:3,medium:5,hard:2}})));
 rows.push({id:'home-prerequisite',title:'第1單元：暖身複習',catalog:{...c,subject:'數學',unit:'第1單元：暖身複習',practice_scope:'before'},total:10,answered:kind==='new'?0:2,correct:1});
 rows.push({id:'home-unknown',title:'探索練習',catalog:{...c,subject:'自然',unit:'探索練習',practice_scope:null},total:11,answered:0,correct:0});
 if(kind!=='new')rows.push({id:'home-own',title:'我的複習小隊',display_name:'我的複習小隊',generated:true,catalog:{...c,subject:'數學',unit:'自選單元：第6單元'},unit_ids:[6],total:5,answered:1,correct:1,saved_at:'2026-11-12T00:00:00Z',distribution:{difficulty:'medium',actual:5,easy:2,medium:2,hard:1}});
 return rows.map(p=>({...p,id:uid(p.id)}));
}
export function homeCatalogRPC({route,body={},grade,user,namespace='default',homeCase='returning'}){
 if(!['a','b'].includes(user))return{role:'guest',grade,sessions:[]};
 const key=namespace+':'+grade+':'+user+':'+homeCase;
 if(!stores.has(key))stores.set(key,seed(grade,homeCase));const rows=stores.get(key);
 if(route.includes('quiz_partner_pilot_access'))return {allowed:true};
 if(route.includes('quiz_partner_pilot_action')&&body.p?.action==='catalog')return {papers:rows.filter(p=>!p.generated&&p.catalog.practice_scope==='after').map(p=>({id:p.id,sourceSession:p.id,sourceSessions:[p.id],title:p.title,total:p.total}))};
 if(route.includes('quiz_library_sessions'))return {role:'student',grade,identity:{class_code:grade+'01',seat_no:7,display_name:homeCase==='new'?'初次練習同學':'合成同學',email:user+'@example.invalid'},sessions:rows};
 if(route.includes('quiz_learning')&&body.p_data?.action==='summary')return {enabled:true,count:homeCase==='new'?0:17,leaves:homeCase==='new'?0:1,remainder:homeCase==='new'?0:7};
 if(route.includes('quiz_learning'))return {attempts:[]};
 if(route.includes('quiz_wrong_questions'))return {facets:[],items:[],total:0};
 if(route.includes('quiz_pool_catalog'))return {available:true,courses:[{id:'115-1-hanlin-g3-math',grade,subject:'數學',units:Array.from({length:9},(_,i)=>({id:i+1,title:'合成單元'+(i+1),count:30}))}],name_characters:[]};
 if(route.includes('quiz_compose')){const d=body.p_data,id=body.p_data.request_id;let p=rows.find(p=>p.id===id);if(!p){p={id,title:'自己的複習卷',display_name:'自己的複習卷',generated:true,catalog:{school_year:'115',volume:grade+'年級上學期',publisher:'合成版本',subject:'數學',unit:'自選單元：'+d.units.join('、'),practice_scope:'after'},unit_ids:d.units,total:d.count,answered:0,correct:0,saved_at:new Date().toISOString(),distribution:{actual:d.count,difficulty:d.difficulty,easy:3,medium:5,hard:2}};rows.push(p);}return {session_id:id,display_name:p.display_name,distribution:p.distribution,paper:p};}
 if(route.includes('quiz_delete_paper')){const i=rows.findIndex(p=>p.id===body.p_data.session_id&&p.generated);if(i>=0)rows.splice(i,1);return {ok:true};}
 if(route.endsWith('/quiz_action')){
  const data=body.p_data||{},paper=rows.find(p=>p.id===data.session_id);if(!paper)return null;
  const attemptKey=key+':'+paper.id,content=text=>({text,media:[]});
  if(!attempts.has(attemptKey)){
   const document={title:paper.title+'・本機示範題',questions:Array.from({length:paper.total},(_,i)=>({id:'q'+(i+1),type:'single',prompt:content(`第${i+1}道合成示範題：${i+1}＋1＝？`),material:content('這是操作示範題，不是正式題庫內容。'),options:[{id:'a',content:content(String(i+2))},{id:'b',content:content(String(i+3))}]}))};
   const state={attempt_id:'synthetic-'+paper.id,version_id:'synthetic-v1',status:'open',complete:false,document,responses:{},reviews:[],leaf:{reason:'not_eligible'}};
   for(let i=0;i<paper.answered;i++){const id='q'+(i+1),correct=i<paper.correct;state.responses[id]=correct?'a':'b';state.reviews.push({question_id:id,correct,answer:{option_id:'a'},explanation:content('把兩個數量加起來，就能算出答案。')});}attempts.set(attemptKey,state);
  }
  const state=attempts.get(attemptKey);if(body.p_action==='view_question')return {};
  if(body.p_action==='submit'){state.responses[data.question_id]=data.response;state.reviews=state.reviews.filter(r=>r.question_id!==data.question_id);state.reviews.push({question_id:data.question_id,correct:data.response==='a',answer:{option_id:'a'},explanation:content('把兩個數量加起來，就能算出答案。')});paper.answered=Object.keys(state.responses).length;paper.correct=state.reviews.filter(r=>r.correct).length;state.complete=paper.answered===paper.total;}
  return state;
 }
 if(route.includes('quiz_past_action')&&body.p_action==='list')return {papers:[{id:'synthetic',grade,enabled:true,title:'合成期末原卷',catalog:{sourceYear:'113-1',exam:2,subject:'數學',edition:'合成版本',range:'期末範圍'}},{id:'synthetic-unopened',grade,enabled:false,title:'尚未開放合成卷',catalog:{sourceYear:'114-1',exam:2,subject:'自然',edition:'合成版本',range:'期末範圍'}}]};
 return null;
}
