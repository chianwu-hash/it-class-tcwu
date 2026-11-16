const {chromium}=require('D:/projects/browser-automation-workflow/node_modules/playwright');
const fs=require('node:fs');
(async()=>{
 const b=await chromium.connectOverCDP(process.env.CDP_URL,{timeout:15000});let p;
 const results=[],errors=[],out=process.env.QUIZ_STRUCTURED_OUT;
 const check=(name,ok)=>{results.push({name,ok});if(!ok)throw Error(name);};
 try{
  p=b.contexts()[0].pages().find(x=>x.url()===JSON.parse(fs.readFileSync(out+'/browser-url.private.json')).url);if(!p)throw Error('exact target missing');
  p.on('pageerror',e=>errors.push(e.message));await p.waitForFunction(()=>window.qa,{timeout:15000});
  const session=await p.context().newCDPSession(p);session.grantForegroundOnce('Page.bringToFront','驗收既有夥伴外層介面中的題型支援');await session.send('Page.bringToFront');
  const click=s=>p.locator(s).evaluate(e=>{e.focus();e.click();});
  for(const width of [1366,390]){
   await p.setViewportSize({width,height:900});await p.evaluate(()=>qa.reset());
   check(width+' 原本固定送出按鈕',await p.locator('[data-workspace-primary]').evaluate(e=>e.closest('footer')&&getComputedStyle(e.closest('footer')).position==='fixed'));
   check(width+' 無內層送出',await p.locator('form[data-form=answer] button').evaluateAll(es=>es.every(e=>e.hidden)));
   await click('[data-workspace-primary]');check(width+' 未完成不送出',await p.evaluate(()=>qa.actions.length===0));
   await click('[data-structured-answer="1"] input[value="b"]');await click('[data-workspace-primary]');
   check(width+' 舊單欄回應與一次送出',await p.evaluate(()=>qa.actions.length===1&&JSON.parse(qa.actions[0].response).f.choice==='b'));
   check(width+' 揭露後有參考答案',await p.locator('[data-structured-reference]').textContent().then(t=>t.includes('乙')));
   await click('[data-workspace-primary]');
   check(width+' 保留勾選介面',await p.locator('[data-structured-answer="2"] input[type=checkbox]').count()===3);
   check(width+' 全不選初始不預選',await p.locator('[data-structured-answer="2"] input[type=checkbox]:checked').count()===0);
   await click('[data-structured-answer="2"] input[type=checkbox] >> nth=0');await click('[data-workspace-primary]');
   check(width+' 勾選仍為集合回應',await p.evaluate(()=>JSON.stringify(JSON.parse(qa.actions.at(-1).response).f.check)==='["a"]'));
   await click('[data-workspace-primary]');
   await p.locator('[data-structured-answer="3"] select').nth(0).selectOption('b');await p.locator('[data-structured-answer="3"] select').nth(1).selectOption('a');await click('[data-workspace-primary]');
   check(width+' 排序順序保留',await p.evaluate(()=>JSON.stringify(JSON.parse(qa.actions.at(-1).response).f.order)==='["b","a"]'));
   await click('[data-workspace-primary]');
   await p.locator('[data-structured-answer="4"] input[type=text]').nth(0).fill('甲');await p.locator('[data-structured-answer="4"] input[type=text]').nth(1).fill('1/2');await click('[data-workspace-primary]');
   check(width+' 多欄整組一次送出',await p.evaluate(()=>{const v=JSON.parse(qa.actions.at(-1).response).f;return v.x==='甲'&&v.y==='1/2';}));
   await click('[data-workspace-primary]');await p.locator('[data-structured-answer="5"] textarea').fill('合成答案');await click('[data-workspace-primary]');
   await click('[data-workspace-primary]');await p.locator('[data-structured-answer="6"] textarea').fill('我的想法');await click('[data-workspace-primary]');
   check(width+' 開放題不自動判對錯',await p.evaluate(()=>qa.state.exercise.mine[5].attempts.at(-1).correct===null));
   check(width+' 開放題參考與檢核',await p.locator('[data-structured-reference]').textContent().then(t=>t.includes('合成例答')&&t.includes('符合題意')));
   check(width+' 正確送出六次',await p.evaluate(()=>qa.actions.filter(x=>x.action==='answer').length===6));
   check(width+' 無水平溢出',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await p.screenshot({path:out+'/structured-'+width+'.png',fullPage:false});
   await click('[data-workspace-primary]');check(width+' 沿用共同回顧',await p.locator('.partner-review').count()===1);
   if(width===1366)await new Promise(r=>setTimeout(r,10500));
  }
  await p.evaluate(async()=>{
   qa.ui.clear();document.querySelector('#app').innerHTML='<div id="my-papers">'+['midterm','final'].map(id=>'<article class="paper-card" data-session-id="'+id+'"><a class="paper-start" href="quiz.html?session='+id+'">開始練功</a></article>').join('')+'</div>';
   await import('./shared/quiz-partner-pilot-entry.mjs');
  });
  await p.waitForSelector('[data-session-id="final"] .partner-paper-start');
  check('期中及期末使用相同入口裝飾',await p.locator('#my-papers .partner-paper-start').count()===2);
  check('夥伴按鈕深青綠白字',await p.locator('[data-session-id="final"] .partner-paper-start').evaluate(e=>getComputedStyle(e).backgroundColor==='rgb(15, 118, 110)'&&getComputedStyle(e).color==='rgb(255, 255, 255)'));
  await p.evaluate(()=>{const c=document.createElement('article');c.className='paper-card';c.dataset.sessionId='new';c.innerHTML='<a class="paper-start" href="quiz.html?session=new">開始練功</a>';document.querySelector('#my-papers').append(c);document.dispatchEvent(new Event('quiz-paper-saved'));});
  await p.waitForSelector('[data-session-id="new"] .partner-paper-start');
  check('新組卷不重整即補按鈕',await p.locator('#my-papers .partner-paper-start').count()===3);
  check('沒有未捕捉錯誤',errors.length===0);
 }catch(e){results.push({failure:e.message});process.exitCode=1;}
 finally{fs.writeFileSync(out+'/browser-proof.private.json',JSON.stringify({results,errors,real_oauth:false,production_writes:false},null,2));console.log(JSON.stringify({passed:results.filter(x=>x.ok).length,failures:results.filter(x=>!x.ok),errors}));if(p)await p.close();await b.close();}
})();
