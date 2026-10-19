// Grade 6 week 08: regular typing, both bosses, boss garden and home card.
// Throwaway static server + local headless Chrome; shared/auth.js and Supabase are
// replaced by an in-memory mock, so no real login or production data is touched.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..');
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png'};
const authModule=logged=>`
export const SUPABASE_URL=location.origin+'/__mock',SUPABASE_ANON_KEY='synthetic';
const session=${logged?JSON.stringify({user:{id:'00000000-0000-0000-0000-000000000007',email:'synthetic@example.invalid'},access_token:'synthetic'}):'null'};
export const getSession=async()=>({session,error:null}),resolveSession=async()=>session,getStoredAccessToken=()=>session?'synthetic':null,isTeacher=()=>false,beginCentralizedLogin=()=>{window.__loginCalls=(window.__loginCalls||0)+1;},signOutAndReload=()=>{};
export const supabase={auth:{onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}},rpc:async(name)=>name==='get_my_student_enrollment'&&session?{data:[{class_code:'609',seat_no:30,display_name:'合成學生',student_code:'60930'}],error:null}:{data:[],error:null},from(table){const filters={};let method='GET';const q={select(){return q},eq(k,v){filters[k]=v;return q},delete(){method='DELETE';return q},maybeSingle(){return run()},then(a,b){return run().then(a,b)}};async function run(){const u=new URL(SUPABASE_URL+'/query');u.searchParams.set('table',table);u.searchParams.set('filters',JSON.stringify(filters));return (await fetch(u,{method})).json()}return q}};
`;
(async()=>{
 const server=http.createServer((req,res)=>{
  const file=path.join(root,decodeURIComponent(new URL(req.url,'http://x').pathname));
  if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);return res.end();}
  res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});
  fs.createReadStream(file).pipe(res);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}/grade6/115-1/`;
 let browser;
 try { browser=await chromium.launch({channel:'chrome',headless:true}); }
 catch(error) { server.close(); throw error; }
 const ctx=await browser.newContext({viewport:{width:1280,height:1000},serviceWorkers:'block'});
 let logged=false,fail=false;const rows=new Map(),drafts=new Map(),writes=[],errors=[];
 const key=x=>`${x.course_id}:${x.week_code}:${x.activity_key}`;
 await ctx.route('**/*',async route=>{
  const r=route.request(),u=new URL(r.url());
  // External assets stay offline. Stub only animation and visibility utilities;
  // this exercises behavior, not the production Tailwind layout.
  if(u.hostname==='cdn.tailwindcss.com')return route.fulfill({contentType:'application/javascript',body:"document.head.insertAdjacentHTML('beforeend','<style>.hidden{display:none!important}</style>');"});
  if(u.hostname==='cdn.jsdelivr.net'&&u.pathname.includes('canvas-confetti'))return route.fulfill({contentType:'application/javascript',body:'window.confetti=()=>{window.__confettiCalls=(window.__confettiCalls||0)+1;};'});
  if(u.pathname==='/shared/auth.js')return route.fulfill({contentType:'application/javascript',body:authModule(logged)});
  if(u.pathname.startsWith('/__mock')){
   const body=r.postData()?JSON.parse(r.postData()):null;let result=null,status=200;
   if(u.pathname.endsWith('/query')){const f=JSON.parse(u.searchParams.get('filters'));const k=key(f);if(r.method()==='DELETE')rows.delete(k);result={data:rows.get(k)||null,error:null};}
   else if(u.pathname.endsWith('/student_progress')){
    if(r.method()==='GET')result=[...rows.values()];
    else if(fail){fail=false;status=503;result={message:'synthetic failure'};}
    else{assert.equal(body.course_id,'grade6-115-1');rows.set(key(body),body);writes.push(body);}
   }
   else if(u.pathname.endsWith('/typing_drafts')){
    const f={};for(const [k,v] of u.searchParams)f[k]=v.replace(/^eq\./,'');
    if(r.method()==='POST'){drafts.set(key(body),body);result=[body];}
    else if(r.method()==='DELETE'){drafts.delete(key(f));}
    else result=f.week_code?(drafts.has(key(f))?[drafts.get(key(f))]:[]):[...drafts.values()].map(({draft_text,...rest})=>rest);
   }
   return route.fulfill({status,contentType:'application/json',body:JSON.stringify(result)});
  }
  if(u.hostname.endsWith('supabase.co'))return route.fulfill({contentType:'application/json',body:'[]'});
  if(u.hostname!=='127.0.0.1')return route.abort('blockedbyclient');
  return route.continue();
 });
 const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
 const open=async name=>{await p.goto(base+name,{waitUntil:'load'});try { await p.waitForSelector('#input-level1',{timeout:10000}); } catch(e) { console.error('page errors:',errors); throw e; }await p.waitForTimeout(500);};
 const fill=n=>p.$eval(`#input-level${n}`,e=>{e.value=e.closest('article').querySelector('.typing-target').textContent;e.dispatchEvent(new Event('input',{bubbles:true}));});
 try{
  // Anonymous: page readable, typing locked.
  await open('week08.html');
  assert(await p.$eval('#input-level1',e=>e.disabled));
  assert.equal((await p.$eval('#auth-status',e=>e.textContent)).trim(),'未登入');
  assert.equal(await p.locator('#typing-levels-container article').count(),5);
  await p.setViewportSize({width:1280,height:1000});
  // Login delegates through navbar auth; the mock never opens OAuth.
  await p.click('#login-btn');
  assert.equal(await p.evaluate(()=>window.__loginCalls),1);
  assert.equal(await p.$eval('.typing-target',e=>getComputedStyle(e).userSelect),'none');
  assert(await p.$eval('#input-level1',e=>e.disabled));
  logged=true;
  // Boss zh: draft save/restore, failed save keeps editing, completion writes week 08 and returns to garden.
  await open('week08-boss-zh.html');
  assert(!await p.$eval('#input-level1',e=>e.disabled));
  assert.equal((await p.$eval('.typing-target',e=>e.textContent)).split('\n').length,7);
  // Navbar shows roster identity instead of the email; details on hover.
  await p.waitForFunction(()=>document.querySelector('#auth-status').textContent.trim()==='60930 合成學生');
  assert.equal(await p.$eval('#auth-status',e=>e.title),'609 班 30 號 合成學生\nsynthetic@example.invalid');
  await p.fill('#input-level1','珍珠');
  await p.click('.typing-check');
  assert((await p.locator('#msg-level1').textContent()).includes('第1行'));
  assert((await p.locator('#msg-level1').textContent()).includes('第3個字'));
  assert.equal(rows.size,0);
  assert.equal(await p.evaluate(()=>window.__confettiCalls||0),0);
  assert.equal(await p.$eval('#input-level1',e=>e.dispatchEvent(new Event('paste',{cancelable:true}))),false);
  assert.equal(await p.$eval('#input-level1',e=>e.dispatchEvent(new Event('drop',{cancelable:true}))),false);
  await p.fill('#input-level1','');
  await p.type('#input-level1','珍珠奶茶');await p.click('#typing-draft-save-1');await p.waitForTimeout(400);
  assert.equal(drafts.size,1);assert.equal([...drafts.values()][0].week_code,'08');
  await p.reload({waitUntil:'load'});await p.waitForSelector('#typing-draft-restore-1:not(.hidden)');await p.click('#typing-draft-restore-1');await p.waitForTimeout(300);
  assert.equal(await p.$eval('#input-level1',e=>e.value),'珍珠奶茶');
  await fill(1);fail=true;await p.click('.typing-check');await p.waitForTimeout(500);
  assert.equal(rows.size,0);assert.equal(await p.$('#celebration-overlay'),null);assert(!await p.$eval('#input-level1',e=>e.readOnly));
  await p.click('.typing-check');await p.waitForTimeout(600);
  assert(rows.get('grade6-115-1:08:typing_boss_zh_1')?.completed);
  assert(!rows.has('grade6-115-1:05:typing_boss_zh_1'));
  await p.waitForSelector('#celebration-overlay');
  await p.click('#celebration-overlay a');await p.waitForSelector('#garden-cards');
  await p.waitForFunction(()=>document.querySelector('#flower-count').textContent.includes('1 朵'));
  assert.equal(await p.locator('.garden-card').count(),6);
  const garden=await p.$eval('#garden-cards',e=>e.textContent);
  assert(garden.includes('珍奶奇蹟')&&garden.includes('Fun Facts about National Flags')&&garden.includes('115學年度・康軒・國語・第6課')&&garden.includes('115學年度・康軒・英語・Unit 1'));
  // Boss en at both widths, then complete.
  await open('week08-boss-en.html');
  assert.equal((await p.$eval('.typing-target',e=>e.textContent)).split('\n').length,11);
  await p.setViewportSize({width:1280,height:1000});
  await fill(1);await p.click('.typing-check');await p.waitForTimeout(600);
  assert(rows.get('grade6-115-1:08:typing_boss_en_1')?.completed);
  // Regular five levels.
  await open('week08.html');
  for(let n=1;n<=5;n++){await fill(n);await p.evaluate(n=>window.checkLevel(n),n);await p.waitForTimeout(150);}
  const regular=rows.get('grade6-115-1:08:typing_task_5');
  assert(regular?.completed);assert.equal(regular.current_level,5);
  assert.equal(rows.size,3);
  // A completed week 08 reload resumes without rewriting its rows.
  const writeCount=writes.length;
  await p.reload({waitUntil:'load'});
  await p.waitForFunction(()=>document.querySelector('#input-level5')?.readOnly);
  assert.equal(writes.length,writeCount);
  assert(await p.$eval('#progress-status',e=>e.textContent.includes('普通5關已完成')));
  await p.click('#reset-progress-btn');
  await p.waitForFunction(()=>!document.querySelector('#input-level1').readOnly);
  assert(!rows.has('grade6-115-1:08:typing_task_5'));
  assert(rows.get('grade6-115-1:08:typing_boss_zh_1')?.completed);
  assert(rows.get('grade6-115-1:08:typing_boss_en_1')?.completed);

  // Garden now shows two flowers; home shows week 08 as the latest card and navbar lists week 08.
  await p.goto(base+'boss-garden.html',{waitUntil:'load'});
  await p.waitForFunction(()=>document.querySelector('#flower-count').textContent.includes('2 朵'));
  await p.goto(base+'index.html',{waitUntil:'load'});await p.waitForTimeout(500);
  assert.equal(await p.$eval('main a[data-week]',e=>e.dataset.week),'08');
  assert.equal(await p.locator('[data-latest-week="true"]').count(),1);

  // Navbar: week 07 links forward to 08, week 08 links back to 07.
  await p.goto(base+'week07.html',{waitUntil:'load'});
  assert.equal(await p.locator('nav a[href="week08.html"]').count(),1);
  await p.goto(base+'week08.html',{waitUntil:'load'});
  assert.equal(await p.locator('nav a[href="week07.html"]').count(),1);
  assert((await p.$eval('nav',e=>e.textContent)).includes('第 8 週'));
  // Reset week 08 boss without touching saved bosses from 05/07.
  for(const week of ['05','07']) {
   const old={course_id:'grade6-115-1',week_code:week,activity_key:'typing_boss_zh_1',completed:true,current_level:1};
   rows.set(key(old),old);
  }
  const oldRows=['05','07'].map(week=>JSON.stringify(rows.get(`grade6-115-1:${week}:typing_boss_zh_1`)));
  await open('week08-boss-zh.html');
  await p.waitForFunction(()=>document.querySelector('#input-level1').readOnly);
  await p.click('#reset-progress-btn');
  await p.waitForFunction(()=>!document.querySelector('#input-level1').readOnly);
  assert(!rows.has('grade6-115-1:08:typing_boss_zh_1'));
  assert.deepEqual(['05','07'].map(week=>JSON.stringify(rows.get(`grade6-115-1:${week}:typing_boss_zh_1`))),oldRows);
  assert.deepEqual(errors,[]);
  console.log('SKIP: 1280/390 production layout and external CDN rendering (network disabled).');
  console.log('PASS g6 week08: anonymous lock, draft save/restore, failed save retry, boss flowers under weekCode 08, garden 6 cards, regular 5, home latest card, reload/reset isolation, offline functional checks; production layout NOT verified');
 }finally{await ctx.close();await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
