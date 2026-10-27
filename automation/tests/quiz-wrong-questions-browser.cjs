const assert=require('node:assert/strict'),fs=require('node:fs/promises'),{createRequire}=require('node:module');
const runtime=createRequire('D:/projects/cdp-tools/package.json');
const {connectCdp,safeScreenshot}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
(async()=>{
 const origin=process.argv[3]||'http://localhost:3000',dir='automation/output/quiz/wrong-questions',kind=origin.startsWith('https:')?'production':'local';
 const qa=JSON.parse(await fs.readFile('automation/output/quiz/drive-library/qa-session.json','utf8'));
 const doc=JSON.parse(await fs.readFile('automation/output/quiz/drive-library/qa-document.json','utf8'));
 const {browser}=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl:origin+'/',enableNetwork:true,puppeteer:runtime('puppeteer-core')});
 const report={origin,details:[],workerImages:0,supabaseImages:0,pageErrors:[],writes:0};
 try{
  const target=browser.targets().find(t=>t._targetId===process.argv[2]);assert.ok(target);const page=await target.page();
  const session=await page.target().createCDPSession();session.grantForegroundOnce('Page.bringToFront','驗證錯題整理及既有圖文燈箱');await session.send('Page.bringToFront');await session.detach();
  page.on('pageerror',e=>report.pageErrors.push(e.message));page.on('request',r=>{if(r.url().includes('/rpc/quiz_action')&&/"p_action":"(submit|join)"/.test(r.postData()||''))report.writes++;});
  page.on('response',r=>{const host=new URL(r.url()).hostname,mime=r.headers()['content-type']||'';if(mime.startsWith('image/')){if(host.endsWith('workers.dev'))report.workerImages++;if(host.endsWith('supabase.co'))report.supabaseImages++;}});
  await page.goto(origin+'/grade3/115-1/quiz-library.html#wrong',{waitUntil:'domcontentloaded'});await page.waitForSelector('.wrong-card',{timeout:45000});
  const user=await page.evaluate(async()=>{const a=await import('/shared/auth.js');return (await a.supabase.auth.getSession()).data.session?.user.id;});assert.equal(user,qa.testUserId);
  assert.equal(await page.$eval('#cloud-papers',e=>getComputedStyle(e).display),'none');
  await page.waitForFunction(()=>!document.getElementById('wrong-unit').disabled,{polling:5000,timeout:30000});
  await page.select('#wrong-unit','圖片與雲端保存驗收');await page.waitForFunction(()=>document.querySelectorAll('.wrong-card').length===3&&!document.getElementById('wrong-unit').disabled,{polling:5000,timeout:30000});report.filteredCount=3;
  await safeScreenshot(page,{path:`${dir}/${kind}-list.png`,fullPage:true});
  const decode=()=>page.waitForFunction(()=>[...document.querySelectorAll('#server-quiz img')].every(i=>i.complete&&i.naturalWidth>0),{polling:5000,timeout:45000});
  async function box(selector){await page.$eval(selector,e=>e.click());await page.waitForFunction(()=>!document.getElementById('lightbox').classList.contains('hidden')&&document.getElementById('lightbox-img').complete&&document.getElementById('lightbox-img').naturalWidth>0,{polling:5000,timeout:30000});
   assert.equal(await page.$eval('#lightbox-scale',e=>e.textContent),'80%');await page.$eval('#lightbox-zoom-out',e=>e.click());assert.equal(await page.$eval('#lightbox-scale',e=>e.textContent),'70%');await page.$eval('#lightbox-close',e=>e.click());}
  for(const [index,b] of doc.blocks.entries()){
   const q=b.questions[0];await page.$eval(`[data-question-id="${q.id}"]`,e=>e.click());
   await page.waitForFunction(()=>!document.getElementById('wrong-detail').hidden&&!document.getElementById('wrong-back').disabled,{polling:5000,timeout:30000});await decode();
   assert.equal(await page.$$eval('.wrong-selected',es=>es.length),1);assert.equal(await page.$$eval('.wrong-correct',es=>es.length),1);
   assert.ok(await page.$eval('.answer-preview',e=>e.textContent.includes('解題想法')));await box('#server-quiz .question img');
   if(q.explanation.media.length)await box('.answer-preview img');
   if(index===0)assert.ok(await page.$$eval('.answer-preview table',es=>es.length));
   assert.ok(await page.$$eval('#server-quiz img',es=>es.every(i=>new URL(i.src).hostname.endsWith('workers.dev')&&i.naturalWidth>0)));
   await safeScreenshot(page,{path:`${dir}/${kind}-detail-${index+1}.png`,fullPage:true});report.details.push({question:index+1,answerLabels:true,lightbox:true,explanationImages:q.explanation.media.length});
   await page.$eval('#wrong-back',e=>e.click());
  }
  await page.setViewport({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.$eval(`[data-question-id="${doc.blocks[1].questions[0].id}"]`,e=>e.click());await page.waitForFunction(()=>!document.getElementById('wrong-detail').hidden,{polling:5000,timeout:30000});await decode();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.setViewport({width:1280,height:1000});report.mobileNoOverflow=true;
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('.wrong-card',{timeout:45000});report.reloadFromCloud=true;
  const denied=await page.evaluate(async()=>{const a=await import('/shared/auth.js'),s=(await a.supabase.auth.getSession()).data.session;
   const r=await fetch(a.SUPABASE_URL+'/rest/v1/rpc/quiz_wrong_questions',{method:'POST',headers:{apikey:a.SUPABASE_ANON_KEY,Authorization:'Bearer '+s.access_token,'Content-Type':'application/json'},body:JSON.stringify({p_data:{action:'detail',attempt_id:'00000000-0000-4000-8000-000000000002',question_id:'hidden'}})});return {status:r.status,body:await r.json()};});assert.equal(denied.body.message,'wrong_question_unavailable');report.foreignDenied=true;
  assert.equal(report.writes,0);assert.equal(report.supabaseImages,0);assert.ok(report.workerImages>0);assert.deepEqual(report.pageErrors,[]);
  await fs.writeFile(`${dir}/${kind}-browser-qa.json`,JSON.stringify(report,null,2),'utf8');console.log(JSON.stringify(report));
 }finally{await browser.disconnect();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
