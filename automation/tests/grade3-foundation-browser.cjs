const fs=require('node:fs'),assert=require('node:assert/strict'),cp=require('node:child_process');
const {connectCdp}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
const lease=process.env.WEEK06_LEASE,cdp=process.env.WEEK06_CDP;if(!lease||!cdp)throw Error('Lease required');
const heartbeat=()=>cp.execFileSync('pwsh',['-NoProfile','-Command',`ai-browser-launch -Heartbeat -LeaseId '${lease}' -WorkerProcessId ${process.pid} -Json`],{stdio:'pipe'});
const source=fs.readFileSync('automation/tests/grade3-week06-browser.cjs','utf8');
const fixture=eval(source.match(/const fixture=(`[^]*?`);/)[1]).replace('export const isTeacher=()=>false','export const isTeacher=()=>Boolean(window.foundationTeacher)');
(async()=>{heartbeat();const c=await connectCdp({cdpUrl:cdp,targetUrl:'http://127.0.0.1:3036/grade3/115-1/week06.html'}),ctx=await c.browser.createBrowserContext(),p=await ctx.newPage(),timer=setInterval(heartbeat,45000);const errors=[],records=new Map(),saves=[];let tree=false;
 p.on('pageerror',e=>errors.push(e.message));await p.setRequestInterception(true);p.on('request',async q=>{
  if(q.url().includes('/shared/auth.js'))return q.respond({contentType:'application/javascript',body:fixture});
  if(q.url().includes('/fake/rest/v1/rpc/typing_foundation_action')){const {p_action:a,p_course_id:course,p_payload:x}=JSON.parse(q.postData());const key=course+':'+x.lesson_key;let r=records.get(key)||null;
   if(a==='start'){r={id:'fixture',course_id:course,lesson_key:x.lesson_key,checkpoint:0,revision:1,completed:false,starter:false,pending_count:0};records.set(key,r);}
   if(a==='save'){saves.push({course,...x});r.checkpoint=x.stage;}
   if(a==='list')r=tree?[{course_id:course,lesson_key:'english-home-row-v1',checkpoint:5,completed:true},{course_id:course,lesson_key:'zhuyin-home-v1',checkpoint:5,completed:true}]:[...records.values()].filter(r=>r.course_id===course);
   if(a==='admin_list')r=[{id:'fixture',course_id:course,learner_key:'google:synthetic-a',display_name:'合成學生',lesson_key:'english-home-row-v1',checkpoint:1,completed:false,starter:false,revision:1}];
   return q.respond({contentType:'application/json',body:JSON.stringify(r)});
  }return q.continue();
 });
 try{for(const grade of [3,6])for(const track of ['typing','zhuyin']){
   await p.setViewport({width:1280,height:900});await p.goto(`http://127.0.0.1:3036/grade${grade}/115-1/${track}-foundation.html`,{waitUntil:'networkidle2'});await p.waitForFunction(()=>document.querySelector('.practice-card')&&!document.querySelector('.practice-card').inert);
   assert.equal(await p.$eval('#grade',e=>e.value),String(grade));assert.equal(await p.$eval('.growth a',e=>e.getAttribute('href')),`/my-tree.html?course=grade${grade}-115-1`);
   for(const label of ['英打基礎','中打基礎'])assert.ok(await p.$$eval('nav a',(els,t)=>els.some(e=>e.textContent.includes(t)),label));
   await p.click('#start');await p.waitForFunction(()=>!document.getElementById('exercise').hidden);
   const inverse=track==='zhuyin'?Object.fromEntries(Object.entries((await import('../../shared/zhuyin-foundation-curriculum.mjs')).zhuyinKeys).map(([k,v])=>[v,k])):{};
   for(let n=0;n<8&&await p.$eval('#exercise',e=>!e.hidden);n++){const text=await p.$$eval('#prompt span:not(.typed)',es=>es.map(e=>e.textContent==='␣'?' ':e.textContent).join(''));await p.keyboard.type([...text].map(t=>inverse[t]||t).join(''));}
   await p.waitForFunction(()=>document.getElementById('cloud-status').textContent.startsWith('已儲存'));
   assert.equal(saves.at(-1).course,`grade${grade}-115-1`);assert.equal(saves.at(-1).stage,1);
   for(const width of [390,1280]){await p.setViewport({width,height:900});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  }
  tree=true;await p.goto('http://127.0.0.1:3036/my-tree.html?course=grade3-115-1',{waitUntil:'networkidle2'});await p.waitForFunction(()=>document.querySelector('#leaf-count').textContent==='2');assert.equal(await p.$eval('#flower-count',e=>e.textContent),'0');
  await p.goto('http://127.0.0.1:3036/grade3/115-1/typing-foundation.html',{waitUntil:'networkidle2'});
  const navigation=p.waitForNavigation({waitUntil:'networkidle2'});
  assert.equal(await p.evaluate(()=>{fixtureUser={user:{id:'synthetic-b',email:'b@apps.ntpc.edu.tw'},access_token:'synthetic'};fixtureListeners.forEach(fn=>fn('SIGNED_IN',fixtureUser));return document.querySelector('.practice-card').inert;}),true);await navigation;
  await p.evaluateOnNewDocument(()=>window.fixtureUser=null);
  await p.goto('http://127.0.0.1:3036/grade3/115-1/typing-foundation.html',{waitUntil:'networkidle2'});
  assert.equal(await p.$eval('.practice-card',e=>e.inert),true);assert.match(await p.$eval('#cloud-status',e=>e.textContent),/登入 Google/);
  await p.evaluateOnNewDocument(()=>{window.fixtureUser={user:{id:'synthetic-teacher',email:'synthetic-teacher@example.invalid'},access_token:'synthetic'};window.foundationTeacher=true;});
  await p.goto('http://127.0.0.1:3036/admin-typing-foundation.html',{waitUntil:'networkidle2'});
  await p.waitForFunction(()=>document.querySelector('#rows').textContent.includes('12 WPM'));
  await p.select('#course','grade3-115-1');await p.waitForFunction(()=>document.querySelector('#rows').textContent.includes('8 WPM'));
  assert.deepEqual(errors,[]);console.log('PASS: Grade3/Grade6 English/Chinese start + save, course routing, persistent navbar, 390/1280 layout, Grade3 foundation tree 2 leaves/0 flowers.');
 }finally{clearInterval(timer);await ctx.close();await c.disconnect();}
})().catch(e=>{console.error(e);process.exitCode=1;});
