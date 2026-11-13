// Run through D:/ai-browser/run-background.cjs with a lease and exact local preview target.
// Synthetic auth and REST only: no real student, homework, reading or growth writes.
const fs = require('node:fs'), assert = require('node:assert/strict');
const {chromium} = require('D:/projects/browser-automation-workflow/node_modules/playwright');
const base = 'http://127.0.0.1:8131', route = '/grade6/115-1/week11.html';
const out = '.chat-mode/evidence/browser';
const state = {user: false, saveFail: false, saveDelay: false, loadFail: false, visibility: [], rows: {}, drafts: {}};
const writes = [], errors = [], checks = [];
const auth = () => `
export const SUPABASE_URL='${base}/fake',SUPABASE_ANON_KEY='synthetic',TEACHER_EMAILS=[],AUTH_STORAGE_KEY='qa',LOGIN_RETURN_KEY='qa-return';
let session=${JSON.stringify(state.user ? {user:{id:'week11-synthetic',email:'qa@example.invalid'},access_token:'synthetic'} : null)};
export const resolveSession=async()=>session,getSession=async()=>({session}),getStoredAccessToken=()=> 'synthetic',isTeacher=()=>false;
window.qaLogin=0;export function beginCentralizedLogin(){window.qaLogin++};export const signInWithGoogle=async()=>{};
const listeners=[];export const signOutAndReload=async()=>{session=null;for(const f of listeners)f('SIGNED_OUT',null)};
window.qaEmit=event=>Promise.all(listeners.map(f=>f(event,session)));
window.qaSetSession=next=>{session=next;return Promise.all(listeners.map(f=>f('SIGNED_IN',session)))};
export const supabase={auth:{getSession,onAuthStateChange(f){listeners.push(f);return{data:{subscription:{unsubscribe(){}}}}}},rpc(){const p=Promise.resolve({data:null,error:null});p.abortSignal=()=>p;return p;},from(table){const filters={};const q={select(){return q},eq(k,v){filters[k]=v;return q},maybeSingle:async()=>{const r=await fetch('${base}/__qa/progress?key='+filters.week_code+':'+filters.activity_key);return r.json()},then(resolve){return Promise.resolve({data:${JSON.stringify(state.visibility)},error:null}).then(resolve)}};return q}};`;
(async () => {
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.connectOverCDP(process.env.CDP_URL,{timeout:30000});
 const context=browser.contexts()[0], page=context.pages()[0];
 assert.equal(new URL(page.url()).origin,base,'must use exact preview target');
 const client=await context.newCDPSession(page);client.grantForegroundOnce('Page.bringToFront','Verify keyboard editing, concept controls and lightbox in the exact test tab.');await client.send('Page.bringToFront');await client.detach();
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 await page.route('**/shared/auth.js*',r=>r.fulfill({contentType:'application/javascript',body:auth()}));
 await page.route('**/__qa/progress?*',r=>{const key=new URL(r.request().url()).searchParams.get('key');return r.fulfill({json:state.loadFail?{data:null,error:{message:'synthetic load failure'}}:{data:state.rows[key]||null,error:null}})});
 await page.route('**/fake/rest/v1/**',async r=>{
   const req=r.request(),url=new URL(req.url()),key=[url.searchParams.get('week_code')?.replace('eq.',''),url.searchParams.get('activity_key')?.replace('eq.','')].join(':');
   if(url.pathname.endsWith('/student_progress')&&req.method()==='POST'){
     const row=req.postDataJSON();writes.push(row);
     if(state.saveDelay)await new Promise(resolve=>{state.releaseSave=resolve;state.onSaveStart?.()});
     if(state.saveFail)return r.fulfill({status:503,body:'synthetic save failure'});
     assert.equal(row.user_id,'week11-synthetic');assert.equal(row.course_id,'grade6-115-1');state.rows[row.week_code+':'+row.activity_key]=row;
     return r.fulfill({status:201,body:''});
   }
   if(url.pathname.endsWith('/typing_drafts')){
     if(req.method()==='POST'){const row=req.postDataJSON();state.drafts[row.week_code+':'+row.activity_key+':'+row.level_id]={...row,saved_at:new Date().toISOString()};}
     if(req.method()==='DELETE'){for(const k of Object.keys(state.drafts))if(k.startsWith(key+':'))delete state.drafts[k];}
     return r.fulfill({json:req.method()==='GET'?Object.entries(state.drafts).filter(([k])=>k.startsWith(key+':')).map(([,v])=>v):null});
   }
   return r.fulfill({json:[]});
 });
 // No fallback to real Supabase data in this test, even if a new import changes.
 await page.route('**/*.supabase.co/**',r=>r.abort());
 const open=async(path=route)=>{await page.goto(base+path,{waitUntil:'networkidle'});await page.waitForFunction(()=>typeof window.checkLevel==='function'||!location.pathname.includes('week11'));};
 const shot=async(name,width,selector)=>{await page.setViewportSize({width,height:900});await page.evaluate(()=>document.fonts.ready);if(selector)await page.locator(selector).scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/${name}-${width}.png`,fullPage:!selector});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow: '+name);};
 try {
   await open();assert.equal(await page.locator('#input-level1').isDisabled(),true);
   await page.locator('#login-btn').click();assert.equal(await page.evaluate(()=>window.qaLogin),1);checks.push('anonymous lock and actual login click');
   for(const [mode,x,y,gap] of [['original',230,108,'30'],['align',300,108,'30'],['distribute',230,134,'56'],['both',300,134,'56']]){
     const b=page.locator(`[data-arrange="${mode}"]`);await b.focus();await page.keyboard.press('Enter');
     assert.equal(await b.getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#demo-shape-0').getAttribute('transform'),`translate(${x},30)`);assert.equal((await page.locator('#demo-shape-1').getAttribute('transform')).split(',')[1],y+')');assert.ok((await page.locator('#gap-text-0').textContent()).includes(gap));
   }
   checks.push('four concept states via real keyboard; edge gaps vs alignment');
   await page.locator('#infographic img').evaluate(e=>e.decode());
   for(const width of [1280,390]){
     await shot('week11',width);await shot('concept',width,'#arrange');
     await page.locator('[data-image-lightbox]').click();await page.locator('#lightbox-img').evaluate(e=>e.decode());
     assert.equal(await page.locator('#lightbox-scale').textContent(),'100%');await page.locator('#lightbox-zoom-in').click();assert.equal(await page.locator('#lightbox-scale').textContent(),'135%');
     const stage=page.locator('#lightbox-stage'),box=await stage.boundingBox();const x=box.x+box.width/2,y=box.y+box.height/2;
     await page.mouse.move(x,y);await page.mouse.wheel(0,-100);const before=await page.locator('#lightbox-img').getAttribute('style');await page.mouse.down();await page.mouse.move(x+30,y+20,{steps:5});await page.mouse.up();assert.notEqual(await page.locator('#lightbox-img').getAttribute('style'),before);
     await page.locator('#lightbox-center').click();await page.locator('#lightbox-stage').dblclick();await page.locator('#lightbox-reset').click();assert.equal(await page.locator('#lightbox-scale').textContent(),'100%');
     await page.screenshot({path:`${out}/lightbox-${width}.png`});await page.keyboard.press('Escape');assert.equal(await page.locator('#lightbox').isVisible(),false);assert.equal(await page.evaluate(()=>document.activeElement?.hasAttribute('data-image-lightbox')),true);
     await page.locator('[data-image-lightbox]').click();assert.equal(await page.locator('#lightbox-scale').textContent(),'100%');await page.locator('#lightbox-close').click();
   }
   checks.push('desktop/mobile no overflow; infographic decoded; zoom wheel drag doubleclick reset center close focus reopen');
   state.user=true;state.loadFail=true;await open();await page.waitForFunction(()=>document.querySelector('#progress-status').textContent.includes('闖關先暫停'));assert.equal(await page.locator('#input-level1').isDisabled(),true);await page.evaluate(()=>window.checkLevel(1));assert.equal(writes.length,0);checks.push('load failure locks input and direct check; no write');
   state.loadFail=false;await open();await page.waitForFunction(()=>!document.querySelector('#input-level1').disabled);
   await page.locator('#input-level1').fill('保留這段尚未完成的文字');state.loadFail=true;
   await page.evaluate(()=>window.qaEmit('TOKEN_REFRESHED'));assert.equal(await page.locator('#input-level1').isDisabled(),true);assert.equal(await page.locator('#typing-draft-save-1').isEnabled(),true);
   await page.locator('#typing-draft-save-1').click();await page.waitForFunction(()=>document.querySelector('#typing-draft-status-1').textContent.includes('草稿已儲存'));assert.equal(writes.length,0);
   await page.evaluate(()=>window.qaSetSession({user:{id:'different-user',email:'other@example.invalid'},access_token:'other-synthetic'}));assert.equal(await page.locator('#typing-draft-save-1').isDisabled(),true);
   state.loadFail=false;await open();await page.locator('#typing-draft-restore-1').click();assert.equal(await page.locator('#input-level1').inputValue(),'保留這段尚未完成的文字');checks.push('token refresh load failure permits own draft save; another user remains locked; restored after reload');
   const {challenges}=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync('grade6/115-1/week11-typing-data.js','utf8')).toString('base64'));
   const set=async(id,text)=>page.locator('#input-level'+id).fill(text);
   const check=async id=>page.locator('#block-level'+id+' .typing-check').click();
   await set(1,'最近');await check(1);assert.match(await page.locator('#msg-level1').textContent(),/第1行、第3個字/);
   await page.locator('#typing-draft-save-1').click();await page.waitForFunction(()=>document.querySelector('#typing-draft-status-1').textContent.includes('草稿已儲存'));assert.equal(writes.length,0);
   await open();await page.locator('#typing-draft-restore-1').click();assert.equal(await page.locator('#input-level1').inputValue(),'最近');
   state.saveFail=true;await set(1,challenges.regular.levels[0].ans);await check(1);await page.waitForFunction(()=>document.querySelector('#msg-level1').textContent.includes('還沒記錄成功'));assert.equal(await page.locator('#block-level2').isVisible(),false);
   state.saveFail=false;await check(1);await page.waitForFunction(()=>!document.querySelector('#block-level2').classList.contains('hidden'));
   await open();await page.waitForFunction(()=>document.querySelector('#input-level1').readOnly);assert.equal(await page.locator('#block-level2').isVisible(),true);
   for(let id=2;id<=6;id++){
     await set(id,challenges.regular.levels[id-1].ans);
     if(id===6){state.saveDelay=true;state.saveFail=true;const started=new Promise(resolve=>state.onSaveStart=resolve);const before=writes.length;await check(6);await started;await page.evaluate(()=>Promise.all([window.checkLevel(6),window.checkLevel(6)]));assert.equal(writes.length,before+1);assert.equal(await page.locator('#celebration-overlay').count(),0);state.saveDelay=false;state.releaseSave();await page.waitForFunction(()=>document.querySelector('#msg-level6').textContent.includes('還沒記錄成功'));assert.equal(await page.locator('#celebration-overlay').count(),0);state.saveFail=false;}
     await check(id);if(id<6)await page.waitForFunction(i=>!document.querySelector('#block-level'+i).classList.contains('hidden'),id+1);else await page.locator('#celebration-overlay').waitFor({state:'visible'});
     if(id===5)assert.match(await page.locator('#msg-level5').textContent(),/一片葉/);
   }
   assert.equal(state.rows['11:typing_task_6'].completed,true);assert.equal(state.rows['11:typing_task_6'].current_level,6);assert.match(await page.locator('#celebration-overlay').textContent(),/一葉一花/);assert.match(await page.locator('#celebration-overlay a').getAttribute('href'),/my-tree/);await page.locator('#celebration-overlay').evaluate(e=>e.remove());const count=writes.length;await page.evaluate(()=>window.checkLevel(6));assert.equal(writes.length,count);checks.push('wrong hint; draft/resume; save failure; six sequential REST saves; reload; reward wording; repeat no write');
   for(const lang of ['zh','en']){await open('/grade6/115-1/week11-boss-'+lang+'.html');await page.waitForFunction(()=>!document.querySelector('#input-level1').disabled);await set(1,challenges[lang].levels[0].ans);await check(1);await page.waitForFunction(()=>document.querySelector('#input-level1').readOnly);assert.equal(state.rows['11:'+challenges[lang].key].completed,true);}
   checks.push('separate zh/en boss progress keys');
   const legacy=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync('grade6/115-1/week09-typing-data.js','utf8')).toString('base64'));
   await open('/grade6/115-1/week09-boss-zh.html');await page.waitForFunction(()=>!document.querySelector('#input-level1').disabled);await set(1,legacy.challenges.zh.levels[0].ans);state.saveDelay=true;state.saveFail=true;const legacyStarted=new Promise(resolve=>state.onSaveStart=resolve),legacyBefore=writes.length;await check(1);await legacyStarted;await page.evaluate(()=>Promise.all([window.checkLevel(1),window.checkLevel(1)]));assert.equal(writes.length,legacyBefore+1);assert.equal(await page.locator('#celebration-overlay').count(),0);state.saveDelay=false;state.releaseSave();await page.waitForFunction(()=>document.querySelector('#msg-level1').textContent.includes('還沒記錄成功'));assert.equal(await page.locator('#celebration-overlay').count(),0);state.saveFail=false;await check(1);await page.locator('#celebration-overlay').waitFor({state:'visible'});checks.push('delayed final-save repeated checks cannot celebrate or duplicate POST; failure/retry verified for opt-in and legacy one-level boss');
   await open('/grade6/115-1/boss-garden.html');assert.equal(await page.locator('a[href="/grade6/115-1/week11-boss-zh.html"]').count(),1);assert.equal(await page.locator('a[href="/grade6/115-1/week11-boss-en.html"]').count(),1);
   state.user=false;await open('/grade6/115-1/index.html');assert.equal(await page.locator('[data-latest-week="true"]').getAttribute('data-week'),'11');assert.equal(await page.locator('[data-latest-week="true"]').count(),1);assert.equal(await page.locator('[data-week="10"]').textContent().then(s=>s.includes('本週</')),false);
   for(const width of [1280,390])await shot('home',width);
   for(const width of [1280,390]){await open('/grade6/115-1/week10.html');await shot('reference-week10',width);}
   assert.deepEqual(errors,[]);fs.writeFileSync(out+'/checks.json',JSON.stringify({status:'passed',synthetic:true,realStudentWrites:0,checks,writeCount:writes.length,pageerrors:errors},null,2));console.log(JSON.stringify({status:'passed',checks,writeCount:writes.length,pageerrors:errors}));
 }finally{await page.close().catch(()=>{});await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
