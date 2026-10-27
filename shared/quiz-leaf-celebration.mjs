let active;
export function stopQuizLeafCelebration(){active?.remove();active=null;document.querySelector('.quiz-speed-warning')?.remove();}
export function celebrateQuizLeaf(){
 active?.remove();const box=document.createElement('div');box.className='quiz-leaf-celebration';box.setAttribute('role','status');box.setAttribute('aria-live','polite');
 const leaf=document.createElement('span');leaf.className='quiz-earned-leaf';leaf.textContent='🌿';leaf.setAttribute('aria-hidden','true');const title=document.createElement('strong');title.textContent='過關了！努力樹長出1片葉子';const text=document.createElement('p');text.textContent='帶著這次找到的線索，繼續練習吧！';box.append(leaf,title,text);
 for(let i=0;i<12;i++){const spark=document.createElement('i');spark.style.setProperty('--i',i);spark.textContent=i%2?'✦':'🍃';spark.setAttribute('aria-hidden','true');box.append(spark);}document.body.append(box);active=box;setTimeout(()=>{box.remove();if(active===box)active=null;},4500);
}
export function quizReadingWarning(){const old=document.querySelector('.quiz-speed-warning');old?.remove();const box=document.createElement('div');box.className='quiz-speed-warning';box.setAttribute('role','alert');box.textContent='請看清題目和選項再作答。答案還沒送出，請稍後再按送出。';document.body.append(box);setTimeout(()=>box.remove(),5000);}
