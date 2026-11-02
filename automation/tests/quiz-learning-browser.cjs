const fs=require('node:fs'),assert=require('node:assert/strict');
const {connectCdp}=require('D:/projects/cdp-tools/packages/cdp-safe-client');const puppeteer=require('D:/projects/cdp-tools/node_modules/puppeteer-core');
const origin=process.env.LEARNING_BROWSER_ORIGIN||'http://127.0.0.1:4501',out=process.env.LEARNING_PROOF_ROOT;
(async()=>{
 const id=process.argv[2],t=(await(await fetch(process.env.CDP_URL+'/json/list')).json()).find(t=>t.id===id);assert(t);
 const c=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl:t.url,puppeteer:{connect:o=>puppeteer.connect({...o,defaultViewport:null,networkEnabled:false,protocolTimeout:25000,targetFilter:t=>['browser','tab'].includes(t.type())||t._targetId===id})}});
 let phase='init';const errors=[],consoleErrors=[];
 try{
  const p=c.page;p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  c.session.grantForegroundOnce('Page.bringToFront','驗證正式轉接介面、延伸葉動畫及手機動線');await c.session.send('Page.bringToFront');
  const goto=async path=>p.goto(origin+path,{waitUntil:'domcontentloaded'});
  const solve=async({celebrate=false}={})=>{
   for(let i=0;i<2;i++){
    await p.waitForSelector('.quiz-choices input');await new Promise(r=>setTimeout(r,2250));const option=await p.$('.quiz-choices input');await option.evaluate(n=>n.scrollIntoView({block:'center'}));await option.click();await p.click('#server-submit');await p.waitForSelector('.answer-preview');
    if(celebrate&&i===1){await p.waitForSelector('.quiz-leaf-celebration');assert.match(await p.$eval('.quiz-leaf-celebration strong',n=>n.textContent),/延伸葉/);assert.equal(await p.$eval('.quiz-leaf-celebration',n=>n.getAttribute('role')),'status');await p.screenshot({path:out+'/learning-celebration.png'});}
    if(i===0){for(const b of await p.$$('.quiz-actions button'))if(await b.evaluate(n=>n.textContent==='下一題')){await b.click();break;}}
   }
  };
  await goto('/grade3/115-1/quiz-library.html?fixture_student=1#wrong');await p.waitForSelector('#wrong-list .wrong-card');await p.waitForFunction(()=>document.querySelector('#learning-count')?.textContent.includes('完成9道'));
  phase='wrong';await p.click('#wrong-list button[data-question-id="s1-q03"]');await p.waitForSelector('.past-learning-links');const ref=p.url();await p.click('.past-learning-links button[aria-controls$="-stem-types"]');await p.click('.past-learning-topic:not([hidden]) .past-learning-start');await solve({celebrate:true});
  await p.reload({waitUntil:'domcontentloaded'});await p.waitForSelector('.answer-preview');assert.equal(await p.$('.quiz-leaf-celebration'),null);await p.click('.quiz-workspace-dock .quiz-back-link');await p.waitForSelector('.past-learning-review');
  for(const key of ['wrong_source','wrong_attempt','wrong_question','wrong_paper','wrong_version','wrong_group'])assert.equal(new URL(p.url()).searchParams.get(key),new URL(ref).searchParams.get(key));
  phase='retake';await p.click('.past-learning-links button[aria-controls$="-stem-types"]');await p.click('.past-learning-topic:not([hidden]) .past-learning-start');await solve();assert.equal(await p.$('.quiz-leaf-celebration'),null);
  phase='full-score';await goto('/grade3/115-1/learning.html?fixture_student=2');await p.waitForSelector('.learning-attempt');await p.click('.learning-attempt');await p.waitForSelector('.learning-topic');await p.click('.learning-topic summary');await p.click('.learning-topic[open] button');await solve();await p.click('.quiz-workspace-dock .quiz-back-link');await p.waitForSelector('.learning-topic[open]');
  phase='tree';await goto('/my-tree.html?course=grade3-115-1&fixture_student=2');await p.waitForSelector('.reward.leaf:not(.ghost)');assert(await p.$eval('.reward-layer',n=>n.innerText!==undefined));assert.equal((await p.$$('.reward.leaf:not(.ghost)')).length,2);assert.equal((await p.$$('.reward.flower:not(.ghost)')).length,1);
  for(const width of [1280,390,360]){await p.setViewport({width,height:1000});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  await p.setViewport({width:390,height:1000});await p.$eval('.tree-stage',n=>n.scrollIntoView({block:'center'}));await p.screenshot({path:out+'/learning-tree-390.png'});
  phase='logout';await goto('/grade3/115-1/learning.html?fixture_student=2');await p.waitForSelector('.learning-attempt');await p.evaluate(()=>window.__learningAuth(null));await p.waitForFunction(()=>document.querySelector('[data-learning-topics]')?.textContent.includes('請先登入'));assert.equal(await p.$('.learning-attempt'),null);
  assert.deepEqual(errors,[]);fs.writeFileSync(out+'/learning-browser-results.private.json',JSON.stringify({passed:true,celebration:true,noReplayCelebration:true,wrongReturn:true,activeReviewReturn:true,fullScoreReview:true,existingFlowerAndLeaf:true,extensionLeaf:true,widths:[1280,390,360],logout:true,errors},null,2));console.log('PASS learning browser, celebration, both return paths, existing tree rewards, mobile and logout');
 }catch(e){let body='';try{body=await c.page.evaluate(()=>document.body.innerText.slice(0,1800));}catch{}fs.writeFileSync(out+'/learning-browser-error.private.json',JSON.stringify({phase,error:e.message,errors,consoleErrors,body}));throw e;}finally{await c.disconnect();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
