const fs=require('node:fs');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {connectCdp}=require(process.env.CDP_SAFE_CLIENT_PATH || 'D:/projects/cdp-tools/packages/cdp-safe-client');
const lease=process.env.WEEK06_LEASE,cdp=process.env.WEEK06_CDP;
if(!lease||!cdp)throw new Error('Acquire an AI Work Browser lease first.');
function heartbeat(){execFileSync('pwsh',['-NoProfile','-Command',`ai-browser-launch -Heartbeat -LeaseId '${lease}' -WorkerProcessId ${process.pid} -Json`],{stdio:'pipe'});}
const fixture=`export const SUPABASE_URL='http://127.0.0.1:3036/fake',SUPABASE_ANON_KEY='synthetic',AUTH_STORAGE_KEY='fixture';
if(window.fixtureUser===undefined)window.fixtureUser={user:{id:'synthetic-a',email:'synthetic@apps.ntpc.edu.tw'},access_token:'synthetic'};
window.fixtureRows??=JSON.parse(sessionStorage.getItem('synthetic-test-rows')||'[]');window.fixtureSaves??=[];window.fixtureListeners??=[];window.fixtureCalls??=[];
export const isTeacher=()=>false,getStoredAccessToken=()=> 'synthetic';
export const getSession=async()=>({session:window.fixtureUser}),resolveSession=async()=>window.fixtureUser;
export function beginCentralizedLogin(){window.fixtureLoginCount=(window.fixtureLoginCount||0)+1;}
export const signInWithGoogle=beginCentralizedLogin,signOutAndReload=async()=>{};
export const supabase={auth:{onAuthStateChange(fn){window.fixtureListeners.push(fn);return {};},getSession},
rpc(name,args){window.fixtureCalls.push(name);const run=async()=>{if(name==='reconnect_grade3_progress')return window.fixtureImportFail?{error:{code:window.fixtureErrorCode,message:'舊成果資料需老師查核，尚未接回。'}}:{data:[{class_code:'301',seat_no:1,display_name:'合成測試',student_code:'30101',practice_account:'synthetic'}]};
if(name==='get_grade3_progress'&&window.fixtureLoadFail)return {error:{code:'P0001',message:'本人進度讀取失敗，請重新整理或找老師。'}};
if(name==='get_my_student_enrollment')return {data:[window.fixtureUser?.user?.id==='synthetic-b'?{class_code:'302',seat_no:2,display_name:'合成乙'}:{class_code:'301',seat_no:1,display_name:'合成測試'}]};
if(name==='save_grade3_progress'){if(window.fixtureSaveFail)return {error:{message:'test'}};window.fixtureSaves.push(args);let row=window.fixtureRows.find(r=>r.week_code===args.p_week_code&&r.activity_key===args.p_activity_key);if(!row){row={course_id:'grade3-115-1',week_code:args.p_week_code,activity_key:args.p_activity_key,score:0};window.fixtureRows.push(row);}row.score=Math.max(row.score,args.p_score);row.completed=row.score===5;row.current_level=Math.min(row.score+1,5);return {data:null};}
return {data:window.fixtureRows.filter(r=>r.week_code===args.p_week_code&&r.activity_key===args.p_activity_key)};};return {abortSignal(){return run()},then(resolve,reject){return run().then(resolve,reject)}};},
from(name){const query={select(){return query},eq(){return query},order(){return query},then(resolve){return Promise.resolve({data:name==='week_visibility'?[]:window.fixtureRows}).then(resolve)}};return query;}};`;
(async()=>{
 heartbeat();const connection=await connectCdp({cdpUrl:cdp,targetUrl:'http://127.0.0.1:3036/grade3/115-1/week06.html'});const timer=setInterval(heartbeat,45000);
 const context=await connection.browser.createBrowserContext();const page=await context.newPage();const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.setRequestInterception(true);
 page.on('request',request=>request.url().includes('/shared/auth.js')?request.respond({contentType:'application/javascript',body:fixture}):request.url().includes('/fake/rest/v1/rpc/typing_foundation_action')?request.respond({contentType:'application/json',body:'[]'}):request.continue());
 const base='http://127.0.0.1:3036',out='automation/output/week06';fs.mkdirSync(out,{recursive:true});
 try{
  await page.setViewport({width:1280,height:900});
  await page.goto(base+'/grade3/week20.html',{waitUntil:'networkidle2'});await page.screenshot({path:out+'/reference-desktop.png'});
  await page.goto(base+'/grade3/115-1/week06.html',{waitUntil:'networkidle2'});
  await page.waitForFunction(()=>typeof window.checkLevel==='function');
  assert.match(await page.$eval('#course-identity-status',el=>el.textContent),/合成測試/);
  assert.equal(await page.$eval('#typing-levels-container',el=>el.inert),false);
  assert.equal(await page.$eval('#login-btn',el=>el.classList.contains('hidden')),true);
  assert.equal(await page.$eval('#logout-btn',el=>el.classList.contains('hidden')),false);
  const beforeRefresh=await page.evaluate(()=>fixtureCalls.length);
  await page.evaluate(()=>{window.fixtureNonce='keep';fixtureListeners.forEach(fn=>fn('TOKEN_REFRESHED',fixtureUser));});
  assert.equal(await page.evaluate(()=>fixtureNonce),'keep');assert.equal(await page.evaluate(()=>fixtureCalls.length),beforeRefresh);
  await page.$eval('#input-level1',el=>el.value='wrong');await page.evaluate(()=>checkLevel(1));
  assert.match(await page.$eval('#msg-level1',el=>el.textContent),/第 1 行、第 1 個字/);
  assert.equal(await page.$eval('#block-level2',el=>el.classList.contains('hidden')),true);
  await page.evaluate(()=>{window.fixtureSaveFail=true;document.querySelector('#input-level1').value='robot358';});await page.evaluate(()=>checkLevel(1));
  assert.equal(await page.$eval('#block-level2',el=>el.classList.contains('hidden')),true);
  assert.equal(await page.$eval('#input-level1',el=>el.readOnly),false);
  await page.evaluate(()=>window.fixtureSaveFail=false);
  const answers=['robot358','l1o0','Robot358!','Hi, I am Tom.',"Hi, I am Tom.\nWhat's your name?"];
  for(let i=0;i<answers.length;i++){await page.$eval('#input-level'+(i+1),(el,value)=>el.value=value,answers[i]);await page.evaluate(n=>checkLevel(n),i+1);}
  assert.deepEqual(await page.evaluate(()=>fixtureSaves.map(x=>x.p_score)),[1,2,3,4,5]);
  assert.equal(await page.evaluate(()=>fixtureRows[0].completed),true);
  await page.evaluate(()=>sessionStorage.setItem('synthetic-test-rows',JSON.stringify(fixtureRows)));
  await page.waitForFunction(()=>document.body.textContent.includes('看看我的努力樹'));
  await page.goto(base+'/my-tree.html?course=grade3-115-1',{waitUntil:'networkidle2'});
  assert.equal(await page.$eval('#leaf-count',el=>el.textContent),'4');assert.equal(await page.$eval('#flower-count',el=>el.textContent),'1');
  // Restored record on a fresh page; a completed six-level week earns five leaves.
  await page.evaluate(()=>{fixtureRows.push({course_id:'grade3-115-1',week_code:'05',activity_key:'typing_task_5',current_level:6,score:6,completed:true});});
  await page.select('#course-select','grade3-114-2');await page.select('#course-select','grade3-115-1');
  await page.waitForFunction(()=>document.querySelector('#leaf-count').textContent==='9');assert.equal(await page.$eval('#flower-count',el=>el.textContent),'2');
  await page.goto(base+'/grade3/115-1/week06.html',{waitUntil:'networkidle2'});
  await page.click('[data-replay="1"]');await page.$eval('#input-level1',el=>el.value='robot358');await page.evaluate(()=>checkLevel(1));
  assert.equal(await page.evaluate(()=>fixtureRows.find(r=>r.week_code==='06').score),5);
  assert.match(await page.$eval('#progress-status',el=>el.textContent),/完整練習|完成/);
  await page.screenshot({path:out+'/week06-desktop.png'});
  assert.equal(await page.$eval('#input-level1',el=>getComputedStyle(el).fontFamily),await page.$eval('.target',el=>getComputedStyle(el).fontFamily));
  assert.equal(await page.$eval('#input-level1',el=>getComputedStyle(el).fontSize),'24px');
  for(const width of [390,1280]){
   await page.setViewport({width,height:900});
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);
  }
  await page.setViewport({width:390,height:844});await page.screenshot({path:out+'/week06-mobile.png'});
  await page.click('[data-replay="1"]');await page.$eval('#input-level1',el=>el.value='wrong');await page.evaluate(()=>checkLevel(1));
  assert.equal(await page.evaluate(()=>document.querySelector('#msg-level1').getBoundingClientRect().bottom<=document.querySelector('#block-level2').getBoundingClientRect().top),true);
  await page.goto(base+'/grade3/week20.html',{waitUntil:'networkidle2'});await page.screenshot({path:out+'/reference-mobile.png'});
  // A previously shown tree must be cleared if a subsequent import/read fails.
  await page.goto(base+'/my-tree.html?course=grade3-115-1',{waitUntil:'networkidle2'});
  assert.equal(await page.$eval('#leaf-count',el=>el.textContent),'4');
  const switched=await page.evaluate(()=>{fixtureRows=[];fixtureUser={user:{id:'synthetic-b',email:'synthetic-b@apps.ntpc.edu.tw'}};fixtureListeners.forEach(fn=>fn('SIGNED_IN',fixtureUser));return document.querySelector('#reward-layer').children.length;});
  assert.equal(switched,0);await page.waitForFunction(()=>document.querySelector('#profile-title').textContent==='合成乙');assert.equal(await page.$eval('#leaf-count',el=>el.textContent),'0');
  await page.evaluate(()=>{fixtureRows=JSON.parse(sessionStorage.getItem('synthetic-test-rows'));fixtureUser={user:{id:'synthetic-a',email:'synthetic@apps.ntpc.edu.tw'}};fixtureListeners.forEach(fn=>fn('SIGNED_IN',fixtureUser));});
  await page.waitForFunction(()=>document.querySelector('#leaf-count').textContent==='4');
  await page.evaluate(()=>{fixtureImportFail=true;fixtureErrorCode='P0001';});
  await page.select('#course-select','grade3-114-2');await page.select('#course-select','grade3-115-1');
  await page.waitForFunction(()=>document.querySelector('#notice-card').textContent.includes('老師查核'));
  assert.equal(await page.$eval('#leaf-count',el=>el.textContent),'0');assert.equal(await page.$eval('#reward-layer',el=>el.children.length),0);
  for(const name of ['week02','week02-mail','week03','week04','week05']){
   await page.goto(base+'/grade3/115-1/'+name+'.html',{waitUntil:'networkidle2'});
   assert.match(await page.$eval('#auth-status',el=>el.textContent),/合成測試/);
   assert.equal(await page.$eval('#login-btn',el=>el.classList.contains('hidden')),true);
   assert.equal(await page.evaluate(()=>fixtureCalls.some(name=>name.includes('guest_progress')||name.includes('class_card'))),false);
   if(name==='week05'){
    assert.equal(await page.$eval('#account-target',el=>el.textContent),'synthetic');
    await page.$eval('#input-level1',el=>el.value='l1o0');await page.evaluate(()=>checkLevel(1));
    assert.equal(await page.evaluate(()=>fixtureSaves.at(-1).p_week_code),'05');
    assert.equal(await page.evaluate(()=>fixtureSaves.at(-1).p_score),1);
   }
  }
  await page.evaluateOnNewDocument(()=>window.fixtureLoadFail=true);
  for(const name of ['week02','week03']){
   await page.goto(base+'/grade3/115-1/'+name+'.html',{waitUntil:'networkidle2'});
   if(name==='week02'){
    assert.match(await page.$eval('#quiz-container',el=>el.textContent),/進度讀取失敗/);
    assert.equal(await page.$$eval('#quiz-container .practice-options button',els=>els.length),0);
    assert.match(await page.$eval('#window-feedback',el=>el.textContent),/重新讀取進度/);
   }else{
    await page.waitForFunction(()=>document.querySelector('#quiz-lock').textContent.includes('本人進度讀取失敗'));
    assert.equal(await page.$eval('#quiz-content',el=>el.inert&&el.classList.contains('hidden')),true);
   }
  }
  await page.evaluateOnNewDocument(()=>window.fixtureLoadFail=false);
  await page.goto(base+'/grade3/115-1/week06.html',{waitUntil:'networkidle2'});
  const navigated=page.waitForNavigation({waitUntil:'networkidle2'});
  const locked=await page.evaluate(()=>{fixtureUser={user:{id:'synthetic-b',email:'synthetic-b@apps.ntpc.edu.tw'}};fixtureListeners.forEach(fn=>fn('SIGNED_IN',fixtureUser));return document.querySelector('#typing-levels-container').inert;});
  assert.equal(locked,true);await navigated;
  // Anonymous mode: instructions stay readable; activity stays locked; navbar event survives rerender.
  await page.evaluateOnNewDocument(()=>window.fixtureUser=null);
  await page.goto(base+'/grade3/115-1/week06.html',{waitUntil:'networkidle2'});
  assert.equal(await page.$eval('#typing-levels-container',el=>el.inert),true);
  assert.equal(await page.$eval('#password',el=>getComputedStyle(el).display)!=='none',true);
  await page.click('#login-btn');assert.equal(await page.evaluate(()=>fixtureLoginCount),1);
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('course-navbar:rendered')));await page.click('#login-btn');assert.equal(await page.evaluate(()=>fixtureLoginCount),2);
  const paste=await page.$eval('#input-level1',el=>el.dispatchEvent(new ClipboardEvent('paste',{cancelable:true,bubbles:true})));assert.equal(paste,false);
  // Import failure is a hard activity lock.
  await page.evaluateOnNewDocument(()=>{window.fixtureUser={user:{id:'synthetic-a',email:'synthetic@apps.ntpc.edu.tw'}};window.fixtureImportFail=true;});
  await page.goto(base+'/grade3/115-1/week06.html',{waitUntil:'networkidle2'});
  assert.equal(await page.$eval('#typing-levels-container',el=>el.inert),true);assert.match(await page.$eval('#course-identity-status',el=>el.textContent),/尚未接回/);
  await page.evaluateOnNewDocument(()=>window.fixtureErrorCode='P0001');await page.reload({waitUntil:'networkidle2'});
  assert.equal(await page.$eval('#course-identity-status',el=>el.textContent),'舊成果資料需老師查核，尚未接回。');
  await page.evaluateOnNewDocument(()=>window.fixtureErrorCode='PGRST202');await page.reload({waitUntil:'networkidle2'});
  assert.match(await page.$eval('#course-identity-status',el=>el.textContent),/Google 已登入，但課程資料轉換尚未啟用/);
  assert.match(await page.$eval('#auth-status',el=>el.textContent),/Google 已登入.*尚未接回/);
  assert.match(await page.$eval('#progress-status',el=>el.textContent),/課程資料轉換尚未啟用/);
  assert.equal(await page.$eval('#typing-levels-container',el=>el.inert),true);
  assert.deepEqual(errors,[]);console.log('PASS: desktop/mobile, five RPC saves, save failure, wrong hint, anonymous/import lock, navbar delegation, 4+1 / 9+2 tree, paste block');
 } finally{clearInterval(timer);await context.close();await connection.browser.disconnect();}
})().catch(error=>{console.error(error);process.exitCode=1;});
