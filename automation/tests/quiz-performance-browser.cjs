// Local-only browser regression: a saved response may be lost or belong to another snapshot.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),{createRequire}=require('node:module');
const runtime=createRequire('D:/projects/cdp-tools/package.json'),{connectCdp}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
(async()=>{
 const url=process.env.QUIZ_BROWSER_URL;
 assert.equal(new URL(url).hostname,'127.0.0.1','fault injection is local-only');
 const {browser}=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl:url,puppeteer:runtime('puppeteer-core')});
 const out='automation/output/quiz/bench-performance-20261028';let report={passed:false},page;
 try{
  page=await browser.targets().find(t=>t._targetId===process.argv[2]).page();
  const c=await page.target().createCDPSession();c.grantForegroundOnce('Page.bringToFront','核對精簡送答、遺失回應重送、快照不符接續與圖片燈箱');await c.send('Page.bringToFront');
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(25000);
  await page.evaluateOnNewDocument(()=>{
   const original=window.fetch;window.__perfTrace=[];window.__perfFault=null;
   window.fetch=async(...args)=>{const response=await original(...args),body=String(args[0]).includes('/__quiz-rpc')?JSON.parse(args[1]?.body||'{}'):{};
    if(body.action==='resume')window.__perfTrace.push({action:'resume'});
    if(body.action==='submit'&&response.ok){const result=await response.clone().json();window.__perfTrace.push({action:'submit',request_id:body.data.request_id,compact:body.data.compact,document:!!result.document,warning:result.warning});
     if(!result.warning&&window.__perfFault==='lost'){window.__perfFault=null;throw new TypeError('本機測試：回應已遺失');}
     if(!result.warning&&window.__perfFault==='mismatch'){window.__perfFault=null;return new Response(JSON.stringify({...result,attempt_id:'wrong-attempt'}),{status:200,headers:{'Content-Type':'application/json'}});}
    }return response;
   };
  });
  const library=new URL('/grade3/115-1/quiz-library.html?local=1&student=19',url).href;
  await page.goto(library,{waitUntil:'networkidle0'});await page.waitForFunction(()=>!document.querySelector('#compose-toggle')?.disabled);
  await page.click('#compose-toggle');const math=await page.$$eval('#compose-course option',xs=>xs.find(x=>x.textContent==='數學').value);await page.select('#compose-course',math);
  await page.click('#compose-units input[value="3"]');await page.select('#compose-count','5');await page.click('#compose-form button[type=submit]');await page.waitForSelector('#compose-result a');
  const paper=await page.$eval('#compose-result a',e=>e.href);await page.goto(paper,{waitUntil:'networkidle0'});await page.waitForSelector('#server-submit');
  const answers=new Map(JSON.parse(await fs.readFile('automation/output/quiz/hanlin-g3-math-pool/pool.json')).map(r=>[r.question_id,r.question.answer.option_id]));
  let lightbox=false;
  for(let i=0;i<2;i++){
   const qid=await page.$eval('.question',e=>e.dataset.questionId),options=await page.$$eval('.student-option input',xs=>xs.map(e=>e.value));
   if(!lightbox&&await page.$('#server-quiz img')){
    await page.waitForFunction(()=>[...document.querySelectorAll('#server-quiz img')].every(i=>i.complete&&i.naturalWidth>0));await page.click('#server-quiz img');await page.waitForSelector('#lightbox:not(.hidden)');await page.click('#lightbox-zoom-out');await page.click('#lightbox-close');lightbox=true;
   }
   await page.click(`.student-option input[value="${options.find(o=>o!==answers.get(qid))}"]`);
   await page.evaluate(fault=>window.__perfFault=fault,i===0?'lost':'mismatch');await new Promise(r=>setTimeout(r,2300));await page.click('#server-submit');
   if(i===0){await page.waitForFunction(()=>document.querySelector('#server-submit')?.textContent.includes('相同答案重試'));await page.click('#server-submit');}
   await page.waitForSelector('.answer-preview');assert.match(await page.$eval('.progress-label',e=>e.textContent),new RegExp((i+1)+' / 5'));
   if(i===0){const traces=await page.evaluate(()=>window.__perfTrace.filter(t=>t.action==='submit'));assert.equal(traces.length,2);assert.equal(traces[0].request_id,traces[1].request_id);assert.ok(traces.every(t=>t.compact&&!t.document));
    await page.goto(library,{waitUntil:'networkidle0'});await page.waitForSelector('#continue-practice a');await page.click('#continue-practice a');await page.waitForSelector('#server-submit');
   }
  }
  assert.ok(await page.evaluate(()=>window.__perfTrace.some(t=>t.action==='resume')),'mismatched compact snapshot must reload authoritative state');
  await page.goto(library+'#wrong',{waitUntil:'networkidle0'});await page.waitForSelector('#wrong-list button');await page.click('#wrong-list button');await page.waitForSelector('#wrong-detail .answer-preview');
  assert.match(await page.$eval('#wrong-detail',e=>e.textContent),/正確答案/);assert.deepEqual(errors,[]);
  await page.screenshot({path:out+'/compact-wrong-review.png',fullPage:false});
  report={passed:true,lostResponseRetry:true,compactWithoutDocument:true,authoritativeResumeOnMismatch:true,continueAfterReload:true,wrongReview:true,lightbox,errors};
  console.log(JSON.stringify(report));
 }finally{await fs.writeFile(out+'/compact-browser.json',JSON.stringify(report,null,2));await browser.disconnect();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
