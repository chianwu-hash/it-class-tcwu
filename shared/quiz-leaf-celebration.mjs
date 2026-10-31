let active;
export function stopQuizLeafCelebration(){active?.remove();active=null;document.querySelector('.quiz-speed-warning')?.remove();}
export function celebrateQuizLeaf({leaves=1}={}){
 active?.remove();const box=document.createElement('div');box.className='quiz-leaf-celebration';box.dataset.half=String(!leaves);box.setAttribute('role','status');box.setAttribute('aria-live','polite');
 const leaf=document.createElement('span');leaf.className='quiz-earned-leaf';leaf.textContent=leaves?'🌿':'◐';leaf.setAttribute('aria-hidden','true');const title=document.createElement('strong');title.textContent=leaves?`過關了！努力樹長出${leaves}片葉子`:'已累積半片葉子！';const text=document.createElement('p');text.textContent=leaves?'帶著這次找到的線索，繼續練習吧！':'再累積半片，就能讓努力樹長出新葉子。';box.append(leaf,title,text);
 for(let i=0;i<(leaves?12:4);i++){const spark=document.createElement('i');spark.style.setProperty('--i',i);spark.textContent=i%2?'✦':'🍃';spark.setAttribute('aria-hidden','true');box.append(spark);}document.body.append(box);active=box;setTimeout(()=>{box.remove();if(active===box)active=null;},leaves?4500:2800);
}
export function quizReadingWarning(){const old=document.querySelector('.quiz-speed-warning');old?.remove();const box=document.createElement('div');box.className='quiz-speed-warning';box.setAttribute('role','alert');box.textContent='請看清題目和選項再作答。答案還沒送出，請稍後再按送出。';document.body.append(box);setTimeout(()=>box.remove(),5000);}
