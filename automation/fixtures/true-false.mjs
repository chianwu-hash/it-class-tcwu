import {initPastExamUI} from '/shared/quiz-past-ui.mjs';import {mountPastAnswers} from '/shared/partner-pilot/past-answer.js';import {createReviewLayout} from '/shared/partner-pilot/review-layout.mjs';
const content=text=>({text,media:[]}),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));let ui,serial=0;window.packets=[];
window.loadCase=async(choices)=>{
 ui?.clear();serial++;const group={id:'tf',kind:'single',title:'是非檢查 '+serial,sourceLabel:'1',assets:[],material:'',promptContent:content('合成命題：每一個磁鐵的磁力強弱都相同。'),fields:[{id:'f',points:1,label:'1',text:'判斷',answer:choices[1].id}],choices:choices.map(c=>({...c,content:content(c.text)}))};
 const root=document.querySelector('#personal');root.innerHTML='<div id="score"></div><div id="progress"></div><div id="practice-progress"></div><div id="steps"></div><div id="workspace"></div><div id="status"></div><button id="restart">重新作答</button>';
 ui=initPastExamUI({root,request:async(path,packet)=>{packets.push({path,packet});throw Error('synthetic_capture_only');},resolveAsset:async x=>x,onView(){}});ui.load({attemptId:'synthetic-attempt',version:'synthetic-version',groups:[group],records:{},summary:{answered:0,total:1,max:1,score:0}});
 const q={id:1,number:1,title:group.title,text:group.promptContent.text,options:choices.map(c=>c.text),correct:null,past:{kind:'single',group:'tf',choices},owner:'a',ownerName:'合成夥伴',attempts:[],rich:{material:content(''),prompt:group.promptContent,options:choices.map(c=>content(c.text)),explanation:content('合成解析')}};
 window.drafts=new Map();const partner=document.querySelector('#partner');partner.innerHTML='<div data-past-answer="1"></div>';mountPastAnswers(partner,{question:()=>q,drafts,loadAsset:async x=>x});
 const room={capacity:2,members:[{id:'a',name:'甲'},{id:'b',name:'乙'}],paper:'合成卷',paperInfo:{title:'合成卷',past:true},exercise:{shared:[q],notes:[],reviewers:[],finished:false,total:1,correct:1,gradedTotal:1}};
 const layout=createReviewLayout({esc,getRoom:()=>room,getViewer:()=>({id:'a'}),fragment:(q,p,i)=>esc(p==='option'?q.options[i]:q.rich[p]?.text||''),marks:()=>'',stories:()=>'',drafts:new Map(),capture(){},rerender(){},onBook(){},onFinish(){},getMarkedOnly:()=>false,setMarkedOnly(){},isLocked:()=>false});document.querySelector('#review').innerHTML=layout.html();
 window.teacherFixture={paper:{title:'合成卷',enabled:true,active_version:'synthetic-version'},document:{groups:[group],blocked:[]},provenance:{sourceFiles:[],entries:[],issues:[]}};
 document.querySelector('#teacher-paper').dispatchEvent(new Event('change'));
 return serial;
};
await loadCase([{id:'O',text:'O'},{id:'X',text:'X'}]);await import('/shared/quiz-past-teacher.mjs');window.ready=true;
