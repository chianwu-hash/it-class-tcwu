// Run via shared ai-browser/run-background.cjs, never launch another browser.
const {chromium}=require('D:/projects/browser-automation-workflow/node_modules/playwright');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.connectOverCDP(process.env.CDP_URL),page=await browser.contexts()[0].newPage();
 const checks=[],errors=[],remote=[];const base='http://localhost:8868';
 const check=(name,ok)=>{checks.push({name,ok:Boolean(ok)});if(!ok)throw Error(name);};
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://**/*',route=>{remote.push(route.request().url());return route.abort();});
 const originalWait=page.waitForFunction.bind(page);page.waitForFunction=(fn,arg,options={})=>originalWait(fn,arg,{polling:200,timeout:12000,...options});
 const ready=()=>page.waitForFunction(()=>document.documentElement.dataset.workshopReady==='true',null,{timeout:15000,polling:200});
 let lastShot=0;const screenshot=async name=>{if(process.env.WORKSHOP_SKIP_SHOTS==='1')return;const delay=10000-(Date.now()-lastShot);if(delay>0)await new Promise(resolve=>setTimeout(resolve,delay));fs.mkdirSync('.chat-mode/evidence/workshop',{recursive:true});await page.screenshot({path:'.chat-mode/evidence/workshop/'+name+'.png',fullPage:false,timeout:12000});lastShot=Date.now();};
 try{
  await page.request.post(base+'/__workshop-rpc',{headers:{Origin:base},data:{route:'reset'}});
  for(const width of [1280,390])for(const grade of [3,4,6,9]){
   await page.request.post(base+'/__workshop-rpc',{headers:{Origin:base},data:{route:'reset'}});
   await page.setViewportSize({width,height:900});
   for(const mode of ['quiz','past-exam','partner-practice','quiz-library']){
    const query=mode==='quiz'?'?cloud=1&session=00000000-0000-4000-8000-000000000001':mode==='past-exam'?'?paper=synthetic':'';
    await page.goto(`${base}/grade${grade}/115-1/${mode}.html${query}`);await ready();
    check(`${grade}/${mode}/${width}: registered course`,await page.locator('body').getAttribute('data-course')===`grade${grade}-115-1`);
    check(`${grade}/${mode}/${width}: no overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.locator('nav').waitFor();
    check(`${grade}/${mode}/${width}: navbar before content`,await page.evaluate(()=>Boolean(document.querySelector('nav').compareDocumentPosition(document.querySelector('main'))&Node.DOCUMENT_POSITION_FOLLOWING)));
    const map=await page.locator('script[type=importmap]').textContent();
    check(`${grade}/${mode}/${width}: one canonical identity module`,new Set(Object.entries(JSON.parse(map).imports).filter(([key])=>key.includes('/grade6-nav-identity.js')).map(([,value])=>value)).size===1);
    if(mode==='past-exam'){
     await page.locator('#workspace .student-option').first().waitFor();
     check(`${grade}/past/${width}: provided roster label`,(await page.locator('#auth-status').textContent()).includes('合成同學'));
     check(`${grade}/past/${width}: shared frame`,await page.locator('.quiz-workspace-dock').count()===1&&await page.locator('.quiz-explanation-panel').count()===1);
     check(`${grade}/past/${width}: boolean labels`,(await page.locator('.option-badge').allTextContents()).join('')==='○×');
     if(width===1280){
      await page.locator('#workspace .student-option').last().evaluate(e=>e.click());await page.locator('#save-past-draft').evaluate(e=>e.click());
      await page.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('已暫存'));
      await page.reload();await ready();await page.locator('input[value=X]:checked').waitFor({state:'attached'});
      check(`${grade}/past: reload restores isolated draft`,await page.locator('input[value=X]').isChecked());
      if(grade===4)await page.evaluate(()=>window.workshopDropNext=true);
      await page.locator('#submit').evaluate(e=>e.click());
      if(grade===4){
       await page.waitForFunction(()=>document.querySelector('#submit')?.textContent.includes('重試'));
       const original=await page.evaluate(()=>window.workshopCalls.filter(c=>c.body.p_action==='submit').at(-1).body.p_data.request_id);
       await page.locator('#submit').evaluate(e=>e.click());
       check('past uncertain write retries the original request ID',await page.evaluate(()=>{const requests=window.workshopCalls.filter(c=>c.body.p_action==='submit');return requests.at(-1).body.p_data.request_id===requests.at(-2).body.p_data.request_id;})&&Boolean(original));
      }
      await page.locator('.feedback.wrong').waitFor();
      check(`${grade}/past: disclosed fixed explanation`,(await page.locator('.quiz-explanation-panel').textContent()).includes('固定合成解析'));
      check(`${grade}/past: result badges`,await page.locator('.student-option[data-result=correct]').count()===1&&await page.locator('.student-option[data-result=incorrect]').count()===1);
     }
     await page.locator('#steps>button').nth(1).evaluate(e=>e.click());
     check(`${grade}/past/${width}: complete group fields`,await page.locator('.answer-list input').count()===2);
     await page.locator('.answer-list .choice-row').first().evaluate(e=>e.click());await page.locator('#mark-confirm').evaluate(e=>{if(!e.checked)e.click();});await page.locator('#submit').evaluate(e=>e.click());
     await page.waitForFunction(()=>document.querySelectorAll('.feedback').length===2);
     const packet=await page.evaluate(()=>window.workshopCalls.filter(c=>c.body.p_action==='submit').at(-1).body.p_data);
     check(`${grade}/past/${width}: group packet retains IDs`,packet.group_id==='group'&&packet.responses.map(r=>r.questionId).join(',')==='mark-a,mark-b');
     check(`${grade}/past/${width}: feedback keeps field labels`,(await page.locator('.quiz-explanation-panel').textContent()).includes('甲敘述')&&(await page.locator('.quiz-explanation-panel').textContent()).includes('乙敘述'));
     check(`${grade}/past/${width}: next group occupies primary action`,await page.locator('.quiz-workspace-dock [data-past-next].quiz-primary').count()===1);
     if(grade===4)await screenshot('past-exam-'+width);
     await page.locator('#steps>button').nth(2).evaluate(e=>e.click());
     check(`${grade}/past/${width}: math editor`,await page.locator('#workspace').getByText('數學', {exact:false}).count()>0||await page.locator('#workspace input').count()>0);
     await page.locator('#steps>button').nth(3).evaluate(e=>e.click());
     await page.waitForFunction(()=>document.querySelector('#workspace img')?.naturalWidth>0);
     check(`${grade}/past/${width}: media decoded`,await page.locator('#workspace audio').count()===1);
     await page.locator('#steps>button').nth(4).evaluate(e=>e.click());
     check(`${grade}/past/${width}: manual self check`,await page.locator('.manual-response textarea').count()===1);
     check(`${grade}/past/${width}: one dock after navigation`,await page.locator('.quiz-workspace-dock').count()===1);
     await page.evaluate(()=>window.fixtureSwitch('b'));await page.locator('#workspace .student-option').first().waitFor();
     check(`${grade}/past/${width}: other user has no prior answers`,await page.locator('.feedback').count()===0&&await page.locator('input:checked').count()===0);
     await page.evaluate(()=>window.fixtureSwitch(null));await page.locator('#quiz-lock').waitFor({state:'visible'});
     check(`${grade}/past/${width}: logout clears frame`,await page.locator('.quiz-workspace-dock').count()===0);
    }else if(mode==='quiz'){
     await page.locator('#server-quiz .student-option').first().waitFor();
     check(`${grade}/quiz/${width}: provided roster label`,(await page.locator('#auth-status').textContent()).includes('合成同學'));
     await page.locator('#server-quiz .student-option').last().evaluate(e=>e.click());await page.locator('#server-submit').evaluate(e=>e.click());
     await page.locator('.answer-preview').waitFor();
     check(`${grade}/quiz/${width}: shared dock and result`,await page.locator('.quiz-workspace-dock').count()===1&&(await page.locator('.answer-preview').textContent()).includes('固定合成解析'));
     await page.locator('.quiz-primary').evaluate(e=>e.click());await page.locator('#server-submit').waitFor();
     await page.locator('#server-quiz .student-option').first().evaluate(e=>e.click());await page.locator('#server-submit').evaluate(e=>e.click());
     await page.locator('.answer-preview[data-correct=true]').waitFor();
     check(`${grade}/quiz/${width}: next question and correct result`,await page.locator('.student-option[data-result=correct]').count()===1);
     if(grade===4)await screenshot('quiz-'+width);
     await page.evaluate(()=>window.fixtureSwitch('b'));await page.locator('#server-submit').waitFor();
     check(`${grade}/quiz/${width}: user switch clears old results`,await page.locator('.answer-preview').count()===0);
    }else if(mode==='partner-practice'){
     await page.waitForFunction(()=>document.documentElement.dataset.booted==='true');
     check(`${grade}/partner/${width}: real app home`,(await page.locator('#app').textContent()).length>0);
     await page.evaluate(()=>import('/automation/fixtures/partner-feedback.mjs'));
     await page.locator('.quiz-workspace-dock').waitFor();
     check(`${grade}/partner/${width}: same shared frame`,await page.locator('.quiz-reading-panel').count()===1&&await page.locator('.quiz-explanation-panel').count()===1);
     await page.evaluate(()=>window.loadCase('unanswered','normal'));
     await page.locator('[data-normal-choices] .student-option').nth(1).evaluate(e=>e.click());
     await page.locator('[data-workspace-primary]').evaluate(e=>e.click());
     await page.waitForFunction(()=>window.feedbackState.exercise.mine[0].attempts.length===1);
     check(`${grade}/partner/${width}: submit uses partner adapter`,(await page.evaluate(()=>window.actions.at(-1))).action==='answer');
     await page.evaluate(()=>window.loadCase('unanswered','normal'));
     check(`${grade}/partner/${width}: replacement room clears choices`,await page.locator('[data-normal-choices] input:checked').count()===0);
    }else{await page.locator('#cloud-library').waitFor({state:'visible'});check(`${grade}/library/${width}: course subjects`,await page.locator('#subject-filter option').count()===(grade===9?8:6));}
    check(`${grade}/${mode}/${width}: loaded content stays within viewport`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&[...document.querySelectorAll('.quiz-workspace-dock button')].every(button=>{const r=button.getBoundingClientRect();return !r.width||(r.left>=-1&&r.right<=innerWidth+1);}))) ;
    if(grade===4&&mode==='partner-practice')await screenshot(mode+'-'+width);
   }
  }
  check('no uncaught browser exceptions',errors.length===0);
 }catch(error){console.error(error.stack);console.error(await page.evaluate(()=>({dataset:{...document.documentElement.dataset},body:document.body.innerText,resources:performance.getEntriesByType('resource').slice(-12).map(x=>x.name)})).catch(()=>''));await screenshot('failure').catch(()=>{});process.exitCode=1;}
 finally{fs.mkdirSync('.chat-mode/evidence/workshop',{recursive:true});fs.writeFileSync('.chat-mode/evidence/workshop/browser.json',JSON.stringify({checks,errors,remoteBlocked:remote.length},null,2));console.log(JSON.stringify({checks:checks.length,failed:checks.filter(x=>!x.ok),errors}));await page.close();await browser.close();}
})();
