const fs=require('node:fs'),assert=require('node:assert/strict');
const {connectCdp}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
const puppeteer=require('D:/projects/cdp-tools/node_modules/puppeteer-core');
const origin='http://127.0.0.1:4497',out='automation/output/past-full-learning-20261101';
(async()=>{
 const id=process.argv[2],targets=await(await fetch(process.env.CDP_URL+'/json/list')).json(),t=targets.find(t=>t.id===id);assert(t);
 const c=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl:t.url,puppeteer:{connect:opts=>puppeteer.connect({...opts,defaultViewport:null,networkEnabled:false,targetFilter:t=>['browser','tab'].includes(t.type())||t._targetId===id})}});
 let phase='init';const errors=[];
 try{
  const p=c.page;p.setDefaultTimeout(22000);p.on('pageerror',e=>errors.push(e.message));
  const goto=async path=>{await p.goto(origin+path,{waitUntil:'domcontentloaded'});};
  const waitCount=async count=>p.waitForFunction(n=>document.querySelector('#extension-count')?.textContent.includes('完成'+n+'道'),{},count);
  const practice=async(qs=2)=>{
   for(let i=0;i<qs;i++){
    await p.waitForSelector('.quiz-choices input');await new Promise(r=>setTimeout(r,2300));
    const option=await p.$('.quiz-choices input');await option.evaluate(n=>n.scrollIntoView({block:'center'}));await option.click();await p.click('#server-submit');await p.waitForSelector('.answer-preview');
    if(i<qs-1){const buttons=await p.$$('.quiz-actions button');for(const b of buttons)if(await b.evaluate(n=>n.textContent==='下一題')){await b.click();break;}await p.waitForSelector('.quiz-choices input');}
   }
  };
  c.session.grantForegroundOnce('Page.bringToFront','驗證本機延伸葉與主動重點複習');await c.session.send('Page.bringToFront');
  await goto('/grade3/115-1/extension-topics.html');await p.waitForSelector('.extension-attempt');await p.click('.extension-attempt');await p.waitForSelector('.extension-topic');
  const reviewUrl=p.url(),concepts=await p.$$eval('.extension-topic',ns=>ns.slice(0,5).map(n=>n.id));assert.equal(concepts.length,5);
  await waitCount(0);
  for(const [ci,topic] of concepts.entries()){
   phase='active-'+ci;await p.goto(reviewUrl,{waitUntil:'domcontentloaded'});await p.waitForSelector('#'+topic);await p.click('#'+topic+' summary');await p.click('#'+topic+' button');await p.waitForSelector('.quiz-choices input');
   assert(new URL(p.url()).searchParams.has('learning_attempt'));
   if(ci===4){
    await practice(1);await waitCount(9);assert.match(await p.$eval('#extension-count',n=>n.textContent),/0片延伸葉/);
    const next=await p.$$('.quiz-actions button');for(const b of next)if(await b.evaluate(n=>n.textContent==='下一題')){await b.click();break;}
    await practice(1);await waitCount(10);assert.match(await p.$eval('#extension-count',n=>n.textContent),/1片延伸葉/);
   }else await practice();
   await p.reload({waitUntil:'domcontentloaded'});await p.waitForSelector('.answer-preview');await waitCount((ci+1)*2);
   const back=await p.$('.quiz-workspace-dock .quiz-back-link');assert.match(await back.evaluate(n=>n.textContent),/回到學習重點/);await back.click();await p.waitForSelector('.extension-topic[open]');assert.equal(p.url().split('?')[0],origin+'/grade3/115-1/extension-topics.html');
  }
  phase='retake';await p.goto(reviewUrl,{waitUntil:'domcontentloaded'});await p.waitForSelector('#'+concepts[0]);await p.click('#'+concepts[0]+' summary');await p.click('#'+concepts[0]+' button');await practice();await waitCount(10);
  phase='wrong-return';await goto('/grade3/115-1/quiz-library.html#wrong');await p.waitForSelector('#wrong-list .wrong-card button');await p.click('#wrong-list .wrong-card button');await p.waitForSelector('.past-learning-links button');const original=new URL(p.url()).searchParams;
  await p.click('.past-learning-links button');await p.click('.past-learning-topic:not([hidden]) .past-learning-start');await practice();
  await p.click('.quiz-workspace-dock .quiz-back-link');await p.waitForSelector('.past-learning-review');const returned=new URL(p.url()).searchParams;
  for(const key of ['wrong_attempt','wrong_version','wrong_group','wrong_question'])assert.equal(returned.get(key),original.get(key));
  phase='tree';await goto('/grade3/115-1/extension-tree.html');await p.waitForSelector('#extension-reward-layer .leaf');assert(await p.$eval('.tree-image',n=>n.complete&&n.naturalWidth>0));
  for(const width of [1280,390,360]){await p.setViewport({width,height:1000});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  await p.setViewport({width:390,height:1000});await p.$eval('.tree-stage',n=>n.scrollIntoView({block:'center'}));await p.screenshot({path:out+'/extension-tree-390.png'});
  phase='full-score';await goto('/grade3/115-1/quiz-library.html?fixture_student=2#wrong');await p.waitForFunction(()=>document.querySelector('#wrong-status')?.textContent.includes('沒有符合'));await p.click('#past-extension-summary a');await p.waitForSelector('.extension-attempt');await p.click('.extension-attempt');await p.waitForSelector('.extension-topic');
  const topic=await p.$('.extension-topic');await topic.$eval('summary',n=>n.click());await topic.$eval('button',n=>n.click());await practice();await p.click('.quiz-workspace-dock .quiz-back-link');await p.waitForSelector('.extension-topic[open]');assert.equal(new URL(p.url()).searchParams.get('fixture_student'),'2');
  phase='logout';await p.evaluate(()=>window.__pastSession(null));await p.waitForFunction(()=>document.querySelector('#extension-count')?.textContent.includes('請先登入'));assert.equal(await p.$('.extension-topic'),null);assert.equal(new URL(p.url()).search,'');
  phase='switch-user';await p.evaluate(()=>window.__pastSession({user:{id:'00000000-0000-4000-8001-000000000001',email:'student1@example.invalid'}}));
  await p.waitForSelector('.extension-attempt');assert(await p.$eval('#cloud-identity',n=>n.textContent.includes('student1@')));
  assert(await p.$$eval('#past-extension-summary a',ns=>ns.every(n=>new URL(n.href).searchParams.get('fixture_student')==='1')));
  await p.click('#past-extension-summary a');await p.waitForSelector('.extension-attempt');assert.equal(new URL(p.url()).searchParams.get('fixture_student'),'1');
  assert.deepEqual(errors,[]);fs.writeFileSync(out+'/extension-browser-results.private.json',JSON.stringify({passed:true,activeReviewRoundtrip:true,wrongRoundtrip:true,tenBoundary:true,retakeDeduplicated:true,fullScoreNoWrong:true,treeImage:true,widths:[1280,390,360],logoutClears:true,errors},null,2));console.log('PASS browser: 9→10 leaf, retake, both return paths, full-score student, tree, mobile and logout');
 }catch(e){fs.writeFileSync(out+'/extension-browser-failure.private.json',JSON.stringify({phase,error:e.message,errors}));throw e;}finally{await c.disconnect();}
})().catch(e=>{console.error(e);process.exitCode=1;});
