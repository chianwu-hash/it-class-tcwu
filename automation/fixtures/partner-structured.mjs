import {createLearningUI} from '../../shared/partner-pilot/learning.js';
const content=text=>({text,media:[]}),options=[{id:'a',content:content('甲')},{id:'b',content:content('乙')}];
const field=(id,input,extra={})=>({id,label:'原題答案',input,...extra});
const definitions=[
 {type:'fields',fields:[field('choice','single',{options})],answer:{format:'fields-v1',fields:{choice:['b']}}},
 {type:'fields',fields:[field('check','set',{options})],answer:{format:'fields-v1',fields:{check:[['a']]}}},
 {type:'fields',fields:[field('order','sequence',{options})],answer:{format:'fields-v1',fields:{order:[['b','a']]}}},
 {type:'fields',fields:[field('x','text'),field('y','math')],answer:{format:'fields-v1',fields:{x:['甲'],y:['1/2']}}},
 {type:'short',answer:{accepted:['合成答案']}},
 {type:'open',fields:[field('write','text')],answer:{format:'self-review-v1',fields:{write:{examples:['合成例答'],criteria:['符合題意']}}}}
];
const make=(id,n)=>{const d=definitions[n],{answer,...normal}=d;return {id,number:id,title:'隔離合成題'+id,text:'請依題意作答。',options:[],normal:{...normal,id:'synthetic'+id,prompt:content('請依題意作答。')},rich:{material:content(''),prompt:content('請依題意作答。'),options:[]},attempts:[],owner:'me',ownerName:'合成學生'};};
const seed=()=>({id:'synthetic-room',revision:1,team:'合成小隊',paper:'synthetic',capacity:2,started:true,allocationVersion:1,members:[{id:'me',name:'合成學生',character:'小鹿'},{id:'peer',name:'合成夥伴',character:'松鼠'}],paperInfo:{title:'隔離題型驗收',kind:'leaf',total:10,real:false},exercise:{mine:definitions.map((_,i)=>make(i+1,i)),shared:[],notes:[],total:6,submitted:0,correct:0,gradedTotal:5,reviewOpen:false,finished:false,reviewers:[],stories:[],award:null,privateDraft:{state:null,revision:0}}});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state=seed(),actions=[],saved=null;
const viewer={id:'me',name:'合成學生'};
const ui=createLearningUI({container:document.querySelector('#app'),esc,notice:text=>{document.querySelector('#status').textContent=text;},onAction:async p=>{
 actions.push(structuredClone(p));
 if(p.action==='answer'){
  const q=state.exercise.mine.find(q=>q.id===p.qid);if(q.attempts.length!==p.expectedAttempt)throw Error('ANSWER_CHANGED');
  q.attempts.push({choice:-1,value:p.response,correct:q.normal.type==='open'?null:true,at:new Date().toISOString()});
  q.normalReference=definitions[q.id-1].answer;q.explanation='合成解析';q.rich.explanation=content(q.explanation);
 }else if(p.action==='save_draft'){saved=structuredClone(p.state);state.exercise.privateDraft={state:saved,revision:state.exercise.privateDraft.revision+1};}
 else if(p.action==='review'){state.exercise.reviewers=[{user:'me',name:'合成學生',reflection:p.text},{user:'peer',name:'合成夥伴',reflection:''}];state.exercise.finished=true;}
 ui.committed(p);state.exercise.submitted=state.exercise.mine.filter(q=>q.attempts.length).length;state.exercise.correct=state.exercise.mine.filter(q=>q.attempts.at(-1)?.correct).length;state.exercise.reviewOpen=state.exercise.submitted===6;if(state.exercise.reviewOpen)state.exercise.shared=structuredClone(state.exercise.mine);state.revision++;ui.render(state,viewer);return state;
 },onHome:()=>{},onRefresh:()=>ui.render(state,viewer),onRetry:()=>{},onStage:v=>document.querySelector('.partner-content').dataset.stage=v,loadMedia:async()=>{throw Error('No media requested by synthetic fixture');}});
window.qa={ui,get state(){return state;},get actions(){return actions;},get saved(){return saved;},resume(){ui.clear();ui.render(state,viewer);},reset(){ui.clear();state=seed();actions=[];saved=null;ui.render(state,viewer);}};
ui.render(state,viewer);
