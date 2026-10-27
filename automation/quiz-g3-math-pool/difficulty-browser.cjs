const assert=require('node:assert/strict'),fs=require('node:fs/promises'),{createRequire}=require('node:module');
const runtime=createRequire('D:/projects/cdp-tools/package.json'),{connectCdp,safeScreenshot}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
(async()=>{
 const url=process.env.QUIZ_BROWSER_URL,local=new URL(url).hostname==='127.0.0.1',dir='automation/output/quiz/hanlin-g3-math-pool/qa';
 const {browser}=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl:url,puppeteer:runtime('puppeteer-core')}),report={local,checks:[],papers:[],errors:[]};
 try{
  const target=browser.targets().find(t=>t._targetId===process.argv[2]);assert.ok(target);const page=await target.page();page.setDefaultTimeout(30000);page.on('pageerror',e=>report.errors.push(e.message));
  const c=await page.target().createCDPSession();c.grantForegroundOnce('Page.bringToFront','驗證三種難度、自動補題與雲端接續');await c.send('Page.bringToFront');await page.setViewport({width:1280,height:1000});
  const pool=JSON.parse(await fs.readFile('automation/output/quiz/hanlin-g3-math-pool/pool.json','utf8')),index=new Map(pool.map(q=>[q.question_id,q]));
  await page.goto(url,{waitUntil:'networkidle0'});await page.waitForSelector('#compose-difficulty');
  if(!local){const qa=JSON.parse(await fs.readFile('automation/output/quiz/drive-library/qa-session.json','utf8'));assert.ok(await page.evaluate(async uid=>{const a=await import('/shared/auth.js'),s=(await a.supabase.auth.getSession()).data.session;return s?.user.id===uid&&document.querySelector('#auth-status')?.textContent===s?.user.email;},qa.testUserId));}
  assert.equal(await page.$eval('#compose-difficulty',e=>e.value),'medium');assert.equal(await page.$eval('#compose-count',e=>e.value),'10');
  const cases=[{mode:'easy',unit:9,count:20,actual:[7,13,0],label:'易・基礎練習',missing:'易題'},
   {mode:'medium',unit:4,count:10,actual:[2,7,1],label:'中・綜合練習',missing:'難題'},
   {mode:'hard',unit:8,count:20,actual:[0,15,5],label:'難・進階挑戰',missing:'難題'},
   {mode:'hard',unit:4,count:10,actual:[0,9,1],label:'難・進階挑戰',missing:'難題'}];
  for(const [i,t] of cases.entries()){
   if(i){await page.goto(url,{waitUntil:'networkidle0'});await page.waitForSelector('#compose-difficulty');}
   const title=`難度驗收${t.mode} ${Date.now()}`;await page.type('#compose-name',title);await page.click(`#compose-units input[value="${t.unit}"]`);await page.select('#compose-count',String(t.count));await page.select('#compose-difficulty',t.mode);assert.match(await page.$eval('#compose-mix',e=>e.textContent),new RegExp(t.label));
   await page.click('#compose-form button');await page.waitForSelector('#compose-result a');
   const status=await page.$eval('#compose-status',e=>e.textContent);assert.match(status,new RegExp(`共${t.count}題：易${t.actual[0]}、中${t.actual[1]}、難${t.actual[2]}`));assert.ok(status.includes(t.missing+'較少')&&status.includes('已自動補入中等題'));
   const paperUrl=await page.$eval('#compose-result a',e=>e.href),sid=new URL(paperUrl).searchParams.get('session'),selector=`#my-papers article[data-session-id="${sid}"]`;await page.waitForSelector(selector);assert.match(await page.$eval(selector+' .paper-difficulty',e=>e.textContent),new RegExp(t.label));
   report.papers.push({session:sid,...t});
   await page.reload({waitUntil:'networkidle0'});await page.waitForSelector(selector);assert.match(await page.$eval(selector+' .paper-mix',e=>e.textContent),new RegExp(`易 ${t.actual[0]} 題・中 ${t.actual[1]} 題・難 ${t.actual[2]} 題`));assert.ok((await page.$eval(selector+' .paper-adjustment',e=>e.textContent)).includes(t.missing));
   if(i===2){await page.$eval(selector,e=>e.scrollIntoView());await safeScreenshot(page,{path:dir+`/difficulty-${local?'local':'production'}.png`,fullPage:false});}
   let document;const responseListener=async response=>{if(!response.url().includes(local?'/__quiz-rpc':'/rest/v1/rpc/quiz_action'))return;try{const data=await response.json();if(data.document)document=data.document;}catch{}};page.on('response',responseListener);
   await page.click(selector+' .paper-start');await page.waitForSelector('#server-submit');await page.waitForFunction(()=>document.querySelectorAll('.student-option input').length>0,{polling:5000});page.off('response',responseListener);assert.ok(document);assert.equal(document.questions.length,t.count);
   const rows=document.questions.map(q=>index.get(q.id));assert.ok(rows.every(q=>q?.unit_ids.includes(t.unit)));assert.equal(new Set(rows.map(q=>q.group_key)).size,t.count);assert.deepEqual([-3,0,3].map(d=>rows.filter(q=>q.difficulty===d).length),t.actual);
   if(i===2){const q=await page.$eval('.question',e=>e.dataset.questionId),right=index.get(q).question.answer.option_id;const options=await page.$$eval('.student-option input',xs=>xs.map(x=>x.value));await page.click(`.student-option input[value="${options.find(x=>x!==right)}"]`);await page.click('#server-submit');await page.waitForSelector('.answer-preview[data-correct="false"]');assert.ok((await page.$eval('.answer-preview',e=>e.textContent)).length>10);
    await page.goto(url,{waitUntil:'networkidle0'});await page.waitForSelector(selector);assert.match(await page.$eval(selector,e=>e.textContent),new RegExp(`已作答 1／${t.count}`));await page.click(selector+' .paper-start');await page.waitForSelector('#server-submit');assert.match(await page.$eval('.question h3',e=>e.textContent),/第 2 題/);report.checks.push('難卷答錯後解析、雲端儲存與接續第二題');}
   report.checks.push(`${t.mode}第${t.unit}單元${t.count}題：自動補足且重整保留實際配比`);
  }
  await page.goto(url,{waitUntil:'networkidle0'});await page.waitForSelector('#compose-difficulty');await page.setViewport({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.$eval('#compose-difficulty',e=>e.scrollIntoView({block:'center'}));await new Promise(r=>setTimeout(r,10000));await safeScreenshot(page,{path:dir+`/difficulty-${local?'local':'production'}-mobile.png`,fullPage:false});await page.setViewport({width:1280,height:1000});report.checks.push('三種模式題目範圍與內容去重，手機390px無溢出');
  // Remove only papers created by this QA run; keep saved answers/wrong history.
  for(const paper of report.papers){await page.goto(url,{waitUntil:'networkidle0'});const selector=`#my-papers article[data-session-id="${paper.session}"]`;await page.waitForSelector(selector);await page.click(selector+' .paper-manage summary');page.once('dialog',d=>d.accept());await page.click(selector+' .paper-delete');await page.waitForFunction(s=>!document.querySelector(s),{polling:5000},selector);}
  assert.deepEqual(report.errors,[]);report.passed=true;console.log(JSON.stringify(report));
 }finally{await fs.writeFile(dir+`/difficulty-${local?'local':'production'}.json`,JSON.stringify(report,null,2),'utf8');await browser.disconnect();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
