// Actual navbar + auth + roster presentation; all identities/RPCs are synthetic and local.
const fs=require('node:fs/promises'),assert=require('node:assert/strict'),{createRequire}=require('node:module');
const runtime=createRequire('D:/projects/cdp-tools/package.json'),{connectCdp}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
const auth=`
window.fixtureUsers={a:{id:'a',email:'a@example.invalid'},b:{id:'b',email:'b@example.invalid'},teacher:{id:'teacher',email:'teacher@example.invalid'}};
window.fixtureSession={user:window.fixtureUsers.a};window.fixtureCalls=[];window.fixtureLogin=0;window.fixtureLogout=0;window.fixtureDelay=false;window.fixtureRelease=null;
window.fixtureRows={a:{class_code:'304',seat_no:7,display_name:'小禾',student_code:'30407',email:'a@example.invalid'},b:{class_code:'603',seat_no:12,display_name:'小樹',student_code:'60312',email:'b@example.invalid'}};
export const resolveSession=async()=>window.fixtureSession;
export const isTeacher=s=>s?.user.id==='teacher';
export const beginCentralizedLogin=()=>window.fixtureLogin++;
export const signOutAndReload=async()=>{window.fixtureLogout++;window.fixtureSwitch(null);};
export const supabase={auth:{onAuthStateChange(fn){window.fixtureCallback=fn;}},rpc:async(name,args)=>{
 if(name!=='get_my_student_enrollment'||args.p_school_year!==115)throw Error('unexpected_rpc');
 const id=window.fixtureSession?.user.id;window.fixtureCalls.push(id);const row=window.fixtureRows[id];
 if(window.fixtureDelay){window.fixtureDelay=false;await new Promise(r=>window.fixtureRelease=r);}
 return window.fixtureFail?{data:null,error:{message:'synthetic unavailable'}}:{data:row?[row]:[],error:null};
}};
window.fixtureSwitch=id=>{window.fixtureSession=id?{user:window.fixtureUsers[id]}:null;window.fixtureCallback('SIGNED_IN',window.fixtureSession);};`;
(async()=>{
 const {browser}=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl:process.env.QUIZ_BROWSER_URL,puppeteer:runtime('puppeteer-core')});
 const out='automation/output/quiz/nav-roster-20261028';await fs.mkdir(out,{recursive:true});
 try{
  const page=await browser.targets().find(t=>t._targetId===process.argv[2]).page();page.setDefaultTimeout(12000);
  const c=await page.target().createCDPSession();c.grantForegroundOnce('Page.bringToFront','驗證班級座號姓名、帳號切換與手機導覽');await c.send('Page.bringToFront');
  await page.setRequestInterception(true);page.on('request',async r=>{
   const u=new URL(r.url());
   if(u.origin!=='http://127.0.0.1:4391')return r.abort();
   if(u.pathname==='/shared/auth.js')return r.respond({contentType:'text/javascript',body:auth});
   if(/^\/grade[36]\/115-1\/(quiz|quiz-library|compact)\.html$/.test(u.pathname)){
    const grade=u.pathname.includes('grade3')?3:6,quiz=!u.pathname.endsWith('compact.html');
    return r.respond({contentType:'text/html;charset=utf-8',body:`<!doctype html><html><head><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/shared/quiz-theme.css"></head><body class="quiz-skin"><div id="quiz-navbar"><script src="/grade${grade}/115-1/navbar.js" data-homework="true" data-quiz="${quiz}"></script></div><script type="module">import {initNavbarAuth} from '/shared/navbar-auth.js';initNavbarAuth();</script></body></html>`});
   }
   if(!/^\/(shared\/(course-navbar\.js|navbar-auth\.js|grade6-nav-identity\.js|quiz-theme\.css)|grade[36]\/115-1\/navbar\.js)$/.test(u.pathname))return r.respond({status:404,body:''});
   return r.respond({contentType:u.pathname.endsWith('.css')?'text/css':'text/javascript',body:await fs.readFile('.'+u.pathname,'utf8')});
  });
  const label=()=>page.$eval('#auth-status',e=>e.textContent),waitLabel=s=>page.waitForFunction(s=>document.querySelector('#auth-status')?.textContent===s,{},s);
  for(const grade of [3,6]){
   for(const path of ['quiz-library.html','quiz.html']){
    await page.goto(`http://127.0.0.1:4391/grade${grade}/115-1/${path}`,{waitUntil:'networkidle0'});await waitLabel('304 班 7 號 小禾');
    assert.ok((await page.$eval('#auth-status',e=>e.title)).includes('a@example.invalid'));
    assert.equal(await page.evaluate(()=>fixtureCalls.length),1);
    await page.evaluate(()=>fixtureCallback('TOKEN_REFRESHED',fixtureSession));await waitLabel('304 班 7 號 小禾');assert.equal(await page.evaluate(()=>fixtureCalls.length),1);
    await page.evaluate(()=>{const n=document.querySelector('nav');n.replaceWith(n.cloneNode(true));dispatchEvent(new Event('course-navbar:rendered'));});await waitLabel('304 班 7 號 小禾');assert.equal(await page.evaluate(()=>fixtureCalls.length),1);
    await page.setViewport({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    if(grade===6&&path==='quiz.html')await page.screenshot({path:out+'/mobile.png',fullPage:false});await page.setViewport({width:1280,height:900});
   }
  }
  await page.evaluate(()=>fixtureSwitch(null));await waitLabel('未登入');
  await page.evaluate(()=>{fixtureDelay=true;fixtureSwitch('a');});await page.waitForFunction(()=>typeof fixtureRelease==='function');
  await page.evaluate(()=>{fixtureSwitch('b');fixtureRelease();});await waitLabel('603 班 12 號 小樹');
  await page.evaluate(()=>fixtureSwitch('teacher'));await waitLabel('teacher@example.invalid');
  await page.click('#logout-btn');await waitLabel('未登入');assert.equal(await page.evaluate(()=>fixtureLogout),1);await page.click('#login-btn');assert.equal(await page.evaluate(()=>fixtureLogin),1);
  await page.evaluate(()=>{fixtureFail=true;fixtureSwitch('a');});await waitLabel('a@example.invalid');await page.waitForFunction(()=>fixtureCalls.at(-1)==='a');
  assert.equal(await label(),'a@example.invalid');
  await page.goto('http://127.0.0.1:4391/grade6/115-1/compact.html',{waitUntil:'networkidle0'});await waitLabel('30407 小禾');
  const report={passed:true,grade3And6:true,libraryAndQuiz:true,oneReadPerUser:true,tokenRefreshAndRerender:true,accountSwitchRace:true,failureFallback:true,loginLogoutOnce:true,mobile:true,legacyCompactPreserved:true};
  await fs.writeFile(out+'/local.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.disconnect();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
