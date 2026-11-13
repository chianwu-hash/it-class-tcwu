const frame=document.getElementById('preview'),scenario=document.getElementById('scenario'),grade=document.getElementById('grade');
const load=()=>{frame.src=`/grade${grade.value}/115-1/quiz-library.html?preview_home=1&preview=preview-home-user-review&preview_case=${scenario.value}`;};
for(const id of ['desktop','phone'])document.getElementById(id).onclick=()=>{frame.classList.toggle('phone',id==='phone');for(const name of ['desktop','phone'])document.getElementById(name).setAttribute('aria-pressed',String(name===id));};
scenario.onchange=grade.onchange=load;load();
