const assert=require('node:assert/strict'),fs=require('node:fs/promises'),{createRequire}=require('node:module');
const runtime=createRequire('D:/projects/cdp-tools/package.json'),{connectCdp,safeScreenshot}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
(async()=>{
 const url=process.env.QUIZ_BROWSER_URL,local=new URL(url).hostname==='127.0.0.1',dir='automation/output/quiz/hanlin-g3-math-pool/qa',deleting=process.env.QUIZ_DELETE_TEST==='1',size=Number(process.env.QUIZ_PAPER_COUNT||5);
 const {browser}=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl:url,puppeteer:runtime('puppeteer-core')});const report={local,checks:[],errors:[]};
 try{
  const target=browser.targets().find(t=>t._targetId===process.argv[2]);assert.ok(target);const page=await target.page();page.setDefaultTimeout(25000);page.on('pageerror',e=>report.errors.push(e.message));
  const c=await page.target().createCDPSession();c.grantForegroundOnce('Page.bringToFront','測試命名、自動儲存、立即更新自組卷清單與接續');await c.send('Page.bringToFront');
  await page.setViewport({width:1280,height:950});await page.goto(url,{waitUntil:'networkidle0'});await page.waitForSelector('#compose-name');
  if(!local){const qa=JSON.parse(await fs.readFile('automation/output/quiz/drive-library/qa-session.json','utf8'));assert.ok(await page.evaluate(async uid=>{const a=await import('/shared/auth.js'),s=(await a.supabase.auth.getSession()).data.session;return s?.user.id===uid&&document.querySelector('#auth-status')?.textContent===s?.user.email;},qa.testUserId));}
  const initial='我的分數複習 '+Date.now(),renamed='下次接著練 '+Date.now();
  await page.type('#compose-name',initial);for(const u of (size===20?[1,2,3,4,5,6,7,8,9]:[8]))await page.click(`#compose-units input[value="${u}"]`);await page.select('#compose-count',String(size));
  assert.match(await page.$eval('#compose-mix',e=>e.textContent),new RegExp(`${size}題以${size/5}題易、${size*3/5}題中、${size/5}題難`));await page.click('#compose-form button');await page.waitForSelector('#compose-result a');
  assert.match(await page.$eval('#compose-status',e=>e.textContent),/已儲存到「我的自組卷」/);
  const paperUrl=await page.$eval('#compose-result a',e=>e.href),sid=new URL(paperUrl).searchParams.get('session'),selector=`#my-papers article[data-session-id="${sid}"]`;report.session=sid;
  await page.waitForSelector(selector);assert.equal(await page.$eval(selector+' h2',e=>e.textContent),initial);assert.match(await page.$eval(selector,e=>e.textContent),new RegExp(`已作答 0／${size}`));report.paperCount=size;if(size===20)assert.match(await page.$eval('#compose-status',e=>e.textContent),/共20題：易4、中12、難4/);report.checks.push('未作答即已儲存，清單立即出現命名新卷');
  assert.equal(await page.$eval(selector+' .paper-manage',e=>e.open),false);await page.$eval(selector+' .paper-manage',e=>e.open=true);
  const input=await page.$(selector+' input');await input.focus();await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.press('Backspace');await input.type(renamed);await page.click(selector+' .paper-rename button');await page.waitForFunction(s=>document.querySelector(s+' [role="status"]').textContent.includes('名稱已儲存'),{polling:5000},selector);
  await page.reload({waitUntil:'networkidle0'});await page.waitForSelector(selector);assert.equal(await page.$eval(selector+' h2',e=>e.textContent),renamed);report.checks.push('改名並重整後仍在我的自組卷');
  await page.goto(paperUrl,{waitUntil:'networkidle0'});await page.waitForSelector('#server-submit');assert.equal(await page.$eval('.quiz-heading h2',e=>e.textContent),renamed);
  const order=await page.$$eval('.student-option input',xs=>xs.map(x=>x.value));
  if(deleting){const pool=JSON.parse(await fs.readFile('automation/output/quiz/hanlin-g3-math-pool/pool.json','utf8')),id=await page.$eval('.question',e=>e.dataset.questionId),right=pool.find(r=>r.question_id===id).question.answer.option_id;report.questionId=id;await page.click(`.student-option input[value="${order.find(x=>x!==right)}"]`);}else await page.click('.student-option input');
  await page.click('#server-submit');await page.waitForSelector('.answer-preview');
  await page.goto(url,{waitUntil:'networkidle0'});await page.waitForSelector(selector);assert.match(await page.$eval(selector,e=>e.textContent),new RegExp(`已作答 1／${size}`));
  await page.click(selector+' .paper-start');await page.waitForSelector('#server-submit');assert.match(await page.$eval('.question h3',e=>e.textContent),/第 2 題/);report.checks.push('改名卷可送答、儲存1題，返回可接續第2題');
  report.optionCount=order.length;
  await page.goto(url,{waitUntil:'networkidle0'});await page.waitForSelector(selector);
  if(deleting){
   await page.$eval(selector+' .paper-manage',e=>e.open=true);
   page.once('dialog',d=>d.dismiss());await page.click(selector+' .paper-delete');assert.ok(await page.$(selector));report.checks.push('取消刪除仍保留原卷');
   page.once('dialog',async d=>{assert.match(d.message(),/作答與錯題紀錄會保留/);await d.accept();});await page.click(selector+' .paper-delete');await page.waitForFunction(s=>!document.querySelector(s),{polling:5000},selector);assert.match(await page.$eval('#cloud-status',e=>e.textContent),/作答與錯題紀錄已保留/);
   await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('#compose-name');assert.equal(await page.$(selector),null);
   const retained=await page.evaluate(async({local,sid})=>{
    let endpoint='/__quiz-rpc',headers={'Content-Type':'application/json'},body={action:'wrong_questions',data:{action:'list',grade:3}};
    if(local)headers['X-Quiz-Demo-Student']=new URLSearchParams(location.search).get('student');else{const a=await import('/shared/auth.js'),s=(await a.supabase.auth.getSession()).data.session;endpoint=a.SUPABASE_URL+'/rest/v1/rpc/quiz_wrong_questions';headers={...headers,apikey:a.SUPABASE_ANON_KEY,Authorization:'Bearer '+s.access_token};body={p_data:{action:'list',grade:3}};}
    const r=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify(body)}),d=await r.json();return r.ok&&d.items.some(i=>i.session_id===sid);
   },{local,sid});assert.ok(retained);report.checks.push('確認刪除立即移除、重整不再出現，錯題仍保留');report.deleted=true;
  }
  if(deleting&&process.env.QUIZ_USABILITY_TEST==='1'){
   await page.evaluate(()=>[...document.querySelectorAll('.wrong-view-switch button')].find(b=>b.textContent==='我的錯題').click());
   const wrong=`#wrong-list button[data-question-id="${report.questionId}"]`;await page.waitForSelector(wrong);await page.click(wrong);await page.waitForSelector('.wrong-extension button');await page.click('.wrong-extension button');await page.waitForSelector('.wrong-extension a');
   const extensionUrl=await page.$eval('.wrong-extension a',e=>e.href),extensionId=new URL(extensionUrl).searchParams.get('session');report.extension=extensionId;
   await page.goto(url,{waitUntil:'networkidle0'});const card=`#my-papers article[data-session-id="${extensionId}"]`;await page.waitForSelector(card);
   assert.equal(await page.$eval(card+' .paper-source-label',e=>e.textContent),'錯題延伸');const title=await page.$eval(card+' h2',e=>e.textContent);assert.match(title,/^同重點再練：.+/);assert.match(await page.$eval(card+' .paper-range',e=>e.textContent),/^學習重點：.+/);assert.equal(await page.$eval(card+' .paper-manage',e=>e.open),false);
   await page.click(card+' .paper-start');await page.waitForSelector('#server-submit');assert.equal(await page.$eval('.quiz-heading h2',e=>e.textContent),title);assert.match(await page.$eval('.quiz-heading',e=>e.textContent),/已作答 0/);report.checks.push('錯題回看解析後可組延伸卷，來源、學習重點、預設名稱及作答頁一致');
   await page.goto(url,{waitUntil:'networkidle0'});await page.waitForSelector(card);
  }
  await page.$eval('#my-papers-section',e=>e.scrollIntoView());await safeScreenshot(page,{path:dir+(size===20?'/twenty':deleting?'/delete':'/named')+(local?'-local.png':'-production.png'),fullPage:false});
  await page.setViewport({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));report.checks.push('手機390px無溢出');await page.setViewport({width:1280,height:950});
  assert.deepEqual(report.errors,[]);report.passed=true;console.log(JSON.stringify(report));
 }finally{await fs.writeFile(dir+(size===20?'/twenty':deleting?'/delete':'/named')+(local?'-local.json':'-production.json'),JSON.stringify(report,null,2),'utf8');await browser.disconnect();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
