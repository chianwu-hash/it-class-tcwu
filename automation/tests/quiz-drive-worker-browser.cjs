const assert=require('node:assert/strict'),fs=require('node:fs/promises'),{createRequire}=require('node:module');
const runtime=createRequire('D:/projects/cdp-tools/package.json');
const {connectCdp,safeScreenshot}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
(async()=>{
 const dir='automation/output/quiz/drive-worker-poc',trial=JSON.parse(await fs.readFile(dir+'/trial.json','utf8')),doc=JSON.parse(await fs.readFile(dir+'/frozen.json','utf8')),manifest=JSON.parse(await fs.readFile(dir+'/manifest.json','utf8'));
 const {browser}=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl:trial.verificationUrl,enableNetwork:true,puppeteer:runtime('puppeteer-core')});
 const report={questions:[],pageErrors:[],imageResponses:[],supabaseResponses:0};
 try{
  const target=browser.targets().find(t=>t._targetId===process.argv[2]);assert.ok(target);const page=await target.page();
  const initial=await page.target().createCDPSession();initial.grantForegroundOnce('Page.bringToFront','驗證本機試答、圖片燈箱與解析');await initial.send('Page.bringToFront');await initial.detach();
  const states=[];
  page.on('pageerror',e=>report.pageErrors.push(e.message));
  page.on('response',async r=>{
   const url=new URL(r.url());if(url.hostname.endsWith('.supabase.co'))report.supabaseResponses++;
   if(url.pathname==='/__quiz-rpc'&&r.ok()){const d=await r.json().catch(()=>null);if(d?.document)states.push(d);}
   if((r.headers()['content-type']||'').startsWith('image/')&&url.hostname.endsWith('.workers.dev'))report.imageResponses.push({origin:url.origin,path:url.pathname,status:r.status(),source:r.headers()['x-quiz-media-source'],cache:r.headers()['x-quiz-cache']});
  });
  await page.goto(trial.verificationUrl,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#server-submit',{timeout:30000});
  console.log('Trial loaded');
  const decode=()=>page.waitForFunction(()=>[...document.querySelectorAll('#server-quiz img')].every(i=>i.complete&&i.naturalWidth>0),{polling:5000,timeout:45000});
  const lightbox=async selector=>{
   await page.$eval(selector,e=>e.click());await page.waitForFunction(()=>!document.getElementById('lightbox').classList.contains('hidden'));
   assert.equal(await page.$eval('#lightbox-scale',e=>e.textContent),'80%');
   await page.$eval('#lightbox-zoom-out',e=>e.click());assert.equal(await page.$eval('#lightbox-scale',e=>e.textContent),'70%');
   await page.$eval('#lightbox-reset',e=>e.click());assert.equal(await page.$eval('#lightbox-scale',e=>e.textContent),'80%');
   assert.ok(await page.$eval('#lightbox-img',e=>e.complete&&e.naturalWidth>0));await page.$eval('#lightbox-close',e=>e.click());
  };
  const secret=doc.blocks[0].questions[0].explanation.media[0].url;
  const denied=await page.evaluate(async(url,id)=>{
   const r=await fetch('/__quiz-media',{method:'POST',headers:{'Content-Type':'application/json','X-Quiz-Demo-Student':new URL(location.href).searchParams.get('student')},body:JSON.stringify({action:'read',url,attempt_id:id})});return r.status;
  },secret,states.at(-1).attempt_id);assert.equal(denied,400);report.unrevealedExplanationDenied=true;
  for(let i=0;i<3;i++){
   console.log(`Checking question ${i+1}`);
   await decode();assert.ok(await page.$$eval('article.question img',es=>es.length));await lightbox('article.question img');
   const q=doc.blocks[i].questions[0],wrong=q.options.find(o=>o.id!==q.answer.option_id).id;
   await page.$eval(`#server-quiz input[value="${wrong}"]`,e=>e.click());await page.$eval('#server-submit',e=>e.click());
   await page.waitForFunction(()=>document.querySelector('#server-quiz [role=status]')?.textContent==='答案已保存。',{polling:5000,timeout:20000});await decode();
   assert.ok((await page.$eval('.answer-preview',e=>e.textContent)).includes('這題還沒答對'));
   const explanationImages=await page.$$eval('.answer-preview img',es=>es.length);
   if(q.explanation.media.length){assert.ok(explanationImages);await lightbox('.answer-preview img');}
   const actualImages=await page.$$eval('#server-quiz img',async imgs=>Promise.all(imgs.map(async img=>{
    const r=await fetch(img.src),b=await r.arrayBuffer(),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(x=>x.toString(16).padStart(2,'0')).join('');return {hash,width:img.naturalWidth,height:img.naturalHeight,origin:new URL(img.src).origin};
   })));
   assert.ok(actualImages.every(a=>manifest.assets[a.hash]&&a.origin===manifest.workerOrigin));
   if(i===1)assert.ok(await page.$$eval('.answer-preview table',es=>es.length));
   if(i===2)assert.ok(await page.$$eval('.katex',es=>es.length));
   await safeScreenshot(page,{path:dir+`/question-${i+1}-wrong.png`,fullPage:true});
   report.questions.push({question:i+1,wrongFeedback:true,promptLightbox:true,explanationImages,explanationLightbox:!!explanationImages,images:actualImages});
   if(i<2){await page.evaluate(()=>[...document.querySelectorAll('#server-quiz button')].find(b=>b.textContent==='下一題').click());await page.waitForSelector('#server-submit');console.log('Next question loaded');}
  }
  assert.equal(await page.$eval('#server-quiz h3',e=>e.textContent),'第 3 題 / 3 題');report.lastQuestionFeedback=true;
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('.answer-preview');report.reloadSavedFeedback=true;
  assert.equal(report.supabaseResponses,0);assert.ok(report.imageResponses.length>0);assert.deepEqual(report.pageErrors,[]);
  await page.goto(trial.userUrl,{waitUntil:'domcontentloaded'});await page.waitForSelector('#server-submit');await decode();
  assert.equal(await page.$eval('.progress-label',e=>e.textContent),'已保存 0 / 3 題');
  const c=await page.target().createCDPSession();c.grantForegroundOnce('Page.bringToFront','開啟Google Drive與Cloudflare圖片試答，保留未作答狀態');await c.send('Page.bringToFront');await c.detach();
  report.userUrl=trial.userUrl;report.userAnswered=0;await fs.writeFile(dir+'/browser-qa.json',JSON.stringify(report,null,2),'utf8');
  console.log(JSON.stringify({questions:report.questions,supabaseResponses:report.supabaseResponses,workerImageResponses:report.imageResponses.length,userUrl:report.userUrl,userAnswered:0,pageErrors:report.pageErrors}));
 }finally{await browser.disconnect();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
