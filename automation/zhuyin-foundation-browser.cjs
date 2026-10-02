const assert=require('node:assert/strict');
const {connectCdp,safeScreenshot}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
(async()=>{
 const {zhuyinLessons:lessons,zhuyinCount:expectedCount,zhuyinKeys}=await import('../shared/zhuyin-foundation-curriculum.mjs');
 const reverse=Object.fromEntries(Object.entries(zhuyinKeys).map(([k,v])=>[v,k]));
 const {physicalKey,needsShift}=await import('../shared/typing-finger-guide.mjs');
 const c=await connectCdp({cdpUrl:'http://127.0.0.1:9232',targetUrl:'http://localhost:3000/grade6/115-1/zhuyin-foundation.html'});
 const context=await c.page.browser().createBrowserContext();const page=await context.newPage();
 const records=new Map(),errors=[];let saveCount=0,failedPayload=null;
 page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);
 page.on('request',async req=>{
  if(req.url().includes('/shared/auth.js'))return req.respond({status:200,contentType:'text/javascript',body:`
   export const SUPABASE_URL='https://foundation-test.invalid',SUPABASE_ANON_KEY='synthetic';
   const session={user:{id:'synthetic-user',email:'test@example.invalid'},access_token:'synthetic'};
   export async function resolveSession(){return session}export async function getSession(){return {session}}
   export function getStoredAccessToken(){return null}export function isTeacher(){return false}
   export function beginCentralizedLogin(){}export function signOutAndReload(){}
   export const supabase={auth:{onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};`});
  if(req.url().includes('foundation-test.invalid')){
   const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,OPTIONS'};
   if(req.method()==='OPTIONS')return req.respond({status:204,headers});
   const {p_action:action,p_payload:p}=JSON.parse(req.postData());let r=records.get(p.lesson_key),status=200;
   const lesson=lessons.find(l=>l.key===p.lesson_key);
   if(action==='list')r=[...records.values()];
   else if(lessons.slice(0,lesson.number-1).some(l=>!records.get(l.key)?.completed)){status=400;r={message:'lesson_locked'};}
   else if(action==='start'){
    r={...(r||{lesson_key:lesson.key,revision:1,checkpoint:0,completed:false}),starter:!!p.starter,practice_session:p.session_id,pending_count:0};records.set(lesson.key,r);
   }else if(action==='save'){
    if(!failedPayload){failedPayload=p;return req.respond({status:503,headers,contentType:'application/json',body:'{"message":"synthetic_save_failure"}'});}
    if(saveCount===0)assert.deepEqual(p,failedPayload,'Retry must reuse the exact event and payload');
    assert.equal(p.correct,expectedCount(lesson,p.stage-1));assert.equal(p.errors,0);assert.equal(p.interrupted,false);
    assert.equal(p.session_id,r.practice_session);assert.equal(p.revision,r.revision);assert.match(p.fingerprint,/^[a-f0-9]{64}$/);
    saveCount++;if(p.stage<6)r.checkpoint=Math.max(r.checkpoint,p.stage);
    else if(r.pending_count===1&&r.fingerprint!==p.fingerprint){r.completed=true;r.pending_count=0;}else{r.pending_count=1;r.fingerprint=p.fingerprint;}
   }
   return req.respond({status,headers,contentType:'application/json',body:JSON.stringify(r||null)});
  }
  return req.continue();
 });
 try{
  await page.bringToFront();await page.setViewport({width:1365,height:980});
  for(const lesson of lessons){
   await page.goto(`http://localhost:3000/grade6/115-1/zhuyin-foundation.html?lesson=${lesson.key}`,{waitUntil:'networkidle0'});
   await page.waitForFunction(()=>!document.querySelector('.practice-card').inert);
   assert.equal(await page.$eval('.heading h1',e=>e.textContent),lesson.title);
   assert.deepEqual(await page.$eval('#finger-intro-link',e=>({href:e.href,target:e.target,rel:e.rel,locked:!!e.closest('[inert]')})),{href:'https://book.eduweb.com.tw/TGame/video/m3.mp4',target:'_blank',rel:'noopener noreferrer',locked:false});
   assert.equal(await page.$$eval('.course-links button:not(:disabled)',es=>es.length),lesson.number);
   await page.click('#start');
   for(let attempt=0;attempt<7;attempt++){
    await page.waitForFunction(()=>!document.getElementById('exercise').hidden);
    for(let row=0;row<3;row++){
     const displayed=await page.$$eval('#prompt span',es=>es.map(e=>e.textContent).join(''));
     if(lesson.mode==='ime') {
       const session=await page.createCDPSession();
       await session.send('Input.imeSetComposition',{text:displayed,selectionStart:displayed.length,selectionEnd:displayed.length});
       assert.equal(await page.$eval('#zh-check',e=>e.disabled),true,'Composing text must not be checked');
       await session.send('Input.insertText',{text:displayed});await session.detach();
       await page.waitForFunction(()=>!document.getElementById('zh-check').disabled);
       await page.click('#zh-check');continue;
     }
     const text=[...displayed].map(char=>char==='一'?' ':reverse[char]).join('');
     const codes={' ':'Space','/':'Slash',',':'Comma','.':'Period',';':'Semicolon',"'":'Quote','[':'BracketLeft',']':'BracketRight','\\':'Backslash','-':'Minus','=':'Equal','`':'Backquote'};
     for(const key of text){
      const base=physicalKey(key),code=codes[base]||(/\d/.test(base)?'Digit'+base:'Key'+base.toUpperCase());
      if(needsShift(key))await page.keyboard.down('Shift');
      await page.keyboard.press(code);
      if(needsShift(key))await page.keyboard.up('Shift');
     }
    }
    if(lesson.number===1&&attempt===0){
     await page.waitForFunction(()=>!document.getElementById('cloud-retry').hidden);
     assert.equal(await page.$eval('#result',e=>e.hidden),true,'Failed save cannot claim completion');
     assert.equal(await page.$$eval('#steps button:not(:disabled)',es=>es.length),0);
     await page.click('#cloud-retry');
    }
    await page.waitForFunction(()=>!document.getElementById('result').hidden&&!document.getElementById('continue').disabled);
    if(lesson.number===1&&attempt===0){
     await page.reload({waitUntil:'networkidle0'});await page.waitForFunction(()=>!document.querySelector('.practice-card').inert);
     assert.match(await page.$eval('#start',e=>e.textContent),/接續/);await page.click('#start');
     assert.match(await page.$eval('#stage-label',e=>e.textContent),/^2/);
    }else if(attempt<6)await page.click('#continue');
   }
   assert.equal(records.get(lesson.key).completed,true);
   assert.equal(await page.$eval('.growth',e=>e.classList.contains('earned')),true);
   console.log(`PASS lesson ${lesson.number}: six stages, two distinct final passes, correct cloud lesson/count, unlocked next.`);
  }
  // Late-stage hints, responsive rendering and completed replay retain results.
  await page.click('#steps li:nth-child(3) button');
  await page.waitForFunction(()=>!document.getElementById('exercise').hidden);
  await page.keyboard.sendCharacter('錯字');await page.click('#zh-check');
  const errorState=await page.$eval('#accuracy',e=>e.textContent);
  await page.click('#zh-check');assert.equal(await page.$eval('#accuracy',e=>e.textContent),errorState);
  // Correct the submitted mismatch. The same failed check must count only once.
  const target=await page.$$eval('#prompt span',es=>es.map(e=>e.textContent).join(''));
  await page.click('#zh-input');await page.keyboard.down('Control');await page.keyboard.press('KeyA');await page.keyboard.up('Control');await page.keyboard.sendCharacter(target);await page.click('#zh-check');
  const {textDistance}=await import('../shared/zhuyin-foundation-curriculum.mjs');
  assert.equal(await page.$eval('#accuracy',e=>e.textContent),`${Math.floor(target.length/(target.length+textDistance('錯字',target))*100)}%`);
  await page.keyboard.sendCharacter('保留');await page.click('#pause');await page.click('#resume');
  assert.equal(await page.$eval('#zh-input',e=>e.value),'保留');
  await page.evaluate(()=>{const event=new Event('paste',{bubbles:true,cancelable:true});document.getElementById('zh-input').dispatchEvent(event);if(!event.defaultPrevented)throw new Error('Paste was not blocked');});
  assert.equal(saveCount,84,'Review must not write progress');
  for(const width of [1365,768,390]){await page.setViewport({width,height:980});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
  await page.setViewport({width:1365,height:980});
  await safeScreenshot(page,{path:require('node:path').resolve('artifacts/zhuyin-foundation-twelve-lessons.png'),fullPage:true});
  assert.equal(saveCount,84);assert.deepEqual(errors,[]);
  console.log('PASS: all 12 Chinese lessons / 84 saved attempts, CDP composition, no composition scoring, replay, responsive. Synthetic account/RPC/IME events; not native Windows IME verification.');
 }catch(error){console.error(await page.evaluate(()=>({stage:document.getElementById('stage-label')?.textContent,feedback:document.getElementById('feedback')?.textContent,count:document.getElementById('count')?.textContent,status:document.getElementById('cloud-status')?.textContent,paused:!document.getElementById('paused')?.hidden,result:!document.getElementById('result')?.hidden})));throw error;
 }finally{await context.close();c.disconnect();}
})().catch(e=>{console.error(e);process.exitCode=1;});
