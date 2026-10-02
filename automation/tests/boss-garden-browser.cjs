const assert = require('node:assert/strict');
const { connectCdp } = require('D:/projects/cdp-tools/packages/cdp-safe-client');
(async () => {
 const s = await connectCdp({cdpUrl:'http://127.0.0.1:9232',targetUrl:'http://localhost:3000/grade6/115-1/week05.html'});
 const ctx = await s.browser.createBrowserContext(); const p = await ctx.newPage();
 let logged=false, fail='', slow=false; const calls=[], errors=[]; let progress=[], drafts=[];
 p.on('pageerror',e=>errors.push(e.message)); await p.setCacheEnabled(false); await p.setRequestInterception(true);
 p.on('request',async r=>{
  const u=new URL(r.url());
  if(u.pathname==='/shared/auth.js')return r.respond({contentType:'text/javascript',body:`
   export const SUPABASE_URL=location.origin+'/mock',SUPABASE_ANON_KEY='mock';
   export const getStoredAccessToken=()=> 'mock',isTeacher=()=>false,beginCentralizedLogin=()=>{},signOutAndReload=()=>{};
   export const resolveSession=async()=>(${logged?JSON.stringify({user:{id:'synthetic-user',email:'synthetic@example.invalid'},access_token:'mock'}):'null'});
   export const supabase={auth:{onAuthStateChange(fn){window.changeTestSession=fn;return {}}}};
  `});
  if(u.pathname.startsWith('/mock/')){
   calls.push(u);assert.equal(r.method(),'GET');assert.equal(u.searchParams.get('course_id'),'eq.grade6-115-1');assert.equal(u.searchParams.get('user_id'),'eq.synthetic-user');
   const isDraft=u.pathname.endsWith('typing_drafts');
   if(isDraft){assert(!u.searchParams.get('select').includes('draft_text'));assert.equal(u.searchParams.get('draft_text'),'neq.');}
   const data=isDraft?drafts:progress;
   if(slow)await new Promise(r=>setTimeout(r,400));
   try{return await r.respond({status:fail===(isDraft?'draft':'progress')?503:200,contentType:'application/json',body:JSON.stringify(data)});}catch{return;}
  }
  if(u.hostname.endsWith('supabase.co'))return r.abort();
  return r.continue();
 });
 const url='http://localhost:3000/grade6/115-1/boss-garden.html';
 const open=()=>p.goto(url,{waitUntil:'networkidle2'});
 const done=()=>p.waitForFunction(()=>!document.querySelector('#refresh-garden').disabled);
 const text=sel=>p.$eval(sel,e=>e.textContent);
 const row=key=>({course_id:'grade6-115-1',week_code:'05',activity_key:key,completed:true,level_id:1});
 try{
  await open();assert.equal(calls.length,0);assert((await text('#garden-status')).includes('請從上方登入'));assert.equal(await p.$$eval('.garden-card',a=>a.length),2);
  logged=true;await open();await done();assert((await text('#flower-count')).includes('0 朵'), JSON.stringify({count:await text('#flower-count'),status:await text('#garden-status'),errors,calls:calls.map(String)}));assert((await text('.card-state')).includes('尚未挑戰'));
  progress=[row('typing_boss_zh_1'),row('typing_boss_zh_1'),{...row('typing_boss_en_1'),course_id:'grade3-115-1'}];drafts=[row('typing_boss_zh_1'),row('typing_boss_en_1')];
  await p.click('#refresh-garden');await done();assert((await text('#flower-count')).includes('1 朵'));assert((await text('.garden-card:first-child .card-state')).includes('已開花'));assert((await text('.english .card-state')).includes('已有草稿'));
  await p.reload({waitUntil:'networkidle2'});await done();assert((await text('#flower-count')).includes('1 朵'));
  for(const width of [1280,390]){await p.setViewport({width,height:1000});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:`tmp/boss-garden-${width}.png`,fullPage:true});}
  fail='progress';await p.click('#refresh-garden');await done();assert((await text('#flower-count')).includes('暫時讀取不到'));assert(!(await text('.card-state')).includes('尚未挑戰'));
  fail='draft';progress=[];await p.click('#refresh-garden');await done();assert((await text('.card-state')).includes('草稿暫時讀取不到'));
  fail='';drafts=[];await p.click('#refresh-garden');await done();assert((await text('.card-state')).includes('尚未挑戰'));
  slow=true;await p.click('#refresh-garden');await p.evaluate(()=>window.changeTestSession('SIGNED_OUT',null));await new Promise(r=>setTimeout(r,700));assert((await text('#flower-count')).includes('登入後'));assert((await text('.card-state')).includes('登入後'));
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS garden: anonymous no reads, scoped GET only, draft metadata, flowers match model, dedupe, resume, failures/retry, logout race, desktop/mobile');
 }finally{await ctx.close();await s.disconnect();}
})().catch(e=>{console.error(e);process.exitCode=1;});
