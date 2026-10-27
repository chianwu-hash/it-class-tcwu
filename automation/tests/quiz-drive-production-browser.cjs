const assert=require('node:assert/strict'),fs=require('node:fs/promises'),{createRequire}=require('node:module');
const runtime=createRequire('D:/projects/cdp-tools/package.json');
const {connectCdp,safeScreenshot}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
(async()=>{
 const dir='automation/output/quiz/drive-production',qa=JSON.parse(await fs.readFile('automation/output/quiz/drive-library/qa-session.json','utf8'));
 const origin='https://it-class-tcwu.vercel.app',worker='https://dingxi-quiz-drive-library.nblm-book-audio.workers.dev';
 const {browser}=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl:origin+'/',enableNetwork:true,puppeteer:runtime('puppeteer-core')});
 const report={origin,questions:[],workerImages:[],supabaseImages:0,ticketCalls:0,answerWrites:0,pageErrors:[]};
 try {
  const target=browser.targets().find(t=>t._targetId===process.argv[2]);assert.ok(target);const page=await target.page();
  const c=await page.target().createCDPSession();c.grantForegroundOnce('Page.bringToFront','驗證正式題庫圖片、燈箱與已保存答錯解析');await c.send('Page.bringToFront');await c.detach();
  page.on('pageerror',e=>report.pageErrors.push(e.message));
  page.on('request',r=>{if(r.url().includes('/rpc/quiz_action')&&r.postData()?.includes('"p_action":"submit"'))report.answerWrites++;});
  page.on('response',r=>{const u=new URL(r.url()),mime=r.headers()['content-type']||'';
   if(u.hostname.endsWith('.supabase.co')&&mime.startsWith('image/'))report.supabaseImages++;
   if(u.pathname==='/functions/v1/quiz-media')report.ticketCalls++;
   if(u.origin===worker&&mime.startsWith('image/'))report.workerImages.push({path:u.pathname,status:r.status(),source:r.headers()['x-quiz-media-source']});
  });
  await page.goto(`${origin}/grade3/115-1/quiz.html?cloud=1&session=${qa.session}`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.answer-preview',{timeout:45000});
  const identity=await page.evaluate(async()=>{const a=await import('/shared/auth.js');return (await a.supabase.auth.getSession()).data.session?.user.id;});assert.equal(identity,qa.testUserId);
  const decode=()=>page.waitForFunction(()=>[...document.querySelectorAll('#server-quiz img')].every(i=>i.complete&&i.naturalWidth>0),{polling:5000,timeout:45000});
  const box=async selector=>{const before=report.ticketCalls;await page.$eval(selector,e=>e.click());
   await page.waitForFunction(()=>!document.getElementById('lightbox').classList.contains('hidden')&&document.getElementById('lightbox-img').complete&&document.getElementById('lightbox-img').naturalWidth>0,{polling:5000,timeout:30000});
   assert.ok(report.ticketCalls>before);assert.equal(await page.$eval('#lightbox-scale',e=>e.textContent),'80%');
   assert.equal(await page.$eval('#lightbox-img',e=>new URL(e.src).origin),worker);
   await page.$eval('#lightbox-zoom-out',e=>e.click());assert.equal(await page.$eval('#lightbox-scale',e=>e.textContent),'70%');
   await page.$eval('#lightbox-reset',e=>e.click());assert.equal(await page.$eval('#lightbox-scale',e=>e.textContent),'80%');await page.$eval('#lightbox-close',e=>e.click());
  };
  for(let number=3;number>=1;number--){
   await decode();assert.equal(await page.$eval('#server-quiz h3',e=>e.textContent),`第 ${number} 題 / 3 題`);
   assert.match(await page.$eval('.answer-preview',e=>e.textContent),/這題還沒答對/);await box('article.question img');
   const explanations=await page.$$eval('.answer-preview img',es=>es.length);if(explanations)await box('.answer-preview img');
   const images=await page.$$eval('#server-quiz img',es=>es.map(i=>({origin:new URL(i.src).origin,width:i.naturalWidth,height:i.naturalHeight})));
   assert.ok(images.every(i=>i.origin===worker&&i.width>0));
   if(number===1)assert.ok(await page.$$eval('.answer-preview table',es=>es.length));
   report.questions.push({number,images,wrongFeedback:true,explanationImages:explanations});
   await safeScreenshot(page,{path:`${dir}/production-question-${number}.png`,fullPage:true});
   if(number>1){await page.evaluate(()=>[...document.querySelectorAll('#server-quiz button')].find(b=>b.textContent==='回看前一題').click());}
  }
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('.answer-preview',{timeout:45000});await decode();
  assert.equal(await page.$eval('.progress-label',e=>e.textContent),'已保存 3 / 3 題');report.reloadSaved=true;
  await page.setViewport({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.setViewport({width:1280,height:1000});report.mobileNoOverflow=true;
  const denied=await page.evaluate(async()=>{const a=await import('/shared/auth.js');const s=(await a.supabase.auth.getSession()).data.session;
   const body={action:'read',url:document.querySelector('#server-quiz img').dataset.quizMediaUrl,attempt_id:'00000000-0000-4000-8000-000000000002'};
   const call=async bearer=>{const r=await fetch(a.SUPABASE_URL+'/functions/v1/quiz-media',{method:'POST',headers:{apikey:a.SUPABASE_ANON_KEY,'Content-Type':'application/json',...(bearer?{Authorization:'Bearer '+bearer}:{})},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
   return {foreign:await call(s.access_token),anonymous:await call(null)};
  });assert.equal(denied.foreign.body.error,'media_unavailable');assert.equal(denied.anonymous.status,401);report.authorizationDenied=true;
  assert.ok(report.workerImages.length>0);assert.equal(report.supabaseImages,0);assert.equal(report.answerWrites,0);assert.deepEqual(report.pageErrors,[]);
  report.at=new Date().toISOString();await fs.writeFile(dir+'/browser-qa.json',JSON.stringify(report,null,2),'utf8');
  console.log(JSON.stringify({production:true,questions:report.questions.length,workerImages:report.workerImages.length,supabaseImages:report.supabaseImages,ticketCalls:report.ticketCalls,reloadSaved:true,answerWrites:0,mobileNoOverflow:true}));
 } finally {await browser.disconnect();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
