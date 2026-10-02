const assert=require('node:assert/strict');
const {connectCdp,safeScreenshot}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
(async()=>{
 const {lessons,expectedCount}=await import('../shared/typing-foundation-curriculum.mjs');
 const {physicalKey,needsShift}=await import('../shared/typing-finger-guide.mjs');
 const c=await connectCdp({cdpUrl:'http://127.0.0.1:9232',targetUrl:'http://localhost:3000/grade6/115-1/typing-foundation.html'});
 const context=await c.page.browser().createBrowserContext();const page=await context.newPage();
 const records=new Map(),errors=[];let saveCount=0;
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
   await page.goto(`http://localhost:3000/grade6/115-1/typing-foundation.html?lesson=${lesson.key}`,{waitUntil:'networkidle0'});
   await page.waitForFunction(()=>!document.querySelector('.practice-card').inert);
   assert.equal(await page.$eval('.heading h1',e=>e.textContent),lesson.title);
   assert.deepEqual(await page.$eval('#finger-intro-link',e=>({href:e.href,target:e.target,rel:e.rel,locked:!!e.closest('[inert]')})),{href:'https://book.eduweb.com.tw/TGame/video/m3.mp4',target:'_blank',rel:'noopener noreferrer',locked:false});
   assert.equal(await page.$$eval('.course-links button:not(:disabled)',es=>es.length),lesson.number);
   await page.click('#start');
   for(let attempt=0;attempt<7;attempt++){
    await page.waitForFunction(()=>!document.getElementById('exercise').hidden);
    for(let row=0;row<3;row++){
     const text=await page.$$eval('#prompt span',es=>es.map(e=>e.textContent==='␣'?' ':e.textContent).join(''));
     const codes={' ':'Space','/':'Slash',',':'Comma','.':'Period',';':'Semicolon',"'":'Quote','[':'BracketLeft',']':'BracketRight','\\':'Backslash','-':'Minus','=':'Equal','`':'Backquote'};
     for(const key of text){
      const base=physicalKey(key),code=codes[base]||(/\d/.test(base)?'Digit'+base:'Key'+base.toUpperCase());
      if(needsShift(key))await page.keyboard.down('Shift');
      await page.keyboard.press(code);
      if(needsShift(key))await page.keyboard.up('Shift');
     }
    }
    await page.waitForFunction(()=>!document.getElementById('result').hidden&&!document.getElementById('continue').disabled);
    if(attempt<6)await page.click('#continue');
   }
   assert.equal(records.get(lesson.key).completed,true);
   assert.equal(await page.$eval('.growth',e=>e.classList.contains('earned')),true);
   console.log(`PASS lesson ${lesson.number}: six stages, two distinct final passes, correct cloud lesson/count, unlocked next.`);
  }
  // Late-stage hints, responsive rendering and completed replay retain results.
  await page.click('[data-stage="2"]');await page.click('#show-fingers');await page.click('#show-fingers');
  for(const width of [1365,768,390]){await page.setViewport({width,height:980});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
  await page.setViewport({width:1365,height:980});
  await safeScreenshot(page,{path:require('node:path').resolve('artifacts/typing-foundation-twelve-lessons.png'),fullPage:true});
  assert.equal(saveCount,84);assert.deepEqual(errors,[]);
  console.log('PASS: all 12 cloud UI lessons / 84 saved attempts. Synthetic account and RPC only.');
 }catch(error){console.error(await page.evaluate(()=>({stage:document.getElementById('stage-label')?.textContent,feedback:document.getElementById('feedback')?.textContent,count:document.getElementById('count')?.textContent,status:document.getElementById('cloud-status')?.textContent,paused:!document.getElementById('paused')?.hidden,result:!document.getElementById('result')?.hidden})));throw error;
 }finally{await context.close();c.disconnect();}
})().catch(e=>{console.error(e);process.exitCode=1;});
