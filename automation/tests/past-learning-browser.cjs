const fs=require('node:fs'),assert=require('node:assert/strict');
const {connectCdp}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
const puppeteer=require('D:/projects/cdp-tools/node_modules/puppeteer-core');
const origin='http://127.0.0.1:4491',out='automation/output/past-exam-learning-mvp-20261101',targetId=process.argv[2];
let step='starting';const phase=value=>{step=value;fs.writeFileSync(out+'/browser-phase.json',JSON.stringify({step,at:new Date().toISOString()}));};
(async()=>{
 phase('connect');
 const targets=await(await fetch(process.env.CDP_URL+'/json/list')).json(),target=targets.find(t=>t.id===targetId);assert(target,'exact target required');
 const c=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl:target.url,puppeteer:{connect:options=>puppeteer.connect({...options,networkEnabled:false,protocolTimeout:30000,targetFilter:t=>['browser','tab'].includes(t.type())||t._targetId===targetId})}});
 try{
  const p=c.page;assert.equal(p.target()._targetId,targetId);p.setDefaultTimeout(15000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
  c.session.grantForegroundOnce('Page.bringToFront','檢查本機單題學習重點 MVP 並留供教師操作');await c.session.send('Page.bringToFront');
  phase('load');await p.setViewport({width:1280,height:1000});await p.goto(origin+'/grade3/115-1/past-exam.html?paper=dingxi-114-1-g3-exam1-science',{waitUntil:'domcontentloaded'});
  await p.waitForSelector('.question-card');
  // The real start action resumes unfinished attempts. Explicitly start a new one for this test.
  await p.$eval('#restart',n=>{n.closest('details').open=true;});await p.click('#restart');
  await p.waitForFunction(()=>!document.querySelector('.past-learning-review')&&document.querySelector('input[value="O"]')&&!document.querySelector('input[value="O"]').disabled);
  await p.$eval('#restart',n=>{n.closest('details').open=false;});assert.equal(await p.$('.past-learning-review'),null);
  phase('answer');await p.$eval('input[value="O"]',n=>n.scrollIntoView({block:'center'}));await p.click('input[value="O"]');await new Promise(r=>setTimeout(r,9000));await p.click('#submit');
  await p.waitForSelector('.past-learning-review');assert.match(await p.$eval('.feedback',n=>n.textContent),/核對答案：X/);assert.equal(await p.$$eval('.past-learning-links button',ns=>ns.length),2);
  assert.equal(await p.$$eval('.past-learning-topic:not([hidden])',ns=>ns.length),0);
  for(const width of [1280,390,360]){
   phase('viewport-'+width);
   await p.setViewport({width,height:1000});await p.$eval('.past-learning-links button',n=>n.scrollIntoView({block:'center'}));await p.click('.past-learning-links button');
   // Close then reopen if the previous viewport left this topic expanded.
   if(await p.$$eval('.past-learning-topic:not([hidden])',ns=>ns.length)===0)await p.click('.past-learning-links button');
   assert.match(await p.$eval('.past-learning-topic:not([hidden])',n=>n.textContent),/植物不會像動物/);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   phase('screenshot-'+width);await p.$eval('.past-learning-review',n=>n.scrollIntoView({block:'center'}));await new Promise(r=>setTimeout(r,10000));await p.screenshot({path:`${out}/learning-${width}.png`,fullPage:false});
  }
  phase('second-topic-and-keyboard');
  await p.$eval('.past-learning-links button:nth-child(2)',n=>n.scrollIntoView({block:'center'}));await p.click('.past-learning-links button:nth-child(2)');
  assert.match(await p.$eval('.past-learning-topic:not([hidden])',n=>n.textContent),/花盆/);
  await p.focus('.past-learning-links button');await p.keyboard.press('Enter');
  assert.equal(await p.$eval('.past-learning-links button',n=>n.getAttribute('aria-expanded')),'true');
  assert.equal(await p.evaluate(()=>document.activeElement.classList.contains('past-learning-topic')),true);
  phase('reload');await p.reload({waitUntil:'domcontentloaded'});await p.waitForSelector('.past-learning-review');
  await p.$eval('.actions-left button',n=>n.scrollIntoView({block:'center'}));await p.click('.actions-left button');await p.waitForFunction(()=>document.querySelector('.question-card').dataset.groupId==='s1-q02');assert.equal(await p.$('.past-learning-review'),null);
  await p.click('.actions-left button');await p.waitForSelector('.past-learning-review');
  phase('switch-account');await p.evaluate(()=>{const u=new URL(location.href);u.searchParams.delete('attempt');history.replaceState(null,'',u);window.__pastSession({user:{id:'00000000-0000-4000-8001-000000000002',email:'student2@example.invalid'}});});await p.waitForFunction(()=>document.querySelector('.question-card')&&!document.querySelector('.past-learning-review'));
  await p.evaluate(()=>window.__pastSession(null));await p.waitForFunction(()=>document.querySelector('#quiz-content').hidden);assert.equal(await p.$('.past-learning-review'),null);
  await p.evaluate(()=>{const u=new URL(location.href);u.searchParams.delete('attempt');history.replaceState(null,'',u);window.__pastSession({user:{id:'00000000-0000-4000-8001-000000000001',email:'student1@example.invalid'}});});await p.waitForSelector('.question-card');
  // Leave a fresh first question for the teacher, with no tests' answer already selected.
  await p.$eval('#restart',n=>{n.closest('details').open=true;});await p.click('#restart');await p.waitForFunction(()=>!document.querySelector('.past-learning-review')&&document.querySelector('input[value="O"]')&&!document.querySelector('input[value="O"]').disabled);
  await p.setViewport({width:1280,height:1000});await p.evaluate(()=>scrollTo(0,0));assert.deepEqual(errors,[]);
  phase('completed');fs.writeFileSync(out+'/browser-results.json',JSON.stringify({passed:true,at:new Date().toISOString(),widths:[1280,390,360],beforeSubmitHidden:true,wrongAnswerReview:true,concepts:2,clickBoth:true,keyboardEnterAndFocus:true,reload:true,otherQuestionHidden:true,accountSwitch:true,logoutClears:true,restartClears:true,errors},null,2));console.log('PASS learning review browser');
 }finally{await c.disconnect();}
})().catch(e=>{fs.writeFileSync(out+'/browser-failure.json',JSON.stringify({step,at:new Date().toISOString(),error:e.stack},null,2));console.error(step+': '+e.stack);process.exitCode=1;});
