// Actual entrypoints with synthetic auth/RPC only. Run through the leased shared browser.
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('D:/projects/browser-automation-workflow/node_modules/playwright');
const base=process.env.QUIZ_STUDY_PREVIEW_ORIGIN||'http://localhost:8946',out=process.env.REPORT_TOOLBAR_EVIDENCE||'.chat-mode/report-toolbar';fs.mkdirSync(out,{recursive:true});
const checks=[],errors=[],external=[];let page,reportPackets=[],failNext=true,shotAt=0;
const check=(name,ok,details)=>{checks.push({name,ok:!!ok,...(details?{details}:{})});if(!ok)throw Error(name);},save=x=>fs.writeFileSync(path.join(out,'report-browser.private.json'),JSON.stringify(x,null,2));
(async()=>{try{
 const b=await chromium.connectOverCDP(process.env.CDP_URL);page=b.contexts()[0].pages()[0];if(new URL(page.url()).origin!==base)throw Error('exact leased target required');
 const c=await page.context().newCDPSession(page);try{c.grantForegroundOnce('Page.bringToFront','檢查回報入口桌手機版面與鍵盤焦點');await c.send('Page.bringToFront');}finally{await c.detach();}
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(base+'/'))external.push(r.url());});await page.route('https://**/*',r=>r.abort());
 await page.route('**/__workshop-rpc',async route=>{const p=route.request().postDataJSON();if(p.route?.endsWith('/quiz_question_report')){reportPackets.push(p.body.p_data);if(failNext){failNext=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'合成網路中斷，請重試。'})});return;}}await route.continue();});
 const wait=fn=>page.waitForFunction(fn,null,{polling:100,timeout:20000}),click=s=>page.locator(s).first().evaluate(n=>n.click()),description=()=>page.locator('textarea[aria-label="問題說明"]');
 for(const width of [1280,390,360])for(const mode of ['quiz','past-exam']){
  reportPackets=[];failNext=true;await page.setViewportSize({width,height:844});const p=width+' '+mode+' ';
  const q=new URLSearchParams({preview:'report-'+Date.now(),preview_user:'a',preview_study:'1'});if(mode==='quiz'){q.set('cloud','1');q.set('session','00000000-0000-4000-8000-000000000001');}else q.set('paper','synthetic');
  await page.goto(base+'/grade6/115-1/'+mode+'.html?'+q);await wait(()=>document.querySelector('.quiz-report-toggle'));
  const qid=await page.locator('.question').first().getAttribute('data-question-id');
  check(p+'單一回報入口',await page.locator('.quiz-report-toggle').count()===1);
  check(p+'入口在題目標題列',await page.locator('.quiz-question-toolbar>.quiz-report-toolbar-toggle').count()===1);
  const geometry=await page.locator('.quiz-report-toggle').evaluate(n=>{const r=n.getBoundingClientRect(),h=n.parentElement.getBoundingClientRect(),s=getComputedStyle(n.parentElement);return {right:r.right,parentRight:h.right-parseFloat(s.paddingRight)-parseFloat(s.borderRightWidth),left:r.left,top:r.top,height:r.height,viewport:innerWidth};});
  check(p+'入口靠右且不超出畫面',Math.abs(geometry.right-geometry.parentRight)<3&&geometry.left>=0&&geometry.right<=width&&geometry.height>=32,geometry);
  check(p+'收合時無底部空框',await page.locator('.quiz-question-report').evaluate(n=>n.hidden&&n.getBoundingClientRect().height===0));
  check(p+'計算紙保留',await page.locator('.quiz-scratchpad-entry').count()===1);
  if(mode==='quiz'||width===390){await new Promise(r=>setTimeout(r,Math.max(0,10000-(Date.now()-shotAt))));await page.screenshot({path:path.join(out,'report-'+mode+'-'+width+'.png')});shotAt=Date.now();}
  await click('.quiz-report-toggle');check(p+'展開並聚焦說明',await description().evaluate(n=>n===document.activeElement));
  const formId=await page.locator('.quiz-report-toggle').getAttribute('aria-controls'),text=p+'選項文字需要確認';await description().fill(text);await page.getByRole('combobox',{name:'問題類型',exact:true}).selectOption('options');
  await click('.quiz-report-toggle');check(p+'收合後說明保留',await description().inputValue()===text);await click('.quiz-report-toggle');
  await click('input[type=radio]');await click(mode==='quiz'?'#server-submit':'#submit');await wait(()=>document.querySelector('.answer-preview'));
  check(p+'作答重繪仍只有一個入口',await page.locator('.quiz-report-toggle').count()===1&&await page.locator('.quiz-question-toolbar>.quiz-report-toolbar-toggle').count()===1);
  check(p+'重繪保留回報內容與表單ID',await description().inputValue()===text&&await page.locator('.quiz-report-toggle').getAttribute('aria-controls')===formId&&await page.locator('.quiz-report-toggle').getAttribute('aria-expanded')==='true');
  await page.getByRole('button',{name:'送出回報',exact:true}).evaluate(n=>n.click());await wait(()=>[...document.querySelectorAll('.quiz-question-report [role=status]')].some(n=>n.textContent.includes('合成網路中斷')));
  check(p+'失敗保留說明且允許重試',await description().inputValue()===text&&await page.getByRole('button',{name:'送出回報',exact:true}).isEnabled());
  await page.getByRole('button',{name:'送出回報',exact:true}).evaluate(n=>n.click());await wait(()=>[...document.querySelectorAll('.quiz-question-report [role=status]')].some(n=>n.textContent.includes('回報已送出')));
  check(p+'重試使用同一request_id',reportPackets.length===2&&reportPackets[0].request_id===reportPackets[1].request_id);
  check(p+'回報仍綁定本人題目與模式',reportPackets.every(r=>r.question_id===qid&&r.source===(mode==='quiz'?'quiz':'past')&&r.description===text&&r.category==='options'&&r.attempt_id));
  check(p+'送出成功不再重送',await page.locator('.quiz-question-report button[type=submit]').evaluate(n=>n.hidden));
  await click('.quiz-report-toggle');check(p+'成功後收合仍無空框',await page.locator('.quiz-question-report').evaluate(n=>n.hidden&&n.getBoundingClientRect().height===0));
  await page.evaluate(()=>window.fixtureSwitch(null));await wait(()=>!document.querySelector('.quiz-report-toggle'));check(p+'登出清除回報入口與草稿',await page.locator('.quiz-question-report').count()===0);
  await page.evaluate(()=>window.fixtureSwitch('b'));await wait(()=>document.querySelector('.quiz-report-toggle'));await click('.quiz-report-toggle');check(p+'換人不帶前人內容',await description().inputValue()==='');
 }
 // Full-paper review reuses the same report node under each question's new heading.
 await page.goto(base+'/grade6/115-1/quiz.html?preview=report-full-review&preview_user=a&preview_study=1&cloud=1&session=00000000-0000-4000-8000-000000000001');await wait(()=>document.querySelector('.quiz-report-toggle'));await click('.quiz-report-toggle');await description().fill('整份回看前尚未送出的回報');await click('.quiz-report-toggle');await click('input[type=radio]');await click('#server-submit');await wait(()=>document.querySelector('.answer-preview'));await click('.quiz-actions .quiz-primary');await wait(()=>document.querySelector('.question')?.dataset.questionId==='q2');await click('input[type=radio]');await click('#server-submit');await wait(()=>document.querySelector('.progress-label')?.textContent.includes('2 / 2'));await click('.quiz-actions .quiz-primary');await wait(()=>document.querySelectorAll('.question').length===2);
 check('整份回顧每題只有一個標題列入口',await page.locator('.question .quiz-question-toolbar>.quiz-report-toolbar-toggle').count()===2);
 await page.locator('.question .quiz-report-toggle').first().evaluate(n=>n.click());check('整份回顧保留原題回報草稿',await page.locator('.question').first().locator('textarea[aria-label="問題說明"]').inputValue()==='整份回看前尚未送出的回報');
 check('整份回顧各題表單ID不重複',await page.locator('.quiz-report-toggle').evaluateAll(ns=>new Set(ns.map(n=>n.getAttribute('aria-controls'))).size===ns.length));
 // The old inline component remains available to non-answer-page consumers.
 const inline=await page.evaluate(async()=>{const {createQuestionReport,mountQuestionReport}=await import('/shared/quiz-question-reports.mjs');const host=document.createElement('div'),box=createQuestionReport({request:async()=>{},context:{}});document.body.append(host);mountQuestionReport(host,box);const result=box.contains(box.querySelector('.quiz-report-toggle'))&&!box.hidden&&box.querySelector('form').hidden;host.remove();return result;});check('無標題列的既有內嵌用法保留',inline);
 check('沒有JavaScript錯誤',!errors.length);check('沒有正式後端請求',!external.some(u=>/supabase|workers\.dev/.test(u)));
 save({passed:true,count:checks.length,checks,errors,blockedExternal:external,limitations:['原答題入口與共用回報元件；合成身分與回報API，沒有送出正式回報或學生答案。']});console.log(JSON.stringify({passed:true,count:checks.length}));
 }catch(e){save({passed:false,checks,errors,error:e.message,diagnostic:page?await page.locator('body').innerText().catch(()=>null):null});throw e;}
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
