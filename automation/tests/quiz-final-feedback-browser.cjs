// 僅對兩份本機合成測驗驗證最後一題與明確切換回顧；不接正式資料庫。
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {createRequire}=require('node:module');
const runtime=createRequire('D:/projects/cdp-tools/package.json');
const {connectCdp,safeScreenshot}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
(async()=>{
 const folder=path.resolve('automation/output/quiz/hanlin-u1-analysis');
 const ten=JSON.parse(await fs.readFile(path.join(folder,'unit1-medium-10.trial-session.json'),'utf8'));
 const rich=JSON.parse(await fs.readFile(path.join(folder,'rich-trial-session.json'),'utf8'));
 const {browser}=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl:'http://127.0.0.1:4340/admin-quiz.html?local=1',puppeteer:runtime('puppeteer-core')});
 const report={cases:[],javascript_errors:[]};
 try{
  const target=browser.targets().find(t=>t._targetId===process.argv[2]);assert.ok(target);const page=await target.page();
  const cdp=await page.target().createCDPSession();try{cdp.grantForegroundOnce('Page.bringToFront','驗證最後一題回饋及回顧按鈕');await cdp.send('Page.bringToFront');}finally{await cdp.detach();}
  page.on('pageerror',e=>report.javascript_errors.push(e.message));
  const wait=fn=>page.waitForFunction(fn,{polling:'mutation',timeout:20000});
  const clickText=text=>page.evaluate(t=>{const b=[...document.querySelectorAll('#server-quiz button')].find(b=>b.textContent===t);if(!b)throw Error(`找不到按鈕：${t}`);b.click();},text);
  for(const spec of [
   {label:'10題逐題揭答，最後答對',source:ten,count:10,mode:'immediate',last:'a',correct:true},
   {label:'3題圖文逐題揭答，最後答錯且回應遺失重試',source:rich,count:3,mode:'immediate',last:'a',correct:false,retry:true},
   {label:'10題整份揭答，最後答錯',source:ten,count:10,mode:'complete',last:'d',correct:false},
  ]){
   const base=new URL(spec.source.user_url).origin;
   await page.goto(`${base}/admin-quiz.html?local=1`,{waitUntil:'domcontentloaded'});
   const s=await page.evaluate(async (version,mode)=>{
    const r=await fetch('/__quiz-rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'open',data:{session_id:crypto.randomUUID(),version_id:version,school_year:115,class_codes:['603'],reveal:mode,shuffle_questions:false,shuffle_options:false}})});const b=await r.json();if(!r.ok)throw Error(b.error);return b;
   },spec.source.version_id,spec.mode);
   const url=`${base}/grade6/115-1/quiz.html?local=1&session=${s.id}&student=3`;
   await page.goto(url,{waitUntil:'domcontentloaded'});await wait(()=>Boolean(document.querySelector('#server-submit')));
   for(let i=0;i<spec.count;i++){
    if(spec.retry&&i===spec.count-1)await page.evaluate(()=>{const original=window.fetch;let fail=true;window.fetch=async(...args)=>{const r=await original(...args);if(fail&&String(args[0]).endsWith('/__quiz-rpc')&&JSON.parse(args[1].body).action==='submit'){fail=false;throw Error('測試：送達後回應遺失');}return r;};});
    await page.$eval(`#server-quiz input[value="${i===spec.count-1?spec.last:'a'}"]`,e=>e.click());
    await page.$eval('#server-submit',e=>e.click());
     if(spec.retry&&i===spec.count-1){await wait(()=>document.querySelector('#server-submit')?.textContent==='以相同答案重試保存'&&!document.querySelector('#server-submit').disabled&&document.querySelector('#server-quiz [role=status]')?.textContent==='測試：送達後回應遺失');await page.$eval('#server-submit',e=>e.click());}
     try { await wait(()=>document.querySelector('#server-quiz [role=status]')?.textContent==='答案已保存。'); }
     catch(error) { console.log(JSON.stringify({case:spec.label,question:i+1,page:await page.$eval('#server-quiz',e=>e.textContent)}));throw error; }
    if(spec.mode==='complete'&&i<spec.count-1)assert.equal(await page.$$eval('#server-quiz .answer-preview',es=>es.length),0);
    if(i<spec.count-1){await clickText('下一題');await wait(()=>Boolean(document.querySelector('#server-submit')));}
   }
   const lastTitle=`第 ${spec.count} 題 / ${spec.count} 題`;
   assert.equal(await page.$$eval('#server-quiz article.question',es=>es.length),1);
   assert.equal(await page.$eval('#server-quiz h3',e=>e.textContent),lastTitle);
   assert.ok((await page.$eval('#server-quiz .answer-preview',e=>e.textContent)).includes(spec.correct?'這題答對了':'這題還沒答對'));
   assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#server-quiz button')].some(b=>b.textContent==='下一題')),false);
   if(spec.retry)await page.waitForFunction(()=>[...document.querySelectorAll('#server-quiz .answer-preview img')].every(i=>i.complete&&i.naturalWidth>0),{polling:5000,timeout:20000});
   await clickText('更新保存狀態');await wait(()=>Boolean(document.querySelector('#server-quiz h3')));
   assert.equal(await page.$eval('#server-quiz h3',e=>e.textContent),lastTitle);
   await clickText('查看整份作答與解析');
   assert.equal(await page.$$eval('#server-quiz article.question',es=>es.length),spec.count);
   assert.equal(await page.$$eval('#server-quiz article h3',es=>es.at(-1).textContent),lastTitle);
   await clickText('回看最後一題');assert.equal(await page.$$eval('#server-quiz article.question',es=>es.length),1);
   await page.reload({waitUntil:'domcontentloaded'});await wait(()=>Boolean(document.querySelector('#server-quiz .answer-preview')));
   assert.equal(await page.$eval('#server-quiz h3',e=>e.textContent),lastTitle);
   await page.setViewport({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.setViewport({width:1280,height:1000});
   await page.goto(url.replace('student=3','student=4'),{waitUntil:'domcontentloaded'});await wait(()=>Boolean(document.querySelector('#server-submit')));
   assert.equal(await page.$eval('.progress-label',e=>e.textContent),`已保存 0 / ${spec.count} 題`);assert.equal(await page.$$eval('#server-quiz .answer-preview',es=>es.length),0);
   report.cases.push({label:spec.label,last_feedback_retained:true,explicit_review:true,reload_last_question:true,identity_isolated:true,mobile_no_overflow:true});
  }
  assert.deepEqual(report.javascript_errors,[]);
  // 使用者已完成這兩份試答；只重新載入既有分頁，不修改其答案。
  const refreshed=[];
  for(const [id,source] of [['D90BF8AD8EC0825BCC3FAD99ADCACF9B',ten],['0287C3CAC1510BC24052B44FD9C40D80',rich]]){
   const existing=browser.targets().find(t=>t._targetId===id);if(!existing)continue;const user=await existing.page();if(user.url()!==source.user_url)continue;
   await user.reload({waitUntil:'domcontentloaded'});await user.waitForFunction(()=>Boolean(document.querySelector('#server-quiz h3')),{polling:'mutation',timeout:20000});
   refreshed.push({url:source.user_url,question:await user.$eval('#server-quiz h3',e=>e.textContent)});
   if(source===rich){const c=await user.target().createCDPSession();try{c.grantForegroundOnce('Page.bringToFront','顯示已修正的最後一題正誤與書商解析');await c.send('Page.bringToFront');}finally{await c.detach();}await user.waitForFunction(()=>[...document.querySelectorAll('#server-quiz img')].every(i=>i.complete&&i.naturalWidth>0),{polling:5000,timeout:20000});await safeScreenshot(user,{path:path.join(folder,'last-question-feedback-fixed.png'),fullPage:true});}
  }
  report.existing_trials_refreshed=refreshed;
  await fs.writeFile(path.join(folder,'last-question-feedback-qa.json'),JSON.stringify(report,null,2),'utf8');console.log(JSON.stringify(report));
  await page.close();
 }finally{await browser.disconnect();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
