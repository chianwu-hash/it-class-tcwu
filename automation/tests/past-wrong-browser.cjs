const fs=require('node:fs'),assert=require('node:assert/strict');
const {connectCdp}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
const puppeteer=require('D:/projects/cdp-tools/node_modules/puppeteer-core');
const origin='http://127.0.0.1:4495',out='automation/output/past-wrong-entry-mvp-20261101',targetId=process.argv[2];
const packet=JSON.parse(fs.readFileSync('automation/output/past-learning-publisher-mvp-20261101/publisher-practice.private.json','utf8'));
let step='connect';const phase=s=>{step=s;fs.writeFileSync(out+'/browser-phase.json',JSON.stringify({step,at:new Date().toISOString()}));};
(async()=>{
 const setup=await(await fetch(origin+'/__past/setup')).json();
 const rpc=async(action,data)=>{const r=await fetch(origin+'/__past/rpc',{method:'POST',headers:{'Content-Type':'application/json','X-Fixture-Nonce':setup.nonce},body:JSON.stringify({action,data,student:2,fast:true})});const result=await r.json();assert(r.ok,JSON.stringify(result));return result;};
 const source=await rpc('restart',{request_id:crypto.randomUUID()});await rpc('view',{attempt_id:source.attemptId,group_id:'s1-q01'});
 await rpc('submit',{attempt_id:source.attemptId,version:setup.version,group_id:'s1-q01',request_id:crypto.randomUUID(),responses:[{questionId:'s1-q01',value:'O'}]});
 const target=(await(await fetch(process.env.CDP_URL+'/json/list')).json()).find(t=>t.id===targetId);assert(target);
 const c=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl:target.url,puppeteer:{connect:opts=>puppeteer.connect({...opts,networkEnabled:false,protocolTimeout:30000,targetFilter:t=>['browser','tab'].includes(t.type())||t._targetId===targetId})}});
 try{
  const p=c.page;p.setDefaultTimeout(20000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
  c.session.grantForegroundOnce('Page.bringToFront','驗證我的錯題本機流程並留供試用');await c.session.send('Page.bringToFront');
  phase('library');await p.setViewport({width:1280,height:1000});await p.goto(origin+'/grade3/115-1/quiz-library.html?fixture_student=2#wrong',{waitUntil:'domcontentloaded'});
  await p.waitForSelector('#wrong-list .wrong-card button');
  await p.click('#wrong-list .wrong-card button');await p.waitForSelector('.past-learning-review');
  const sourceUrl=p.url();assert.match(sourceUrl,/wrong_source=past_exam/);
  assert.match(await p.$eval('#wrong-meta',n=>n.textContent),/考古題/);
  assert.equal(await p.$$('.wrong-extension').then(a=>a.length),0);
  const sourceTitle=await p.$eval('#wrong-title',n=>n.textContent);
  for(const [index,[conceptId,entry]] of Object.entries(packet.documents).entries()){
   phase('concept-'+conceptId);const buttons=await p.$$('.past-learning-links button');await buttons[index].focus();await p.keyboard.press('Enter');
   await p.waitForSelector('.past-learning-topic:not([hidden]) .past-learning-start');assert.equal(await buttons[index].evaluate(n=>n.getAttribute('aria-expanded')),'true');
   for(const width of [1280,390,360]){
    await p.setViewport({width,height:1000});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    if(index===0&&width!==360){await p.$eval('.past-learning-review',n=>n.scrollIntoView({block:'center'}));await new Promise(r=>setTimeout(r,10000));await p.screenshot({path:`${out}/wrong-${width}.png`});}
   }
   phase('practice-'+conceptId);await p.$eval('.past-learning-topic:not([hidden]) .past-learning-start',n=>n.scrollIntoView({block:'center'}));
   await Promise.all([p.waitForNavigation({waitUntil:'domcontentloaded'}),p.click('.past-learning-topic:not([hidden]) .past-learning-start')]);
   await p.waitForSelector('.quiz-choices input');assert.equal(await p.$('.answer-preview'),null);
   assert.match(p.url(),/wrong_attempt=/);
   const questions=entry.document.blocks.flatMap(b=>b.questions);
   for(const [qi,q] of questions.entries()){
    phase(conceptId+'-question-'+qi);await p.waitForFunction(id=>document.querySelector('article.question')?.dataset.questionId===id,{},q.id);
    const response=qi===0?q.answer.option_id:q.options.find(o=>o.id!==q.answer.option_id).id;
    await p.$eval(`.quiz-choices input[value="${response}"]`,n=>n.scrollIntoView({block:'center'}));await p.click(`.quiz-choices input[value="${response}"]`);await p.click('#server-submit');await p.waitForSelector('.answer-preview');
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    if(qi===0){const controls=await p.$$('.quiz-actions button');let next;for(const b of controls)if(await b.evaluate(n=>n.textContent==='下一題'))next=b;assert(next);await next.evaluate(n=>n.scrollIntoView({block:'center'}));await next.click();}
   }
   phase('return-'+conceptId);await p.reload({waitUntil:'domcontentloaded'});await p.waitForSelector('.answer-preview');
   const back=await p.$('.quiz-workspace-dock .quiz-back-link');assert.match(await back.evaluate(n=>n.textContent),/回這道錯題/);await back.evaluate(n=>n.scrollIntoView({block:'center'}));
   await Promise.all([p.waitForNavigation({waitUntil:'domcontentloaded'}),back.click()]);await p.waitForSelector('.past-learning-review');assert.equal(p.url(),sourceUrl);assert.equal(await p.$eval('#wrong-title',n=>n.textContent),sourceTitle);
   await p.reload({waitUntil:'domcontentloaded'});await p.waitForSelector('.past-learning-review');assert.equal(p.url(),sourceUrl);
  }
  phase('source-entry');await p.goto(origin+'/grade3/115-1/past-exam.html?'+new URLSearchParams({paper:setup.paperId,attempt:source.attemptId,fixture_student:'2'}),{waitUntil:'domcontentloaded'});
  await p.waitForSelector('.past-learning-review');assert.equal(await p.$('.past-learning-links'),null);assert.equal(await p.$('.past-learning-start'),null);
  const link=await p.$('.past-learning-review a');assert(link);await link.evaluate(n=>n.scrollIntoView({block:'center'}));await Promise.all([p.waitForNavigation({waitUntil:'domcontentloaded'}),link.click()]);await p.waitForSelector('.past-learning-links');assert.equal(p.url(),sourceUrl);
  phase('account-clear');await p.evaluate(()=>window.__pastSession(null));await p.waitForFunction(()=>!document.querySelector('.past-learning-review'));assert.equal(await p.$eval('#wrong-detail',n=>n.hidden),true);assert(!p.url().includes('wrong_attempt'));
  phase('leave-demo');await p.setViewport({width:1280,height:1000});await p.goto(origin+'/grade3/115-1/quiz-library.html#wrong',{waitUntil:'domcontentloaded'});await p.waitForSelector('#wrong-list .wrong-card button');assert.equal(await p.$$('#wrong-list .wrong-card').then(a=>a.length),1);
  assert.deepEqual(errors,[]);fs.writeFileSync(out+'/browser-results.private.json',JSON.stringify({passed:true,concepts:2,questions:4,exactReturnAndRefresh:true,mobileWidths:[390,360],keyboard:true,logoutClears:true,errors},null,2));phase('done');
 }catch(e){fs.writeFileSync(out+'/browser-failure.private.json',JSON.stringify({step,error:e.stack},null,2));throw e;}finally{await c.disconnect();}
})().catch(e=>{console.error(e);process.exitCode=1;});
