// Real product HTML/modules/DOM; only Auth/RPC origins are synthetic fixtures.
const fs=require('node:fs/promises'),assert=require('node:assert/strict'),{createRequire}=require('node:module');
const runtime=createRequire('D:/projects/cdp-tools/package.json'),{connectCdp}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
const origin=process.env.QUIZ_BATCH4_ORIGIN||'http://localhost:4391',out=process.env.QUIZ_BATCH4_OUT||'automation/output/quiz/batch4/browser';
const ids={practice:'30000000-0000-4000-8000-000000000001',own:'30000000-0000-4000-8000-000000000009'};
const catalog={school_year:'115',volume:'3年級上學期',subject:'數學',unit:'第一單元'};
const identity={email:'a@example.invalid',class_code:'301',seat_no:7,display_name:'合成學生',student_code:'30107'};
const auth=`export const SUPABASE_URL='${origin}/mock-supabase',SUPABASE_ANON_KEY='synthetic-only';
const users={a:{id:'a',email:'a@example.invalid'}};const callbacks=[];window.__navRpc=0;
window.fixtureSession={user:users.a,access_token:'fixture-a',expires_at:Math.floor(Date.now()/1000)+3600};
export const resolveSession=async()=>window.fixtureSession,getSession=async()=>({session:window.fixtureSession}),isTeacher=()=>false,beginCentralizedLogin=()=>{},signInWithGoogle=()=>{},signOutAndReload=async()=>{},signOutUser=async()=>{};
export const supabase={auth:{getSession:async()=>({data:{session:window.fixtureSession}}),onAuthStateChange:f=>callbacks.push(f)},rpc:async name=>{window.__navRpc++;return {data:[{email:'a@example.invalid',class_code:'999',seat_no:99,display_name:'不應出現',student_code:'99999'}]};}};`;
(async()=>{
 const {browser}=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl:process.env.QUIZ_BROWSER_URL,puppeteer:runtime('puppeteer-core')});
 try{
  await fs.mkdir(out,{recursive:true});const page=await browser.targets().find(t=>t._targetId===process.argv[2]).page();page.setDefaultTimeout(15000);
  const session=await page.target().createCDPSession();session.grantForegroundOnce('Page.bringToFront','驗證第四批練功坊請求減量');await session.send('Page.bringToFront');
  const calls=[],errors=[];let busyNext=0,own=null;
  page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);
  page.on('request',async request=>{try{
   const url=new URL(request.url());if(url.origin!==origin)return request.abort();
   const send=(data,status=200)=>request.respond({status,contentType:'application/json',body:JSON.stringify(data)});
   if(url.pathname==='/shared/auth.js')return request.respond({contentType:'text/javascript',body:auth});
   if(url.pathname.startsWith('/mock-supabase/')){
    const body=JSON.parse(request.postData()||'{}'),name=url.pathname.split('/').at(-1),data=body.p_data||{};calls.push({name,body});
    if(busyNext){busyNext--;return send({code:'PGRST003',message:'Timed out acquiring connection from connection pool.'},504);}
    if(name==='quiz_library_sessions')return send({role:'student',grade:3,identity,sessions:[{id:ids.practice,version_id:'v1',title:'準備好的練習',catalog,total:5,answered:0,correct:0,status:'open',generated:false}]});
    if(name==='quiz_pool_catalog')return send({available:true,courses:[{id:'115-1-hanlin-g3-math',grade:3,subject:'數學',units:[{id:1,title:'10000以內的數',count:10}],extension_available:true}],name_characters:[]});
    if(name==='quiz_compose'){own={id:ids.own,version_id:'v2',title:'我的數學自組卷',catalog:{...catalog,unit:'第1單元：10000以內的數'},status:'open',generated:true,display_name:'三年級數學｜測試・角色｜001',saved_at:'2026-10-29T07:00:00Z',generated_kind:'self',unit_ids:[1],distribution:{actual:5,easy:1,medium:3,hard:1,requested:5,difficulty:'medium'},learning_point:null,total:5,answered:0,correct:0};
     return send({session_id:ids.own,display_name:own.display_name,distribution:own.distribution,reused:false,paper:own});}
    if(name==='quiz_wrong_questions')return send({role:'student',grade:3,total:0,facets:[],items:[]});
    if(name==='quiz_entry_context')return send({role:'student',grade:3,subject:'數學',version_id:'v1',identity});
    if(name==='quiz_action')return send({message:'attempt_unavailable'},400);
    throw Error('unexpected endpoint '+name);
   }
   if(!/^\/(shared\/[A-Za-z0-9_./-]+|grade[36]\/115-1\/(quiz-library\.html|quiz\.html|navbar\.js))$/.test(url.pathname)||url.pathname.includes('..'))return request.respond({status:404,body:''});
   const type=url.pathname.endsWith('.html')?'text/html;charset=utf-8':url.pathname.endsWith('.css')?'text/css':url.pathname.endsWith('.woff2')?'font/woff2':'text/javascript';
   return request.respond({contentType:type,body:await fs.readFile('.'+url.pathname)});
  }catch(e){errors.push(e.message);if(!request.isInterceptResolutionHandled?.())try{await request.respond({status:500,body:'fixture failed'});}catch{}}});
  const count=name=>calls.filter(c=>c.name===name).length,label=()=>page.$eval('#auth-status',n=>n.textContent.trim());
  await page.setViewport({width:1366,height:768});
  // 1. 選卷頁：清單1次、目錄0次、navbar不另查名冊並顯示清單帶回的身分。
  await page.goto(origin+'/grade3/115-1/quiz-library.html',{waitUntil:'networkidle0'});await page.waitForSelector('.paper-start');
  await page.waitForFunction(()=>document.querySelector('#auth-status')?.textContent.includes('301 班'));
  const libraryLabel=await label();assert.equal(libraryLabel,'301 班 7 號 合成學生');
  assert.equal(count('quiz_library_sessions'),1);assert.equal(count('quiz_pool_catalog'),0);assert.equal(await page.evaluate(()=>window.__navRpc),0);
  // 2. 組卷：目錄1次、compose1次、清單不重載，卡片直接出現在「我的自組卷」。
  await page.click('#compose-toggle');await page.waitForSelector('#compose-units input');assert.equal(count('quiz_pool_catalog'),1);
  await page.click('#compose-units input');await page.click('#compose-form button[type="submit"]');await page.waitForSelector('#compose-result a');
  assert.equal(count('quiz_compose'),1);assert.equal(count('quiz_library_sessions'),1,'compose must not reload the list');
  await page.click('#compose-result button');await page.waitForFunction(id=>document.querySelector(`#my-papers [data-session-id="${id}"]`),{},ids.own);
  assert.match(await page.$eval(`#my-papers [data-session-id="${ids.own}"]`,n=>n.textContent),/測試・角色/);
  // 3. 忙碌：一次504後，30秒內再按更新不送請求，提示不要重新整理。
  busyNext=1;await page.click('#refresh-library');await page.waitForFunction(()=>document.querySelector('#cloud-lock p')?.textContent.includes('伺服器忙碌'));
  const before=count('quiz_library_sessions');const msg=await page.$eval('#cloud-lock p',n=>n.textContent);assert.match(msg,/不要重新整理/);
  // Same module instance as the page: the read is refused locally during cooldown, writes still go out.
  const cooled=await page.evaluate(async()=>{const {createQuizRequest}=await import('/shared/quiz-api.mjs?v=20261029-batch4');const r=await createQuizRequest({getSession:()=>fixtureSession});
   const read=await r('library_sessions').then(()=>'sent',e=>e.code);const write=await r('compose',{kind:'self',count:5,units:[1],request_id:crypto.randomUUID()}).then(()=>'sent',e=>e.code);return {read,write};});
  assert.deepEqual(cooled,{read:'server_busy',write:'sent'});assert.equal(count('quiz_library_sessions'),before,'no read during cooldown');
  // 4. 作答頁：entry帶回身分，navbar不另查名冊。
  await page.goto(origin+`/grade3/115-1/quiz.html?cloud=1&session=${ids.practice}`,{waitUntil:'networkidle0'});
  await page.waitForFunction(()=>document.querySelector('#auth-status')?.textContent.includes('301 班'));
  assert.equal(await label(),'301 班 7 號 合成學生');assert.equal(await page.evaluate(()=>window.__navRpc),0);assert.equal(count('quiz_entry_context'),1);
  assert.deepEqual(errors,[]);
  const report={passed:true,libraryRequests:1,initialCatalog:0,navRpc:0,composeReloadsLibrary:false,busyCooldown:true,quizNavRpc:0,libraryLabel,errors};
  await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.disconnect();}
})().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});
