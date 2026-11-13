// Run through D:/ai-browser/run-background.cjs with a lease and exact local preview target.
// Synthetic auth and REST only: no real student, homework, reading or growth writes.
const fs = require('node:fs'), assert = require('node:assert/strict');
const {chromium} = require('D:/projects/browser-automation-workflow/node_modules/playwright');
const base = 'http://127.0.0.1:8133', route = '/grade6/115-1/week11.html';
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
   state.user=true;
   const {challenges}=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync('grade6/115-1/week11-typing-data.js','utf8')).toString('base64'));
   const answer=challenges.zh.levels[0].ans;
   const index=answer.length-18, wrong=answer.slice(0,index)+'錯'+answer.slice(index+1);
   for(const width of [1280,390]) {
     await page.setViewportSize({width,height:900});
     await open('/grade6/115-1/week11-boss-zh.html');
     await page.waitForFunction(()=>!document.querySelector('#input-level1').disabled);
     await page.locator('#input-level1').fill(wrong);
     await page.locator('.typing-check').click();
     assert.equal(await page.locator('.typing-error-locator').count(),1);
     await page.locator('.typing-error-jump').click();
     await page.waitForTimeout(500);
     const position=await page.locator('#input-level1').evaluate(e=>({start:e.selectionStart,end:e.selectionEnd,text:e.value,scroll:e.scrollTop}));
     assert.equal(position.start,index);assert.equal(position.end,index+1);assert.equal(position.text,wrong);
     if(width===390)assert.ok(position.scroll>0,'scroll to long wrapped text');
     assert.equal(writes.length,0);
     await page.locator('.typing-error-locator').scrollIntoViewIfNeeded();
     await page.screenshot({path:`${out}/locator-${width}.png`});
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   }
   // Use actual initialized textarea/composition listener and renderer, without progress writes.
   const cases=await page.evaluate(async()=>{
     const {renderTypingErrorLocator:render}=await import('/shared/typing-error-locator.mjs?v=20261113-locator');
     const input=document.querySelector('#input-level1'),root=document.querySelector('#msg-level1');
     const results=[];
     for(const [actual,answer,kind,start,end] of [['甲丙','甲乙丙','少了',1,1],['甲多乙丙','甲乙丙','多了',1,2],['甲乙','甲\n乙','Enter',1,1],['甲,乙','甲，乙','全形',1,2],['😀錯','😀好','需要',2,3]]) {
       input.value=actual;render(root,input,answer);root.querySelector('button').click();
       results.push({ok:root.textContent.includes(kind)&&input.selectionStart===start&&input.selectionEnd===end&&input.value===actual,actual});
     }
     input.value='甲錯丙';render(root,input,'甲乙丙');input.value='錯乙丙';root.querySelector('button').click();
     results.push({ok:input.selectionStart===0&&input.selectionEnd===1&&root.textContent.includes('重新定位'),actual:'stale'});
     input.value='甲乙丙';root.querySelector('button').click();results.push({ok:root.textContent.includes('請再按'),actual:'fixed'});
     input.value='甲錯丙';render(root,input,'甲乙丙');input.setSelectionRange(0,0);input.dispatchEvent(new CompositionEvent('compositionstart'));root.querySelector('button').click();
     results.push({ok:input.selectionStart===0&&input.selectionEnd===0&&root.textContent.includes('完成注音選字'),actual:'IME'});
     input.dispatchEvent(new CompositionEvent('compositionend'));input.readOnly=true;root.querySelector('button').click();results.push({ok:root.textContent.includes('目前未開放'),actual:'locked'});input.readOnly=false;
     input.value='<img src=x onerror=alert(1)>';render(root,input,'正常文字');results.push({ok:root.querySelectorAll('img,script').length===0,actual:'literal markup'});
     return results;
   });
   cases.forEach(result=>assert.ok(result.ok,result.actual));checks.push('desktop/mobile raw offsets and scroll; missing caret; extra selection; punctuation/Enter; emoji; stale hint; IME; locked; literal markup; no writes');
   for(const week of ['05','07','08','09','11'])for(const lang of ['zh','en']){
     await open(`/grade6/115-1/week${week}-boss-${lang}.html`);await page.waitForFunction(()=>!document.querySelector('#input-level1').disabled);
     await page.locator('#input-level1').fill('錯誤');await page.locator('.typing-check').click();assert.equal(await page.locator('.typing-error-locator').count(),1);
   }
   checks.push('all ten garden bosses use locator');
   await open();assert.equal(await page.locator('#practice article.resource').count(),5);
   assert.equal(await page.locator('#practice a[href="zhuyin-foundation.html"]').count(),1);assert.equal(await page.locator('#practice a[href="typing-foundation.html"]').count(),1);
   for(const width of [1280,390]){await page.setViewportSize({width,height:900});await page.locator('#practice').scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/fast-five-${width}.png`});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
   assert.deepEqual(errors,[]);assert.equal(writes.length,0);fs.writeFileSync(out+'/locator-checks.json',JSON.stringify({status:'passed',synthetic:true,checks,cases,writeCount:writes.length,pageerrors:errors},null,2));console.log(JSON.stringify({status:'passed',checks,cases,writeCount:writes.length,pageerrors:errors}));
 }finally{await page.close().catch(()=>{});await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});

