const {chromium}=require('D:/projects/browser-automation-workflow/node_modules/playwright');const fs=require('node:fs');
(async()=>{const b=await chromium.connectOverCDP(process.env.CDP_URL,{aiTargetIds:[process.argv[2]]}),p=b.contexts()[0].pages()[0],checks=[],errors=[];p.on('pageerror',e=>errors.push(e.message));const check=(name,ok)=>{checks.push({name,ok});if(!ok)throw Error(name);};
try{
 if(!p.url().startsWith('http://localhost:8857/'))throw Error('wrong target');await p.waitForFunction(()=>window.ready,null,{polling:100,timeout:12000});
 for(const status of['wrong','right']){
 await p.evaluate(s=>loadCase(s),status);
 check(status+' retains every option',await p.locator('.quiz-reading-panel .student-option').count()===3);
 check(status+' submitted options locked',await p.locator('.quiz-reading-panel input[type=radio]:disabled').count()===3);
 check(status+' correct option green',await p.locator('.student-option[data-result=correct] .option-body').textContent()==='讓船浮在水面');
 check(status+' visible outcome title',(await p.locator('.partner-answer-feedback strong').textContent()).includes(status==='right'?'答對了':'還沒答對'));
 check(status+' full reference shown',(await p.locator('.feedback-reference').textContent()).includes('2・讓船浮在水面'));
 check(status+' raw reference removed',!(await p.locator('.feedback-explanation').textContent()).includes('參考：'));
 check(status+' explanation preserved',(await p.locator('.feedback-explanation').textContent()).includes('水的浮力能托住船'));
 check(status+' feedback has colored card',await p.locator('.partner-answer-feedback').evaluate((e,s)=>getComputedStyle(e).backgroundColor===(s==='right'?'rgb(239, 249, 242)':'rgb(255, 246, 233)'),status));
 if(status==='wrong'){
 check('wrong selected option orange',(await p.locator('.student-option[data-result=incorrect] .option-result').textContent()).includes('你的答案'));
 await p.locator('[data-edit]').evaluate(e=>e.click());check('retry unlocks all options',await p.locator('.quiz-reading-panel input[type=radio]:enabled').count()===3);
 await p.locator('.quiz-reading-panel input[type=radio]').nth(1).evaluate(e=>{e.checked=true;e.dispatchEvent(new Event('change',{bubbles:true}));});
 await p.locator('[data-workspace-primary]').evaluate(e=>e.click());await p.waitForFunction(()=>actions.length>0,null,{polling:100,timeout:12000});
 check('retry sends original typed ID',await p.evaluate(()=>actions.at(-1).value==='2'&&actions.at(-1).expectedAttempt===1));
 check('retry retains initial answer',await p.evaluate(()=>feedbackState.exercise.mine[0].attempts.length===2));
 }
 }
 await p.evaluate(()=>loadCase('wrong','single',true));check('TF body not duplicated',JSON.stringify(await p.locator('.student-option .option-body').allTextContents())===JSON.stringify(['正確','不正確']));
 await p.evaluate(()=>loadCase('unanswered'));check('unanswered has no feedback',await p.locator('.partner-answer-feedback').count()===0);check('unanswered has no marked answers',await p.locator('[data-result]').count()===0);
 await p.evaluate(()=>loadCase('wrong','normal'));check('regular choices retained',await p.locator('.student-option').count()===3);check('regular wrong and correct marked',await p.locator('.student-option[data-result=incorrect]').count()===1&&await p.locator('.student-option[data-result=correct]').count()===1);
 await p.evaluate(()=>loadCase('self','short'));check('self check neutral',await p.locator('[data-feedback-state=self-check]').count()===1);check('self check has no automatic correct reference',await p.locator('.feedback-reference').count()===0);
 await p.setViewportSize({width:390,height:844});await p.evaluate(()=>loadCase('wrong'));check('mobile no horizontal overflow',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));check('mobile correct option retained',await p.locator('.student-option[data-result=correct]').count()===1);
 check('no uncaught error',errors.length===0);
}catch(e){checks.push({failure:e.message});process.exitCode=1;}finally{fs.mkdirSync('.chat-mode/answer-feedback',{recursive:true});fs.writeFileSync('.chat-mode/answer-feedback/browser.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({passed:checks.filter(c=>c.ok).length,checks,errors}));await b.close();}})();
