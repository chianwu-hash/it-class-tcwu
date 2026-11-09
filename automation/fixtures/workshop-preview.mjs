import {workshopCourses} from '/shared/quiz-workshop-config.mjs';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
const labels={quiz:'一般答題',past:'個人考古題',partner:'夥伴練功'};
const state={grade:workshopCourses.some(c=>c.grade===Number(params.get('grade')))?Number(params.get('grade')):3,mode:labels[params.get('mode')]?params.get('mode'):'quiz',width:['auto','desktop','phone'].includes(params.get('width'))?params.get('width'):'auto',user:params.get('user')==='b'?'b':'a',kind:params.get('kind')==='past'?'past':'normal',namespace:/^preview-[a-zA-Z0-9-]{1,50}$/.test(params.get('preview')||'')?params.get('preview'):'preview-'+crypto.randomUUID()};
for(const course of workshopCourses)$('preview-course').append(new Option(course.school+'・'+course.label,course.grade));
function show(){
 const course=workshopCourses.find(c=>c.grade===state.grade),query=new URLSearchParams({preview:state.namespace,preview_user:state.user});
 let file=state.mode==='quiz'?'quiz.html':state.mode==='past'?'past-exam.html':'partner-practice.html';
 if(state.mode==='quiz'){query.set('cloud','1');query.set('session','00000000-0000-4000-8000-000000000001');}
 if(state.mode==='past')query.set('paper','synthetic');
 if(state.mode==='partner'){query.set('invite','123456');query.set('preview_kind',state.kind);}
 const url=course.basePath+file+'?'+query;
 $('preview-course').value=String(state.grade);$('preview-width').value=state.width;$('preview-user').value=state.user;$('preview-partner-kind').value=state.kind;$('partner-kind-label').hidden=state.mode!=='partner';
 document.querySelectorAll('[data-mode]').forEach(button=>{const active=button.dataset.mode===state.mode;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;});
 $('preview-stage').dataset.width=state.width;$('preview-context').textContent=`${course.school}・${course.label}｜${labels[state.mode]}${state.mode==='partner'?'・'+(state.kind==='past'?'完整原卷題組':'一般單題'):''}｜合成資料，不影響正式紀錄`;
 $('preview-frame').title=course.school+course.label+labels[state.mode]+'合成預覽';$('preview-frame').src=url;$('preview-open').href=url;
 history.replaceState(null,'','?'+new URLSearchParams({grade:state.grade,mode:state.mode,width:state.width,user:state.user,kind:state.kind,preview:state.namespace}));
}
$('preview-course').onchange=event=>{state.grade=Number(event.target.value);show();};
$('preview-width').onchange=event=>{state.width=event.target.value;$('preview-stage').dataset.width=state.width;history.replaceState(null,'','?'+new URLSearchParams({grade:state.grade,mode:state.mode,width:state.width,user:state.user,kind:state.kind,preview:state.namespace}));};
$('preview-user').onchange=event=>{state.user=event.target.value;show();};
$('preview-partner-kind').onchange=event=>{state.kind=event.target.value;show();};
document.querySelectorAll('[data-mode]').forEach(button=>{button.onclick=()=>{state.mode=button.dataset.mode;show();};button.onkeydown=event=>{const buttons=[...document.querySelectorAll('[data-mode]')],index=buttons.indexOf(button);if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?2:(index+(event.key==='ArrowRight'?1:2))%3;buttons[next].focus();buttons[next].click();};});
$('preview-reset').onclick=async()=>{const button=$('preview-reset');button.disabled=true;try{const response=await fetch('/__workshop-rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({route:'reset_preview',grade:state.grade,namespace:state.namespace})});if(!response.ok)throw Error('合成練習尚未重設，請稍後再試。');show();}catch(error){$('preview-context').textContent=error.message;}finally{button.disabled=false;}};
show();
