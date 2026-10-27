const assert=require('node:assert/strict'),fs=require('node:fs/promises'),{createRequire}=require('node:module');
const runtime=createRequire('D:/projects/cdp-tools/package.json');
const {connectCdp,safeScreenshot}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
(async()=>{
 const dir='automation/output/quiz/drive-library',qa=JSON.parse(await fs.readFile(dir+'/qa-session.json','utf8')),doc=JSON.parse(await fs.readFile(dir+'/qa-document.json','utf8')),manifest=JSON.parse(await fs.readFile(dir+'/manifest.json','utf8'));
 const {browser}=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl:'http://localhost:3000/',enableNetwork:true,puppeteer:runtime('puppeteer-core')});
 const report={questions:[],imageResponses:[],supabaseControlResponses:0,supabaseImageResponses:0,localTicketRequests:0,pageErrors:[]};
 try{
  const target=browser.targets().find(t=>t._targetId===process.argv[2]);assert.ok(target);const page=await target.page();
  const c=await page.target().createCDPSession();c.grantForegroundOnce('Page.bringToFront','驗證真實Supabase登入、作答保存與獨立圖片服務');await c.send('Page.bringToFront');await c.detach();
  let state;
  page.on('pageerror',e=>report.pageErrors.push(e.message));
  page.on('response',async r=>{
   const u=new URL(r.url()),mime=r.headers()['content-type']||'';
   if(u.hostname.endsWith('.supabase.co')){report.supabaseControlResponses++;if(mime.startsWith('image/'))report.supabaseImageResponses++;}
   if(u.pathname==='/__quiz-drive-media')report.localTicketRequests++;
   if(u.hostname.endsWith('.workers.dev')&&mime.startsWith('image/'))report.imageResponses.push({origin:u.origin,path:u.pathname,status:r.status(),source:r.headers()['x-quiz-media-source']});
   if(u.pathname.endsWith('/rpc/quiz_action')&&r.ok()){const v=await r.json().catch(()=>null);if(v?.document)state=v;}
  });
  await page.goto(qa.url,{waitUntil:'domcontentloaded'});await page.waitForSelector('#server-submit',{timeout:45000});
  const identity=await page.evaluate(async()=>{const a=await import('/shared/auth.js');const {data}=await a.supabase.auth.getSession();return {id:data.session?.user.id,email:data.session?.user.email};});
  assert.equal(identity.id,qa.testUserId);report.verifiedRealStudent=true;
  const mediaCall=async(url,attempt,anonymous=false)=>page.evaluate(async(url,attempt,anonymous)=>{
   const a=await import('/shared/auth.js');const {data}=await a.supabase.auth.getSession();
   const r=await fetch('/__quiz-drive-media',{method:'POST',headers:{'Content-Type':'application/json',...(anonymous?{}:{Authorization:`Bearer ${data.session.access_token}`})},body:JSON.stringify({action:'read',url,attempt_id:attempt})});
   return {status:r.status,body:await r.json()};
  },url,attempt,anonymous);
  const promptUrls=new Set(doc.blocks.flatMap(b=>[b.material,...b.questions.flatMap(q=>[q.prompt,...q.options.map(o=>o.content)])]).flatMap(c=>c.media.map(m=>m.url)));
  const secret=doc.blocks.flatMap(b=>b.questions.flatMap(q=>q.explanation.media)).find(m=>!promptUrls.has(m.url));assert.ok(secret);
  assert.equal((await mediaCall(secret.url,state.attempt_id)).status,403);report.unrevealedExplanationDenied=true;
  assert.equal((await mediaCall(secret.url,'00000000-0000-4000-8000-000000000002')).status,403);report.foreignAttemptDenied=true;
  assert.equal((await mediaCall(secret.url,state.attempt_id,true)).status,401);report.anonymousDenied=true;
  const decode=()=>page.waitForFunction(()=>[...document.querySelectorAll('#server-quiz img')].every(i=>i.complete&&i.naturalWidth>0),{polling:5000,timeout:45000});
  const lightbox=async selector=>{
   const before=report.localTicketRequests;await page.$eval(selector,e=>e.click());
   await page.waitForFunction(()=>!document.getElementById('lightbox').classList.contains('hidden')&&document.getElementById('lightbox-img').complete&&document.getElementById('lightbox-img').naturalWidth>0,{polling:5000,timeout:30000});
   assert.ok(report.localTicketRequests>before);assert.equal(await page.$eval('#lightbox-scale',e=>e.textContent),'80%');
   await page.$eval('#lightbox-zoom-out',e=>e.click());assert.equal(await page.$eval('#lightbox-scale',e=>e.textContent),'70%');
   await page.$eval('#lightbox-reset',e=>e.click());assert.equal(await page.$eval('#lightbox-scale',e=>e.textContent),'80%');await page.$eval('#lightbox-close',e=>e.click());
  };
  for(let i=0;i<3;i++){
   console.log(`Checking real Supabase answer ${i+1}`);await decode();await lightbox('article.question img');
   const q=doc.blocks[i].questions[0],wrong=q.options.find(o=>o.id!==q.answer.option_id).id;
   await page.$eval(`#server-quiz input[value="${wrong}"]`,e=>e.click());await page.$eval('#server-submit',e=>e.click());
   await page.waitForFunction(()=>document.querySelector('#server-quiz [role=status]')?.textContent==='答案已保存。',{polling:5000,timeout:30000});await decode();
   assert.ok((await page.$eval('.answer-preview',e=>e.textContent)).includes('這題還沒答對'));
   if(q.explanation.media.length)await lightbox('.answer-preview img');
   const images=await page.$$eval('#server-quiz img',imgs=>imgs.map(i=>({origin:new URL(i.src).origin,width:i.naturalWidth,height:i.naturalHeight})));
   assert.ok(images.every(i=>i.origin===manifest.workerOrigin&&i.width>0));
   if(i===0)assert.ok(await page.$$eval('.answer-preview table',es=>es.length));
   await safeScreenshot(page,{path:dir+`/cloud-question-${i+1}-wrong.png`,fullPage:true});
   report.questions.push({question:i+1,wrongFeedback:true,originalImages:images,explanationLightbox:!!q.explanation.media.length});
   if(i<2){await page.evaluate(()=>[...document.querySelectorAll('#server-quiz button')].find(b=>b.textContent==='下一題').click());await page.waitForSelector('#server-submit');}
  }
  assert.equal(await page.$eval('#server-quiz h3',e=>e.textContent),'第 3 題 / 3 題');report.lastQuestionFeedback=true;
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('.answer-preview',{timeout:30000});await decode();
  assert.equal(await page.$eval('.progress-label',e=>e.textContent),'已保存 3 / 3 題');report.reloadCloudProgress=true;
  await page.setViewport({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.setViewport({width:1280,height:1000});report.mobileNoOverflow=true;
  assert.ok(report.supabaseControlResponses>0);assert.equal(report.supabaseImageResponses,0);assert.ok(report.imageResponses.length>0);assert.deepEqual(report.pageErrors,[]);
  await page.goto('http://localhost:3000/grade3/115-1/quiz-library.html',{waitUntil:'domcontentloaded'});await page.waitForSelector('.paper-start',{timeout:30000});
  assert.equal(await page.$$eval('.paper-start',es=>es.length),16);report.libraryPapers=16;
  await fs.writeFile(dir+'/browser-qa.json',JSON.stringify(report,null,2),'utf8');console.log(JSON.stringify({realStudent:true,questions:3,reloadCloudProgress:true,workerImageResponses:report.imageResponses.length,supabaseControlResponses:report.supabaseControlResponses,supabaseImageResponses:report.supabaseImageResponses,libraryPapers:16}));
 }finally{await browser.disconnect();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
