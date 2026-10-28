// Small production smoke test, never a load test. Only the configured QA student's new five-question paper.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),{createRequire}=require('node:module');
const runtime=createRequire('D:/projects/cdp-tools/package.json'),{connectCdp}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
(async()=>{
 const url=process.env.QUIZ_BROWSER_URL;assert.equal(new URL(url).hostname,'it-class-tcwu.vercel.app');
 const qa=JSON.parse(await fs.readFile('automation/output/quiz/drive-library/qa-session.json'));
 const answers=new Map(JSON.parse(await fs.readFile('automation/output/quiz/hanlin-g3-math-pool/pool.json')).map(r=>[r.question_id,r.question.answer.option_id]));
 const {browser}=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl:url,puppeteer:runtime('puppeteer-core')});
 const out='automation/output/quiz/bench-performance-20261028';let page,sid,report={passed:false},original;
 async function identity(){return page.evaluate(async uid=>{
  const auth=await import('/shared/auth.js'),session=(await auth.supabase.auth.getSession()).data.session;
  if(session?.user.id!==uid||session.user.email!=='chianwu@apps.ntpc.edu.tw'||!document.querySelector('#auth-status')?.title.includes(session.user.email))throw Error('qa_identity_mismatch');
  const {createQuizRequest}=await import('/shared/quiz-api.mjs?v=20261028-performance');window.__perfRequest=await createQuizRequest({getSession:()=>session});return true;
 },qa.testUserId);}
 try{
  page=await browser.targets().find(t=>t._targetId===process.argv[2]).page();page.setDefaultTimeout(25000);
  const c=await page.target().createCDPSession();c.grantForegroundOnce('Page.bringToFront','正式驗證已核對QA學生的精簡送答與雲端接續');await c.send('Page.bringToFront');
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url,{waitUntil:'networkidle0'});await page.waitForFunction(()=>!document.querySelector('#compose-toggle')?.disabled);await identity();
  original=await page.evaluate(()=>window.__perfRequest('library_sessions'));
  const made=await page.evaluate(()=>window.__perfRequest('compose',{kind:'self',course_id:'115-1-hanlin-g3-math',units:[3],count:5,name_work:'寶可夢',request_id:crypto.randomUUID()}));sid=made.session_id;
  const joined=await page.evaluate(id=>window.__perfRequest('join',{session_id:id}),sid);assert.equal(joined.document.questions.length,5);
  await page.goto(new URL('/grade3/115-1/quiz.html?cloud=1&session='+sid+'&qa=performance20261028',url).href,{waitUntil:'networkidle0'});await page.waitForSelector('#server-submit');await identity();
  const qid=await page.$eval('.question',e=>e.dataset.questionId),right=answers.get(qid);assert.ok(right);
  let lightbox=false;if(await page.$('#server-quiz img')){await page.waitForFunction(()=>[...document.querySelectorAll('#server-quiz img')].every(i=>i.complete&&i.naturalWidth>0));await page.click('#server-quiz img');await page.waitForSelector('#lightbox:not(.hidden)');await page.click('#lightbox-close');lightbox=true;}
  await page.click(`.student-option input[value="${right}"]`);await new Promise(r=>setTimeout(r,2300));
  const waiting=page.waitForResponse(r=>{try{return r.url().includes('/rpc/quiz_action')&&JSON.parse(r.request().postData()||'{}').p_action==='submit';}catch{return false;}});
  await page.click('#server-submit');const response=await waiting,result=await response.json();
  assert.equal(result.compact,true);assert.equal(result.document,undefined);assert.equal(result.responses[qid],right);assert.equal(result.reviews.find(r=>r.question_id===qid).correct,true);assert.notEqual(result.leaf?.earned_now,true);
  await page.waitForSelector('.answer-preview');assert.match(await page.$eval('.progress-label',e=>e.textContent),/1 \/ 5/);
  const resumed=await page.evaluate(id=>window.__perfRequest('resume',{session_id:id}),sid);assert.deepEqual(resumed.document,joined.document);assert.equal(resumed.responses[qid],right);
  await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('#server-submit');assert.match(await page.$eval('.progress-label',e=>e.textContent),/1 \/ 5/);await identity();
  await page.evaluate(id=>window.__perfRequest('delete_paper',{session_id:id}),sid);
  const after=await page.evaluate(()=>window.__perfRequest('library_sessions'));assert.deepEqual(after.sessions.map(s=>s.id).sort(),original.sessions.map(s=>s.id).sort());assert.deepEqual(errors,[]);
  report={passed:true,identityVerified:true,newFiveQuestionPaperOnly:true,compact:true,persistedCorrectAnswer:true,resumeAndReload:true,noLeafForFive:true,existingPapersUnchanged:true,removedOnlyNewPaper:true,lightbox,errors};console.log(JSON.stringify(report));
 }finally{await fs.writeFile(out+'/production-browser.json',JSON.stringify({...report,qaPaper:sid},null,2));await browser.disconnect();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
