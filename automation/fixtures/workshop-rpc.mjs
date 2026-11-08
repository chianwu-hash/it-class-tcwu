// Synthetic preview only. No production credentials, database or proxy.
const c=(text,media=[])=>({text,media});
const stores=new Map();
const choices=[{id:'O',text:'O',content:c('O')},{id:'X',text:'X',content:c('X')}];
const group=(id,kind,extra={})=>({id,kind,title:'合成題組 '+id,sourceLabel:id,assets:[],material:'',promptContent:c('合成命題：水可以幫助船浮起來。'),fields:[{id:id+'-f',label:'1',text:'第一欄',points:1}],choices:kind==='single'?choices:[],...extra});
function past(grade,user){return {attemptId:`synthetic-${grade}-${user}`,version:'synthetic-v1',title:'共用介面合成驗收卷',identity:{class_code:grade+'01',seat_no:7,display_name:'合成同學',email:user+'@example.invalid'},groups:[
 group('boolean','single'),group('group','mark',{material:'完整保留這份題組的共用材料。',fields:[{id:'mark-a',label:'1',text:'甲敘述',points:1},{id:'mark-b',label:'2',text:'乙敘述',points:1}]}),
 group('math','short',{answerFormat:'math-v1',promptContent:c('計算 $\\frac{1}{2}+\\frac{1}{2}$')}),
 group('media','single',{promptContent:c('觀察圖片並播放合成音檔。',[{kind:'image',url:'https://quiz-media.invalid/00000000-0000-4000-8000-000000000001/'+('a'.repeat(64)),alt:'合成圖'},{kind:'audio',url:'https://quiz-media.invalid/00000000-0000-4000-8000-000000000001/'+('b'.repeat(64)),alt:'合成音檔'}])}),
 group('manual','manual',{assets:[{url:'/__workshop-image.svg',alt:'合成圖'}]}),group('last','single')],records:{},summary:{answered:0,total:7,max:7,score:0},draft:{revision:0,groups:{}},policy:{automaticPoints:7,manualPoints:1,blockedFields:0,blockedPoints:0}};}
function normal(){return {attempt_id:'synthetic-normal',version_id:'synthetic-v1',status:'open',complete:false,document:{title:'合成普通練習',questions:[1,2].map(n=>({id:'q'+n,type:'single',prompt:c('水具有什麼特性？'),material:c(''),options:[{id:'a',content:c('浮力')},{id:'b',content:c('磁力')}]}))},responses:{},reviews:[],leaf:{reason:'not_eligible'}};}
export function fixtureRPC({route,body,grade,user='a'}){
 if(route==='reset'){stores.clear();return {};}
 const key=grade+':'+user;
 if(!stores.has(key))stores.set(key,{past:past(grade,user),normal:normal()});
 const store=stores.get(key),action=body.p_action||body.p?.action,data=body.p_data||body.p||{};
 if(route.includes('/quiz-media'))return {url:body.url.endsWith('a'.repeat(64))?'/__workshop-image.svg':'/__workshop-audio.wav'};
 const identity={class_code:grade+'01',seat_no:7,display_name:'合成同學',email:user+'@example.invalid'};
 if(route.includes('quiz_partner_match_action'))return {enabled:false,available:false};
 if(route.includes('quiz_partner_pilot_action')){
  if(action==='me')return {id:user,name:'合成同學',rooms:[]};if(action==='catalog')return {papers:[]};
 }
 if(route.includes('quiz_entry_context'))return {role:'student',grade,identity,subject:'自然'};
 if(route.includes('quiz_library_sessions'))return {role:'student',grade,identity,sessions:[]};
 if(route.includes('quiz_pool_catalog'))return {subjects:[],units:[]};
 if(route.includes('quiz_learning'))return {enabled:false};
 if(route.includes('quiz_question_report'))return {id:'synthetic-report'};
 if(route.includes('quiz_past_action')){
  if(action==='list')return {papers:[]};
  const state=store.past;
  if(action==='view')return {};
  if(action==='save_draft'){state.draft={revision:state.draft.revision+1,groups:data.groups,currentGroup:data.current_group,updatedAt:new Date().toISOString()};return state.draft;}
  if(action==='restart'){store.past=past(grade,user);return store.past;}
  if(action==='submit'){
   if(state.records[data.group_id])return state;
   const g=state.groups.find(g=>g.id===data.group_id),manual=g.kind==='manual';
   state.records[g.id]={responses:data.responses,score:1,results:manual?[]:data.responses.map(r=>({questionId:r.questionId,correct:r.value==='O'||r.value===true,official:g.kind==='mark'?true:'O'})),reference:manual?'這題採自我核對，不計分。':null,learningExplanations:manual?[]:[{text:'固定合成解析：水的浮力可以托住船。'}]};
   state.summary.answered+=g.fields.length;return state;
  }
  if(['start','resume'].includes(action))return state;
 }
 if(route.endsWith('/quiz_action')){
  const state=store.normal;
  if(action==='view_question')return {};
  if(action==='submit'){state.responses[data.question_id]=data.response;state.reviews.push({question_id:data.question_id,correct:data.response==='a',answer:{option_id:'a'},explanation:c('固定合成解析：水的浮力可以托住船。')});state.complete=Object.keys(state.responses).length===2;}
  return state;
 }
 throw Error('unexpected_fixture_request: '+route+' '+action);
}
