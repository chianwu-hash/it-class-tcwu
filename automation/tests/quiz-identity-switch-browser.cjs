// Real product modules; every Auth/RPC and all identities are synthetic fixtures.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const runtime=createRequire('D:/projects/cdp-tools/package.json');
const {connectCdp}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
const root=path.resolve(process.env.IDENTITY_SOURCE_ROOT||'.');
const origin=process.env.IDENTITY_ORIGIN||'http://127.0.0.1:4397';
const live=process.env.IDENTITY_LIVE==='1',baseline=process.env.IDENTITY_EXPECT_BASELINE==='1';
const out=path.resolve(process.env.IDENTITY_OUT||'automation/output/quiz/identity-sync/browser');
const release='20261030-identity-sync';
const ownId='30000000-0000-4000-8000-000000000009';
const auth=`
export const SUPABASE_URL=location.origin+'/fixture-supabase',SUPABASE_ANON_KEY='fixture-only';
const callbacks=[];window.fixtureSession={user:{id:'fixture-test',email:'chianwu@apps.ntpc.edu.tw'},access_token:'synthetic-only'};
export const getSession=async()=>({session:window.fixtureSession}),resolveSession=async()=>window.fixtureSession,isTeacher=()=>false,beginCentralizedLogin=()=>{},signOutAndReload=async()=>{};
export const supabase={auth:{getSession:async()=>({data:{session:window.fixtureSession}}),onAuthStateChange:f=>callbacks.push(f)},rpc:async(name,args)=>{
 const r=await fetch('/fixture-rpc/'+name,{method:'POST',body:JSON.stringify(args||{})});return r.json();
}};
window.fixtureAuthRefresh=()=>callbacks.forEach(f=>f('TOKEN_REFRESHED',window.fixtureSession));
`;
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const progress=step=>console.log(JSON.stringify({step}));
 progress('connecting');
 const puppeteer=runtime('puppeteer-core');
 const ownedTargets=new Set(process.argv.slice(2,4));
 assert.equal(ownedTargets.size,2,'two_exact_fixture_targets_required');
 // Chromium's parent tab targets must attach before their exact owned page targets can initialize.
 const {browser}=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl:process.env.QUIZ_BROWSER_URL,puppeteer:{connect:options=>puppeteer.connect({...options,protocolTimeout:15000,waitForInitialPage:false,targetFilter:t=>['browser','tab'].includes(t.type())||ownedTargets.has(t._targetId)})}});
 progress('connected');
 const pages=[],errors=[],calls=[];let grade=3,failSwitch=false,holdLibrary=false,holdCatalog=false;
 let releaseLibrary=null,releaseCatalog=null;
 const row=g=>({email:'chianwu@apps.ntpc.edu.tw',class_code:g===3?'307':'609',seat_no:30,display_name:'合成測試',student_code:g===3?'30730':'60930'});
 const catalog=g=>({school_year:'115',volume:g+'年級上學期',subject:'英語',unit:'Unit 1'});
 const paper=g=>({id:ownId,version_id:'fixture-v'+g,title:'合成英語卷',catalog:catalog(g),status:'open',generated:true,display_name:'合成英語卷',saved_at:'2026-10-30T00:00:00Z',generated_kind:'self',total:5,answered:2,correct:1});
 const library=g=>({role:'student',grade:g,identity:row(g),sessions:[paper(g)]});
 async function front(page){const session=await page.target().createCDPSession();try{session.grantForegroundOnce('Page.bringToFront','驗證身分切換按鈕與原頁同步，需要可見分頁的瀏覽器互動');await session.send('Page.bringToFront');}finally{await session.detach();}}
 async function click(page,selector){await front(page);await page.click(selector);}
 async function setup(page){
  pages.push(page);page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.stack||String(e)));
  const waitForFunction=page.waitForFunction.bind(page);
  page.waitForFunction=(fn,options={},...args)=>waitForFunction(fn,{polling:100,...options},...args);
  await page.setRequestInterception(true);
  page.on('request',async request=>{
   try{
    const u=new URL(request.url());if(u.origin!==origin)return request.abort();
    const send=(body,status=200)=>request.respond({status,contentType:'application/json',body:JSON.stringify(body)});
    if(u.pathname==='/shared/auth.js')return request.respond({contentType:'text/javascript',body:auth});
    if(u.pathname.startsWith('/fixture-rpc/')){
     const name=u.pathname.split('/').at(-1),args=JSON.parse(request.postData()||'{}');calls.push({name,args});
     if(name==='switch_test_identity'){
      if(args.p_grade&&failSwitch)return send({data:null,error:{message:'synthetic failure'}});
      if(args.p_grade)grade=args.p_grade==='grade3'?3:6;
      return send({data:[row(grade)],error:null});
     }
     if(name==='get_my_student_enrollment')return send({data:[row(grade)],error:null});
     return send({data:[],error:null});
    }
    if(u.pathname.startsWith('/fixture-supabase/')){
     const name=u.pathname.split('/').at(-1),body=JSON.parse(request.postData()||'{}');calls.push({name,body});
     if(name==='quiz_library_sessions'){
      const result=library(grade);
      if(holdLibrary){holdLibrary=false;await new Promise(r=>releaseLibrary=r);}
      return send(result);
     }
     if(name==='quiz_pool_catalog'){
      const g=grade,result={available:true,courses:[{id:'fixture-en-'+g,grade:g,subject:'英語',units:[{id:1,title:'單元一',count:40}]}],name_characters:[]};
      if(holdCatalog){holdCatalog=false;await new Promise(r=>releaseCatalog=r);}
      return send(result);
     }
     if(name==='quiz_compose')return send({session_id:ownId,display_name:paper(grade).display_name,paper:paper(grade),distribution:{actual:5,easy:1,medium:3,hard:1,requested:5,difficulty:'medium'}});
     if(name==='quiz_wrong_questions')return send({role:'student',grade,total:0,facets:[],items:[]});
     if(name==='quiz_past_action')return send({papers:[]});
     return send({error:'unexpected_fixture_rpc'},400);
    }
    if(/^\/grade[36]\/115-1\/index.html$/.test(u.pathname))return request.respond({contentType:'text/html;charset=utf-8',body:`<!doctype html><html><body><main></main><span id="auth-status"></span><button id="login-btn"></button><button id="logout-btn"></button><script type="module">import{initNavbarAuth}from'/shared/navbar-auth.js';import{initGrade6NavIdentity}from'/shared/grade6-nav-identity.js?v=${baseline?'20261029-batch4':release}';import{initTestIdentitySwitch}from'/shared/test-identity-switch.js?v=${baseline?'20261019':release}';initNavbarAuth();initGrade6NavIdentity({expanded:true});initTestIdentitySwitch();</script></body></html>`});
    if(u.pathname==='/identity-fixture-start')return request.respond({contentType:'text/html',body:'<!doctype html><title>身分同步測試</title>'});
    if(!/^\/(shared\/[A-Za-z0-9_./-]+|grade[36]\/115-1\/(quiz-library\.html|quiz\.html|navbar\.js))$/.test(u.pathname)||u.pathname.includes('..'))return request.respond({status:404,body:''});
    if(live)return request.continue();
    const type=u.pathname.endsWith('.html')?'text/html;charset=utf-8':u.pathname.endsWith('.css')?'text/css':u.pathname.endsWith('.woff2')?'font/woff2':'text/javascript';
    return request.respond({contentType:type,body:await fs.readFile(path.join(root,u.pathname.slice(1)))});
   }catch(e){errors.push(e.message);if(!request.isInterceptResolutionHandled?.())await request.respond({status:500,body:'fixture failure'}).catch(()=>{});}
  });
  return page;
 }
 const waitIdentity=(p,g)=>p.waitForFunction(cls=>document.querySelector('#auth-status')?.textContent.includes(cls+' 班'),{},g===3?'307':'609');
 const waitGrade=async(p,g)=>{await front(p);return p.waitForFunction(g=>location.pathname===`/grade${g}/115-1/quiz-library.html`&&document.querySelector('#cloud-library')?.hidden===false,{},g);};
 const count=name=>calls.filter(x=>x.name===name).length;
 try{
  const first=browser.targets().find(t=>t._targetId===process.argv[2]);assert(first,'exact_seed_target_required');
  const page=await setup(await first.page());
  await front(page);
  progress('library-initial');
  await page.goto(origin+'/grade3/115-1/quiz-library.html',{waitUntil:'networkidle0'});await waitIdentity(page,3);
  progress('initial-identity-ready');
  await click(page,'#compose-toggle');await page.waitForSelector('#compose-course option');
  progress('initial-catalog-ready');
  assert.equal(await page.$eval('#compose-course',n=>n.value),'fixture-en-3');
  const homeTarget=browser.targets().find(t=>t._targetId===process.argv[3]);assert(homeTarget,'exact_home_target_required');
  const home=await setup(await homeTarget.page());await front(home);await home.goto(origin+'/grade3/115-1/index.html',{waitUntil:'networkidle0'});
  progress('home-ready');
  await home.waitForFunction(()=>document.querySelector('#test-identity-switch button')?.textContent==='切到六年級');
  await click(home,'#test-identity-switch button');await home.waitForFunction(()=>location.pathname==='/grade6/115-1/index.html'&&document.querySelector('#test-identity-switch button')?.textContent==='切到三年級');
  progress('switched-to-six');
  if(baseline){
   const changed=await page.waitForFunction(()=>location.pathname.includes('/grade6/'),{timeout:5000}).then(()=>true,()=>false);
   assert.equal(changed,false,'baseline unexpectedly already handles same-user roster changes');
   const report={baselineDefectReproduced:true,serverGrade:grade,oldPageGrade:3,sameGoogleUser:true,oldCatalogRetained:await page.$eval('#compose-course',n=>n.value)};
   await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));return;
  }
  await waitGrade(page,6);await waitIdentity(page,6);assert.equal(await page.$eval('#quiz-composer',n=>n.hidden),true);
  await click(page,'#compose-toggle');await page.waitForSelector('#compose-course option');assert.equal(await page.$eval('#compose-course',n=>n.value),'fixture-en-6');
  await click(page,'#compose-units input');await click(page,'#compose-form button[type="submit"]');await page.waitForSelector('#compose-result a');
  await click(page,'#compose-result button');await page.waitForFunction(()=>!document.querySelector('#my-papers-section').hidden);assert.match(await page.$eval('#my-papers',n=>n.textContent),/已作答/);
  // A delayed old six-grade library response must never replace the fresh three-grade view.
  holdLibrary=true;await click(page,'#refresh-library');await page.waitForFunction(()=>document.querySelector('#refresh-library').disabled);assert(releaseLibrary);
  await click(home,'#test-identity-switch button');await home.waitForFunction(()=>location.pathname==='/grade3/115-1/index.html'&&document.querySelector('#test-identity-switch button')?.textContent==='切到六年級');
  await waitGrade(page,3);releaseLibrary();releaseLibrary=null;await waitIdentity(page,3);
  // Cross-tab signals invalidate old in-flight catalog results, too.
  holdCatalog=true;await click(page,'#compose-toggle');await page.waitForFunction(()=>document.querySelector('#compose-toggle').disabled);assert(releaseCatalog);
  await click(home,'#test-identity-switch button');await waitGrade(page,6);releaseCatalog();releaseCatalog=null;await waitIdentity(page,6);
  await click(page,'#compose-toggle');await page.waitForSelector('#compose-course option');assert.equal(await page.$eval('#compose-course',n=>n.value),'fixture-en-6');
  // A plain token refresh/focus/pageshow is not another roster read or page reload.
  const before=count('quiz_library_sessions');await page.evaluate(()=>{fixtureAuthRefresh();dispatchEvent(new Event('focus'));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
  await page.waitForFunction(()=>document.querySelector('#compose-course')?.value==='fixture-en-6');assert.equal(count('quiz_library_sessions'),before);
  // Missed cross-tab event during BFCache: pageshow reconciles the stored revision.
  grade=3;await page.evaluate(key=>{localStorage.setItem(key,JSON.stringify({version:1,userId:'fixture-test',revision:'bfcache-synthetic-change'}));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));},'test-identity-change-115-v1');
  await waitGrade(page,3);await waitIdentity(page,3);
  // Failed switches must not invalidate other pages or announce a successful change.
  await home.goto(origin+'/grade3/115-1/index.html',{waitUntil:'networkidle0'});await home.waitForFunction(()=>document.querySelector('#test-identity-switch button')?.textContent==='切到六年級');
  failSwitch=true;const failedBefore=count('quiz_library_sessions');await click(home,'#test-identity-switch button');await home.waitForFunction(()=>document.querySelector('#test-identity-switch p')?.textContent.includes('切換失敗'));
  assert.equal(grade,3);assert.equal(count('quiz_library_sessions'),failedBefore);
  await page.setViewport({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.deepEqual(errors,[]);
  const report={passed:true,sameGoogleUserSwitch:true,threeToSix:true,sixToThree:true,oldCatalogInvalidated:true,lateLibraryRejected:true,lateCatalogRejected:true,bfcacheReconciled:true,noRefreshOnFocusOrToken:true,failedSwitchDoesNotInvalidate:true,composeAndSavedCard:true,mobile:true,rpcCounts:Object.fromEntries(['quiz_library_sessions','quiz_pool_catalog','quiz_compose'].map(n=>[n,count(n)])),errors};
  await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }catch(error){
  const states=await Promise.all(pages.map(p=>p.evaluate(()=>({url:location.href,visibility:document.visibilityState,label:document.querySelector('#auth-status')?.textContent,status:document.querySelector('#cloud-lock')?.textContent,ids:[...document.querySelectorAll('[id]')].map(n=>n.id),storage:localStorage.getItem('test-identity-change-115-v1')})).catch(e=>({error:e.message}))));
  await fs.writeFile(path.join(out,'failure.json'),JSON.stringify({states,errors,calls},null,2));console.error(JSON.stringify({states,errors}));throw error;
 }finally{
  releaseLibrary?.();releaseCatalog?.();
  for(const page of pages)try{await Promise.race([page.close(),new Promise(r=>setTimeout(r,3000))]);}catch{}
  await browser.disconnect();
 }
})().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});
