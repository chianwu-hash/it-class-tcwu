const fs=require('node:fs'),assert=require('node:assert/strict');
const {connectCdp}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
const puppeteer=require('D:/projects/cdp-tools/node_modules/puppeteer-core');
const origin=process.env.PAST_TEST_ORIGIN||'http://127.0.0.1:4493',out='automation/output/past-learning-publisher-mvp-20261101',targetId=process.argv[2];
const packet=JSON.parse(fs.readFileSync(process.env.PAST_PUBLISHER_PRACTICE_PATH,'utf8'));
let step='starting';const phase=s=>{step=s;fs.writeFileSync(out+'/browser-phase.json',JSON.stringify({step,at:new Date().toISOString()}));};
(async()=>{
 phase('connect');const target=(await(await fetch(process.env.CDP_URL+'/json/list')).json()).find(t=>t.id===targetId);assert(target);
 const c=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl:target.url,puppeteer:{connect:opts=>puppeteer.connect({...opts,networkEnabled:false,protocolTimeout:30000,targetFilter:t=>['browser','tab'].includes(t.type())||t._targetId===targetId})}});
 try{
  const p=c.page;p.setDefaultTimeout(18000);assert.equal(p.target()._targetId,targetId);const errors=[];p.on('pageerror',e=>errors.push(e.message));
  c.session.grantForegroundOnce('Page.bringToFront','驗證書商重點練習並留供使用者試用');await c.session.send('Page.bringToFront');
  await p.setViewport({width:1280,height:1000});await p.goto(origin+'/grade3/115-1/past-exam.html?paper=dingxi-114-1-g3-exam1-science',{waitUntil:'domcontentloaded'});await p.waitForSelector('.question-card');
  async function freshSource(){
   await p.$eval('#restart',n=>{n.closest('details').open=true;});await p.click('#restart');await p.waitForFunction(()=>document.querySelector('input[value="O"]')&&!document.querySelector('input[value="O"]').disabled);
   await p.$eval('#restart',n=>{n.closest('details').open=false;});assert.equal(await p.$('.past-learning-review'),null);
   await p.$eval('input[value="O"]',n=>n.scrollIntoView({block:'center'}));await p.click('input[value="O"]');await new Promise(r=>setTimeout(r,2400));await p.click('#submit');await p.waitForSelector('.past-learning-review');
  }
  phase('source-answer');await freshSource();const sourceScore=await p.$eval('#score',n=>n.textContent);
  const completed=[];
  for(const [index,[conceptId,entry]] of Object.entries(packet.documents).entries()){
   phase('select-'+conceptId);
   const buttons=await p.$$('.past-learning-links button');await buttons[index].evaluate(n=>n.scrollIntoView({block:'center'}));await buttons[index].click();await p.waitForSelector('.past-learning-topic:not([hidden]) .past-learning-start');
   assert.match(await p.$eval('.past-learning-topic:not([hidden])',n=>n.textContent),/康軒/);
   if(index===0){await p.setViewport({width:390,height:1000});await p.$eval('.past-learning-topic:not([hidden])',n=>n.scrollIntoView({block:'center'}));await new Promise(r=>setTimeout(r,10000));await p.screenshot({path:out+'/source-mobile.png',fullPage:false});}
   await p.$eval('.past-learning-topic:not([hidden]) .past-learning-start',n=>n.scrollIntoView({block:'center'}));
   await Promise.all([p.waitForNavigation({waitUntil:'domcontentloaded'}),p.click('.past-learning-topic:not([hidden]) .past-learning-start')]);
   await p.waitForSelector('.quiz-choices input');assert.equal(await p.$('.answer-preview'),null);
   const practiceUrl=p.url();assert.match(practiceUrl,/quiz\.html\?cloud=1/);
   const questions=entry.document.blocks.flatMap(b=>b.questions);
   for(const [qi,q] of questions.entries()){
    phase(conceptId+'-question-'+qi);await p.waitForFunction(id=>document.querySelector('article.question')?.dataset.questionId===id,{},q.id);
    const response=qi===0?q.answer.option_id:q.options.find(o=>o.id!==q.answer.option_id).id;
    await p.$eval(`.quiz-choices input[value="${response}"]`,n=>n.scrollIntoView({block:'center'}));await p.click(`.quiz-choices input[value="${response}"]`);await p.click('#server-submit');await p.waitForSelector('.answer-preview');
    assert.equal(await p.$$eval('.quiz-choices input',ns=>ns.every(n=>n.disabled)),true);
    if(qi===0){
     for(const width of [1280,390,360]){
      await p.setViewport({width,height:1000});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      if(width!==360){await p.$eval('article.question',n=>n.scrollIntoView({block:'start'}));await new Promise(r=>setTimeout(r,10000));await p.screenshot({path:`${out}/${conceptId}-${width}.png`,fullPage:false});}
     }
     const controls=await p.$$('.quiz-actions button');let found=false;for(const b of controls)if(await b.evaluate(n=>n.textContent==='下一題')){await b.evaluate(n=>n.scrollIntoView({block:'center'}));await b.click();found=true;break;}assert(found);
    }
   }
   phase('resume-'+conceptId);await p.reload({waitUntil:'domcontentloaded'});await p.waitForSelector('.answer-preview');assert.equal(await p.$eval('article.question',n=>n.dataset.questionId),questions[1].id);
   completed.push({conceptId,questions:2,mixedAnswers:true,reload:true});
   const back=await p.$('.quiz-workspace-dock .quiz-back-link');assert.match(await back.evaluate(n=>n.textContent),/回原題解析/);await back.evaluate(n=>n.scrollIntoView({block:'center'}));
   await Promise.all([p.waitForNavigation({waitUntil:'domcontentloaded'}),back.click()]);await p.waitForSelector('.past-learning-review');assert.equal(await p.$eval('#score',n=>n.textContent),sourceScore);
  }
  phase('leave-fresh-demo');await freshSource();await p.setViewport({width:1280,height:1000});await p.$eval('.past-learning-links button',n=>n.scrollIntoView({block:'center'}));await p.click('.past-learning-links button');
  assert.deepEqual(errors,[]);phase('completed');
  fs.writeFileSync(out+'/browser-results.json',JSON.stringify({passed:true,at:new Date().toISOString(),completed,widths:[1280,390,360],publisher:'康軒',noPreSubmitReview:true,sourceScoreUnchanged:true,returnToSource:true,previewUrl:p.url(),errors},null,2));console.log('PASS publisher browser: both concepts, all four original questions, return and resume');
 }finally{await c.disconnect();}
})().catch(e=>{fs.writeFileSync(out+'/browser-failure.json',JSON.stringify({step,error:e.stack},null,2));console.error(step+': '+e.stack);process.exitCode=1;});
