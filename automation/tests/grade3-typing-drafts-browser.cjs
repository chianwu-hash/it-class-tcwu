// Run via D:/ai-browser/run-background.cjs with an acquired lease.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { connectCdp, safeScreenshot } = require('D:/projects/cdp-tools/packages/cdp-safe-client');
const sharedRequire = require('node:module').createRequire('D:/projects/cdp-tools/packages/cdp-safe-client/index.js');
const puppeteer = sharedRequire('puppeteer-core');
const base = process.env.DRAFT_TEST_BASE || 'http://127.0.0.1:3043';
fs.mkdirSync('tmp/grade3-typing-drafts-qa', {recursive:true});
const logFile='tmp/grade3-typing-drafts-qa/results.log';
fs.writeFileSync(logFile,'');
const log=(...items)=>fs.appendFileSync(logFile,items.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' ')+'\n');
const fixture = `
export const SUPABASE_URL='${base}/fake', SUPABASE_ANON_KEY='synthetic';
export const resolveSession=async()=>window.testSession, getSession=async()=>({session:window.testSession});
export const getStoredAccessToken=()=>window.testSession?.access_token,isTeacher=()=>false;
export const beginCentralizedLogin=()=>{},signOutAndReload=async()=>{};
window.testAuthListeners=[];window.testRpc=[];
export const supabase={auth:{onAuthStateChange(fn){testAuthListeners.push(fn);return {};},getSession},
rpc(name,args){testRpc.push({name,args});return {abortSignal:async()=>{
 if(name==='reconnect_grade3_progress') return window.testIdentityFail?{error:{code:'P0001',message:'合成本人身分驗證失敗'}}:{data:[{class_code:'301',seat_no:1,display_name:'合成同學',student_code:'30101'}]};
 if(name==='get_grade3_progress') return {data:window.testMailUnlock&&args.p_week_code==='02'&&args.p_activity_key!=='typing_task_5'?[{current_level:6,completed:true,score:5}]:window.testProgress?[window.testProgress]:[]};
 if(name==='save_grade3_progress') return window.testProgressFail?{error:{code:'P0001',message:'合成進度保存失敗'}}:{data:true};
 return {data:[]};
}};},from(){const q={select(){return q;},eq(){return q;},maybeSingle:async()=>({data:null}),then(resolve){return Promise.resolve({data:[]}).then(resolve);}};return q;}};
`;
const user = { user: { id: 'synthetic-user-a', email: 'synthetic@apps.ntpc.edu.tw' }, access_token: 'synthetic-token-a' };
const names = ['week02','week02-mail','week03','week04','week05','week06','week07','week08','week09'];
function inventory(directory) {
 return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?inventory(`${directory}/${entry.name}`):/\.(?:html|js)$/.test(entry.name)?[`${directory}/${entry.name}`]:[]);
}
const weeklySources=inventory('grade3').filter(f=>/\/week[^/]*\.(?:html|js)$/.test(f));
for(const file of weeklySources) {
 const source=fs.readFileSync(file,'utf8');
 if(/initTypingChallenge\s*\(/.test(source)) assert.match(source,/draftOptions:\s*\{\s*enabled:\s*true/,`Missing drafts: ${file}`);
}
log('PASS draft coverage for every Grade 3 weekly typing initializer');
const drafts = new Map(), calls = [], errors = [];
let failDraft = false, bootstrap, delayedRead = null;
const key = row => [row.user_id,row.course_id,row.week_code,row.activity_key,row.level_id].join(':');
(async()=>{
 const c = await connectCdp({cdpUrl:process.env.AI_WORK_BROWSER_CDP_URL,targetUrl:'about:blank',puppeteer});
 const target = await c.browser.waitForTarget(t => t._targetId === process.env.DRAFT_TEST_TARGET, { timeout: 10000 });
 const page = await target.page();
 assert.equal(page.target()._targetId, process.env.DRAFT_TEST_TARGET, 'Use the exact leased target');
 const wait = (fn,...args)=>page.waitForFunction(fn,{polling:5000,timeout:25000},...args);
 page.on('pageerror',e=>errors.push(e.message));
 await page.setRequestInterception(true);
 page.on('request',r=>(async()=>{
  const u=new URL(r.url());
  if(u.pathname==='/shared/auth.js') return r.respond({contentType:'application/javascript',body:fixture});
  if(u.pathname==='/fake/rest/v1/typing_drafts') {
   const method=r.method(), body=r.postData()?JSON.parse(r.postData()):null;
   calls.push({method,body,query:Object.fromEntries(u.searchParams),auth:r.headers().authorization});
   if(failDraft) return r.respond({status:503,contentType:'application/json',body:'{"message":"synthetic draft failure"}'});
   const filters=Object.fromEntries([...u.searchParams].filter(([k])=>!['on_conflict','select'].includes(k)).map(([k,v])=>[k,v.replace(/^eq\./,'')]));
   const matching=[...drafts.values()].filter(row=>Object.entries(filters).every(([k,v])=>String(row[k])===v));
   let data=matching;
   if(method==='POST'){drafts.set(key(body),body);data=[body];}
   if(method==='DELETE'){for(const row of matching) drafts.delete(key(row));data=null;}
   if(method==='GET'&&delayedRead){const hold=delayedRead;delayedRead=null;hold.started();await hold.wait;}
   return r.respond({status:200,contentType:'application/json',body:JSON.stringify(data)});
  }
  if(/supabase\.co/.test(u.hostname)) throw Error('Unexpected production request');
  return r.continue();
 })().catch(e=>errors.push(e.message)));
 async function scenario(name, options={}) {
  log('SCENARIO',name,options);
  if(bootstrap) await page.removeScriptToEvaluateOnNewDocument(bootstrap.identifier);
  bootstrap=await page.evaluateOnNewDocument((config)=>{
   window.testSession=config.session===false?null:config.user;
   window.testIdentityFail=!!config.identityFail;window.testProgress=config.progress||null;
   window.testMailUnlock=config.mailUnlock;window.testProgressFail=false;window.confetti=()=>{};
  },{user,mailUnlock:name==='week02-mail',...options});
  await page.goto(`${base}/grade3/${options.legacy?'':'115-1/'}${name}.html`,{waitUntil:'networkidle2'});
  await wait(()=>typeof window.checkLevel==='function');
  await wait(()=>!!document.querySelector('#typing-draft-save-1'));
 }
 async function setText(text, selector='#input-level1') {await page.$eval(selector,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},text);}
 async function save(){await page.$eval('#typing-draft-save-1',e=>e.click());await wait(()=>document.querySelector('#typing-draft-status-1').textContent.includes('草稿已儲存'));}
 try {
  for(const name of names) {
   drafts.clear();calls.length=0;
   await scenario(name);
   await wait(()=>!document.querySelector('#typing-draft-save-1').disabled).catch(async e=>{console.log(name,await page.evaluate(()=>({status:document.querySelector('#progress-status')?.textContent,disabled:document.querySelector('#input-level1')?.disabled,inert:document.querySelector('#typing-levels-container')?.inert,session:testSession,rpcs:testRpc})),errors);throw e;});
   const count=await page.$$eval('[id^="input-level"]',els=>els.length);
   assert.equal(await page.$$eval('[id^="typing-draft-save-"]',els=>els.length),count,name);
   await setText('123',name==='week02-mail'?'#mail-1-0':'#input-level1');
   await save();
   const row=[...drafts.values()][0];assert.equal(row.course_id,'grade3-115-1');assert.equal(row.week_code,name.slice(4,6));assert.equal(row.user_id,user.user.id);
   assert.equal(await page.evaluate(()=>testRpc.filter(c=>c.name==='save_grade3_progress').length),0);
   assert.ok(calls.every(c=>c.auth==='Bearer synthetic-token-a'));
   const stored=row.draft_text;
   await scenario(name);await wait(()=>!document.querySelector('#typing-draft-restore-1').classList.contains('hidden'));
   await page.$eval('#typing-draft-restore-1',e=>e.click());
   await wait(expected=>document.querySelector('#input-level1').value===expected,stored);
   if(name==='week02-mail')assert.equal(await page.$eval('#mail-1-0',e=>e.value),'123');
   log('PASS',name,'all controls, scoped cloud save, reload/restore, no progress writes');
  }
  await scenario('week16',{legacy:true});await wait(()=>!document.querySelector('#typing-draft-save-1').disabled);
  await setText('舊學期草稿');await save();
  assert.ok([...drafts.values()].some(r=>r.course_id==='grade3-114-2'&&r.draft_text==='舊學期草稿'));
  await scenario('week16',{legacy:true});await wait(()=>!document.querySelector('#typing-draft-restore-1').classList.contains('hidden'));
  await page.$eval('#typing-draft-restore-1',e=>e.click());await wait(()=>document.querySelector('#input-level1').value==='舊學期草稿');
  log('PASS legacy regular Google draft save/restore');
  const lastLevel={current_level:6,score:5,completed:false};
  await scenario('week09',{progress:lastLevel});await wait(()=>!document.querySelector('#typing-draft-save-6').disabled);
  await setText("How old are you?\nI'm eight",'#input-level6');await page.$eval('#typing-draft-save-6',e=>e.click());
  await wait(()=>document.querySelector('#typing-draft-status-6').textContent.includes('草稿已儲存'));
  await scenario('week09',{progress:lastLevel});await wait(()=>!document.querySelector('#typing-draft-restore-6').classList.contains('hidden'));
  await page.$eval('#typing-draft-restore-6',e=>e.click());await wait(()=>document.querySelector('#input-level6').value==="How old are you?\nI'm eight");
  assert.equal(await page.$eval('#input-level6',e=>e.readOnly),false);
  log('PASS final multiline English level resume without completing it');
  // Real shared validator + Grade 3 RPC adapter, partial input and both failure paths.
  await scenario('week09');await wait(()=>!document.querySelector('#typing-draft-save-1').disabled);
  await setText('窗');await save();
  await setText('目前文字');let dialogs=0;
  page.once('dialog',async d=>{dialogs++;await d.dismiss();});
  await page.$eval('#typing-draft-restore-1',e=>e.click());await wait(()=>document.querySelector('#input-level1')===document.activeElement||document.querySelector('#input-level1').value==='目前文字');
  assert.equal(await page.$eval('#input-level1',e=>e.value),'目前文字');
  page.once('dialog',async d=>{dialogs++;await d.accept();});
  await page.$eval('#typing-draft-restore-1',e=>e.click());await wait(()=>document.querySelector('#input-level1').value==='窗');assert.equal(dialogs,2);
  failDraft=true;await setText('窗戶');await page.$eval('#typing-draft-save-1',e=>e.click());
  await wait(()=>document.querySelector('#typing-draft-status-1').textContent.includes('沒有儲存成功'));
  assert.equal(await page.$eval('#input-level1',e=>e.value),'窗戶');
  await page.evaluate(()=>{testProgressFail=true;return checkLevel(1);});assert.equal(await page.$eval('#input-level1',e=>e.readOnly),false);
  failDraft=false;await save();
  await page.evaluate(()=>{testProgressFail=false;return checkLevel(1);});
  await wait(()=>document.querySelector('#typing-draft-restore-1').classList.contains('hidden'));
  assert.equal(await page.$eval('#input-level1',e=>e.readOnly),true);
  assert.ok((await page.evaluate(()=>testRpc)).some(c=>c.name==='save_grade3_progress'&&c.args.p_week_code==='09'&&c.args.p_activity_key==='typing_task_6'&&c.args.p_score===1));
  const matching=[...drafts.values()].filter(r=>r.week_code==='09'&&r.level_id===1);assert.equal(matching.length,0);
  // Draft failure must not block progress or invent a completion.
  failDraft=true;await scenario('week09');await wait(()=>document.querySelector('#typing-draft-status-1').textContent.includes('讀取不到'));
  await setText('窗戶');await page.evaluate(()=>checkLevel(1));assert.equal(await page.$eval('#input-level1',e=>e.readOnly),true);failDraft=false;
  for(const options of [{session:false},{identityFail:true}]) {
   calls.length=0;await scenario('week09',options);assert.equal(calls.length,0);assert.equal(await page.$eval('#typing-draft-save-1',e=>e.disabled),true);assert.equal(await page.$eval('#typing-levels-container',e=>e.inert),true);
  }
  await scenario('week09');await wait(()=>!document.querySelector('#typing-draft-save-1').disabled);
  await setText('窗');await save();const before=calls.length;
  await page.evaluate(()=>{window.retained='yes';window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));testAuthListeners.forEach(fn=>fn('TOKEN_REFRESHED',testSession));});
  assert.equal(calls.length,before);assert.equal(await page.evaluate(()=>retained),'yes');
  await page.evaluate(()=>{testSession={...testSession,access_token:'synthetic-token-refreshed'};testAuthListeners.forEach(fn=>fn('TOKEN_REFRESHED',testSession));});
  await save();assert.equal(calls.at(-1).auth,'Bearer synthetic-token-refreshed');
  fs.mkdirSync('tmp/grade3-typing-drafts-qa',{recursive:true});
  for(const width of [1280,390]) {
   await page.setViewport({width,height:900});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.$eval('#input-level1',e=>{document.documentElement.style.scrollBehavior='auto';window.scrollTo({top:e.getBoundingClientRect().top+scrollY-230,behavior:'instant'});});
   await safeScreenshot(page,{path:`tmp/grade3-typing-drafts-qa/week09-${width}.png`});
  }
  // Invalidate while a draft response is in flight; never display old-account drafts.
  let release,announceRead;const readStarted=new Promise(r=>{announceRead=r;});
  delayedRead={wait:new Promise(r=>{release=r;}),started:announceRead};
  const nav=scenario('week09');await readStarted;
  await page.evaluate(()=>{testSession=null;testAuthListeners.at(-1)('SIGNED_OUT',null);});release();await nav;
  await wait(()=>document.querySelector('#typing-draft-save-1').disabled);
  assert.equal(await page.$eval('#typing-draft-restore-1',e=>e.classList.contains('hidden')),true);
  assert.deepEqual(errors,[]);
  log('PASS overwrite confirmation, draft/progress failures and retry, RPC progress write, cleanup, anonymous/roster denial, no focus writes, layout, account invalidation');
 } finally {await page.close();await c.disconnect();}
})().catch(e=>{log('FAIL',e.stack);console.error(e);process.exitCode=1;});
