// Run with the shared browser lease wrapper; synthetic Auth/RPC, no real student writes.
const fs=require('node:fs'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const {connectCdp,safeScreenshot}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
const base='http://127.0.0.1:3000',week='/grade3/115-1/week11.html',out='.chat-mode/evidence/browser';
const user={user:{id:'synthetic-week11-a',email:'synthetic@apps.ntpc.edu.tw'},access_token:'synthetic'};
const fixture=`
export const SUPABASE_URL='${base}/fake',SUPABASE_ANON_KEY='synthetic';
window.fixtureListeners=[];window.fixtureSaves=[];window.fixtureLoginCalls=[];window.fixtureLogoutCount=0;
// Exercise the real tree/return UI anonymously so navigation cannot write garden growth.
export const resolveSession=async()=>location.pathname==='/my-tree.html'?null:window.fixtureUser,getSession=async()=>({session:location.pathname==='/my-tree.html'?null:window.fixtureUser});
export const signInWithGoogle=async()=>{},TEACHER_EMAILS=[],AUTH_STORAGE_KEY='synthetic-auth',LOGIN_RETURN_KEY='synthetic-return';
export const isTeacher=()=>false,getStoredAccessToken=()=> 'synthetic';
export function beginCentralizedLogin(options){window.fixtureLoginCalls.push(options);}
export const signOutAndReload=async()=>{window.fixtureLogoutCount++;};
export const supabase={auth:{onAuthStateChange(fn){window.fixtureListeners.push(fn);return {};},getSession},
rpc(name,args){
 if(name==='get_grade3_progress')return {abortSignal:async()=>window.fixtureLoadFail?{error:{code:'P0001',message:'合成進度讀取失敗'}}:{data:window.fixtureProgress?[window.fixtureProgress]:[]}};
 if(name==='save_grade3_progress')return {abortSignal:async()=>{window.fixtureSaves.push(args);if(window.fixtureSaveFail)return {error:{code:'P0001',message:'合成儲存失敗'}};window.fixtureProgress={current_level:Math.min(args.p_score+1,6),completed:args.p_score===6,score:args.p_score};return {data:null};}};
 return {abortSignal:async()=>window.fixtureImportFail?{error:{code:'P0001',message:'合成身分接回失敗'}}:{data:[{class_code:'304',seat_no:1,display_name:'合成測試',student_code:'30401',practice_account:'synthetic'}]}};
},from(){const q={select(){return q;},eq(){return q;},then(resolve){return Promise.resolve({data:window.fixtureVisibility||[]}).then(resolve);}};return q;}};
`;
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const {WEEK11_LEVELS:levels}=await import(pathToFileURL(require('node:path').resolve('grade3/115-1/week11-content.mjs')));
 const c=await connectCdp({cdpUrl:process.env.AI_WORK_BROWSER_CDP_URL,targetUrl:base+week+'?qa=week11'});
 const p=c.page,errors=[];let bootstrap;const drafts=new Map();
 if(!p.url().startsWith(base+week+'?qa=week11')){await c.disconnect();throw new Error('exact task target missing; acquire the QA URL before running');}
 c.session.grantForegroundOnce('Page.bringToFront','Exercise keyboard focus, draft controls and course unlocks in the task tab.');
 await c.session.send('Page.bringToFront');
 await p.goto('about:blank',{waitUntil:'load'});
 p.setDefaultTimeout(20000);
 p.on('pageerror',e=>errors.push(e.message));
 await p.setCacheEnabled(false);await p.setBypassServiceWorker(true);await p.setRequestInterception(true);
 const intercept=async r=>{
  const url=new URL(r.url());
  if(url.pathname==='/shared/auth.js')return r.respond({contentType:'application/javascript',body:fixture});
  if(url.pathname==='/fake/rest/v1/typing_drafts'){
   if(r.method()==='POST'){const row=JSON.parse(r.postData());drafts.set(Number(row.level_id),{...row,saved_at:new Date().toISOString()});}
   if(r.method()==='DELETE')drafts.delete(Number(url.searchParams.get('level_id')?.replace('eq.','')));
   return r.respond({status:200,contentType:'application/json',body:JSON.stringify(r.method()==='GET'?[...drafts.values()]:null)});
  }
  return /supabase\.co/.test(r.url())?r.abort():r.continue();
 };
 p.on('request',r=>intercept(r).catch(()=>{}));
 async function scenario(config={},path=week){
  if(bootstrap)await p.removeScriptToEvaluateOnNewDocument(bootstrap.identifier);
  bootstrap=await p.evaluateOnNewDocument(data=>{window.fixtureUser=data.user||null;window.fixtureProgress=data.progress||null;window.fixtureSaveFail=Boolean(data.saveFail);window.fixtureLoadFail=Boolean(data.loadFail);window.fixtureImportFail=Boolean(data.importFail);window.fixtureVisibility=data.visibility||[];},config);
  await p.goto(base+path,{waitUntil:'networkidle2'});await p.waitForFunction(()=>window.__navbarAuthController);
 }
 const value=(id,text)=>p.$eval('#input-level'+id,(e,t)=>{e.value=t;e.dispatchEvent(new Event('input',{bubbles:true}));},text);
 const check=id=>p.$eval(`[onclick="checkLevel(${id})"]`,e=>e.click());
 const settled=id=>p.waitForFunction(n=>document.querySelector('#input-level'+n).readOnly&&!document.querySelector('[data-replay="'+n+'"]').disabled,{},id);
 const visible=id=>p.$eval('#block-level'+id,e=>!e.classList.contains('hidden'));
 async function screenshot(width,name,section){await p.setViewport({width,height:900});await p.evaluate(id=>{document.documentElement.style.scrollBehavior='auto';if(id){const e=document.getElementById(id)||document.querySelector(id);scrollTo(0,scrollY+e.getBoundingClientRect().top-(document.querySelector('body > nav')?.getBoundingClientRect().height||0)-16);}else scrollTo(0,0);},section);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'overflow '+width);await safeScreenshot(p,{path:`${out}/${name}.png`});}
 try{
  await scenario();assert.ok(await p.$eval('#typing-levels-container',e=>e.inert));assert.ok(await p.$eval('#input-level1',e=>e.disabled));
  await p.click('#login-btn');assert.equal(await p.evaluate(()=>fixtureLoginCalls[0].returnTo),base+week);
  assert.equal(await p.$eval('#fingers a[href="typing-foundation.html"]',e=>e.textContent.includes('英打基礎')),true);
  await screenshot(1280,'week11-desktop');await screenshot(390,'week11-mobile');
  await scenario({user});await p.waitForFunction(()=>!document.querySelector('#input-level1').disabled);
  for(const event of ['paste','drop'])assert.equal(await p.$eval('#input-level1',(e,name)=>e.dispatchEvent(new Event(name,{cancelable:true})),event),false);
  // Real keyboard event path: edit only the wrong letter, preserving the suffix.
  await p.click('#input-level1');await p.type('#input-level1','I likr cats.');
  await p.keyboard.press('Home');for(let i=0;i<6;i++)await p.keyboard.press('ArrowRight');await p.keyboard.press('Backspace');await p.keyboard.type('e');
  assert.equal(await p.$eval('#input-level1',e=>e.value),'I like cats.');
  await p.keyboard.press('Home');for(let i=0;i<5;i++)await p.keyboard.press('ArrowRight');await p.keyboard.press('Delete');await p.keyboard.type('e');
  assert.equal(await p.$eval('#input-level1',e=>e.value),'I like cats.');
  await value(1,'老');await check(1);await p.waitForFunction(()=>document.querySelector('#msg-level1').textContent.includes('還沒打完'));
  await p.click('#typing-draft-save-1');await p.waitForFunction(()=>document.querySelector('#typing-draft-status-1').textContent.includes('草稿已儲存'));
  assert.equal(await p.evaluate(()=>fixtureSaves.length),0);
  await scenario({user});await p.waitForFunction(()=>!document.querySelector('#typing-draft-restore-1').classList.contains('hidden'));
  await p.click('#typing-draft-restore-1');assert.equal(await p.$eval('#input-level1',e=>e.value),'老');
  await value(1,levels[0].ans);await p.evaluate(()=>fixtureSaveFail=true);await check(1);await p.waitForFunction(()=>document.querySelector('#msg-level1').textContent.includes('合成儲存失敗'));assert.equal(await visible(2),false);
  await p.evaluate(()=>fixtureSaveFail=false);await check(1);await settled(1);
  assert.deepEqual(await p.evaluate(()=>fixtureSaves.at(-1)),{p_week_code:'11',p_activity_key:'typing_task_6',p_score:1});
  let progress=await p.evaluate(()=>fixtureProgress);await scenario({user,progress});await p.waitForFunction(()=>document.querySelector('#input-level1').readOnly);
  await p.click('[data-next="2"]');await p.type('#input-level2',levels[1].ans);await check(2);await settled(2);
  for(let id=3;id<=5;id++){assert.equal(await visible(id),true);await value(id,levels[id-1].ans);await check(id);await settled(id);}
  assert.match(await p.$eval('#msg-level5',e=>e.textContent),/一片葉/);
  await screenshot(390,'week11-typing-mobile','typing');
  await value(6,levels[5].ans.replace('eraser','eraxer'));await check(6);await p.waitForFunction(()=>document.querySelector('#msg-level6').textContent.includes('第 3 行'));
  await value(6,levels[5].ans.replace('\n',''));await check(6);await p.waitForFunction(()=>document.querySelector('#msg-level6').textContent.includes('Enter'));
  await value(6,levels[5].ans);await p.evaluate(()=>fixtureSaveFail=true);await check(6);await p.waitForFunction(()=>document.querySelector('#msg-level6').textContent.includes('合成儲存失敗'));assert.equal(await p.$('#celebration-overlay'),null);
  await p.evaluate(()=>fixtureSaveFail=false);await check(6);await settled(6);assert.match(await p.$eval('#celebration-overlay',e=>e.textContent),/一片葉、一朵花/);
  progress=await p.evaluate(()=>fixtureProgress);assert.deepEqual(progress,{current_level:6,completed:true,score:6});
  await p.waitForFunction(()=>document.querySelector('#celebration-overlay a')?.getBoundingClientRect().width>100);
  await Promise.all([p.waitForNavigation({waitUntil:'networkidle2'}),p.click('#celebration-overlay a')]);
  assert.equal(new URL(p.url()).pathname,'/my-tree.html');assert.equal(new URL(p.url()).searchParams.get('course'),'grade3-115-1');
  await p.waitForFunction(()=>!document.querySelector('#back-page-btn')?.classList.contains('hidden'));
  assert.equal(await p.$eval('#back-page-btn',e=>new URL(e.href).pathname),week);
  await Promise.all([p.waitForNavigation({waitUntil:'networkidle2'}),p.click('#back-page-btn')]);assert.equal(new URL(p.url()).pathname,week);assert.equal(await p.$('#celebration-overlay'),null);
  await scenario({user,progress});await p.waitForFunction(()=>document.querySelector('#input-level6').readOnly);assert.equal(await p.$('#celebration-overlay'),null);
  for(let id=1;id<=6;id++){await p.$eval('[data-replay="'+id+'"]',e=>e.click());assert.equal(await p.$eval('#target-level'+id,e=>e.textContent),levels[id-1].replay);await value(id,levels[id-1].replay);await check(id);await settled(id);if(id===6)await p.$eval('#celebration-overlay',e=>e.remove());}
  assert.equal(await p.evaluate(()=>fixtureSaves.length),0);
  await screenshot(1280,'week11-typing-desktop','typing');await screenshot(390,'week11-fingers-mobile','fingers');
  await scenario({user,loadFail:true});await p.waitForFunction(()=>document.querySelector('#progress-status').textContent.includes('合成進度讀取失敗'));assert.ok(await p.$eval('#typing-levels-container',e=>e.inert));
  await scenario({user,importFail:true});await p.waitForFunction(()=>document.querySelector('#auth-status').textContent.includes('尚未接回'));assert.ok(await p.$eval('#input-level1',e=>e.disabled));
  await scenario({user});await p.waitForFunction(()=>!document.querySelector('#typing-levels-container').inert);await p.evaluate(()=>{for(const fn of fixtureListeners)fn('TOKEN_REFRESHED',fixtureUser)});await value(1,levels[0].ans);await check(1);await settled(1);
  await p.click('#logout-btn');assert.equal(await p.evaluate(()=>fixtureLogoutCount),1);
  await scenario({},'/grade3/115-1/index.html');assert.equal(await p.$eval('[data-week="11"]',e=>e.dataset.latestWeek),'true');assert.equal(await p.$eval('[data-week="10"]',e=>e.dataset.latestWeek),undefined);
  assert.equal(await p.$$eval('[data-latest-week="true"]',es=>es.length),1);
  assert.deepEqual(await p.$$eval('.week-card-grid a > div > span,.week-card-grid a > div > div',es=>es.filter(e=>/^(本週|本週最新)$/.test(e.textContent.trim())).map(e=>e.closest('a').dataset.week)),['11']);
  assert.equal(await p.$eval('[data-current-week-badge]',e=>e.closest('a').dataset.latestWeek),'true');
  await screenshot(1280,'home-desktop','.week-card-grid');await screenshot(390,'home-mobile','.week-card-grid');assert.equal(await p.$eval('[data-week="11"]',e=>e.querySelector('[data-current-week-badge]').getBoundingClientRect().bottom<=e.querySelector('div > span').getBoundingClientRect().top),true,'mobile badge overlaps title');
  await Promise.all([p.waitForNavigation({waitUntil:'networkidle2'}),p.click('[data-week="11"]')]);assert.equal(new URL(p.url()).pathname,week);
  await scenario({visibility:[{course_id:'grade3-115-1',week_code:'11',is_visible:false}]},'/grade3/115-1/index.html');await p.waitForFunction(()=>document.querySelector('[data-week="11"]').classList.contains('hidden'));assert.equal(await p.$('body > nav a[href="week11.html"]'),null);assert.equal(await p.$eval('[data-week="10"]',e=>e.classList.contains('hidden')),false);
  assert.deepEqual(errors,[]);const result={status:'passed',realStudentWrites:0,checks:['anonymous/OAuth','Backspace/Delete/arrow real keyboard','drafts','six sequential saves','first/boss save failure','resume','six alternate replays without writes','precise mixed-language hints','logout','home/navbar visibility','unique week11 data marker and visible badge','home desktop/mobile and click week11','actual boss tree button and return click','desktop/mobile no overflow'],pageerrors:errors};fs.writeFileSync(out+'/synthetic-checks.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await p.setRequestInterception(false).catch(()=>{});await p.close().catch(()=>{});await c.disconnect();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
