// 三題原圖、原生文字／表格的本機端到端驗證，僅使用合成身分。
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {createHash}=require('node:crypto'),{createRequire}=require('node:module');
const runtime=createRequire('D:/projects/cdp-tools/package.json');
const {connectCdp,safeScreenshot}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
(async()=>{
 const folder=path.resolve('automation/output/quiz/hanlin-u1-analysis');
 const trial=JSON.parse(await fs.readFile(path.join(folder,'native-trial-session.json'),'utf8'));
 const doc=JSON.parse(await fs.readFile(path.join(folder,'native-trial-frozen.json'),'utf8'));
 const sourceDoc=JSON.parse(await fs.readFile(path.join(folder,'native-trial.quiz.json'),'utf8'));
 const expectedHashes={};
 for(const b of sourceDoc.blocks)for(const c of [b.questions[0].prompt,b.questions[0].explanation])for(const media of c.media){const name=new URL(media.url).pathname.slice(1);expectedHashes[name]=createHash('sha256').update(await fs.readFile(path.join(folder,'native-assets',name))).digest('hex');}
 const {browser}=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl:trial.verification_url,puppeteer:runtime('puppeteer-core')});
 const report={questions:[],errors:[]};
 try{
  const target=browser.targets().find(t=>t._targetId===process.argv[2]);assert.ok(target);const page=await target.page();assert.equal(page.url(),trial.verification_url);
  const cdp=await page.target().createCDPSession();try{cdp.grantForegroundOnce('Page.bringToFront','驗證原圖、原生表格與答錯解析，最後開放使用者試答');await cdp.send('Page.bringToFront');}finally{await cdp.detach();}
  page.on('pageerror',e=>report.errors.push(e.message));const states=[];
  page.on('response',async r=>{if(r.url().endsWith('/__quiz-rpc')&&r.ok()){const b=await r.json().catch(()=>null);if(b?.document)states.push(b);}});
  const wait=fn=>page.waitForFunction(fn,{polling:'mutation',timeout:20000});
  const decode=()=>page.waitForFunction(()=>[...document.querySelectorAll('#server-quiz img')].every(i=>i.complete&&i.naturalWidth>0),{polling:5000,timeout:20000});
  await page.reload({waitUntil:'domcontentloaded'});await wait(()=>Boolean(document.querySelector('#server-submit')));
  assert.equal(states.at(-1).reviews.length,0);assert.equal(await page.$$eval('#server-quiz table',es=>es.length),0);
  const secret=doc.blocks[1].questions[0].explanation.media[0].url;
  const denied=await page.evaluate(async(url,id)=>{const r=await fetch('/__quiz-media',{method:'POST',headers:{'Content-Type':'application/json','X-Quiz-Demo-Student':'2'},body:JSON.stringify({action:'read',url,attempt_id:id})});return {status:r.status,body:await r.json()};},secret,states.at(-1).attempt_id);
  assert.equal(denied.status,400);report.unrevealed_explanation_denied=true;
  for(let i=0;i<3;i++){
   await decode();assert.equal(await page.$$eval('#server-quiz input[type=radio]',es=>es.length),4);
   const prompt=await page.$('article.question>.quiz-rich-content');assert.ok(prompt);
   const promptText=await prompt.evaluate(e=>e.textContent);assert.ok(promptText.trim().length>3);
   assert.equal(await prompt.$$eval('img',es=>es.length),[0,1,4][i]);
   if(i===2)assert.equal(await prompt.$$eval('.quiz-image-row img',es=>es.length),3);
   await page.$eval('#server-quiz input[value="a"]',e=>e.click());await page.$eval('#server-submit',e=>e.click());
   await wait(()=>document.querySelector('#server-quiz [role=status]')?.textContent==='答案已保存。');await decode();
   const review=await page.$('.answer-preview');assert.ok((await review.evaluate(e=>e.textContent)).includes('這題還沒答對'));
   const expected=sourceDoc.blocks[i].questions[0].explanation;
   const table=expected.layout.find(p=>p.type==='table');
   const actualTable=await review.$$eval('table tr',rows=>rows.map(row=>[...row.cells].map(c=>c.textContent.replace(/\s+/g,''))));
   if(table){assert.deepEqual(actualTable,table.rows.map(row=>row.map(cell=>cell.filter(r=>r.type==='text').map(r=>r.text).join('').replace(/\s+/g,''))));}
   else assert.deepEqual(actualTable,[]);
   const images=await page.$$eval('#server-quiz img',async els=>Promise.all(els.map(async img=>{
     const bytes=await fetch(img.src).then(r=>r.arrayBuffer());return {width:img.naturalWidth,height:img.naturalHeight,hash:[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('')};
   })));
   const allowed=new Set(Object.values(expectedHashes));assert.ok(images.every(m=>allowed.has(m.hash)));
   if(i===1){assert.equal(await review.$$eval('.quiz-rich-paragraph .quiz-embedded-image',es=>es.length),1);assert.ok((await review.evaluate(e=>e.textContent)).includes('3312'));}
   if(i===2){assert.equal(await page.$$eval('article.question',es=>es.length),1);assert.equal(await page.$eval('#server-quiz h3',e=>e.textContent),'第 3 題 / 3 題');}
   const shot=path.join(folder,'native-assets',`browser-question-${i+1}.png`);await safeScreenshot(page,{path:shot,fullPage:true});
   await page.setViewport({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.setViewport({width:1280,height:1000});
   report.questions.push({source_item_id:trial.source_item_ids[i],prompt_text:promptText,native_table_rows:actualTable,original_image_hashes_verified:true,images,wrong_answer_feedback:true,mobile_no_overflow:true,screenshot:shot});
   if(i<2){await page.evaluate(()=>[...document.querySelectorAll('#server-quiz button')].find(b=>b.textContent==='下一題').click());await wait(()=>Boolean(document.querySelector('#server-submit')));}
  }
  await page.evaluate(()=>[...document.querySelectorAll('#server-quiz button')].find(b=>b.textContent==='查看整份作答與解析').click());
  assert.equal(await page.$$eval('#server-quiz table',es=>es.length),2);
  await page.reload({waitUntil:'domcontentloaded'});await wait(()=>document.querySelector('#server-quiz h3')?.textContent==='第 3 題 / 3 題');await decode();
  assert.equal(await page.$$eval('#server-quiz table',es=>es.length),1);report.reload_and_last_feedback=true;
  const safe=await page.evaluate(async()=>{const {renderContent}=await import('/shared/quiz-render.mjs');const host=document.createElement('div');renderContent(host,{text:'安全文字',media:[],layout:[{type:'paragraph',runs:[{type:'text',text:'<script>window.bad=true</script>'}]}]});return !host.querySelector('script')&&host.textContent.includes('<script>');});assert.equal(safe,true);report.text_not_executed_as_html=true;
  await page.goto(trial.user_url,{waitUntil:'domcontentloaded'});await wait(()=>Boolean(document.querySelector('#server-submit')));
  assert.equal(await page.$eval('.progress-label',e=>e.textContent),'已保存 0 / 3 題');assert.deepEqual(report.errors,[]);
  report.user_url=page.url();report.user_answered=0;
  await fs.writeFile(path.join(folder,'native-trial-browser-qa.json'),JSON.stringify(report,null,2),'utf8');console.log(JSON.stringify(report));
 }finally{await browser.disconnect();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
