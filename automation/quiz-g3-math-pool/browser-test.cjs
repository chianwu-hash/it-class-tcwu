const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {createRequire}=require('node:module');
const {connectCdp,safeScreenshot}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
const req=createRequire('D:/projects/cdp-tools/package.json');
const base='automation/output/quiz/hanlin-g3-math-pool';
(async()=>{
 const student=21,origin='http://127.0.0.1:4380',library=`${origin}/grade3/115-1/quiz-library.html?local=1&student=${student}`;
 const {page,session,disconnect}=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl:process.env.QUIZ_BROWSER_URL||library,puppeteer:req('puppeteer-core')});
 const report={checks:[],pageErrors:[]},pool=JSON.parse(await fs.readFile(base+'/pool.json','utf8')),byId=new Map(pool.map(r=>[r.question_id,r]));
 let phase='init';const timer=setTimeout(()=>{console.error('timeout '+phase);process.exit(1);},240000);
 const mark=s=>{phase=s;console.log(s);report.checks.push(s);};
 const rpc=(action,data={},who=student)=>page.evaluate(async(action,data,who)=>{const r=await fetch('/__quiz-rpc',{method:'POST',headers:{'Content-Type':'application/json','X-Quiz-Demo-Student':String(who)},body:JSON.stringify({action,data})});return {status:r.status,data:await r.json()};},action,data,who);
 const images=async()=>{await page.$$eval('#server-quiz img',xs=>xs.forEach(x=>x.loading='eager'));await page.waitForFunction(()=>[...document.querySelectorAll('#server-quiz img')].every(i=>i.complete&&i.naturalWidth>0),{timeout:20000,polling:1000});assert.equal(await page.$$eval('#server-quiz figure [role="alert"]',xs=>xs.length),0);};
 const buttonText=async text=>{const handles=await page.$$('#server-quiz button');for(const h of handles)if(await h.evaluate((e,t)=>e.textContent===t,text)){await h.click();return;}throw Error('button_missing '+text);};
 try{
  assert.equal((await session.send('Target.getTargetInfo')).targetInfo.targetId,process.argv[2]);page.on('pageerror',e=>report.pageErrors.push(e.message));
  page.setDefaultTimeout(20000);
  const foreground=await page.target().createCDPSession();foreground.grantForegroundOnce('Page.bringToFront','本機題庫互動測試需要可見分頁，避免背景分頁暫停點擊等待');await foreground.send('Page.bringToFront');
  await page.setViewport({width:1366,height:900});await page.goto(library,{waitUntil:'networkidle0'});await page.waitForSelector('#compose-units input');
  mark('選範圍組10題：實際2易6中2難');await page.click('#compose-units input[value="8"]');await page.click('#compose-form button');await page.waitForSelector('#compose-result a');
  assert.match(await page.$eval('#compose-status',e=>e.textContent),/易2、中6、難2/);const paper=await page.$eval('#compose-result a',e=>e.href),sid=new URL(paper).searchParams.get('session');
  const joined=(await rpc('join',{session_id:sid})).data;assert.equal(joined.document.questions.length,10);assert.equal(joined.reviews.length,0);assert.doesNotMatch(JSON.stringify(joined.document),/"answer"|"explanation"/);
  mark('本人私有、其他學生不能加入');assert.equal((await rpc('join',{session_id:sid},22)).status,400);assert.equal((await rpc('library_sessions',{},22)).data.sessions.some(p=>p.id===sid),false);
  await page.goto(paper,{waitUntil:'networkidle0'});await page.waitForSelector('#server-submit');
  const before=await page.$$eval('.student-option input',xs=>xs.map(x=>x.value));await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('#server-submit');assert.deepEqual(await page.$$eval('.student-option input',xs=>xs.map(x=>x.value)),before);mark('重新整理保留題目、選項順序');
  let wrongItem=null,shot=false,lightbox=false;
  for(let i=0;i<10;i++){
   const q=joined.document.questions[i],source=byId.get(q.id);assert.equal(await page.$eval('.question',e=>e.dataset.questionId),q.id);
   await images();
   if(!lightbox&&await page.$('#server-quiz .question img')){
    await page.click('#server-quiz .question img');await page.waitForSelector('#lightbox:not(.hidden)');
    const state=await page.$eval('#lightbox',e=>e.innerText);report.lightboxInitial=state;
    await page.click('#lightbox-zoom-out');report.lightboxAfterOut=await page.$eval('#lightbox',e=>e.innerText);
    assert.match(state,/80%/);assert.match(report.lightboxAfterOut,/70%/);await page.click('#lightbox-close');lightbox=true;
   }
   const right=source.question.answer.option_id,response=i%2?right:'abcd'.split('').find(x=>x!==right);
   await page.click(`.student-option input[value="${response}"]`);await page.click('#server-submit');await page.waitForSelector('.answer-preview[data-correct]');await images();
   assert.equal(await page.$eval('.answer-preview',e=>e.dataset.correct),String(i%2===1));
   if(i%2===0&&!wrongItem)wrongItem={attempt_id:joined.attempt_id,question_id:q.id};
   if(!shot&&await page.$('.answer-preview .katex')){await safeScreenshot(page,{path:base+'/qa/fraction-feedback.png',fullPage:true});shot=true;}
   if(i<9)await buttonText('下一題');else{assert.equal(await page.$$eval('.question',xs=>xs.length),1);assert.match(await page.$eval('.notice',e=>e.textContent),/先確認這一題/);}
  }
  mark('10題對錯、公式、原圖、解析、最後一題回饋與燈箱80%→70%');assert.ok(lightbox);
  const complete=(await rpc('resume',{session_id:sid})).data;assert.equal(Object.keys(complete.responses).length,10);await page.reload({waitUntil:'networkidle0'});assert.equal(await page.$eval('.question',e=>e.dataset.questionId),joined.document.questions[9].id);mark('已送答案重新整理後仍保存');
  await page.goto(library+'#wrong',{waitUntil:'networkidle0'});await page.waitForSelector('.wrong-card button');
  const target=await page.$(`.wrong-card button[data-question-id="${wrongItem.question_id}"]`);await target.click();await page.waitForSelector('#wrong-detail:not([hidden]) .wrong-extension button');await images();
  await page.click('.wrong-extension button');await page.waitForSelector('.wrong-extension a');const extensionUrl=await page.$eval('.wrong-extension a',e=>e.href),eid=new URL(extensionUrl).searchParams.get('session');
  const extended=(await rpc('join',{session_id:eid})).data;assert.ok(extended.document.questions.length>0);const source=byId.get(wrongItem.question_id);for(const q of extended.document.questions){const r=byId.get(q.id);assert.equal(r.knowledge_code,source.knowledge_code);assert.notEqual(r.group_key,source.group_key);assert.ok(r.difficulty<=source.difficulty);}mark('我的錯題→同重點延伸：不重複來源，難度不高於原題');
  await page.goto(extensionUrl,{waitUntil:'networkidle0'});await page.waitForSelector('#server-submit');await images();
  mark('9單元各抽5題，逐題送答並檢查原圖、解析');let checked=0,mediaCount=0;
  for(let unit=1;unit<=9;unit++){
   const made=(await rpc('compose',{kind:'self',count:5,units:[unit],request_id:crypto.randomUUID()})).data;assert.ok(made.session_id,JSON.stringify(made));
   const state=(await rpc('join',{session_id:made.session_id})).data;
   for(const q of state.document.questions){assert.ok(byId.get(q.id).unit_ids.includes(unit));const answer=byId.get(q.id).question.answer.option_id;const result=await rpc('submit',{session_id:made.session_id,question_id:q.id,response:answer,request_id:crypto.randomUUID()});assert.equal(result.status,200);assert.equal(result.data.reviews.find(x=>x.question_id===q.id).correct,true);checked++;}
   await page.goto(`${origin}/grade3/115-1/quiz.html?local=1&student=${student}&session=${made.session_id}`,{waitUntil:'networkidle0'});await buttonText('查看整份作答與解析');await images();mediaCount+=await page.$$eval('#server-quiz img',xs=>xs.length);
  }
  report.unitQuestionsChecked=checked;report.sampleImagePlacements=mediaCount;
  await page.goto(library,{waitUntil:'networkidle0'});await page.setViewport({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));mark('390px手機組卷介面無橫向溢出');
  await safeScreenshot(page,{path:base+'/qa/mobile-library.png',fullPage:false});
  assert.deepEqual(report.pageErrors,[]);report.passed=true;
 }finally{clearTimeout(timer);await fs.writeFile(base+'/qa/browser-validation.json',JSON.stringify(report,null,2),'utf8');await disconnect();}
})().catch(e=>{console.error(e);process.exitCode=1;});
