// Site home and semester home pages: the teacher test-identity switch is shown only to the
// test account, calls only its own RPC and leaves every other visitor untouched.
// Runs a throwaway static server and a local headless Chrome; shared/auth.js is
// replaced by the synthetic fixture, so no real login or production data is used.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..');
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.vtt':'text/vtt'};
const baseFixture=eval(fs.readFileSync(path.join(root,'automation/tests/grade3-week06-browser.cjs'),'utf8').match(/const fixture=(`[^]*?`);/)[1]);
const marker="if(name==='reconnect_grade3_progress')";
assert.ok(baseFixture.includes(marker));
const fixture=baseFixture.replace(marker,`if(name==='switch_test_identity'){window.fixtureSwitchCalls=(window.fixtureSwitchCalls||[]).concat([args.p_grade]);if(window.fixtureSwitchFail&&args.p_grade)return {error:{message:'test'}};if(args.p_grade)sessionStorage.setItem('fixture-grade',args.p_grade);return {data:[(sessionStorage.getItem('fixture-grade')||'grade6')==='grade3'?{class_code:'307',seat_no:30,display_name:'合成小謙'}:{class_code:'609',seat_no:30,display_name:'測試學生'}]};}
`+marker)+`
export const consumePendingRedirect=()=>{},getHomeRedirectUrl=()=>location.origin+'/index.html';`;
const tester={user:{id:'synthetic-t',email:'Chianwu@apps.ntpc.edu.tw'},access_token:'synthetic'};
const student={user:{id:'synthetic-a',email:'synthetic@apps.ntpc.edu.tw'},access_token:'synthetic'};
const homes=['/grade3/115-1/index.html','/grade6/115-1/index.html'],site='/index.html';
(async()=>{
 const server=http.createServer((req,res)=>{
  const file=path.join(root,decodeURIComponent(new URL(req.url,'http://x').pathname));
  if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);return res.end();}
  res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});
  fs.createReadStream(file).pipe(res);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const open=async(user,{fail=false,width=1280}={})=>{
   const ctx=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
   await ctx.route('**/shared/auth.js*',r=>r.fulfill({contentType:'application/javascript',body:fixture}));
   await ctx.addInitScript(([u,f])=>{window.fixtureUser=u;window.fixtureSwitchFail=f;},[user,fail]);
   const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
   return {ctx,page,errors};
  };
  const settle=async page=>{await page.waitForFunction(()=>document.querySelectorAll('main a[data-week],main .course-grid a').length>0);await page.waitForTimeout(500);};
  const overflow=page=>page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  // Anonymous visitors and ordinary students: no switch, no RPC.
  for(const user of [null,student]){
   const {ctx,page,errors}=await open(user);
   for(const home of [site,...homes]){
    await page.goto(base+home,{waitUntil:'load'});await settle(page);
    assert.equal(await page.locator('#test-identity-switch').count(),0,`${home}: switch leaked`);
    assert.equal(await page.evaluate(()=>(window.fixtureSwitchCalls||[]).length),0,`${home}: unexpected RPC`);
   }
   assert.deepEqual(errors,[]);await ctx.close();
  }
  // Test account: starts in Grade 6, switches from either home and lands on the target home.
  for(const width of [1280,390]){
   const {ctx,page,errors}=await open(tester,{width});
   const status=page.locator('#test-identity-switch [role=status]'),button=page.locator('#test-identity-switch button');
   await page.goto(base+homes[0],{waitUntil:'load'});await button.waitFor();
   assert.match(await status.textContent(),/目前是六年級 609 班 30 號 測試學生/);assert.equal(await button.textContent(),'切到三年級');
   assert.equal(await page.evaluate(()=>document.querySelector('main').firstElementChild.id),'test-identity-switch');
   await button.click();await page.waitForFunction(()=>document.querySelector('#test-identity-switch button')?.textContent==='切到六年級');
   assert.equal(new URL(page.url()).pathname,homes[0]);
   assert.match(await status.textContent(),/目前是三年級 307 班 30 號 合成小謙/);
   await settle(page);assert.equal(await overflow(page),false,`${width}: grade3 horizontal overflow`);
   await button.click();await page.waitForURL(u=>u.pathname===homes[1]);await button.waitFor();
   assert.match(await status.textContent(),/目前是六年級 609 班 30 號 測試學生/);assert.equal(await button.textContent(),'切到三年級');
   await settle(page);assert.equal(await overflow(page),false,`${width}: grade6 horizontal overflow`);
   // Site home: mounted between the banner and the grade cards; switching lands on the grade home.
   await page.goto(base+site,{waitUntil:'load'});await button.waitFor();
   assert.match(await status.textContent(),/目前是六年級 609 班 30 號 測試學生/);
   assert.deepEqual(await page.evaluate(()=>{const bar=document.querySelector('#test-identity-switch');return [bar.previousElementSibling.className,bar.nextElementSibling.className];}),['home-heading','course-grid']);
   await settle(page);assert.equal(await overflow(page),false,`${width}: site home horizontal overflow`);
   await button.click();await page.waitForURL(u=>u.pathname===homes[0]);await button.waitFor();
   assert.match(await status.textContent(),/目前是三年級 307 班 30 號 合成小謙/);
   assert.deepEqual(errors,[]);await ctx.close();
  }
  // A failed switch stays on the page, says so and can be retried.
  {
   const {ctx,page}=await open(tester,{fail:true});
   const button=page.locator('#test-identity-switch button');
   await page.goto(base+homes[1],{waitUntil:'load'});await button.waitFor();await button.click();
   await page.waitForFunction(()=>document.querySelector('#test-identity-switch [role=status]').textContent.includes('切換失敗'));
   assert.equal(new URL(page.url()).pathname,homes[1]);assert.equal(await button.isDisabled(),false);
   assert.deepEqual(await page.evaluate(()=>window.fixtureSwitchCalls),[null,'grade3']);await ctx.close();
  }
  console.log('PASS: switch hidden and silent for anonymous/student on site and both semester homes; test account status, both-direction switch and landing page at 1280/390 without overflow, site home placement; failed switch stays put and is retryable.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
