// Run through D:/ai-browser/run-background.cjs with a lease and exact local preview target.
// Synthetic auth and REST only: no real student, homework, reading or growth writes.
const fs = require('node:fs'), assert = require('node:assert/strict');
const {chromium} = require('D:/projects/browser-automation-workflow/node_modules/playwright');
const base = process.env.TCWU_WEEK12_TEST_ORIGIN || 'http://127.0.0.1:8766', route = '/grade6/115-1/week12.html';
const out = process.env.TCWU_WEEK12_TEST_OUTPUT || '.chat-mode/evidence/week12-typing/browser';
const state = {user: false, saveFail: false, saveDelay: false, loadFail: false, visibility: [], rows: {}, drafts: {}};
const writes = [], errors = [], checks = [];
const auth = () => `
export const SUPABASE_URL='${base}/fake',SUPABASE_ANON_KEY='synthetic',TEACHER_EMAILS=[],AUTH_STORAGE_KEY='qa',LOGIN_RETURN_KEY='qa-return';
let session=${JSON.stringify(state.user ? {user:{id:'week12-synthetic',email:'qa@example.invalid'},access_token:'synthetic'} : null)};
export const resolveSession=async()=>session,getSession=async()=>({session}),getStoredAccessToken=()=> 'synthetic',isTeacher=()=>false;
window.qaLogin=0;export function beginCentralizedLogin(){window.qaLogin++};export const signInWithGoogle=async()=>{};
const listeners=[];export const signOutAndReload=async()=>{session=null;for(const f of listeners)f('SIGNED_OUT',null)};
window.qaEmit=event=>Promise.all(listeners.map(f=>f(event,session)));
window.qaSetSession=next=>{session=next;return Promise.all(listeners.map(f=>f('SIGNED_IN',session)))};
export const supabase={auth:{getSession,onAuthStateChange(f){listeners.push(f);return{data:{subscription:{unsubscribe(){}}}}}},rpc(){const p=Promise.resolve({data:null,error:null});p.abortSignal=()=>p;return p;},from(table){const filters={};let resetting=false;const q={select(){return q},delete(){resetting=true;return q},eq(k,v){filters[k]=v;return q},maybeSingle:async()=>{const r=await fetch('${base}/__qa/progress?key='+filters.week_code+':'+filters.activity_key+'&user='+filters.user_id);return r.json()},then(resolve){return Promise.resolve(resetting?{data:null,error:{message:'synthetic reset failure'}}:{data:${JSON.stringify(state.visibility)},error:null}).then(resolve)}};return q}};`;
(async () => {
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.connectOverCDP(process.env.CDP_URL,{timeout:30000});
 const context=browser.contexts()[0], page=context.pages()[0];
 assert.equal(new URL(page.url()).origin,base,'must use exact preview target');
 const client=await context.newCDPSession(page);client.grantForegroundOnce('Page.bringToFront','Verify keyboard editing, concept controls and lightbox in the exact test tab.');await client.send('Page.bringToFront');await client.detach();
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 await page.route('**/shared/auth.js*',r=>r.fulfill({contentType:'application/javascript',body:auth()}));
 await page.route('**/__qa/progress?*',async r=>{
   const query=new URL(r.request().url()).searchParams;
   const user=query.get('user');
   if(state.blockProgressFor===user) await new Promise(resolve=>{state.resumeProgress=resolve;state.onProgressStart();});
   const row=state.rows[query.get('key')];
   return r.fulfill({json:state.loadFail?{data:null,error:{message:'synthetic load failure'}}:{data:row?.user_id===user?row:null,error:null}});
 });
 await page.route('**/fake/rest/v1/**',async r=>{
   const req=r.request(),url=new URL(req.url()),key=[url.searchParams.get('week_code')?.replace('eq.',''),url.searchParams.get('activity_key')?.replace('eq.','')].join(':');
   if(url.pathname.endsWith('/student_progress')&&req.method()==='POST'){
     const row=req.postDataJSON();writes.push(row);
     if(state.saveDelay)await new Promise(resolve=>{state.releaseSave=resolve;state.onSaveStart?.()});
     if(state.saveFail)return r.fulfill({status:503,body:'synthetic save failure'});
     assert.equal(row.user_id,'week12-synthetic');assert.equal(row.course_id,'grade6-115-1');state.rows[row.week_code+':'+row.activity_key]=row;
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
 const { challenges }=await import('../../grade6/115-1/week12-typing-content.mjs');
 const { buildKeyboardGuideModel }=await import('../../shared/typing-guide-model.mjs');
 const folder='/grade6/115-1/';
 const open=async(path=route)=>{
   await page.goto(base+path,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>typeof window.checkLevel==='function');
 };
 const input=id=>page.locator('#input-level'+id);
 const waitEnabled=id=>page.waitForFunction(i=>!document.getElementById('input-level'+i).disabled,id);
 const block=id=>page.locator('#block-level'+id);
 const pressCheck=id=>page.locator('#check-'+id).click();
 const saveDraft=async(id,value)=>{
   await input(id).fill(value);
   await page.locator('#typing-draft-save-'+id).click();
   await page.waitForFunction(i=>document.getElementById('typing-draft-status-'+i).textContent.includes('草稿已儲存'),id);
 };
 const restoreDraft=async(id,value)=>{
   await waitEnabled(id);
   await page.locator('#typing-draft-restore-'+id).click();
   assert.equal(await input(id).inputValue(),value);
 };
 const closeOverlay=async()=>page.locator('#celebration-overlay').evaluate(e=>e.remove());
 const closeGuide=async()=>{
   const panel=page.locator('#floating-kb-panel');
   if(await panel.isVisible()) await page.locator('[data-typing-tool-close=keyboard]').click();
 };
 const records=[];
 async function guide(prompt,editor,width,label){
   let prefix='';
   for(const [lineIndex,line] of prompt.lines.entries()){
     const model=buildKeyboardGuideModel(typeof line==='string'?{text:line}:line);
     await editor.fill(prefix);
     await editor.evaluate(e=>{e.focus();e.setSelectionRange(e.value.length,e.value.length);e.dispatchEvent(new Event('keyup',{bubbles:true}));});
     if(!await page.locator('#floating-kb-panel').isVisible()){
       await page.locator('[data-typing-tool-toggle=keyboard]').click();
     }
     const target=page.locator('[data-'+(model.lang==='zh'?'zhuyin':'english')+'-keyboard-guide]');
     await target.waitFor({state:'visible'});
     const sample=target.locator('[data-guide-char]:not(.kg-punctuation)').first();
     await sample.click();
     const result=await target.evaluate((root,model)=>{
       const all=root.querySelector('[data-guide-all]');
       if(!all.hidden && all.getAttribute('aria-expanded')==='false') all.click();
       const clear=root.querySelector('[data-guide-clear]');
       if(!clear.hidden) clear.click();
       const cards=[...root.querySelectorAll('[data-guide-char]')];
       const matches=[];const failures=[];
       for(const item of model.items){
         const card=cards.find(c=>Number(c.dataset.guideChar)===item.id);
         if(!card){failures.push('missing:'+item.id);continue;}
         const display=card.querySelector('strong').textContent;
         if(display!==item.display) failures.push('display:'+item.id);
         if(item.kind==='punct') continue;
         const hint=card.querySelector('small').textContent;
         if(item.syllable&&!hint.includes(item.syllable)) failures.push('syllable:'+item.id);
         card.click();
         const active=[...root.querySelectorAll('kbd.is-target')].map(k=>k.dataset.key).sort();
         if(active.join(',')!==[...new Set(item.keys)].sort().join(',')) failures.push('keys:'+item.id);
         else matches.push(item.id);
       }
       return {matches,failures,warn:root.innerText.includes('待確認')};
     },model);
     assert.deepEqual(result.failures,[], label+' / '+lineIndex+' / '+model.text);
     assert.equal(result.warn,false);
     assert.equal(await editor.inputValue(),prefix,'guide must not alter input');
     assert.ok(await editor.evaluate(e=>document.activeElement===e),'guide must retain typing focus');
     if (lineIndex === 0 && ['regular:1:main','regular:1:replay1','zh:1:main','en:1:main'].includes(label)) {
       await page.screenshot({path:out+'/'+label.replaceAll(':','-')+'-'+width+'.png'});
     }
     prefix+=model.text+'\n';
     records.push({width,activity:label,line:lineIndex+1,lang:model.lang,keysVerified:result.matches.length});
   }
   await closeGuide();
 }

 try {
   await open();
   assert.ok(await input(1).isDisabled());
   assert.equal(await block(1).locator('.start-replay').isVisible(),false);
   await page.evaluate(()=>window.checkLevel(1));
   assert.equal(writes.length,0);
   assert.ok(await page.evaluate(()=>document.querySelector('#classwork').compareDocumentPosition(document.querySelector('#typing-section'))&Node.DOCUMENT_POSITION_FOLLOWING));
   checks.push('匿名鎖定且無寫入，相簿任務先於獨立打字區');

   // A delayed read or save from a previous account must never unlock B's page.
   const second={user:{id:'week12-other',email:'other@example.invalid'},access_token:'other-synthetic'};
   const pauseRead=async user=>{
     state.blockProgressFor=user;
     return new Promise(resolve=>state.onProgressStart=resolve);
   };
   state.user=true;
   await open(); await waitEnabled(1);
   await input(1).fill('previous account input');
   await page.evaluate(()=>window.qaEmit('TOKEN_REFRESHED'));
   await page.evaluate(next=>window.qaSetSession(next),{
     user:{id:'week12-synthetic',email:'qa@example.invalid'},access_token:'refreshed-synthetic'
   });
   assert.equal(await input(1).inputValue(),'previous account input');
   assert.ok(await input(1).isEnabled());
   let started=pauseRead('week12-other');
   await page.evaluate(next=>{window.qaPending=window.qaSetSession(next);},second);
   await started;
   assert.equal(await input(1).inputValue(),'');
   assert.ok(await input(1).isDisabled());
   assert.ok(await page.locator('#check-1').isDisabled());
   state.blockProgressFor=null;state.resumeProgress();
   await page.evaluate(()=>window.qaPending);

   const former={'user_id':'week12-synthetic','course_id':'grade6-115-1','week_code':'12','activity_key':'typing_task_6','current_level':6,completed:true};
   state.rows['12:typing_task_6']=former;
   started=pauseRead('week12-synthetic');
   await open();
   await started;
   await page.evaluate(next=>window.qaSetSession(next),second);
   const delayedResponse=page.waitForResponse(response=>response.url().includes('user=week12-synthetic'));
   state.blockProgressFor=null;state.resumeProgress();
   await (await delayedResponse).finished();
   assert.ok(await input(1).isEnabled());
   assert.equal(await input(1).evaluate(e=>e.readOnly),false);
   assert.equal(await block(2).isVisible(),false);
   delete state.rows['12:typing_task_6'];

   await open();await waitEnabled(1);
   await input(1).fill(challenges.regular.levels[0].main.ans);
   state.saveDelay=true;
   started=new Promise(resolve=>state.onSaveStart=resolve);
   await page.evaluate(()=>{window.qaCheck=window.checkLevel(1);});await started;
   await page.evaluate(next=>window.qaSetSession(next),second);
   state.saveDelay=false;state.releaseSave();
   await page.evaluate(()=>window.qaCheck);
   assert.equal(await input(1).inputValue(),'');
   assert.equal(await block(2).isVisible(),false);
   checks.push('切換帳號即鎖定清空，舊帳號延遲的讀取及保存無法解鎖新帳號');
   checks.push('同一帳號的登入事件與權杖更新保留輸入');

   state.loadFail=true;
   const failedRead=page.waitForResponse(response=>response.url().includes('/__qa/progress?'));
   await open();
   await (await failedRead).finished();
   assert.ok(await input(1).isDisabled());
   state.loadFail=false;
   await page.evaluate(()=>window.qaEmit('TOKEN_REFRESHED'));
   await waitEnabled(1);
   checks.push('首次進度讀取失敗會鎖住，權杖更新後可重試');

   for(const width of [1280,390]){
     await page.setViewportSize({width,height:900});
     Object.keys(state.rows).filter(key=>key.startsWith('12:')).forEach(key=>delete state.rows[key]);
     state.user=true;
     state.rows['11:typing_task_6']={user_id:'week12-synthetic',course_id:'grade6-115-1',week_code:'11',activity_key:'typing_task_6',current_level:6,completed:true};
     const oldRow={...state.rows['11:typing_task_6']};
     const successful={};
     for(const [lang,challenge] of Object.entries(challenges)){
       const path=lang==='regular'?route:folder+'week12-boss-'+lang+'.html';
       await open(path);
       await waitEnabled(1);
       assert.equal(await input(1).evaluate(e=>e.readOnly),false,'old week and other activities do not unlock');
       const draft='draft-'+lang+'-'+width;
       await saveDraft(1,draft);
       const key='12:'+challenge.key;
       assert.equal(state.drafts[key+':1'].draft_text,draft);
       await open(path);
       await restoreDraft(1,draft);
       const before=writes.length;
       for(const {id,main,replays} of challenge.levels){
         await waitEnabled(id);
         await guide(main,input(id),width,lang+':'+id+':main');
         await input(id).fill(main.ans);
         if(width===1280&&lang==='regular'&&id===1){
           state.saveFail=true;
           await pressCheck(id);
           await page.waitForFunction(()=>document.querySelector('#msg-level1').textContent.includes('還沒記錄成功'));
           assert.equal(await block(2).isVisible(),false);
           assert.equal(await block(1).locator('.start-replay').isVisible(),false);
           state.saveFail=false;
         }
         await pressCheck(id);
         if(id===challenge.levels.length){
           await page.locator('#celebration-overlay').waitFor();
           await closeOverlay();
         }else await block(id+1).waitFor();
         assert.equal(state.rows[key].completed,id===challenge.levels.length);
         assert.equal(state.rows[key].current_level,Math.min(id+1,challenge.levels.length));
         const replay=block(id).locator('.start-replay');
         const replayEditor=block(id).locator('.replay-area textarea');
         const replayCheck=block(id).locator('.replay-check');
         const afterSave=writes.length;
         for(const [index,question] of replays.entries()){
           await replay.click();
           assert.equal(await replayEditor.inputValue(),'');
           assert.equal(await replay.isDisabled(),true);
           if(index===0){
             await replayEditor.fill('x');await replayCheck.click();assert.equal(await replay.isDisabled(),true);
             if(width===1280 && id===1){
               await page.evaluate(()=>window.qaEmit('TOKEN_REFRESHED'));
               assert.equal(await replayEditor.inputValue(),'x');
             }
           }
           await guide(question,replayEditor,width,lang+':'+id+':replay'+(index+1));
           await replayEditor.fill(question.ans);await replayCheck.click();
           assert.equal(await replay.isEnabled(),true);
           assert.equal(writes.length,afterSave,'unscored replay may not write progress');
           assert.equal(state.drafts[key+':'+id],undefined);
         }
       }
       assert.equal(writes.length-before,challenge.levels.length+(width===1280&&lang==='regular'?1:0));
       successful[key]={...state.rows[key]};
       await open(path);await waitEnabled(1);
       assert.ok(await input(1).evaluate(e=>e.readOnly));
       assert.ok(await block(1).locator('.start-replay').isVisible());
       if(width===1280){
         const last=challenge.levels.length;
         page.once('dialog',dialog=>dialog.accept());
         await page.locator('#reset-progress-btn').click();
         await page.waitForFunction(()=>document.querySelector('#progress-status').textContent.includes('重新開始練習暫時失敗'));
         assert.ok(await block(last).locator('.start-replay').isEnabled());
         assert.deepEqual(state.rows[key],successful[key]);
       }
       assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
     }
     for(const [key,row] of Object.entries(successful)) assert.deepEqual(state.rows[key],row);
     assert.deepEqual(state.rows['11:typing_task_6'],oldRow);
     await page.goto(base+folder+'boss-garden.html',{waitUntil:'domcontentloaded'});
     const cards=page.locator('.garden-card');
     await cards.first().waitFor();
     assert.equal(await cards.locator('[href$="week12-boss-zh.html"]').count(),1);
     assert.equal(await cards.locator('[href$="week12-boss-en.html"]').count(),1);
     assert.equal(await cards.locator('[href$="week11-boss-zh.html"]').count(),1);
     console.log('Completed all originals, replays, drafts and keys at '+width+' px');
   }
   assert.deepEqual(errors,[]);
   const data={status:'passed',synthetic:true,checks,records,lines:records.length,keysVerified:records.reduce((sum,r)=>sum+r.keysVerified,0),writeCount:writes.length,realStudentWrites:0,pageerrors:errors};
   fs.writeFileSync(out+'/checks.json',JSON.stringify(data,null,2));
   console.log(JSON.stringify({lines:data.lines,keysVerified:data.keysVerified,writeCount:data.writeCount,realStudentWrites:0,pageerrors:errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
