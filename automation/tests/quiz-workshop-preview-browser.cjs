const {chromium}=require('D:/projects/browser-automation-workflow/node_modules/playwright');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.connectOverCDP(process.env.CDP_URL),page=await browser.contexts()[0].newPage();
 const base=process.env.WORKSHOP_PREVIEW_URL||'http://localhost:8872',checks=[],errors=[],outbound=[];
 const check=(name,ok)=>{checks.push({name,ok:Boolean(ok)});if(!ok)throw Error(name);};
 const click=locator=>locator.evaluate(element=>element.click());
 const wait=(frame,fn)=>frame.waitForFunction(fn,null,{polling:200,timeout:15000});
 const ready=async()=>{await wait(page,()=>document.querySelector('#preview-frame')?.contentDocument?.documentElement?.dataset.workshopReady==='true');return page.frames().find(frame=>frame.url().includes('/grade'));};
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('https://**/*',route=>{const host=new URL(route.request().url()).hostname;if(host.includes('supabase')||route.request().method()!=='GET')outbound.push({host,method:route.request().method()});return route.abort();});
 let current;const stamp=Date.now().toString(36);
 try{
  for(const width of [1280,390])for(const grade of [3,4,6,9])for(const mode of ['quiz','past','partner']){
   await page.setViewportSize({width,height:1000});
   await page.goto(`${base}/?grade=${grade}&mode=${mode}&preview=preview-test-${stamp}-${width}-${grade}-${mode}`);
   const frame=current=await ready();
   check(`${grade}/${mode}/${width}: real course`,await frame.locator('body').getAttribute('data-course')===`grade${grade}-115-1`);
   check(`${grade}/${mode}/${width}: visible synthetic boundary`,await frame.locator('[data-preview-notice]').count()===1);
   if(mode==='quiz'){
    await frame.locator('#server-submit').waitFor();await click(frame.locator('.student-option').last());await click(frame.locator('#server-submit'));
    await frame.locator('.answer-preview[data-correct=false]').waitFor();check(`${grade}/${mode}/${width}: wrong answer and explanation`,(await frame.locator('.answer-preview').textContent()).includes('固定合成解析'));
    await click(frame.locator('.quiz-primary'));await frame.locator('#server-submit').waitFor();await click(frame.locator('.student-option').first());await click(frame.locator('#server-submit'));
    await frame.locator('.answer-preview[data-correct=true]').waitFor();check(`${grade}/${mode}/${width}: next and correct answer`,true);
   }else if(mode==='past'){
    await frame.locator('#submit').waitFor();await click(frame.locator('.student-option').last());await click(frame.locator('#submit'));await frame.locator('.feedback.wrong').waitFor();
    await click(frame.locator('[data-past-next].quiz-primary'));check(`${grade}/${mode}/${width}: original full group`,await frame.locator('.answer-list input').count()===2);
    await click(frame.locator('.answer-list .choice-row').first());await click(frame.locator('#mark-confirm'));await click(frame.locator('#submit'));await wait(frame,()=>document.querySelectorAll('.feedback').length===2);
    check(`${grade}/${mode}/${width}: field-level results`,await frame.locator('.feedback.wrong').count()===1);
   }else{
    await frame.locator('[data-workspace-primary]').waitFor();check(`${grade}/${mode}/${width}: original app opens synthetic room`,await frame.locator('.quiz-reading-panel').count()===1);
    await click(frame.locator('[data-normal-choices] .student-option').last());await click(frame.locator('[data-workspace-primary]'));
    await wait(frame,()=>document.querySelector('[data-workspace-primary]')?.textContent.includes('下一'));
    const packet=await frame.evaluate(()=>window.workshopCalls.filter(call=>call.body.p?.action==='answer').at(-1)?.body.p);
    check(`${grade}/${mode}/${width}: real partner packet`,packet?.qid===1&&packet?.roomId?.includes('synthetic-room'));
    if(grade===4){
     await click(frame.locator('[data-camp-control]'));await frame.locator('#camp-dialog[open]').waitFor();
     await frame.locator('#camp-chat-text').fill('這是本機隔離的合成小紙條。');
     await frame.locator('form[data-form=chat]').evaluate(form=>form.requestSubmit());
     await wait(frame,()=>document.querySelector('.camp-chat-messages')?.textContent.includes('本機隔離'));
     check(`${grade}/${mode}/${width}: actual camp composer`,true);await click(frame.locator('[data-camp-close]'));
    }
    await click(frame.locator('[data-workspace-primary]'));await click(frame.locator('[data-normal-choices] .student-option').first());await click(frame.locator('[data-workspace-primary]'));
    await wait(frame,()=>document.querySelector('[data-workspace-primary]')?.textContent.includes('共同回顧'));await click(frame.locator('[data-workspace-primary]'));
    await frame.locator('.partner-review').waitFor();check(`${grade}/${mode}/${width}: shared review interface`,true);
    await page.locator('#preview-partner-kind').selectOption('past');const past=current=await ready();await past.locator('[data-workspace-primary]').waitFor();
    check(`${grade}/${mode}/${width}: partner preserves complete paper unit`,await past.locator('[data-past-answer]').count()===2);
   }
   check(`${grade}/${mode}/${width}: hub fits`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   check(`${grade}/${mode}/${width}: frame fits`,await current.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  }
  check('no formal outbound request',outbound.length===0);check('no uncaught exceptions',errors.length===0);
 }catch(error){console.error(error.stack);console.error(current?await current.locator('body').innerText().then(text=>text.slice(0,2200)).catch(()=>null):null);process.exitCode=1;}
 finally{fs.mkdirSync('.chat-mode/evidence/workshop-preview',{recursive:true});fs.writeFileSync('.chat-mode/evidence/workshop-preview/browser.json',JSON.stringify({checks,errors,outbound},null,2));console.log(JSON.stringify({checks:checks.length,failed:checks.filter(check=>!check.ok),errors,outbound}));await page.close();await browser.close();}
})();
