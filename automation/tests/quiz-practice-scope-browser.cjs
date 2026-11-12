// Run through ai-browser/run-background.cjs with its exact leased target.
const {chromium}=require('D:/projects/browser-automation-workflow/node_modules/playwright');
const fs=require('fs'),path=require('path'),out=path.resolve('.chat-mode/scope-local');fs.mkdirSync(out,{recursive:true});
const checks=[],errors=[],base=process.env.SCOPE_PREVIEW_ORIGIN||'http://localhost:8898';
const check=(name,ok)=>{checks.push({name,ok:!!ok});fs.writeFileSync(path.join(out,'progress.json'),JSON.stringify({checks,errors},null,2));if(!ok)throw Error(name)};
(async()=>{const browser=await chromium.connectOverCDP(process.env.CDP_URL);try{
 const pages=browser.contexts().flatMap(c=>c.pages());if(pages.length!==1)throw Error('exact_target_required');const page=pages[0];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());
 const activation=await page.context().newCDPSession(page);activation.grantForegroundOnce('Page.bringToFront','Capture desktop and mobile layouts in this task-owned local scope preview');await activation.send('Page.bringToFront');await activation.detach();
 const wait=fn=>page.waitForFunction(fn,null,{polling:5000,timeout:20000}),click=s=>page.locator(s).first().evaluate(n=>n.click());
 for(const width of [1280,390]){
  await page.setViewportSize({width,height:900});await page.goto(base+'/grade3/115-1/quiz-library.html?preview_scope=1&preview_user=a');await wait(()=>!document.querySelector('#cloud-library').hidden&&document.querySelectorAll('#cloud-papers .paper-card').length>0);
  check(width+'預設期末範圍',await page.locator('[data-scope=after]').getAttribute('aria-pressed')==='true');
  check(width+'期中教師卷不混入本次清單',await page.locator('#cloud-papers [data-session-id=teacher-before]').count()===0);
  check(width+'期末及跨範圍教師卷可見',await page.locator('#cloud-papers [data-session-id=teacher-after],#cloud-papers [data-session-id=teacher-mixed]').count()===2);
  check(width+'未知範圍獨立收納',await page.locator('#cloud-papers .scope-unclassified:not([open]) [data-session-id=teacher-unknown]').count()===1);
  check(width+'舊卷接續入口不被篩掉',(await page.locator('#continue-practice a').getAttribute('href')).includes('teacher-before'));
  await click('[data-scope=before]');check(width+'切回期中保留原進度',(await page.locator('#cloud-papers [data-session-id=teacher-before]').innerText()).includes('3／10'));
  await click('[data-scope=all]');check(width+'全部包含前後教師卷',await page.locator('#cloud-papers [data-session-id=teacher-before],#cloud-papers [data-session-id=teacher-after]').count()===2);
  await click('#tab-past');await click('[data-scope=after]');check(width+'原始學年及期末考次',(await page.locator('#past-papers').innerText()).includes('113上三年級期末數學'));
  check(width+'未開放卷不產生作答連結',await page.locator('#past-unopened a').count()===0&&await page.locator('#past-unopened .paper-card').count()===1);
  await click('[data-scope=before]');check(width+'舊考古卷仍可複習',(await page.locator('#past-papers').innerText()).includes('期中數學')&&await page.locator('#past-papers a').count()===1);
  await click('#tab-mine');await click('[data-scope=after]');check(width+'自組卷依範圍收納',await page.locator('#my-papers [data-session-id=own-after]').count()===1&&await page.locator('#my-papers [data-session-id=own-before]').count()===0);
  await click('[data-scope=all]');check(width+'歷史自組卷保留原連結',(await page.locator('#my-papers [data-session-id=own-before] a.paper-start').getAttribute('href')).includes('own-before'));
  await click('[data-scope=after]');await click('#compose-toggle');await wait(()=>document.querySelectorAll('#compose-units input').length===4);
  check(width+'自組只列已核期中後單元',JSON.stringify(await page.locator('#compose-units input').evaluateAll(ns=>ns.map(n=>n.value)))==='["6","7","8","9"]');
  await page.locator('#compose-units input').first().evaluate(n=>n.click());await click('[data-scope=before]');check(width+'切換範圍不殘留被隱藏的勾選',await page.locator('#compose-units input').count()===5&&await page.locator('#compose-units input:checked').count()===0);
  await click('#compose-toggle');await click('#tab-preset');await click('[data-scope=after]');await page.screenshot({path:path.join(out,'scope-'+width+'.png'),fullPage:true});
  check(width+'無整頁橫向溢出',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  await click('#tab-wrong');check(width+'錯題不受考試範圍隱藏',await page.locator('#practice-scope').isHidden());
  await page.evaluate(()=>window.fixtureSwitch(null));await wait(()=>document.querySelector('#cloud-library').hidden);check(width+'登出清除清單',await page.locator('#cloud-papers .paper-card').count()===0);
  await page.evaluate(()=>window.fixtureSwitch('b'));await wait(()=>!document.querySelector('#cloud-library').hidden);check(width+'換人預設回期末',await page.locator('[data-scope=after]').getAttribute('aria-pressed')==='true');
  check(width+'未呼叫正式作答或刪卷API',await page.evaluate(()=>!window.workshopCalls.some(c=>['submit','delete_paper','rename_paper'].includes(c.body?.p_action))));
 }
 check('無頁面程式錯誤',errors.length===0);fs.writeFileSync(path.join(out,'proof.json'),JSON.stringify({passed:true,synthetic_only:true,widths:[1280,390],checks,errors},null,2));console.log(JSON.stringify({passed:true,checks:checks.length}));
}finally{await browser.close()}})().catch(e=>{fs.writeFileSync(path.join(out,'error.txt'),e.stack);console.error(e.message);process.exitCode=1});
