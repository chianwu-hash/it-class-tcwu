// Actual quiz entry/controller/CSS/navbar. Synthetic local Auth/RPC responses only.
const fs=require('node:fs/promises'),assert=require('node:assert/strict'),{createRequire}=require('node:module');
const runtime=createRequire('D:/projects/cdp-tools/package.json'),{connectCdp}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
const origin=process.env.QUIZ_WORKSPACE_ORIGIN||'http://localhost:3000',sid='00000000-0000-4000-8000-000000000001';
const content=text=>({text,media:[]});
const auth=`export const SUPABASE_URL='${origin}/mock-supabase',SUPABASE_ANON_KEY='synthetic-only';
const users={a:{id:'a',email:'a@example.invalid'},b:{id:'b',email:'b@example.invalid'},teacher:{id:'teacher',email:'teacher@example.invalid'}};
const callbacks=[];window.fixtureSession={user:users[sessionStorage.getItem('fixture-user')||'a'],access_token:'fixture-'+(sessionStorage.getItem('fixture-user')||'a'),expires_at:Math.floor(Date.now()/1000)+3600};
window.fixtureSwitch=id=>{window.fixtureSession=id?{user:users[id],access_token:'fixture-'+id,expires_at:Math.floor(Date.now()/1000)+3600}:null;if(id)sessionStorage.setItem('fixture-user',id);else sessionStorage.removeItem('fixture-user');callbacks.forEach(f=>f(id?'SIGNED_IN':'SIGNED_OUT',window.fixtureSession));};
export const resolveSession=async()=>window.fixtureSession,isTeacher=s=>s?.user?.id==='teacher',beginCentralizedLogin=()=>{},signOutAndReload=async()=>window.fixtureSwitch(null);
export const supabase={auth:{getSession:async()=>({data:{session:window.fixtureSession}}),onAuthStateChange:f=>callbacks.push(f)},rpc:async()=>({data:await fetch('/test/roster?user='+window.fixtureSession?.user?.id).then(r=>r.json())})};`;
(async()=>{
 const {browser}=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl:process.env.QUIZ_BROWSER_URL,puppeteer:runtime('puppeteer-core')});
 const out=process.env.QUIZ_WORKSPACE_OUT||'automation/output/quiz/workspace-release-20261029';await fs.mkdir(out,{recursive:true});
 let grade=3,scenario='short',rosterCalls=0,rpcCalls=[],lost=false,fast=false,delaySubmit=false,releaseSubmit=null,states=new Map();const errors=[];
 function snapshot(uid){
  if(states.has(uid))return states.get(uid);
  const questions=Array.from({length:2},(_,i)=>({id:'q'+i,type:'single',material:content(''),prompt:content(i?'這條繩子的長度是 $\\frac{1}{2}$ 公尺，哪個說法正確？':'哪一個不是水上交通工具？'),options:['水車','遊艇','帆船','小舟'].map((t,j)=>({id:'abcd'[j],content:content(t)}))}));
  if(scenario==='image')questions[0].prompt.media=[{kind:'image',url:'https://fixture.example.invalid/figure.svg',alt:'教學圖形'}];
  if(scenario==='long')questions[0].material=content('閱讀材料：'+('請仔細閱讀故事，再選出適合的答案。'.repeat(90)));
  if(scenario==='long-options')questions[0].options.forEach(o=>o.content=content(o.content.text+'，'+ '請核對選項中的條件。'.repeat(12)));
  if(scenario==='motion')for(let i=2;i<10;i++)questions.push({...structuredClone(questions[0]),id:'q'+i});
  if(scenario==='rich')questions[0].material={text:'聽力與數量表',media:[{kind:'audio',url:'https://fixture.example.invalid/listen.wav',alt:'合成聽力'}],layout:[{type:'table',rows:[[[{type:'text',text:'千位'}],[{type:'text',text:'百位'}]],[[{type:'text',text:'3'}],[{type:'text',text:'0'}]]]}]};
  const state={attempt_id:'attempt-'+uid,session_id:sid,version_id:'version-one',status:scenario==='closed'?'closed':'open',identity:{role:'student',grade},complete:false,leaf:{earned:false,reason:'not_eligible'},responses:{},reviews:[],document:{title:'第一課：同屏閱讀測試（合成資料）',catalog:{subject:'國語',volume:grade+'年級上學期'},questions}};
  states.set(uid,state);return state;
 }
 try{
  const page=await browser.targets().find(t=>t._targetId===process.argv[2]).page();page.setDefaultTimeout(15000);
  const c=await page.target().createCDPSession();c.grantForegroundOnce('Page.bringToFront','核對固定下一題與同屏解析');await c.send('Page.bringToFront');
  page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);
  page.on('request',async r=>{
   try{
    const u=new URL(r.url());
    if(u.origin==='https://fixture.example.invalid'){
     if(u.pathname.endsWith('.wav')){const b=Buffer.alloc(44+1600);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(8000,24);b.writeUInt32LE(16000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(1600,40);return r.respond({contentType:'audio/wav',body:b});}
     return r.respond({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="240"><rect x="5" y="5" width="790" height="230" fill="white" stroke="black"/><path d="M400 5V235" stroke="black"/><rect x="6" y="6" width="393" height="228" fill="#ccc"/></svg>'});
    }
    if(u.origin!==origin)return r.abort();
    const send=data=>r.respond({contentType:'application/json',body:JSON.stringify(data)});
    if(u.pathname==='/shared/auth.js')return r.respond({contentType:'text/javascript',body:auth});
    if(u.pathname==='/test/roster'){rosterCalls++;return send([{email:u.searchParams.get('user')+'@example.invalid',class_code:grade===3?'304':'603',seat_no:7,display_name:u.searchParams.get('user')==='b'?'小樹':'小禾',student_code:grade===3?'30407':'60307'}]);}
    if(u.pathname==='/mock-supabase/rest/v1/rpc/quiz_action'){
     const {p_action:action,p_data:data}=JSON.parse(r.postData()),uid=r.headers().authorization?.replace('Bearer fixture-','');rpcCalls.push({action,data});
     if(uid==='teacher')return r.respond({status:403,contentType:'application/json',body:JSON.stringify({message:'student_required'})});
     if(action==='library_sessions')return send({role:'student',grade,sessions:[{id:sid,catalog:{subject:'國語',volume:grade+'年級上學期'}}]});
     assert.ok(['join','resume','view_question','submit'].includes(action));
     const state=snapshot(uid);
     if(action==='view_question')return send({viewed:true});
     if(action==='join'||action==='resume'){assert.equal(data.entry_identity,undefined);return send(state);}
     if(fast){fast=false;return send({warning:'answer_too_fast'});}
     if(delaySubmit){delaySubmit=false;await new Promise(resolve=>releaseSubmit=resolve);}
     if(!state.responses[data.question_id]){
      state.responses[data.question_id]=data.response;
      const explanation=content('水車主要用來取水或帶動機械，其他三種都可以在水上載人。');
      if(scenario==='long-explanation')explanation.text+='請把條件一項一項核對。'.repeat(180);
      if(scenario==='no-detail')explanation.text='書商未提供這一題的詳細解析。';
      if(scenario==='image')explanation.media=[{kind:'image',url:'https://fixture.example.invalid/figure.svg',alt:'解析原圖'}];
      if(scenario!=='deferred')state.reviews.push({question_id:data.question_id,correct:data.response==='a',answer:{option_id:'a'},explanation});
     }
     state.complete=Object.keys(state.responses).length===state.document.questions.length;
     if(state.complete)state.leaf={earned:false,reason:'timing_unverified'};
     if(state.complete&&scenario==='earned')state.leaf={earned:true,earned_now:true,id:'synthetic-leaf'};
     if(lost){lost=false;return r.abort('failed');}
     const {document,...compact}=state;return send({...compact,compact:true});
    }
    if(/^\/grade[36]\/115-1\/quiz\.html$/.test(u.pathname)){grade=u.pathname.includes('grade3')?3:6;scenario=u.searchParams.get('case')||scenario;}
    if(!/^\/(shared\/[A-Za-z0-9_./-]+|grade[36]\/115-1\/(quiz\.html|navbar\.js))$/.test(u.pathname)||u.pathname.includes('..'))return r.respond({status:404,body:''});
    if(process.env.QUIZ_WORKSPACE_LIVE==='1')return r.continue();
    const type=u.pathname.endsWith('.html')?'text/html;charset=utf-8':u.pathname.endsWith('.css')?'text/css':u.pathname.endsWith('.woff2')?'font/woff2':'text/javascript';
    return r.respond({contentType:type,body:await fs.readFile('.'+u.pathname)});
   }catch(e){errors.push(e.message);if(!r.isInterceptResolutionHandled())await r.respond({status:500,body:'synthetic fixture error'});}
  });
  const url=(g=3,c='short')=>`${origin}/grade${g}/115-1/quiz.html?cloud=1&session=${sid}&case=${c}`;
  const ready=()=>page.waitForSelector('#server-submit');
  const choose=()=>page.$eval('.student-option input[value="b"]',e=>e.click());
  const primary=()=>page.$eval('.quiz-workspace-dock .quiz-primary',e=>{const r=e.getBoundingClientRect();return {text:e.textContent,top:r.top,bottom:r.bottom,height:innerHeight};});
  const visible=async()=>{const b=await primary();assert.ok(b.top>=0&&b.bottom<=b.height+1,JSON.stringify(b));return b;};
  await page.setViewport({width:1366,height:620});await page.goto(url(),{waitUntil:'networkidle0'});await ready();
  assert.ok(rosterCalls>=1);assert.ok(rpcCalls.some(r=>r.action==='library_sessions'));await visible();
  await page.waitForFunction(()=>document.querySelector('#server-quiz').classList.contains('workspace-desktop'));
  assert.ok(await page.evaluate(()=>document.scrollingElement.scrollHeight<=innerHeight+2));
  const start=await page.$eval('.student-option',e=>({x:e.getBoundingClientRect().x,width:e.getBoundingClientRect().width}));
  lost=true;await choose();await page.click('#server-submit');await page.waitForFunction(()=>document.querySelector('#server-submit')?.textContent.includes('相同答案重試'));
  assert.equal(await page.$('.quiz-workspace-dock button:not(#server-submit).quiz-primary'),null);await visible();
  await page.click('#server-submit');await page.waitForSelector('.answer-preview');assert.equal((await visible()).text,'下一題');
  const submitted=rpcCalls.filter(r=>r.action==='submit');assert.equal(submitted[0].data.request_id,submitted[1].data.request_id);
  const after=await page.$eval('.student-option',e=>({x:e.getBoundingClientRect().x,width:e.getBoundingClientRect().width}));assert.deepEqual(after,start);
  assert.ok(await page.evaluate(()=>{const l=document.querySelector('.quiz-reading-panel').getBoundingClientRect(),r=document.querySelector('.answer-preview').getBoundingClientRect();return l.top>=0&&r.top>=0&&r.bottom<=innerHeight-document.querySelector('.quiz-workspace-dock').getBoundingClientRect().height;}));
  await page.screenshot({path:out+'/desktop-1366-feedback.png'});
  await page.reload({waitUntil:'networkidle0'});await ready();assert.ok(rosterCalls>=2,'original roster flow retained');
  fast=true;await choose();await page.click('#server-submit');await page.waitForSelector('.quiz-speed-warning');assert.ok(await page.$('#server-submit'));await visible();
  await page.click('#server-submit');await page.waitForSelector('.answer-preview');assert.match((await visible()).text,/查看整份/);
  assert.match(await page.$eval('.quiz-context-status',e=>e.textContent),/本次不計葉片/);
  await page.click('.quiz-workspace-dock .quiz-primary');await page.waitForFunction(()=>document.querySelector('#server-quiz').classList.contains('is-review'));assert.equal(await page.$('.quiz-workspace-dock'),null);assert.equal((await page.$$('article.question')).length,2);
  await page.evaluate(()=>sessionStorage.removeItem('student-display-115-v1'));states=new Map();await page.goto(url(6,'image'),{waitUntil:'networkidle0'});await ready();await choose();await page.click('#server-submit');await page.waitForSelector('.answer-preview img');
  await page.waitForFunction(()=>[...document.querySelectorAll('#server-quiz img')].every(i=>i.complete&&i.naturalWidth));
  await page.click('.answer-preview img');await page.waitForSelector('#lightbox:not(.hidden)');await page.click('#lightbox-zoom-out');assert.match(await page.$eval('#lightbox-scale',e=>e.textContent),/70/);await page.click('#lightbox-close');
  for(const view of [{width:1920,height:930},{width:390,height:844},{width:683,height:384,deviceScaleFactor:2}]){
   await page.setViewport(view);await page.waitForFunction(()=>{const b=document.querySelector('.quiz-workspace-dock .quiz-primary')?.getBoundingClientRect();return b&&b.bottom<=innerHeight+1;});await visible();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  }
  await page.setViewport({width:390,height:844});await page.screenshot({path:out+'/mobile-feedback.png'});
  await page.evaluate(()=>fixtureSwitch('teacher'));await page.waitForFunction(()=>document.querySelector('#entry-status')?.textContent.includes('學生'));assert.equal(await page.$('.question'),null);
  await page.evaluate(()=>fixtureSwitch(null));await page.waitForFunction(()=>document.querySelector('#auth-status')?.textContent==='未登入');assert.equal(await page.$('.quiz-workspace-dock'),null);
  states=new Map();await page.evaluate(()=>{sessionStorage.setItem('fixture-user','a');});await page.setViewport({width:1366,height:620});await page.goto(url(3,'long'),{waitUntil:'networkidle0'});await ready();await page.waitForFunction(()=>!document.querySelector('#server-quiz').classList.contains('workspace-desktop'));await visible();assert.ok(await page.evaluate(()=>document.scrollingElement.scrollHeight>innerHeight));
  const extra={};
  async function fresh(caseName){states=new Map();await page.goto(url(3,caseName),{waitUntil:'networkidle0'});await ready();}
  await fresh('short');delaySubmit=true;await choose();await page.click('#server-submit');
  await page.waitForFunction(()=>document.querySelector('#server-submit')?.disabled);assert.match((await visible()).text,/正在儲存/);
  assert.equal(await page.$('.answer-preview'),null);releaseSubmit();await page.waitForSelector('.answer-preview');extra.pendingSave=true;
  await page.focus('.quiz-reading-panel');await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>!!document.activeElement));
  await page.$eval('.quiz-message-tray summary',e=>e.focus());await page.keyboard.press('Enter');await page.waitForSelector('.quiz-message-tray[open]');
  await page.keyboard.press('Escape');assert.equal(await page.$('.quiz-message-tray[open]'),null);extra.keyboardTray=true;
  await fresh('deferred');await choose();await page.click('#server-submit');await page.waitForFunction(()=>document.querySelector('.quiz-explanation-placeholder')?.textContent.includes('已儲存'));
  assert.equal(await page.$('.answer-preview'),null);assert.equal((await visible()).text,'下一題');extra.deferredReveal=true;
  await fresh('long-explanation');await choose();await page.click('#server-submit');await page.waitForSelector('.answer-preview');await visible();
  assert.ok(await page.$eval('.quiz-explanation-panel',e=>e.scrollHeight>e.clientHeight));
  await page.focus('.quiz-explanation-panel');await page.keyboard.press('End');await visible();extra.longExplanation=true;
  await fresh('no-detail');await choose();await page.click('#server-submit');await page.waitForSelector('.answer-preview');assert.match(await page.$eval('.answer-preview',e=>e.textContent),/目前沒有詳細解析/);extra.noDetail=true;
  await fresh('long-options');await visible();assert.ok(await page.$eval('.quiz-reading-panel',e=>e.scrollHeight>e.clientHeight));extra.longOptions=true;
  await fresh('earned');for(let i=0;i<2;i++){await page.$eval('.student-option input[value="a"]',e=>e.click());await page.click('#server-submit');await page.waitForSelector('.answer-preview');if(i===0)await page.click('.quiz-workspace-dock .quiz-primary');}
  await page.waitForSelector('.quiz-leaf-celebration');await visible();assert.match(await page.$eval('.quiz-context-status',e=>e.textContent),/1片葉/);assert.equal(await page.$('.quiz-leaf-celebration[data-half]'),null);extra.originalLeafCelebration=true;
  for(const viewport of [{width:390,height:844},{width:320,height:600}]){await page.setViewport(viewport);await visible();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  extra.lastQuestionNarrow=true;
  await page.setViewport({width:1366,height:620});await fresh('short');await choose();await page.click('#server-submit');await page.waitForSelector('.answer-preview');
  snapshot('a').status='closed';await page.$eval('.quiz-message-tray summary',e=>e.click());await page.click('.quiz-refresh');await page.waitForSelector('.quiz-context-status');
  assert.match(await page.$eval('.quiz-context-status',e=>e.textContent),/本場已結束/);await page.click('.quiz-workspace-dock .quiz-primary');assert.equal(await page.$('#server-submit'),null);extra.closedReadOnly=true;
  await fresh('short');delaySubmit=true;await choose();await page.click('#server-submit');await page.waitForFunction(()=>document.querySelector('#server-submit')?.disabled);
  await page.evaluate(()=>fixtureSwitch('b'));await ready();releaseSubmit();await new Promise(resolve=>setTimeout(resolve,250));
  assert.equal(await page.$('.answer-preview'),null);assert.match(await page.$eval('.progress-label',e=>e.textContent),/0 \/ 2/);extra.accountSwitchLateResponse=true;
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await fresh('motion');
  const variants=[];for(let i=0;i<10;i++){
   await page.$eval(`.student-option input[value="${i%2?'b':'a'}"]`,e=>e.click());await page.click('#server-submit');await page.waitForSelector('.answer-preview');
   variants.push(await page.$eval('.answer-preview',e=>e.dataset.motionVariant));await visible();if(i<9)await page.click('.quiz-workspace-dock .quiz-primary');
  }
  assert.equal(new Set(variants).size,10);extra.tenFeedbackVariants=variants;extra.reducedMotion=true;
  await fresh('rich');await page.waitForSelector('.quiz-content-table');assert.equal((await page.$$('.quiz-content-table th')).length,2);
  await page.$eval('audio',async e=>{e.muted=true;await e.play();});await page.waitForFunction(()=>document.querySelector('audio')?.readyState>=1);
  await page.$eval('audio',e=>e.pause());await visible();await choose();await page.click('#server-submit');await page.waitForSelector('.answer-preview');await page.click('.quiz-workspace-dock .quiz-primary');
  await page.waitForSelector('.katex');await visible();extra.tableAudioFormula=true;
  assert.deepEqual(errors,[]);
  const report={passed:true,shortDesktopFits:true,stableColumns:true,failedSaveNoNext:true,sameRequestRetry:true,finalFeedback:true,fullReviewNatural:true,originalRosterFlow:true,fastWarning:true,lightbox:true,mobile:true,zoomEquivalent:true,longReadingFallback:true,nonStudentDenied:true,logoutClearsWorkspace:true,rosterCalls,rpcActions:rpcCalls.map(r=>r.action),errors};
  Object.assign(report,extra);await fs.writeFile(out+'/browser.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.disconnect();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
