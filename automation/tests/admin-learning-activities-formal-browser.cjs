const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const puppeteer=require('D:/projects/cdp-tools/node_modules/puppeteer-core');
const out=path.resolve("automation/output/admin-learning-activities-20261105");
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const browser=await puppeteer.connect({browserURL:process.env.AI_WORK_BROWSER_CDP_URL,defaultViewport:null,protocolTimeout:25000});let page,hook;
 try{
  const target=browser.targets().find(t=>t._targetId===process.argv[2]);if(!target)throw Error('owned_target_missing');page=await target.page();const errors=[];page.on('pageerror',()=>errors.push('page_script_error'));
  hook=await page.evaluateOnNewDocument(()=>{const original=window.fetch;window.__learningChecks=[];window.__learningOriginal=original;window.fetch=async(...args)=>{const r=await original(...args);if(String(args[0]).includes('/rest/v1/rpc/admin_learning_')){const request=JSON.parse(args[1].body);window.__learningChecks.push({request,status:r.status,data:await r.clone().json()});}return r;};});
  await page.setViewport({width:1280,height:1000});await page.goto('https://it-class-tcwu.vercel.app/admin-learning.html',{waitUntil:'domcontentloaded'});
  const cdp=await page.target().createCDPSession();cdp.grantForegroundOnce('Page.bringToFront','正式站教師Google登入及新增活動驗證');await cdp.send('Page.bringToFront');
  let clicked=false,ready=false;
  for(let i=0;i<12;i++){
   const state=await page.evaluate(()=>({host:location.hostname,teacher:document.querySelector('#identity')?.textContent==='chianwu@gmail.com',ready:!!document.querySelector('#roster-list .student-button'),locked:document.querySelector('#locked')?.hidden===false}));
   if(state.host==='it-class-tcwu.vercel.app'&&state.teacher&&state.ready){ready=true;break;}
   if(state.locked&&!clicked){await page.click('#teacher-login');clicked=true;console.log('Teacher Google login');}
   if(state.host==='accounts.google.com'){const account=await page.$('[data-identifier="chianwu@gmail.com"]');if(account)await account.click();}
   await new Promise(r=>setTimeout(r,5000));
  }
  assert.equal(ready,true,'real_google_teacher_login_required');console.log('Teacher ready');
  const results=[];
  for(const grade of [4,9,3,6]){
   const course=`grade${grade}-115-1`;console.log('Verify grade '+grade);await page.select('#course',course);
   await page.waitForFunction(course=>window.__learningChecks.some(x=>x.request.p_course_id===course&&x.request.p_action==='roster'&&x.status===200),{},course);
   const chosen=await page.evaluate(async course=>{
    const roster=window.__learningChecks.filter(x=>x.request.p_course_id===course&&x.request.p_action==='roster').at(-1).data;
    const auth=await import('/shared/auth.js');
    for(const student of roster.items.filter(x=>Number(x.mappings)===1)){
     const r=await fetch(`${auth.SUPABASE_URL}/rest/v1/rpc/admin_learning_action`,{method:'POST',headers:{'Content-Type':'application/json',apikey:auth.SUPABASE_ANON_KEY,Authorization:`Bearer ${auth.getStoredAccessToken()}`},body:JSON.stringify({p_action:'papers',p_course_id:course,p_payload:{class_code:student.class_code,seat_no:student.seat_no,activity_type:'past_exam'}})});
     if(!r.ok)throw Error('teacher_probe_failed');const data=await r.json();if(data.total>0)return {code:student.student_code,total:roster.total,past:data.total};
    }
    const student=roster.items.find(x=>Number(x.mappings)===1);return {code:student?.student_code,total:roster.total,past:0};
   },course);
   assert.ok(chosen.code,'linked_roster_sample_required');await page.click(`.student-button[data-student-code="${chosen.code}"]`);
   await page.waitForFunction(()=>document.querySelector('#mapping-status').textContent.startsWith('已依'));await page.waitForSelector('#record-section:not([hidden])');await page.click('#tab-papers');
   await page.select('#paper-activity','past_exam');assert.ok((await page.$eval('#paper-filter-status',e=>e.textContent)).includes('請按'));
   await page.$eval('#paper-filters',e=>e.requestSubmit());
   await page.waitForFunction(()=>document.querySelector('#paper-filter-status').textContent.startsWith('考古題・'));
   const rows=await page.$$eval('#records [data-activity-type]',rows=>rows.map(r=>r.dataset.activityType));assert.ok(rows.every(v=>v==='past_exam'));
   let detailVerified=false,images=0;
   if(chosen.past){
    assert.ok(rows.length>0);await page.click('#records button');await page.waitForSelector('#detail-content .question-card');
    const detail=await page.evaluate(()=>window.__learningChecks.filter(x=>x.request.p_action==='paper'&&x.status===200).at(-1).data);
    assert.equal(detail.activity_type,'past_exam');assert.ok(detail.version_id);assert.equal(await page.$$eval('#detail-content .question-card',n=>n.length),detail.items.length);
    const keys=await page.$$eval('#detail-content .question-card',n=>n.map(e=>[e.dataset.groupId,e.dataset.questionId]));assert.deepEqual(keys,detail.items.map(i=>[i.group_id,i.question.id]));
    const answersMatch=await page.evaluate(async detail=>{
     const {pastAnswerText}=await import('/shared/admin-learning-activities.mjs?v=20261105-reference');
     return [...document.querySelectorAll('#detail-content .question-card')].every((card,i)=>{
      const item=detail.items[i],f=item.field,values=[...card.querySelectorAll('.answer-grid .answer-box > span')].map(e=>e.textContent);
      return values[0]===(item.answered?pastAnswerText(item.response,item.group.kind):'尚未作答')&&values[1]===pastAnswerText(item.official??f.displayAnswer??f.answer??f.reference,item.group.kind);
     });
    },detail);assert.equal(answersMatch,true,'saved_answers_and_reference_must_match');
    for(const img of await page.$$('#detail-content img[data-quiz-media-url]')){await img.evaluate(e=>e.scrollIntoView({block:'center'}));await page.waitForFunction(el=>el.complete&&el.naturalWidth>0,{},img);images++;}
    await page.click('#only-wrong');await page.waitForFunction(()=>document.querySelector('#detail-content').getAttribute('aria-busy')!=='true');
    const wrong=await page.evaluate(()=>window.__learningChecks.filter(x=>x.request.p_action==='paper'&&x.request.p_payload.filter==='wrong'&&x.status===200).at(-1)?.data);assert.ok(wrong);assert.ok(wrong.items.every(i=>i.correct===false&&i.answered));
    detailVerified=true;await page.click('#close-detail');
   }
   await page.select('#paper-activity','extension');await page.$eval('#paper-filters',e=>e.requestSubmit());await page.waitForFunction(()=>document.querySelector('#paper-filter-status').textContent.startsWith('延伸練習・'));
   assert.ok((await page.$$eval('#records [data-activity-type]',r=>r.map(e=>e.dataset.activityType))).every(v=>v==='extension'));
   await page.select('#paper-activity','self');await page.$eval('#paper-filters',e=>e.requestSubmit());await page.waitForFunction(()=>document.querySelector('#paper-filter-status').textContent.startsWith('自組卷・'));
   assert.ok((await page.$$eval('#records [data-activity-type]',r=>r.map(e=>e.dataset.activityType))).every(v=>v==='self'));
   for(const width of [1280,768,390]){await page.setViewport({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);}
   await page.setViewport({width:1280,height:1000});
   await page.select('#reward-class',chosen.code.slice(0,3));await page.waitForSelector('.class-reward-table tbody tr');
   assert.equal(await page.$eval('.class-table-wrap',e=>e.scrollWidth<=e.clientWidth+1),true);
   results.push({grade,roster:chosen.total,pastRecordsForSample:chosen.past,detailVerified,answersMatch:detailVerified,images,activityFilter:true,extensionFilter:true,selfFilter:true,classSummary:true,widths:[1280,768,390]});
  }
  assert.deepEqual(errors,[]);
  assert.equal(await page.evaluate(()=>window.__learningChecks.every(x=>x.status===200)),true);
  const report={passed:true,origin:'https://it-class-tcwu.vercel.app',realGoogleTeacher:true,results,scriptErrors:errors.length,at:new Date().toISOString()};await fs.writeFile(path.join(out,'formal-browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{
  if(page){await page.evaluate(()=>{if(window.__learningOriginal)window.fetch=window.__learningOriginal;delete window.__learningChecks;delete window.__learningOriginal;}).catch(()=>{});if(hook)await page.removeScriptToEvaluateOnNewDocument(hook.identifier).catch(()=>{});}
  await browser.disconnect();
 }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
