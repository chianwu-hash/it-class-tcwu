const assert=require('node:assert/strict'),fs=require('node:fs/promises'),{createRequire}=require('node:module');
const runtime=createRequire('D:/projects/cdp-tools/package.json'),{connectCdp,safeScreenshot}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
(async()=>{
 const url=process.env.QUIZ_BROWSER_URL,local=new URL(url).hostname==='127.0.0.1',dir='automation/output/quiz/hanlin-g3-math-pool/qa';
 const {browser}=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl:url,puppeteer:runtime('puppeteer-core')});const report={local,checks:[],errors:[]};
 try{
  const target=browser.targets().find(t=>t._targetId===process.argv[2]);assert.ok(target);const page=await target.page();page.setDefaultTimeout(25000);page.on('pageerror',e=>report.errors.push(e.message));
  const c=await page.target().createCDPSession();c.grantForegroundOnce('Page.bringToFront','測試命名、自動儲存、立即更新自組卷清單與接續');await c.send('Page.bringToFront');
  await page.setViewport({width:1280,height:950});await page.goto(url,{waitUntil:'networkidle0'});await page.waitForSelector('#compose-name');
  if(!local){const qa=JSON.parse(await fs.readFile('automation/output/quiz/drive-library/qa-session.json','utf8'));assert.ok(await page.evaluate(async uid=>{const a=await import('/shared/auth.js'),s=(await a.supabase.auth.getSession()).data.session;return s?.user.id===uid&&document.querySelector('#auth-status')?.textContent===s?.user.email;},qa.testUserId));}
  const initial='我的分數複習 '+Date.now(),renamed='下次接著練 '+Date.now();
  await page.type('#compose-name',initial);await page.click('#compose-units input[value="8"]');await page.select('#compose-count','5');await page.click('#compose-form button');await page.waitForSelector('#compose-result a');
  assert.match(await page.$eval('#compose-status',e=>e.textContent),/已儲存到「我的自組卷」/);
  const paperUrl=await page.$eval('#compose-result a',e=>e.href),sid=new URL(paperUrl).searchParams.get('session'),selector=`#my-papers article[data-session-id="${sid}"]`;report.session=sid;
  await page.waitForSelector(selector);assert.equal(await page.$eval(selector+' h2',e=>e.textContent),initial);assert.match(await page.$eval(selector,e=>e.textContent),/已保存 0／5/);report.checks.push('未作答即已儲存，清單立即出現命名新卷');
  const input=await page.$(selector+' input');await input.focus();await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.press('Backspace');await input.type(renamed);await page.click(selector+' .paper-rename button');await page.waitForFunction(s=>document.querySelector(s+' [role="status"]').textContent.includes('名稱已儲存'),{polling:5000},selector);
  await page.reload({waitUntil:'networkidle0'});await page.waitForSelector(selector);assert.equal(await page.$eval(selector+' h2',e=>e.textContent),renamed);report.checks.push('改名並重整後仍在我的自組卷');
  await page.goto(paperUrl,{waitUntil:'networkidle0'});await page.waitForSelector('#server-submit');assert.equal(await page.$eval('.quiz-heading h2',e=>e.textContent),renamed);
  const order=await page.$$eval('.student-option input',xs=>xs.map(x=>x.value));await page.click('.student-option input');await page.click('#server-submit');await page.waitForSelector('.answer-preview');
  await page.goto(url,{waitUntil:'networkidle0'});await page.waitForSelector(selector);assert.match(await page.$eval(selector,e=>e.textContent),/已保存 1／5/);
  await page.click(selector+' .paper-start');await page.waitForSelector('#server-submit');assert.match(await page.$eval('.question h3',e=>e.textContent),/第 2 題/);report.checks.push('改名卷可送答、保存1題，返回可接續第2題');
  report.optionCount=order.length;
  await page.goto(url,{waitUntil:'networkidle0'});await page.waitForSelector(selector);await page.$eval('#my-papers-section',e=>e.scrollIntoView());await safeScreenshot(page,{path:dir+(local?'/named-local.png':'/named-production.png'),fullPage:false});
  await page.setViewport({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));report.checks.push('手機390px無溢出');await page.setViewport({width:1280,height:950});
  assert.deepEqual(report.errors,[]);report.passed=true;console.log(JSON.stringify(report));
 }finally{await fs.writeFile(dir+(local?'/named-local.json':'/named-production.json'),JSON.stringify(report,null,2),'utf8');await browser.disconnect();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
