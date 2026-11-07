import {createLearningUI} from '/shared/partner-pilot/learning.js';
const c=text=>({text,media:[]}),esc=s=>String(s??'').replace(/[&<>"']/g,v=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[v]));let ui,state;
window.actions=[];
window.loadCase=(status='wrong',kind='single',tf=false)=>{
 ui?.clear();const choices=tf?[{id:'O',text:'O'},{id:'X',text:'X'}]:[{id:'1',text:'水庫可以儲水'},{id:'2',text:'讓船浮在水面'},{id:'3',text:'讓水結冰'}];
 const correct=choices[1].id,selected=status==='right'?correct:choices[0].id,attempts=status==='unanswered'?[]:[{value:selected,choice:0,correct:status==='self'?null:status==='right'}];
 const q={id:1,number:1,title:'合成回饋題',text:'利用水具有浮力的特性，可以幫助我們做什麼？',options:choices.map(x=>x.text),past:kind==='normal'?null:{kind,group:'g',choices,selfCheck:status==='self'},attempts,owner:'me',ownerName:'合成甲',rich:{prompt:c('利用水具有浮力的特性，可以幫助我們做什麼？'),material:c(''),options:choices.map(x=>c(x.text))}};
 if(attempts.length){q.correct=kind==='normal'?1:0;q.pastReference=correct;q.explanation='參考：'+JSON.stringify(correct)+'\n水的浮力能托住船。';q.rich.explanation=c(q.explanation);}
 state={id:'synthetic-feedback',revision:1,team:'合成小隊',paper:'合成卷',capacity:2,started:true,members:[{id:'me',name:'合成甲'},{id:'peer',name:'合成乙'}],paperInfo:{title:'答題回饋合成檢查',kind:'flower',total:2},exercise:{mine:[q],shared:[],notes:[],total:2,submitted:attempts.length,correct:status==='right'?1:0,gradedTotal:2,reviewOpen:false,finished:false,reviewers:[],stories:[],award:null,privateDraft:{state:null,revision:0}}};
 ui=createLearningUI({container:document.querySelector('#app'),esc,onAction:async p=>{actions.push(p);if(p.action==='answer'){q.attempts.push({value:p.value,choice:p.choice,correct:p.value===correct||p.choice===1});q.pastReference=correct;q.correct=kind==='normal'?1:0;q.explanation='參考：'+JSON.stringify(correct)+'\n水的浮力能托住船。';q.rich.explanation=c(q.explanation);state.revision++;ui.committed(p);ui.render(state,{id:'me',name:'合成甲'});}},onHome(){},onRefresh(){},notice(){},onStage:v=>document.querySelector('.partner-content').dataset.stage=v,loadMedia:async()=>{throw Error('no external media in this fixture');}});
 ui.render(state,{id:'me',name:'合成甲'});window.feedbackState=state;return true;
};loadCase();window.ready=true;
