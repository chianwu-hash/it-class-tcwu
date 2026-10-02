const assert=require('node:assert/strict');
const {connectCdp,safeScreenshot}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
(async()=>{
 const c=await connectCdp({cdpUrl:'http://127.0.0.1:9232',targetUrl:'http://localhost:3000/grade6/115-1/typing-foundation.html'});
 const context=await c.page.browser().createBrowserContext();
 const page=await context.newPage(),errors=[];let teacher=false,signedIn=true,record=null,failNext=false,expectedCourse='grade6-115-1';const saves=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.setRequestInterception(true);
 page.on('request',async req=>{
  if(req.url().includes('/shared/auth.js'))return req.respond({status:200,contentType:'text/javascript',body:`
   export const SUPABASE_URL='https://foundation-test.invalid';export const SUPABASE_ANON_KEY='synthetic';
   const session=${signedIn?`{user:{id:'synthetic-user',email:'${teacher?'chianwu@gmail.com':'synthetic@example.invalid'}'},access_token:'synthetic-token'}`:'null'};
   export async function resolveSession(){return session}export async function getSession(){return {session}}export function getStoredAccessToken(){return null}
   export function isTeacher(s){return s?.user.email==='chianwu@gmail.com'}export function beginCentralizedLogin(){}export function signOutAndReload(){}
   export const supabase={rpc:async()=>({data:[{course_id:'grade3-115-1',class_code:'999',seat_no:99,student_code:'99999',display_name:'合成測試學生',profile_id:'grade3-115-1:999:99'}],error:null}),auth:{onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}};`});
  if(req.url().includes('foundation-test.invalid')){
   if(req.method()==='OPTIONS')return req.respond({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,OPTIONS'}});
   const body=JSON.parse(req.postData()),p=body.p_payload;let data=record;
   if(body.p_action==='admin_list' && body.p_course_id==='grade3-115-1')return req.respond({status:200,headers:{'Access-Control-Allow-Origin':'*'},contentType:'application/json',body:'[]'});
   assert.equal(body.p_course_id,expectedCourse);
   assert.equal('birthday_code' in p,false);
   if(body.p_action==='start')record={...(record||{id:'synthetic-progress',course_id:body.p_course_id,learner_key:'google:synthetic-user',display_name:'合成測試學生',lesson_key:'english-home-row-v1',revision:1,checkpoint:0,completed:false}),practice_session:p.session_id,pending_count:0,starter:false};
   if(body.p_action==='save'){
    saves.push(p);
    if(failNext){failNext=false;return req.respond({status:503,contentType:'application/json',body:'{}'});}
    if(p.revision!==record.revision)return req.respond({status:400,contentType:'application/json',body:JSON.stringify({message:'stale_revision'})});
    if(p.stage<6)record.checkpoint=Math.max(record.checkpoint,p.stage);
    else{record.pending_count++;if(record.pending_count>=2){record.completed=true;record.completed_at=new Date().toISOString();record.pending_count=0;}}
   }
   if(body.p_action==='admin_reset'){assert.equal(teacher,true);record={...record,checkpoint:0,completed:false,completed_at:null,revision:record.revision+1,pending_count:0};}
   data=body.p_action==='admin_list' ? record?[record]:[] : record;
   return req.respond({status:200,headers:{'Access-Control-Allow-Origin':'*'},contentType:'application/json',body:JSON.stringify(data)});
  }
  req.continue();
 });
 const text=s=>page.$eval(s,e=>e.textContent);
 async function ready(){await page.waitForFunction(()=>!document.querySelector('.practice-card').inert);}
 async function finish(){for(let n=0;n<5 && await page.$eval('#exercise',e=>!e.hidden);n++){const remaining=await page.$$eval('#prompt span:not(.typed)',es=>es.map(e=>e.textContent==='␣'?' ':e.textContent).join(''));await page.keyboard.type(remaining);}await page.waitForFunction(()=>!document.getElementById('result').hidden);}
 async function saved(){await page.waitForFunction(()=>document.getElementById('cloud-status').textContent.startsWith('已儲存'));}
 try{
  await page.bringToFront();await page.setViewport({width:1365,height:980});await page.goto('http://localhost:3000/grade6/115-1/typing-foundation.html',{waitUntil:'networkidle0'});await ready();
  await page.click('#start');await page.waitForFunction(()=>!document.getElementById('exercise').hidden);
  assert.ok(await page.$eval('.shell h1',e=>parseFloat(getComputedStyle(e).fontSize))>=32,'Tailwind preflight must not shrink prototype title');
  await safeScreenshot(page,{path:require('node:path').resolve('prototypes/typing-foundation/level1/preview-cloud.png'),fullPage:true});
  failNext=true;await finish();await page.waitForFunction(()=>!document.getElementById('cloud-retry').hidden);
  assert.equal(await page.$eval('#continue',e=>e.disabled),true);
  await page.click('#cloud-retry');await saved();assert.equal(saves[0].event_id,saves[1].event_id);
  assert.equal(record.checkpoint,1);
  const reviewSaves=saves.length,originalRecord=JSON.stringify(record);
  assert.equal(await page.$eval('[data-stage="0"]',e=>e.disabled),false);
  assert.equal(await page.$eval('[data-stage="2"]',e=>e.disabled),true);
  await page.focus('[data-stage="0"]');await page.keyboard.press('Enter');
  assert.match(await text('#stage-label'),/食指定位.*重練/);
  const firstReview=await text('#prompt');
  await page.keyboard.type(await page.$eval('#prompt .active',e=>e.textContent==='␣'?' ':e.textContent));
  const partialCount=await text('#count');
  await page.click('[data-stage="0"]');await page.click('#switch-cancel');
  await page.waitForFunction(()=>document.activeElement.id==='typing-area');
  assert.equal(await text('#count'),partialCount,'Cancelling a switch preserves the partial attempt');
  await page.click('[data-stage="0"]');await page.click('#switch-confirm');
  await page.waitForFunction(()=>document.getElementById('count').textContent.includes('0 /'));
  assert.match(await text('#count'),/0 \//);
  assert.notEqual(await text('#prompt'),firstReview,'Re-entering review generates new questions');
  await finish();assert.equal(saves.length,reviewSaves);assert.equal(JSON.stringify(record),originalRecord);
  const completedReview=await text('#prompt');await page.click('#continue');
  assert.notEqual(await text('#prompt'),completedReview);await finish();
  await page.click('#retry');assert.match(await text('#stage-label'),/中指加入/);
  assert.equal(await page.$eval('#return-progress',e=>e.hidden),true);
  await page.reload({waitUntil:'networkidle0'});await ready();assert.match(await text('#start'),/中指加入/);
  await page.setViewport({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Grade 6 cloud navbar and lesson fit mobile width');
  await page.setViewport({width:1365,height:980});
  await page.click('#start');await page.waitForFunction(()=>!document.getElementById('exercise').hidden);
  for(let stage=2;stage<=6;stage++){
   if(stage===6){
    assert.equal(await page.$eval('#finger-controls',e=>e.hidden),false);
    assert.equal(await page.$eval('#show-fingers',e=>e.checked),false);
    assert.equal(await page.$eval('#target-line',e=>e.hidden),true);
    const before={count:await text('#count'),accuracy:await text('#accuracy'),saves:saves.length};
    await page.click('#show-fingers');
    assert.equal(await page.$eval('#target-line',e=>e.hidden),false);
    assert.equal(await page.$eval('#finger-guide',e=>e.hidden),false);
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'typing-area');
    const key=await page.$eval('#prompt .active',e=>e.textContent==='␣'?' ':e.textContent);
    const expected={a:['left-pinky'],s:['left-ring'],d:['left-middle'],f:['left-index'],g:['left-index'],h:['right-index'],j:['right-index'],k:['right-middle'],l:['right-ring'],';':['right-pinky'],' ':['left-thumb','right-thumb']};
    assert.deepEqual(await page.$$eval('#finger-guide [data-finger].is-active',es=>es.map(e=>e.dataset.finger)),expected[key]);
    await page.click('#show-fingers');await page.keyboard.press('Space');
    assert.equal(await page.$eval('#show-fingers',e=>e.checked),true);
    assert.deepEqual({count:await text('#count'),accuracy:await text('#accuracy'),saves:saves.length},before,'Toggling hints does not score keys or save progress');
    await page.keyboard.press('Space');await page.keyboard.press('Tab');
    assert.equal(await page.$eval('#target-line',e=>e.hidden),true);
    for(const width of [1656,1365,768,375]){
     await page.setViewport({width,height:980});
     assert.equal(await page.evaluate(()=>{
      const area=document.getElementById('typing-area').getBoundingClientRect();
      const spans=[...document.querySelectorAll('#prompt span')].map(e=>e.getBoundingClientRect());
      const bottom=Math.max(...spans.map(r=>r.bottom));
      return area.bottom-bottom>=19 && document.getElementById('feedback').getBoundingClientRect().top>area.bottom && spans.every(r=>r.left>=area.left && r.right<=area.right) && document.documentElement.scrollWidth<=innerWidth;
     }),true,`Challenge characters stay inside the focus frame with bottom padding at ${width}px`);
    }
    await page.setViewport({width:1365,height:980});
    await safeScreenshot(page,{path:require('node:path').resolve('prototypes/typing-foundation/level1/preview-challenge-layout.png'),fullPage:true});
   }
   await finish();await saved();console.log(`Cloud stage ${stage} saved.`);if(stage<6)await page.keyboard.press('Enter');
  }
  assert.equal(record.completed,false);assert.equal(await page.$eval('.growth',e=>e.classList.contains('earned')),false);
  await page.keyboard.press('Enter');await finish();await saved();assert.equal(record.completed,true);
  assert.equal(await page.$eval('.growth',e=>e.classList.contains('earned')),true);
  await page.reload({waitUntil:'networkidle0'});await ready();assert.match(await text('#start'),/已過關/);
  assert.equal(await page.$$eval('#steps button',es=>es.every(e=>!e.disabled)),true);
  const completedSaves=saves.length;
  await page.click('[data-stage="2"]');await finish();
  assert.equal(saves.length,completedSaves);assert.equal(record.completed,true);
  assert.equal(await page.$$eval('#steps li.done',es=>es.length),6);
  assert.equal(await page.$eval('.growth',e=>e.classList.contains('earned')),true);
  teacher=true;await page.goto('http://localhost:3000/admin-typing-foundation.html',{waitUntil:'networkidle0'});await page.select('#course','grade6-115-1');
  await page.waitForFunction(()=>document.querySelectorAll('#rows tr').length===1);
  page.once('dialog',d=>d.accept());await page.click('#rows button');
  await page.waitForFunction(()=>document.getElementById('rows').textContent.includes('未過關'));
  assert.equal(record.checkpoint,0);assert.equal(record.completed,false);assert.equal(record.revision,2);
  signedIn=false;teacher=false;
  await page.goto('http://localhost:3000/grade6/115-1/typing-foundation.html',{waitUntil:'networkidle0'});
  await page.waitForFunction(()=>document.getElementById('cloud-status')?.textContent.includes('請先登入 Google'));
  assert.equal(await page.$eval('.practice-card',e=>e.inert),true,'Anonymous Grade 6 practice must remain locked');
  expectedCourse='grade3-115-1';record=null;
  await page.goto('http://localhost:3000/grade3/115-1/typing-foundation.html',{waitUntil:'networkidle0'});
  assert.match(await text('main'),/尚未開放/);
  assert.equal(await page.$('#start'),null);
  assert.equal(await page.$('nav a[href="typing-foundation.html"]'),null);
  assert.equal(record,null,'Reserved page must not call the foundation service');
  await page.goto('http://localhost:3000/grade3/115-1/typing-foundation-tree.html',{waitUntil:'networkidle0'});
  assert.match(await text('main'),/尚未開放/);assert.equal(record,null);
  await page.setViewport({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Grade 3 cloud navbar and lesson fit mobile width');
  assert.deepEqual(errors,[]);console.log('PASS: real page shared module path; cloud checkpoint/resume, failed save/idempotent retry, final award, reload, scoped teacher reset, anonymous lock, Grade 3 reserved routes. Synthetic RPC only; no real student data.');
 }catch(error){console.error(await page.evaluate(()=>({focus:document.activeElement.id,status:document.getElementById('cloud-status')?.textContent,count:document.getElementById('count')?.textContent,stage:document.getElementById('stage-label')?.textContent,paused:document.getElementById('paused')?.hidden,result:document.getElementById('result')?.hidden})));throw error;
 }finally{page.removeAllListeners('request');await page.setRequestInterception(false);await context.close();c.disconnect();}
})().catch(e=>{console.error(e);process.exitCode=1;});
