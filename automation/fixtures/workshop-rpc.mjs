// Synthetic preview only. No production credentials, database or proxy.
const c=(text,media=[])=>({text,media});
const stores=new Map();
const studyBook='00000000-0000-4000-8000-000000000099';
const studyHash=n=>String(n).padStart(64,'a');
function withStudy(snapshot,kind,enabled){
 if(!enabled)return snapshot;const next=structuredClone(snapshot),past=kind==='past',refs={},explanations={};
 for(const q of past?next.groups:next.document.questions){
  refs[q.id]={bookId:studyBook,primary:past?114:q.id==='q1'?75:79,references:past?[114,111,4,5]:q.id==='q1'?[75,79,80]:[79,80,81],fields:past?q.fields.map(f=>({questionId:f.id,page:111})):[]};
  if(past?next.records[q.id]:next.reviews.some(r=>r.question_id===q.id))for(const id of past?q.fields.map(f=>f.id):[q.id])explanations[id]={text:past?'先找出兩組實驗相同的條件，再比較不同的地方。':'水流變慢時，帶不動那麼多沙子，沙子就留下來。',origin:'ai'};
 }
 next.study={schema:1,kind,attemptId:past?next.attemptId:next.attempt_id,versionId:past?next.version:next.version_id,packageId:'synthetic-study-v1',pages:[4,5,75,79,81,111,114,115].map(n=>({id:String(n),bookId:studyBook,printedPages:n===79?[79,80]:[n],sequence:n<10?'prerequisites':'unit3-4',url:'https://quiz-media.invalid/'+studyBook+'/'+studyHash(n)})),references:refs,explanations};return next;
}
const choices=[{id:'O',text:'O',content:c('O')},{id:'X',text:'X',content:c('X')}];
const groupTitles={boolean:'是非判斷',group:'整組勾選',math:'數學作答',media:'圖音觀察',manual:'自我核對',last:'綜合練習'};
const group=(id,kind,extra={})=>({id,kind,title:'合成題組・'+groupTitles[id],sourceLabel:String(Object.keys(groupTitles).indexOf(id)+1),assets:[],material:'',promptContent:c('合成命題：水可以幫助船浮起來。'),fields:[{id:id+'-f',label:'1',text:'第一欄',points:1}],choices:kind==='single'?choices:[],...extra});
function past(grade,user){return {attemptId:`synthetic-${grade}-${user}`,version:'synthetic-v1',title:'共用介面合成驗收卷',identity:{class_code:grade+'01',seat_no:7,display_name:'合成同學',email:user+'@example.invalid'},groups:[
 group('boolean','single'),group('group','mark',{material:'完整保留這份題組的共用材料。',fields:[{id:'mark-a',label:'1',text:'甲敘述',points:1},{id:'mark-b',label:'2',text:'乙敘述',points:1}]}),
 group('math','short',{answerFormat:'math-v1',promptContent:c('計算 $\\frac{1}{2}+\\frac{1}{2}$')}),
 group('media','single',{promptContent:c('觀察圖片並播放合成音檔。',[{kind:'image',url:'https://quiz-media.invalid/00000000-0000-4000-8000-000000000001/'+('a'.repeat(64)),alt:'合成圖'},{kind:'audio',url:'https://quiz-media.invalid/00000000-0000-4000-8000-000000000001/'+('b'.repeat(64)),alt:'合成音檔'}])}),
 group('manual','manual',{assets:[{url:'/__workshop-image.svg',alt:'合成圖'}]}),group('last','single')],records:{},summary:{answered:0,total:7,max:6,score:0},draft:{revision:0,groups:{}},policy:{automaticPoints:6,manualPoints:1,blockedFields:0,blockedPoints:0}};}
function normal(){return {attempt_id:'synthetic-normal',version_id:'synthetic-v1',status:'open',complete:false,document:{title:'合成普通練習',questions:[1,2].map(n=>({id:'q'+n,type:'single',prompt:c(n===1?'水具有什麼特性，可以托住船？':'計算 $\\frac{1}{2}+\\frac{1}{2}$。'),material:c(''),options:[{id:'a',content:c(n===1?'浮力':'1')},{id:'b',content:c(n===1?'磁力':'2')}]}))},responses:{},reviews:[],leaf:{reason:'not_eligible'}};}
function partner(grade,user,kind){
 const own=[1,2].map((id,i)=>({id,number:id,title:kind==='past'?'同一原卷題組・第 '+id+' 欄':'合成夥伴練習・第 '+id+' 題',text:i?'一半加一半等於多少？':'水的浮力可以幫助船浮在水面。',options:kind==='past'?['正確','不正確']:i?['1','2']:['正確','不正確'],attempts:[],owner:user,ownerName:'合成同學',
  past:kind==='past'?{kind:'single',group:'whole-group',choices:[{id:'O',text:'O'},{id:'X',text:'X'}]}:null,
  rich:{prompt:c(i?'一半加一半等於一。':'水的浮力可以幫助船浮在水面。'),material:c(kind==='past'?'這是一組完整的合成原卷材料，兩個欄位保留在同一段，不切成兩份任務。':''),options:kind==='past'?[c('O'),c('X')]:i?[c('1'),c('2')]:[c('正確'),c('不正確')]}}));
 const peer={id:3,number:3,title:'合成夥伴負責的題目',text:'水的浮力可以托住船。',options:['正確','不正確'],attempts:[{choice:0,correct:true}],owner:'peer',ownerName:'合成夥伴',correct:0,explanation:'水的浮力可以托住船。',rich:{prompt:c('水的浮力可以托住船。'),material:c(''),options:[c('正確'),c('不正確')],explanation:c('水的浮力可以托住船。')}};
 return {id:`synthetic-room-${grade}-${user}-${kind}`,revision:1,team:'隔離合成小隊',paper:'synthetic-paper',title:'合成比較練習',capacity:2,host:user,started:true,paused:false,topic:null,
  members:[{id:user,name:'合成同學'},{id:'peer',name:'合成夥伴'}],paperInfo:{title:kind==='past'?'合成原卷完整題組':'合成夥伴單題',kind:'leaf',total:3},
  exercise:{mine:own,shared:[],notes:[],total:3,submitted:1,correct:1,gradedTotal:3,reviewOpen:false,finished:false,reviewers:[{user:'peer',text:'這是合成夥伴的示範回顧。'}],stories:[],award:null,privateDraft:{state:null,revision:0}},_peer:peer};
}
function publicRoom(room){const value=structuredClone(room);delete value._peer;return value;}
export function fixtureRPC({route,body={},grade,user='a',namespace='default',roomKind='normal',study=false}){
 if(route==='reset'){for(const key of stores.keys())if(key.startsWith(namespace+':'))stores.delete(key);return {};}
 if(!/^[a-zA-Z0-9_-]{1,70}$/.test(namespace)||![3,4,6,9].includes(Number(grade)))throw Error('invalid_preview_scope');
 if(route==='reset_preview'){for(const key of stores.keys())if(key.startsWith(namespace+':'+grade+':'))stores.delete(key);return {};}
 const key=namespace+':'+grade+':'+user;
 if(!stores.has(key))stores.set(key,{past:past(grade,user),normal:normal(),partner:{normal:partner(grade,user,'normal'),past:partner(grade,user,'past')}});
 const store=stores.get(key),action=body.p_action||body.p?.action,data=body.p_data||body.p||{};
 if(route.includes('/quiz-media')){
  if(body.action==='textbook'){
   const state=body.kind==='past'?store.past:store.normal,aid=body.kind==='past'?state.attemptId:state.attempt_id;
   if(!study||body.attempt_id!==aid||body.version_id!==(body.kind==='past'?state.version:state.version_id)||!withStudy(state,body.kind,true).study.pages.some(p=>p.url===body.url))throw Error('media_unavailable');
   return {url:'/__workshop-study-page.svg?spread='+String(body.url.endsWith(studyHash(79)))};
  }
  return {url:body.url.endsWith('a'.repeat(64))?'/__workshop-image.svg':'/__workshop-audio.wav'};
 }
 const identity={class_code:grade+'01',seat_no:7,display_name:'合成同學',email:user+'@example.invalid'};
 if(route.includes('quiz_partner_match_action'))return {enabled:false,available:false};
 if(route.includes('quiz_partner_pilot_action')){
  const room=store.partner[roomKind==='past'?'past':'normal'];
  if(action==='me')return {id:user,name:'合成同學',rooms:[{...publicRoom(room),phase:room.exercise.finished?'completed':'active',finished:room.exercise.finished,progress:{submitted:room.exercise.submitted,total:room.exercise.total,correct:room.exercise.correct,gradedTotal:3,reviewed:room.exercise.reviewers.length}}]};
  if(action==='catalog')return {papers:[]};
  if(action==='lookup')return {id:room.id,started:true,count:2,capacity:2};
  if(action==='snapshot')return publicRoom(room);
  if(action==='answer'){
   const q=room.exercise.mine.find(q=>q.id===data.qid);if(!q)throw Error('INVALID_QUESTION');
   const correct=q.past?data.value==='O':data.choice===0;
   q.attempts.push(q.past?{value:data.value,correct}:{choice:data.choice,correct});q.correct=0;q.pastReference=q.past?'O':undefined;q.explanation='合成固定解析：'+(q.id===1?'浮力可以托住船。':'一半加一半等於一。');q.rich.explanation=c(q.explanation);
   room.exercise.submitted=1+room.exercise.mine.filter(q=>q.attempts.length).length;room.exercise.correct=1+room.exercise.mine.filter(q=>q.attempts.at(-1)?.correct).length;room.exercise.reviewOpen=room.exercise.submitted===3;room.exercise.shared=room.exercise.reviewOpen?[...room.exercise.mine,room._peer]:[];
  }else if(action==='save_draft'){room.exercise.privateDraft={state:data.state,revision:room.exercise.privateDraft.revision+1};}
  else if(['chat','ask','reply','mark','discuss'].includes(action))room.exercise.notes.push({id:room.exercise.notes.length+1,kind:action,user,name:'合成同學',text:data.text||'',qid:data.qid,thread:data.thread,tag:data.tag,attachments:[]});
  else if(action==='review'){
   room.exercise.reviewers=room.exercise.reviewers.filter(r=>r.user!==user).concat({user,text:data.text||''});room.exercise.finished=room.exercise.reviewers.length===2;
   room.exercise.stories=[{user,name:'合成同學',lines:['完成合成練習與回顧。']}];
  }else if(action==='read_notes')return publicRoom(room);
  else if(!['finish','settle'].includes(action))throw Error('unsupported_preview_partner_action:'+action);
  room.revision++;return publicRoom(room);
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
   if(state.records[data.group_id])return withStudy(state,'past',study);
   const g=state.groups.find(g=>g.id===data.group_id),manual=g.kind==='manual';
   const official=g.kind==='mark'?true:g.answerFormat==='math-v1'?'1':'O';
   const results=manual?[]:data.responses.map(r=>({questionId:r.questionId,correct:(typeof r.value==='object'?r.value?.answer:r.value)===official,official}));
   const score=results.filter(r=>r.correct).length;
   state.records[g.id]={responses:data.responses,score,results,reference:manual?'這題採自我核對，不計分。':null,learningExplanations:manual?[]:[{text:g.answerFormat==='math-v1'?'固定合成解析：一半加一半等於一。':'固定合成解析：水的浮力可以托住船。'}]};
   state.summary.answered+=g.fields.length;state.summary.score+=score;return withStudy(state,'past',study);
  }
  if(['start','resume'].includes(action))return withStudy(state,'past',study);
 }
 if(route.endsWith('/quiz_action')){
  const state=store.normal;
  if(action==='view_question')return {};
  if(action==='submit'){state.responses[data.question_id]=data.response;state.reviews.push({question_id:data.question_id,correct:data.response==='a',answer:{option_id:'a'},explanation:c('固定合成解析：水的浮力可以托住船。')});state.complete=Object.keys(state.responses).length===2;}
  return withStudy(state,'normal',study);
 }
 throw Error('unexpected_fixture_request: '+route+' '+action);
}
