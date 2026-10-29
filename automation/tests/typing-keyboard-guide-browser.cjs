// Acquired AI Work Browser only; all real course auth/progress requests are synthetic.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {connectCdp,safeScreenshot}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
const sharedRequire=require('node:module').createRequire('D:/projects/cdp-tools/packages/cdp-safe-client/index.js');
const puppeteer=sharedRequire('puppeteer-core');
const base=process.env.KEYBOARD_BASE||'http://127.0.0.1:3043',out=process.env.KEYBOARD_OUT||'tmp/typing-keyboard-qa';
const productionMode=process.env.KEYBOARD_PRODUCTION==='1';
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(`${out}/results.log`,'');
const log=(...args)=>fs.appendFileSync(`${out}/results.log`,args.map(a=>typeof a==='string'?a:JSON.stringify(a)).join(' ')+'\n');
// Reuse exactly the synthetic identity/RPC fixture used for the nine-week draft regression.
const fixtureLiteral=fs.readFileSync('automation/tests/grade3-typing-drafts-browser.cjs','utf8').match(/const fixture = (`[\s\S]*?`);/)[1];
const fixture=vm.runInNewContext(fixtureLiteral,{base});
const user={user:{id:'synthetic-user-a',email:'synthetic@apps.ntpc.edu.tw'},access_token:'synthetic-token-a'};
(async()=>{
 const c=await connectCdp({cdpUrl:process.env.AI_WORK_BROWSER_CDP_URL,targetUrl:'about:blank',puppeteer:{connect:options=>puppeteer.connect({...options,protocolTimeout:30000})}});
 const target=await c.browser.waitForTarget(t=>t._targetId===process.env.KEYBOARD_TARGET,{timeout:10000});
 const page=await target.page();const errors=[],drafts=new Map();let bootstrap;
 const wait=(fn,...args)=>page.waitForFunction(fn,{polling:5000,timeout:25000},...args);
 page.on('pageerror',e=>errors.push(e.message));await page.setCacheEnabled(false);
 await page.setRequestInterception(true);
 page.on('request',r=>(async()=>{
  const u=new URL(r.url());
  if(u.pathname==='/shared/auth.js')return r.respond({contentType:'application/javascript',body:fixture});
  if(u.pathname==='/fake/rest/v1/typing_drafts'){
   const body=r.postData()?JSON.parse(r.postData()):null;
   const key=b=>[b.user_id,b.course_id,b.week_code,b.activity_key,b.level_id].join(':');
   const filters=Object.fromEntries([...u.searchParams].filter(([k])=>!['select','on_conflict'].includes(k)).map(([k,v])=>[k,v.replace(/^eq\./,'')]));
   const matching=[...drafts.values()].filter(row=>Object.entries(filters).every(([k,v])=>String(row[k])===v));
   let data=matching;if(r.method()==='POST'){drafts.set(key(body),body);data=[body];}
   if(r.method()==='DELETE'){matching.forEach(row=>drafts.delete(key(row)));data=[];}
   return r.respond({contentType:'application/json',body:JSON.stringify(data)});
  }
  if(/supabase\.co/.test(u.hostname)){errors.push('Unexpected production request');return r.abort();}
  return r.continue();
 })().catch(e=>errors.push(e.message)));
 const preview=base+'/tmp/typing-keyboard-preview/';
 async function ready(){await wait(()=>document.querySelector('#typing-keyboard-guide-css')?.sheet&&document.querySelector('.kg-board')?.getBoundingClientRect().height>100);}
 const rect=sel=>page.$eval(sel,e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};});
 async function desktopBounds(){
  const [p,b,close]=await Promise.all([rect('#floating-kb-panel'),rect('.kg-board'),rect('[data-typing-tool-close="keyboard"]')]);
  log('desktop bounds',{p,b,close});assert.ok(p.top>=0&&p.bottom<=720);assert.ok(b.top>=close.bottom&&b.bottom<=p.bottom);assert.ok(b.height>=150);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }
 try{
  if(!productionMode){
  await page.setViewport({width:1280,height:720});await page.goto(preview,{waitUntil:'networkidle2'});await ready();await desktopBounds();
  const initialSession=await page.target().createCDPSession();
  initialSession.grantForegroundOnce('Page.bringToFront','實測使用者要求的本機預覽：滑鼠查字與輸入焦點');await initialSession.send('Page.bringToFront');await initialSession.detach();
  log('STEP lookup',await page.evaluate(()=>({visibility:document.visibilityState,focus:document.hasFocus()})));
  const total=Number((await page.$eval('.kg-position',e=>e.textContent)).match(/／(\d+)/)[1]);assert.ok(total>=4);
  await page.$eval('#preview-input',e=>e.focus());await page.click('.kg-card');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'preview-input');
  assert.equal(await page.$$eval('.kg-key.is-target',n=>n.length),4);
  assert.equal(await page.$eval('.kg-card',e=>e.getAttribute('aria-pressed')),'true');
  log('STEP reopen');
  await page.click('[data-typing-tool-close="keyboard"]');await page.click('[data-typing-tool-toggle="keyboard"]');
  assert.equal(await page.$eval('.kg-card',e=>e.getAttribute('aria-pressed')),'true');
  await page.click('[data-guide-next]');assert.equal(await page.$eval('.kg-card',e=>e.getAttribute('aria-pressed')),'false');
  log('STEP composition');
  assert.equal(await page.$eval('.kg-position',e=>e.textContent),`第 2／${total} 段`);
  await page.$eval('#preview-input',e=>e.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'ㄒ'})));
  await page.click('[data-guide-next]');assert.equal(await page.$eval('.kg-position',e=>e.textContent),`第 2／${total} 段`);
  await page.$eval('#preview-input',e=>e.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'心'})));
  await page.click('[data-guide-all]');
  log('STEP full list');
  const top=(await rect('.kg-board')).top;await page.$eval('.kg-hints',e=>e.scrollTop=e.scrollHeight);
  assert.equal((await rect('.kg-board')).top,top);
  assert.ok(await page.$eval('.kg-hints',e=>e.scrollHeight>e.clientHeight));
  await desktopBounds();
  await page.click('[data-example="2"]');assert.ok(await page.$('[data-english-keyboard-guide]'));
  assert.ok(await page.$('.kg-key[data-key="shift"].is-target'));assert.match(await page.$eval('.kg-source',e=>e.textContent),/How old are you\?/);
  await page.click('[data-guide-next]');assert.match(await page.$eval('.kg-source',e=>e.textContent),/I'm eight years old\./);
  await page.click('[data-example="3"]');assert.equal(await page.$eval('[data-guide-next]',e=>e.hidden),true);
  await page.click('[data-example="0"]');
  await page.click('.kg-punctuation');assert.equal(await page.$eval('#floating-kb-panel',e=>e.classList.contains('hidden')),true);
  assert.equal(await page.$eval('#floating-punc-panel',e=>e.classList.contains('hidden')),false);
  await page.click('[data-typing-tool-toggle="keyboard"]');assert.equal(await page.$eval('#floating-punc-panel',e=>e.classList.contains('hidden')),true);
  await page.focus('[data-guide-next]');await page.keyboard.press('Enter');assert.match(await page.$eval('.kg-position',e=>e.textContent),/第 2／/);
  await page.click('[data-guide-prev]');
  await safeScreenshot(page,{path:`${out}/preview-1280.png`});
  for(const [width,height] of [[640,360],[390,844]]){
   await page.setViewport({width,height});await ready();const close=await rect('[data-typing-tool-close="keyboard"]');
   const panel=await rect('#floating-kb-panel');assert.ok(panel.left>=0&&panel.right<=width);
   assert.ok(close.top>=0&&close.bottom<=height);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await safeScreenshot(page,{path:`${out}/preview-${width}.png`});
  }
  log('PASS preview: bounded keyboard, segmented/full hints, opt-in lookup, mouse focus, composition guard (synthetic), English case/punctuation, short words, small viewport/zoom fallback');
  }
  await page.setViewport({width:1280,height:720});
  async function course(name){
   if(bootstrap)await page.removeScriptToEvaluateOnNewDocument(bootstrap.identifier);
   bootstrap=await page.evaluateOnNewDocument(user=>{window.testSession=user;window.testIdentityFail=false;window.testMailUnlock=false;window.testProgress={current_level:5,score:4,completed:false};window.testProgressFail=false;window.confetti=()=>{};},user);
   await page.goto(`${base}/grade3/115-1/${name}.html`,{waitUntil:'networkidle2'});
   await wait(()=>typeof window.checkLevel==='function'&&!document.querySelector('#input-level5').disabled);
   await page.$eval('#input-level5',e=>{e.focus();document.documentElement.style.scrollBehavior='auto';window.scrollTo({top:e.getBoundingClientRect().top+scrollY-160,behavior:'instant'});});
   await page.$eval('[data-typing-tool-toggle="keyboard"]',e=>e.click());await ready();await desktopBounds();
  }
  for(const name of ['week08','week09']){
   await course(name);assert.ok(await page.$('[data-zhuyin-keyboard-guide]'));
   await page.$eval('#input-level5',e=>{e.value='草稿文字';e.dispatchEvent(new Event('input',{bubbles:true}));});
   await page.$eval('#typing-draft-save-5',e=>e.click());await wait(()=>document.querySelector('#typing-draft-status-5').textContent.includes('草稿已儲存'));
   assert.equal(await page.evaluate(()=>testRpc.filter(r=>r.name==='save_grade3_progress').length),0);
   await course(name);await wait(()=>!document.querySelector('#typing-draft-restore-5').classList.contains('hidden'));
   await page.$eval('#typing-draft-restore-5',e=>e.click());await wait(()=>document.querySelector('#input-level5').value==='草稿文字');
   assert.ok(await page.$('[data-zhuyin-keyboard-guide]'));
   const answer=await page.$eval('#block-level5 .target',e=>e.textContent);
   await page.$eval('#input-level5',(e,text)=>{e.value=text;e.dispatchEvent(new Event('input',{bubbles:true}));},answer);
   await page.evaluate(()=>checkLevel(5));assert.equal(await page.$eval('#input-level5',e=>e.readOnly),true);
   assert.ok(await page.evaluate(()=>testRpc.some(r=>r.name==='save_grade3_progress'&&r.args.p_score===5)));
   log('PASS actual course',name,'correct language, long text bounds, draft restore, original progress RPC');
  }
  await page.goto(`${base}/grade3/week16.html`,{waitUntil:'networkidle2'});
  await wait(()=>!!document.querySelector('[data-typing-tool-toggle="keyboard"]'));
  await page.$eval('[data-typing-tool-toggle="keyboard"]',e=>e.click());
  await wait(()=>!document.querySelector('#floating-kb-panel').classList.contains('hidden'));
  const legacyClose=await rect('[data-typing-tool-close="keyboard"]');assert.ok(legacyClose.top>=0&&legacyClose.bottom<=720);
  assert.ok(await page.$('#keyboard-img-zh'));
  await page.$eval('[data-keyboard-layout="en"]',e=>e.click());assert.equal(await page.$eval('#keyboard-img-en',e=>e.classList.contains('hidden')),false);
  log('PASS legacy static keyboard layout/tabs remain usable');
  assert.deepEqual(errors,[]);
  if(bootstrap)await page.removeScriptToEvaluateOnNewDocument(bootstrap.identifier);
  if(!productionMode){
  await page.goto(preview,{waitUntil:'networkidle2'});await ready();
  await page.$eval('#preview-input',e=>e.focus());await page.click('.kg-card');
  await safeScreenshot(page,{path:`${out}/preview-final.png`});
  const session=await page.target().createCDPSession();
  session.grantForegroundOnce('Page.bringToFront','顯示使用者要求的找字小幫手本機操作預覽');await session.send('Page.bringToFront');await session.detach();
  log('PASS preview shown; native Windows IME candidate window still requires manual acceptance');
  }else log('PASS production pages: synthetic auth/draft/progress only; zero real student writes');
 }finally{if(productionMode&&!page.isClosed())await page.close();await c.disconnect();}
})().catch(e=>{log('FAIL',e.stack);process.exitCode=1;});
