const assert=require('node:assert/strict'),fs=require('node:fs/promises'),{createRequire}=require('node:module');
const runtime=createRequire('D:/projects/cdp-tools/package.json'),{connectCdp,safeScreenshot}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
(async()=>{
 const url=process.env.QUIZ_BROWSER_URL,local=new URL(url).hostname==='127.0.0.1',dir='automation/output/quiz/hanlin-g3-math-pool/qa';
 const {browser}=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl:url,puppeteer:runtime('puppeteer-core')});const report={local,checks:[],errors:[]};
 try{
  const target=browser.targets().find(t=>t._targetId===process.argv[2]);assert.ok(target);const page=await target.page();page.setDefaultTimeout(25000);page.on('pageerror',e=>report.errors.push(e.message));
  const c=await page.target().createCDPSession();c.grantForegroundOnce('Page.bringToFront','核對自組卷與系統預設卷分區、配色及手機畫面');await c.send('Page.bringToFront');
  await page.setViewport({width:1366,height:1000});await page.goto(url,{waitUntil:'networkidle0'});await page.waitForSelector('#my-papers-section:not([hidden]) .paper-card');
  const sections=await page.evaluate(()=>{
   const own=document.getElementById('my-papers-section'),preset=document.getElementById('system-papers-section');
   return {ownColor:getComputedStyle(own).backgroundColor,presetColor:getComputedStyle(preset).backgroundColor,ownCards:own.querySelectorAll('.paper-card').length,presetCards:preset.querySelectorAll('.paper-card').length,ownLabels:[...own.querySelectorAll('.paper-source-label')].every(x=>x.textContent==='自組卷'),presetLabels:[...preset.querySelectorAll('.paper-source-label')].every(x=>x.textContent==='系統預設卷'),nested:own.contains(preset)||preset.contains(own),sameParent:own.parentElement===preset.parentElement};
  });assert.notEqual(sections.ownColor,sections.presetColor);assert.ok(sections.ownLabels&&sections.presetLabels&&sections.sameParent);assert.equal(sections.nested,false);if(!local)assert.ok(sections.presetCards>0);report.sections=sections;report.checks.push('兩個獨立區塊、不同底色、卡片來源標籤');
  await page.$eval('#my-papers-section',e=>e.scrollIntoView());await safeScreenshot(page,{path:dir+`/sections-${local?'local':'production'}-own.png`,fullPage:false});
  await page.$eval('#system-papers-section',e=>e.scrollIntoView());await safeScreenshot(page,{path:dir+`/sections-${local?'local':'production'}-preset.png`,fullPage:false});
  await page.evaluate(()=>[...document.querySelectorAll('.wrong-view-switch button')].find(b=>b.textContent==='我的錯題').click());
  await page.waitForFunction(()=>document.getElementById('my-papers-section').hidden&&document.getElementById('system-papers-section').hidden,{polling:5000});
  await page.waitForFunction(()=>!document.querySelector('.wrong-view-switch button').disabled,{polling:5000});
  await page.evaluate(()=>[...document.querySelectorAll('.wrong-view-switch button')].find(b=>b.textContent==='單元練習').click());assert.equal(await page.$eval('#system-papers-section',e=>e.hidden),false);report.checks.push('錯題頁隱藏兩區，返回後正常恢復');
  await page.setViewport({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await safeScreenshot(page,{path:dir+`/sections-${local?'local':'production'}-mobile.png`,fullPage:false});await page.setViewport({width:1366,height:1000});report.checks.push('手機390px無橫向溢出');
  assert.deepEqual(report.errors,[]);report.passed=true;console.log(JSON.stringify(report));
 }finally{await fs.writeFile(dir+`/sections-${local?'local':'production'}.json`,JSON.stringify(report,null,2),'utf8');await browser.disconnect();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
