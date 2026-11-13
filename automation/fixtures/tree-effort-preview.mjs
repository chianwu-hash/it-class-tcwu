// Visual acceptance only: the actual my-tree markup and shared help module,
// synthetic summary requests only; original garden/auth bootstrap is not run.
import {createQuizEffortHelp} from '/shared/quiz-effort-help.mjs?v=20261113-effort-help';
const query=new URLSearchParams(location.search),course=document.getElementById('course-select');
let courseId=/^grade[3469]-115-1$/.test(query.get('course'))?query.get('course'):'grade3-115-1',userId='a';
const context=()=>({courseId,userId});
async function readSummary(){
 window.effortPreviewReads=(window.effortPreviewReads||0)+1;if(window.effortPreviewFailNext){window.effortPreviewFailNext=false;throw Error('synthetic_summary_failure');}
 const started={...context()};if(window.effortPreviewDelay){window.effortPreviewDelay=false;await new Promise(resolve=>window.effortPreviewRelease=resolve);}
 const r=await fetch('/__workshop-rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({route:'quiz_learning',body:{p_data:{action:'summary'}},grade:Number(started.courseId.match(/^grade([3469])/)[1]),user:started.userId,namespace:query.get('preview')||'preview-effort-tree',home:true,homeCase:query.get('preview_case')||'returning'})});const data=await r.json();
 return started.userId==='b'?{...data,count:4,leaves:0,remainder:4}:data;
}
const help=createQuizEffortHelp({root:document.getElementById('quiz-effort-help'),getContext:context,readSummary});
window.effortPreviewHelp=help;
for(const grade of [3,4,6,9])course.append(new Option(grade+'年級 115 上',`grade${grade}-115-1`));course.append(new Option('三年級 114 下（歷史課程）','grade3-114-2'));
for(const id of ['login-btn','logout-btn','back-page-btn'])document.getElementById(id).style.display='none';
document.querySelectorAll('.flower-option,#reward-color-mode').forEach(n=>n.disabled=true);
document.getElementById('subtitle').textContent='本機示意：本輪驗收說明區，不模擬正式樹的成長或獎勵。';
document.getElementById('profile-meta').textContent='下方花葉數字不是正式學生資料。';
document.getElementById('leaf-text').textContent='本機呈現示意';document.getElementById('flower-text').textContent='本機呈現示意';
let generation=0;
async function load(){const serial=++generation,c={...context()};help.reset();course.value=courseId;document.getElementById('profile-title').textContent=userId?'合成同學 '+userId.toUpperCase():'尚未登入';
 const grade=courseId.match(/^grade([3469])/)[1],back=document.getElementById('quiz-library-link');back.classList.remove('hidden');back.href=`/grade${grade}/115-1/quiz-library.html?preview_home=1&preview=${encodeURIComponent(query.get('preview')||'preview-effort-tree')}`;document.getElementById('course-home-link').href=back.href;
 if(userId&&courseId.endsWith('115-1')){const summary=await readSummary();if(serial===generation)help.setSummary({...c,summary});}
}
course.onchange=()=>{courseId=course.value;load();};
window.fixtureSwitch=id=>{userId=['a','b'].includes(id)?id:null;load();};
window.fixtureCourse=id=>{courseId=id;load();};
await load();if(query.get('open_help')==='1')document.getElementById('quiz-effort-help').open=true;document.documentElement.dataset.effortPreviewReady='true';
