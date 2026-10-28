// Run through D:/ai-browser/run-background.cjs. Synthetic auth; no real student writes.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {connectCdp,safeScreenshot}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
const base='http://127.0.0.1:3000',week='/grade3/115-1/week09.html',out='tmp/grade3-week09-qa';
const fixture=`
export const SUPABASE_URL='${base}/fake',SUPABASE_ANON_KEY='synthetic';
window.fixtureListeners=[];window.fixtureSaves=[];window.fixtureLoginCalls=[];window.fixtureLogoutCount=0;
export const resolveSession=async()=>window.fixtureUser,getSession=async()=>({session:window.fixtureUser});
export const isTeacher=()=>false,getStoredAccessToken=()=> 'synthetic';
export function beginCentralizedLogin(options){window.fixtureLoginCalls.push(options);}
export const signOutAndReload=async()=>{window.fixtureLogoutCount++;};
export const supabase={auth:{onAuthStateChange(fn){window.fixtureListeners.push(fn);return {};},getSession},
rpc(name,args){
 if(name==='get_grade3_progress')return {abortSignal:async()=>window.fixtureLoadFail?{error:{code:'P0001',message:'合成進度讀取失敗'}}:{data:window.fixtureProgress?[window.fixtureProgress]:[]}};
 if(name==='save_grade3_progress')return {abortSignal:async()=>{window.fixtureSaves.push(args);if(window.fixtureSaveFail)return {error:{code:'P0001',message:'合成儲存失敗'}};window.fixtureProgress={current_level:Math.min(args.p_score+1,6),completed:args.p_score===6,score:args.p_score};return {data:null};}};
 return {abortSignal:async()=>window.fixtureImportFail?{error:{code:'P0001',message:'合成身分接回失敗'}}:{data:[{class_code:'301',seat_no:1,display_name:'合成測試',student_code:'30101',practice_account:'synthetic'}]}};
},from(){const query={select(){return query;},eq(){return query;},then(resolve){return Promise.resolve({data:window.fixtureVisibility||[]}).then(resolve);}};return query;}};
`;
const user={user:{id:'synthetic-a',email:'synthetic@apps.ntpc.edu.tw'},access_token:'synthetic'};
const answers=['窗戶','eight','霧裡看花','How old are you?','上課要專心一點，才能有收穫。',"How old are you?\nI'm eight years old."];
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const c=await connectCdp({cdpUrl:process.env.AI_WORK_BROWSER_CDP_URL,targetUrl:base+week+'?qa=week09'});
 const p=c.page,errors=[];let bootstrap;
 p.on('pageerror',e=>errors.push(e.message));
 await p.setCacheEnabled(false);await p.setBypassServiceWorker(true);await p.setRequestInterception(true);
 const intercept=r=>(new URL(r.url()).pathname==='/shared/auth.js'?r.respond({contentType:'application/javascript',body:fixture}):/supabase\.co/.test(r.url())?r.abort():r.continue()).catch(()=>{});
 p.on('request',intercept);
 async function scenario(config={},path=week){
  if(bootstrap)await p.removeScriptToEvaluateOnNewDocument(bootstrap.identifier);
  bootstrap=await p.evaluateOnNewDocument(data=>{window.fixtureUser=data.user||null;window.fixtureProgress=data.progress||null;window.fixtureSaveFail=Boolean(data.saveFail);window.fixtureLoadFail=Boolean(data.loadFail);window.fixtureImportFail=Boolean(data.importFail);window.fixtureVisibility=data.visibility||[];},config);
  await p.goto(base+path,{waitUntil:'networkidle2'});
  await p.waitForFunction(()=>window.__navbarAuthController);
 }
 const value=(id,text)=>p.$eval('#input-level'+id,(e,t)=>{e.value=t;e.dispatchEvent(new Event('input',{bubbles:true}));},text);
 const check=id=>p.$eval(`[onclick="checkLevel(${id})"]`,e=>e.click());
 async function settled(id){await p.waitForFunction(n=>document.querySelector('#input-level'+n).readOnly&&document.querySelector('[data-replay="'+n+'"]').disabled===false,{},id);}
 async function screenshot(width,name,section){
  await p.setViewport({width,height:900});
  await p.evaluate(id=>{document.documentElement.style.scrollBehavior='auto';if(id)document.getElementById(id).scrollIntoView();else scrollTo(0,0);},section);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'horizontal overflow '+width);
  await safeScreenshot(p,{path:`${out}/${name}.png`});
 }
 try{
  c.session.grantForegroundOnce('Page.bringToFront','Verify the new course page at desktop and mobile widths.');await c.session.send('Page.bringToFront');
  await scenario();
  assert.equal(await p.$eval('#typing-levels-container',e=>e.inert),true);
  assert.ok(await p.$eval('#input-level1',e=>e.disabled));
  assert.ok(await p.$eval('[data-replay="1"]',e=>e.disabled));
  const vote=await p.$eval('#vote-link',e=>({href:e.href,target:e.target,rel:e.rel}));
  assert.equal(vote.href,'https://forms.gle/6EYf7aSkYvq7PBwz7');assert.equal(vote.target,'_blank');assert.match(vote.rel,/noopener/);
  assert.equal(await p.$eval('#practice-link',e=>e.getAttribute('href')),'quiz-library.html');
  await p.$eval('#login-btn',e=>e.click());assert.equal(await p.evaluate(()=>fixtureLoginCalls[0].returnTo),base+week);
  await screenshot(1280,'week09-1280');await screenshot(390,'week09-390');
  await scenario({user});await p.waitForFunction(()=>!document.querySelector('#input-level1').disabled);
  assert.equal(await p.$eval('#typing-levels-container',e=>e.inert),false);
  assert.equal(await p.$eval('#input-level1',e=>e.dispatchEvent(new Event('paste',{cancelable:true}))),false);
  assert.equal(await p.$eval('#input-level1',e=>e.dispatchEvent(new Event('drop',{cancelable:true}))),false);
  await value(1,'窗');await check(1);await p.waitForFunction(()=>document.querySelector('#msg-level1').textContent.includes('還少 1'));
  await value(1,'chuang');await check(1);await p.waitForFunction(()=>document.querySelector('#msg-level1').textContent.includes('切到「中」'));
  await value(1,'窗戶');await p.evaluate(()=>{window.fixtureSaveFail=true;});await check(1);
  await p.waitForFunction(()=>document.querySelector('#msg-level1').textContent.includes('合成儲存失敗'));
  assert.ok(await p.$eval('#block-level2',e=>e.classList.contains('hidden')));assert.ok(await p.$eval('[data-replay="1"]',e=>e.disabled));
  await p.evaluate(()=>{window.fixtureSaveFail=false;});await check(1);await settled(1);
  assert.deepEqual(await p.evaluate(()=>fixtureSaves.at(-1)),{p_week_code:'09',p_activity_key:'typing_task_6',p_score:1});
  const progress=await p.evaluate(()=>fixtureProgress);await scenario({user,progress});
  await p.waitForFunction(()=>document.querySelector('#progress-status').textContent.includes('第 2 關'));
  await p.$eval('[data-replay="1"]',e=>e.click());assert.equal(await p.$eval('#target-level1',e=>e.textContent),'黑板');
  await value(1,'黑板');await check(1);await settled(1);assert.equal(await p.evaluate(()=>fixtureSaves.length),0);
  await p.$eval('[data-replay="1"]',e=>e.click());assert.equal(await p.$eval('#target-level1',e=>e.textContent),'窗戶');
  await value(1,'窗戶');await check(1);await settled(1);
  assert.equal(await p.$eval('[data-next="2"]',e=>e.disabled),false);
  await p.click('[data-next="2"]');
  assert.equal(await p.evaluate(()=>document.activeElement.id),'input-level2');
  await p.$eval('#input-level2',e=>e.dispatchEvent(new FocusEvent('focus')));await p.$eval('[data-typing-tool-toggle="keyboard"]',e=>e.click());
  assert.ok((await p.$$('[data-english-keyboard-guide] .is-target')).length>0);
  await p.$eval('[data-typing-tool-close="keyboard"]',e=>e.click());
  await p.type('#input-level2','eight');await check(2);await settled(2);
  for(let id=3;id<=5;id++){await value(id,answers[id-1]);await check(id);await settled(id);}
  await value(6,answers[5].replace('\n',''));await check(6);await p.waitForFunction(()=>document.querySelector('#msg-level6').textContent.includes('Enter'));
  await value(6,"How old are you?\nI'm eight yearx old.");await check(6);await p.waitForFunction(()=>document.querySelector('#msg-level6').textContent.includes('第 2 行第 15 個字元'));
  await value(6,answers[5]);await check(6);await settled(6);assert.equal(await p.evaluate(()=>fixtureProgress.completed),true);
  const done=await p.evaluate(()=>fixtureProgress);assert.equal(done.score,6);
  assert.match(await p.$eval('#celebration-overlay',e=>e.textContent),/五片葉、一朵花/);
  const treeHref=await p.$eval('#celebration-overlay a',e=>e.href);assert.match(treeHref,/course=grade3-115-1/);assert.match(treeHref,/week09/);
  await scenario({user,progress:done});await p.waitForFunction(()=>document.querySelector('#input-level6').readOnly);
  assert.equal(await p.$('#celebration-overlay'),null);
  await screenshot(1280,'week09-typing-1280','typing');await screenshot(390,'week09-typing-390','typing');
  for(let id=1;id<=6;id++){
   const before=await p.$eval('#target-level'+id,e=>e.textContent);await p.$eval(`[data-replay="${id}"]`,e=>e.click());const after=await p.$eval('#target-level'+id,e=>e.textContent);assert.notEqual(after,before);await value(id,after);await check(id);await settled(id);
   if(id===6)await p.$eval('#celebration-overlay',e=>e.remove());
  }
  assert.equal(await p.evaluate(()=>fixtureSaves.length),0);
  await scenario({user,loadFail:true});await p.waitForFunction(()=>document.querySelector('#progress-status').textContent.includes('合成進度讀取失敗'));assert.ok(await p.$eval('#typing-levels-container',e=>e.inert));
  await scenario({user,importFail:true});await p.waitForFunction(()=>document.querySelector('#auth-status').textContent.includes('尚未接回'));assert.ok(await p.$eval('#input-level1',e=>e.disabled));
  await scenario({user});await p.waitForFunction(()=>!document.querySelector('#typing-levels-container').inert);
  await p.evaluate(()=>{for(const fn of fixtureListeners)fn('TOKEN_REFRESHED',fixtureUser);});await value(1,answers[0]);await check(1);await settled(1);
  const invalidated=await p.evaluate(()=>{for(const fn of fixtureListeners)fn('SIGNED_OUT',null);return document.querySelector('#typing-levels-container').inert;});assert.equal(invalidated,true);
  await scenario({},'/grade3/115-1/index.html');assert.equal(await p.$eval('[data-week="09"]',e=>e.dataset.latestWeek),'true');assert.equal(await p.$eval('[data-week="08"]',e=>e.dataset.latestWeek),undefined);
  await scenario({visibility:[{course_id:'grade3-115-1',week_code:'09',is_visible:false}]},'/grade3/115-1/index.html');await p.waitForFunction(()=>document.querySelector('[data-week="09"]').classList.contains('hidden'));assert.equal(await p.$('body > nav a[href="week09.html"]'),null);assert.equal(await p.$eval('[data-week="08"]',e=>e.classList.contains('hidden')),false);
  await scenario({},'/grade3/115-1/index.html');await p.waitForFunction(()=>document.querySelector('body > nav a[href="week09.html"]'));
  assert.deepEqual(errors,[]);
  const result={status:'passed',realStudentWrites:0,widths:[1280,390],checks:['anonymous lock','vote and practice links','OAuth returnTo','save failure retry','RPC week09 parameters','resume','six levels and precise hints','six alternate replay questions without writes','keyboard tools','read/import failure lock','auth refresh and account invalidation','completion and tree link','home/navbar hide and restore']};fs.writeFileSync(out+'/checks.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{p.off('request',intercept);await p.setRequestInterception(false).catch(()=>{});await p.close().catch(()=>{});await c.disconnect();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
