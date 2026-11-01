const fs=require('node:fs'),assert=require('node:assert/strict');
const {connectCdp}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
const puppeteer=require('D:/projects/cdp-tools/node_modules/puppeteer-core');
const origin=process.env.PAST_TEST_ORIGIN||'http://127.0.0.1:4497',out='automation/output/past-full-learning-20261101',targetId=process.argv[2];
const read=name=>JSON.parse(fs.readFileSync(out+'/'+name,'utf8')),map=read('learning-map.private.json'),bundle=read('source-bundle.private.json'),packet=read('publisher-practice.private.json');
let step='setup';const phase=s=>{step=s;fs.writeFileSync(out+'/browser-phase.json',JSON.stringify({step,at:new Date().toISOString()}));};
(async()=>{
 const setup=await(await fetch(origin+'/__past/setup')).json(),{demoWrongResponses}=await import('../lib/past-demo-responses.mjs');
 const rpc=async(action,data)=>{const r=await fetch(origin+'/__past/rpc',{method:'POST',headers:{'Content-Type':'application/json','X-Fixture-Nonce':setup.nonce},body:JSON.stringify({action,data,student:2,fast:true})});const value=await r.json();assert(r.ok,JSON.stringify(value));return value;};
 const source=await rpc('restart',{request_id:crypto.randomUUID()});
 for(const g of bundle.document.groups){await rpc('view',{attempt_id:source.attemptId,group_id:g.id});await rpc('submit',{attempt_id:source.attemptId,version:setup.version,group_id:g.id,confirmed:true,request_id:crypto.randomUUID(),responses:demoWrongResponses(g)});}
 const urlFor=e=>origin+'/grade3/115-1/quiz-library.html?'+new URLSearchParams({fixture_student:'2',wrong_source:'past_exam',wrong_attempt:source.attemptId,wrong_paper:setup.paperId,wrong_version:setup.version,wrong_group:e.groupId,wrong_question:e.questionId})+'#wrong';
 const target=(await(await fetch(process.env.CDP_URL+'/json/list')).json()).find(t=>t.id===targetId);assert(target);
 const c=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl:target.url,puppeteer:{connect:opts=>puppeteer.connect({...opts,networkEnabled:false,protocolTimeout:30000,targetFilter:t=>['browser','tab'].includes(t.type())||t._targetId===targetId})}});
 try{
  const p=c.page;p.setDefaultTimeout(18000);const errors=[],requests=[],bootRetries=[];p.on('pageerror',e=>errors.push(e.message));
  await p.evaluateOnNewDocument(()=>{const original=window.fetch;window.__qaFetch=[];window.fetch=(input,...args)=>{window.__qaFetch.push(typeof input==='string'?input:input.url);return original(input,...args);};});
  const collect=async()=>{requests.push(...await p.evaluate(()=>window.__qaFetch||[]));};
  const goto=async url=>{await collect();await p.goto(url,{waitUntil:'domcontentloaded'});};
  const waitPractice=async()=>{
   try{await p.waitForSelector('.quiz-choices input');}catch(error){
    const state=await p.evaluate(()=>({url:location.href,title:document.title,body:document.body.innerText,fetches:window.__qaFetch||[]}));
    if(state.title!=='我的課堂測驗'||state.fetches.length||bootRetries.length)throw error;
    bootRetries.push(state);fs.writeFileSync(out+'/browser-boot-retry.private.json',JSON.stringify(state,null,2));
    await p.reload({waitUntil:'domcontentloaded'});await p.waitForSelector('.quiz-choices input');
   }
  };
  c.session.grantForegroundOnce('Page.bringToFront','驗證全卷本機錯題延伸並留供試用');await c.session.send('Page.bringToFront');
  phase('existing-library');await p.setViewport({width:1280,height:1000});await goto(origin+'/grade3/115-1/quiz-library.html#wrong');await p.waitForSelector('#wrong-list .wrong-card button');
  assert.match(await p.$eval('#wrong-status',n=>n.textContent),/66/);assert.equal(await p.$eval('#tab-wrong',n=>n.getAttribute('aria-selected')),'true');
  await p.click('#wrong-list .wrong-card button');await p.waitForSelector('.past-learning-review');await p.click('#wrong-back');
  for(let page=0;page<4;page++){
   await p.waitForFunction(count=>document.querySelectorAll('#wrong-list .wrong-card').length===count,{},page===3?6:20);
   if(page<3){await p.$eval('#wrong-pages button:last-child',n=>n.scrollIntoView({block:'center'}));await p.click('#wrong-pages button:last-child');await p.waitForFunction(n=>document.querySelector('#wrong-pages span')?.textContent.includes('第 '+n+'／'),{},page+2);}
  }
  const representatives=['s1-q01','s3-q04-4','s3-q02','s3-q06-3','s3-q07-1','s3-q08-1','s3-q08-2','s3-q10-1','s3-q09-6'];
  for(const [index,qid] of representatives.entries()){
   phase('wrong-detail-'+qid);const entry=map.questions.find(e=>e.questionId===qid);await goto(urlFor(entry));await p.waitForSelector('.past-learning-review');
   assert.match(await p.$eval('#wrong-detail',n=>n.textContent),new RegExp(entry.explanation.slice(0,7).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
   await p.waitForFunction(()=>[...document.querySelectorAll('#wrong-detail img')].every(n=>n.complete&&n.naturalWidth>0));
   for(const width of [1280,390,360]){await p.setViewport({width,height:1000});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
   if(['s3-q06-3','s3-q02'].includes(qid)){
    await p.setViewport({width:390,height:1000});await p.$eval('#wrong-detail .question',n=>n.scrollIntoView({block:'start'}));await new Promise(r=>setTimeout(r,10000));await p.screenshot({path:out+'/'+qid+'-390.png'});
   }
   const button=await p.$('.past-learning-links button');await button.focus();await p.keyboard.press('Enter');await p.waitForSelector('.past-learning-topic:not([hidden])');assert.equal(await button.evaluate(n=>n.getAttribute('aria-expanded')),'true');
  }
  const practiced=[];
  const tasks=map.concepts.map(concept=>({concept,entry:map.questions.find(e=>!e.selfCheck&&e.conceptIds.includes(concept.id))}));
  tasks.push({concept:map.concepts.find(c=>c.id==='root-types'),entry:map.questions.filter(e=>!e.selfCheck&&e.conceptIds.includes('root-types'))[1]});
  for(const [index,{concept,entry}] of tasks.entries()){
   phase('practice-'+concept.id+'-'+entry.questionId);await goto(urlFor(entry));await p.waitForSelector('.past-learning-links');
   const button=await p.$(`.past-learning-links button[aria-controls$="-${concept.id}"]`);assert(button);await button.evaluate(n=>n.scrollIntoView({block:'center'}));await button.click();
   await p.$eval('.past-learning-topic:not([hidden]) .past-learning-start',n=>n.scrollIntoView({block:'center'}));await collect();
   await Promise.all([p.waitForNavigation({waitUntil:'domcontentloaded'}),p.click('.past-learning-topic:not([hidden]) .past-learning-start')]);await waitPractice();assert.equal(await p.$('.answer-preview'),null);
   const qs=packet.documents[concept.id].document.blocks.flatMap(b=>b.questions);
   for(const [qi,q] of qs.entries()){
    await p.waitForFunction(id=>document.querySelector('article.question')?.dataset.questionId===id,{},q.id);
    const response=qi===0?q.answer.option_id:q.options.find(o=>o.id!==q.answer.option_id).id;
    await p.$eval(`.quiz-choices input[value="${response}"]`,n=>n.scrollIntoView({block:'center'}));await p.click(`.quiz-choices input[value="${response}"]`);await p.click('#server-submit');await p.waitForSelector('.answer-preview');
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    if(qi===0){const controls=await p.$$('.quiz-actions button');let next;for(const b of controls)if(await b.evaluate(n=>n.textContent==='下一題'))next=b;assert(next);await next.evaluate(n=>n.scrollIntoView({block:'center'}));await next.click();}
   }
   await collect();await p.reload({waitUntil:'domcontentloaded'});await p.waitForSelector('.answer-preview');
   const back=await p.$('.quiz-workspace-dock .quiz-back-link');assert.match(await back.evaluate(n=>n.textContent),/回這道錯題/);await back.evaluate(n=>n.scrollIntoView({block:'center'}));await collect();
   await Promise.all([p.waitForNavigation({waitUntil:'domcontentloaded'}),back.click()]);await p.waitForSelector('.past-learning-review');
   const u=new URL(p.url());assert.equal(u.searchParams.get('wrong_attempt'),source.attemptId);assert.equal(u.searchParams.get('wrong_version'),setup.version);assert.equal(u.searchParams.get('wrong_group'),entry.groupId);assert.equal(u.searchParams.get('wrong_question'),entry.questionId);
   await collect();await p.reload({waitUntil:'domcontentloaded'});await p.waitForSelector('.past-learning-review');practiced.push(concept.id);
  }
  const originalUrl=origin+'/grade3/115-1/past-exam.html?'+new URLSearchParams({paper:setup.paperId,attempt:source.attemptId,fixture_student:'2'});
  phase('original-wrong-link');await goto(originalUrl);await p.waitForSelector('.past-learning-review a');assert.equal(await p.$('.past-learning-links'),null);
  const originalLink=await p.$('.past-learning-review a');await originalLink.evaluate(n=>n.scrollIntoView({block:'center'}));await collect();await Promise.all([p.waitForNavigation({waitUntil:'domcontentloaded'}),originalLink.click()]);await p.waitForSelector('.past-learning-review');assert.equal(new URL(p.url()).searchParams.get('wrong_question'),'s1-q01');
  phase('original-manual-explanation');await goto(originalUrl);await p.waitForSelector('.question-card');
  await p.$eval('#steps',n=>n.closest('details').open=true);const steps=await p.$$('#steps button');assert.equal(steps.length,42);await steps.at(-1).evaluate(n=>n.scrollIntoView({block:'center'}));await steps.at(-1).click();
  await p.waitForFunction(()=>document.querySelector('.past-learning-review h3')?.textContent==='這題怎麼自我核對？');assert.equal(await p.$('.past-learning-start'),null);assert.equal(await p.$('.past-learning-links'),null);
  for(const width of [1280,390,360]){await p.setViewport({width,height:1000});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  phase('logout-clear');await goto(urlFor(map.questions[0]));await p.waitForSelector('.past-learning-review');await p.evaluate(()=>window.__pastSession(null));await p.waitForFunction(()=>!document.querySelector('.past-learning-review'));assert(!p.url().includes('wrong_attempt'));
  phase('leave-user-demo');await p.setViewport({width:1280,height:1000});await goto(origin+'/grade3/115-1/quiz-library.html#wrong');await p.waitForSelector('#wrong-list .wrong-card button');await collect();
  assert.deepEqual(errors,[]);assert(requests.every(u=>new URL(u,origin).origin===origin),'study fetches stay on the local fixed-data server');
  fs.writeFileSync(out+'/browser-results.private.json',JSON.stringify({passed:true,sourceAttempt:source.attemptId,version:setup.version,representatives,concepts:practiced,publisherQuestions:44,publisherAnswers:46,additionalSharedSourceChecks:1,originalWrongLink:true,exactReturnAndRefresh:true,mobileWidths:[390,360],keyboard:true,manualExplanation:true,logoutClears:true,studentFetchesLocalOnly:true,fetchCount:requests.length,initializationRetries:bootRetries.length,errors},null,2));phase('done');
 }catch(e){fs.writeFileSync(out+'/browser-failure.private.json',JSON.stringify({step,error:e.stack},null,2));throw e;}finally{await c.disconnect();}
})().catch(e=>{console.error(e);process.exitCode=1;});
