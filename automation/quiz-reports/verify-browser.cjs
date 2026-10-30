const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),{createRequire}=require('node:module'),r=createRequire('D:/projects/cdp-tools/package.json');
const {connectCdp}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
(async()=>{const [id,out]=process.argv.slice(2),{browser}=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl:'http://127.0.0.1:4317/',puppeteer:{connect:o=>r('puppeteer-core').connect({...o,protocolTimeout:15000,targetFilter:t=>['browser','tab'].includes(t.type())||t._targetId===id})}});let page;
try{page=await browser.targets().find(t=>t._targetId===id).page();const s=await page.target().createCDPSession();s.grantForegroundOnce('Page.bringToFront','驗證題目回報與後台處理，全部使用合成資料');await s.send('Page.bringToFront');await s.detach();await page.goto('http://127.0.0.1:4317/__report-test.html');const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.evaluate(async()=>{
  const {initServerQuiz}=await import('/shared/quiz-server.mjs');const {initReportAdmin}=await import('/shared/quiz-report-admin.mjs');
  document.body.innerHTML='<div id="lock"></div><div id="content"><div id="root"></div></div><section id="admin"></section>';
  const c=text=>({text,media:[]}),q={id:'q1',type:'single',prompt:c('合成問題：請選二'),material:c(''),options:[{id:'o2',content:c('二')},{id:'o1',content:c('一')}]};
  const state={attempt_id:'a1',version_id:'v1',status:'open',complete:false,document:{title:'合成試卷',questions:[q]},responses:{},reviews:[]};
  let report=null,requests=[],lost=true,uid='synthetic-student';
  const request=async(action,p)=>{
   if(['join','resume'].includes(action))return structuredClone(state);if(action==='view_question')return {};
   if(action==='question_report'){
    if(p.action==='submit'){requests.push(structuredClone(p));report??={id:'r1',...p,identity:{class_code:'609',seat_no:30,display_name:'合成學生'},status:'pending',note:'',created_at:new Date().toISOString(),updated_at:'v1',snapshot:{title:'合成試卷',number:1,question:{...q,answer:{option_id:'o2'},explanation:c('合成解析')}},version_id:'v1'};if(lost){lost=false;throw Error('合成網路中斷，請重試');}return {id:report.id};}
    if(p.action==='list')return {total:report?1:0,items:report?[{...report,title:report.snapshot.title,number:1}]:[]};if(p.action==='detail')return structuredClone(report);if(p.action==='update'){report.status=p.status;report.note=p.note;report.updated_at='v2';return structuredClone(report);}
   }throw Error('unexpected action:'+action);
  };
  window.quiz=initServerQuiz({selectors:{container:'root',lock:'lock',content:'content'},server:{request,sessionId:'s1'}});await window.quiz.handleAuthChange({user:{id:uid}});
  window.fixture={requests,get report(){return report;},setIdentity:async()=>{uid=null;await window.quiz.handleAuthChange(null);}};
  window.inbox=initReportAdmin({root:document.querySelector('#admin'),request,getUserId:()=>uid});
 });
 await page.click('.quiz-report-toggle');await page.select('.quiz-question-report select[aria-label="問題類型"]','options');await page.select('.quiz-question-report select[aria-label="有問題的選項"]','o2');await page.type('.quiz-question-report textarea','選項 A 字有問題 <img src=x onerror=alert(1)>');
 await page.evaluate(()=>window.quiz.render());assert.equal(await page.$eval('.quiz-question-report textarea',n=>n.value),'選項 A 字有問題 <img src=x onerror=alert(1)>');
 await page.click('.quiz-question-report form button');await page.waitForFunction(()=>document.querySelector('.quiz-question-report [role=status]').textContent.includes('網路中斷'),{polling:100});await page.click('.quiz-question-report form button');await page.waitForFunction(()=>document.querySelector('.quiz-question-report [role=status]').textContent.includes('已送出'),{polling:100});
 const packets=await page.evaluate(()=>window.fixture.requests);assert.equal(packets.length,2);assert.equal(packets[0].request_id,packets[1].request_id);assert.equal(packets[0].option_id,'o2');
 await page.evaluate(()=>window.inbox.setEnabled(true));await page.click('#question-reports article button');await page.waitForSelector('dialog[open]');assert((await page.$eval('dialog',n=>n.textContent)).includes('A（學生回報此選項）'));assert.equal(await page.$eval('dialog',n=>n.querySelectorAll('img').length),0);
 await page.select('dialog select','processing');await page.type('dialog textarea','已核對');await page.evaluate(()=>[...document.querySelectorAll('dialog button')].find(n=>n.textContent==='儲存處理狀態').click());await page.waitForFunction(()=>document.querySelector('dialog [role=status]').textContent.includes('已儲存'),{polling:100});assert.equal(await page.evaluate(()=>window.fixture.report.status),'processing');
 await page.screenshot({path:path.join(out,'admin-synthetic.png'),fullPage:false});await page.click('dialog button');await page.setViewport({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(out,'student-mobile-synthetic.png'),fullPage:true});
 await page.evaluate(()=>window.fixture.setIdentity());assert.equal(await page.$('.quiz-question-report'),null);assert.deepEqual(errors,[]);
 const otherEntries=await page.evaluate(async()=>{
  const {initWrongQuestions}=await import('/shared/quiz-wrong-questions.mjs');
  const c=text=>({text,media:[]}),q={id:'q1',type:'single',prompt:c('合成錯題'),material:c(''),options:[{id:'o2',content:c('二')},{id:'o1',content:c('一')}]};
  document.body.innerHTML='<div id="cloud-library"></div>';const packets=[];
  const request=async(action,p)=>{if(action==='question_report'){packets.push(p);return {id:'r2'};}return p.action==='list'?{total:1,facets:[],items:[{attempt_id:'a2',question_id:'q1',catalog:{subject:'自然'},number:1,answered_at:new Date().toISOString(),preview:'合成題'}]}:{question:q,number:1,catalog:{subject:'自然'},answered_at:new Date().toISOString(),review:{answer:{option_id:'o2'},explanation:c('合成解析')},response:'o1',can_extend:false};};
  const wrong=initWrongQuestions({request,pageGrade:6,getUserId:()=> 'synthetic',externalNavigation:true});wrong.activate(true);
  window.otherFixture={wrong,packets};return true;
 });assert(otherEntries);
 await page.waitForSelector('#wrong-list article button');await page.click('#wrong-list article button');await page.waitForSelector('#wrong-detail:not([hidden]) .quiz-question-report');await page.click('.quiz-report-toggle');await page.type('.quiz-question-report textarea','合成錯題回報');await page.click('.quiz-question-report form button');await page.waitForFunction(()=>window.otherFixture.packets.length===1,{polling:100});assert.equal(await page.evaluate(()=>window.otherFixture.packets[0].attempt_id),'a2');await page.evaluate(()=>window.otherFixture.wrong.reset());
 await page.evaluate(async()=>{
  document.body.innerHTML='<p id="status"></p><p id="score"></p><p id="progress"></p><progress id="past-progress"></progress><button id="restart">重作</button><div id="steps"></div><div id="workspace"></div>';
  const {initPastExamUI}=await import('/shared/quiz-past-ui.mjs');const packets=[];const ui=initPastExamUI({root:document.body,request:async()=>{throw Error('unexpected write');},resolveAsset:async()=>'',onView:()=>{},reportRequest:async(_action,p)=>{packets.push(p);return {id:'r3'};}});
  ui.load({attemptId:'past-a',version:'past-v',records:{},summary:{answered:0,max:1,total:1,score:0},groups:[{id:'g1',kind:'single',sourceLabel:'一',title:'合成考古題',material:'',assets:[],promptContent:{text:'合成題',media:[]},choices:[{id:'A',content:{text:'一',media:[]}},{id:'B',content:{text:'二',media:[]}}],fields:[{id:'f1',points:1}]}]});window.pastFixture={packets,ui};
 });await page.click('.quiz-report-toggle');await page.type('.quiz-question-report textarea','合成考古題回報');await page.click('.quiz-question-report form button');await page.waitForFunction(()=>window.pastFixture.packets.length===1,{polling:100});assert.equal(await page.evaluate(()=>window.pastFixture.packets[0].source),'past');await page.evaluate(()=>window.pastFixture.ui.clear());assert.deepEqual(errors,[]);
 const result={passed:true,saveRerenderPreservesDraft:true,lostResponseIdempotentRetry:true,shuffledOptionCorrect:true,adminReadAndUpdate:true,wrongQuestionEntry:true,pastExamEntry:true,textSafe:true,mobileNoOverflow:true,identityClearsReport:true,pageErrors:errors,realWrites:0};await fs.writeFile(path.join(out,'browser-synthetic.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await page?.close().catch(()=>{});await browser.disconnect();}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
