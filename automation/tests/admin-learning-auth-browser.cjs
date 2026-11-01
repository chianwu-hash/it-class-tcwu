const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const puppeteer=require('D:/projects/cdp-tools/node_modules/puppeteer-core');
const {safeScreenshot}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
const base='http://127.0.0.1:4472',target=process.argv[2],out=path.resolve(__dirname,'../output/admin-learning-20261101');
// Auth is simulated ONLY by this test's request interception on the exact local
// tab. No production module, credentials, OAuth endpoint or remote API is used.
const authModule=`
  const callbacks=new Set();let current=null,serial=0;
  const make=role=>role?{user:{id:role==='student'?'fixture-student':role==='teacherA'?'fixture-teacher-a':'fixture-teacher-b',email:role+'@example.invalid'},access_token:'fixture-'+role+'-'+(++serial)}:null;
  export const SUPABASE_URL=location.origin,SUPABASE_ANON_KEY='fixture-public';
  export const isTeacher=s=>s?.user?.id?.startsWith('fixture-teacher-')||false;
  export const getStoredAccessToken=()=>current?.access_token||null;
  export const resolveSession=async()=>current;
  export const beginCentralizedLogin=options=>{window.__fixtureLogin=options;};
  export const signOutAndReload=async()=>window.__fixtureAuth.change(null);
  export const supabase={auth:{onAuthStateChange:fn=>{callbacks.add(fn);return{data:{subscription:{unsubscribe:()=>callbacks.delete(fn)}}};}}};
  window.__fixtureAuth={change(role){current=make(role);for(const fn of callbacks)fn('SIGNED_IN',current);},
    refresh(){if(current)current={...current,access_token:'fixture-refresh-'+(++serial)};for(const fn of callbacks)fn('TOKEN_REFRESHED',current);},
    expire(){if(current)current={...current,access_token:'fixture-expired'};for(const fn of callbacks)fn('TOKEN_REFRESHED',current);}};
`;
(async()=>{
  await fs.mkdir(out,{recursive:true});const tests=[],errors=[],calls=[];let delaySeat=null;
  const shell=await fetch(`${base}/admin-learning.html?local=1`),cookie=shell.headers.get('set-cookie').split(';')[0];
  const browser=await puppeteer.connect({browserURL:process.env.AI_WORK_BROWSER_CDP_URL,defaultViewport:null,protocolTimeout:30000});
  const owned=browser.targets().find(t=>t._targetId===target);if(!owned){await browser.disconnect();throw new Error('owned_target_missing');}
  const page=await owned.page();const inflight=new Set();
  const check=async(name,fn)=>{await fn();tests.push({name,passed:true});};
  const intercept=request=>{
    const task=(async()=>{
      const url=new URL(request.url());if(url.origin!==base)throw new Error('nonlocal_request_blocked');
      if(url.pathname==='/shared/auth.js')return request.respond({status:200,contentType:'text/javascript',body:authModule});
      if(url.pathname==='/rest/v1/rpc/admin_learning_action'){
        const b=JSON.parse(request.postData());calls.push({action:b.p_action,seat:b.p_payload.seat_no});
        if(request.headers().authorization==='Bearer fixture-expired')return request.respond({status:401,contentType:'application/json',body:'{"message":"fixture_expired"}'});
        const headers={Origin:base,Cookie:cookie,'Content-Type':'application/json',...(request.headers().authorization?.includes('student')?{'x-learning-role':'student'}:{})};
        const response=await fetch(`${base}/__learning-rpc`,{method:'POST',headers,body:request.postData()});const body=await response.text();
        if(b.p_action==='profile'&&b.p_payload.seat_no===delaySeat)await new Promise(r=>setTimeout(r,900));
        return request.respond({status:response.status,contentType:'application/json',body});
      }
      return request.continue();
    })().catch(error=>{if(!/Invalid InterceptionId|Target closed|Session closed|interception.*handled|No resource/.test(error.message))errors.push(error.message);});
    inflight.add(task);task.finally(()=>inflight.delete(task));
  };
  try{
    const cdp=await page.target().createCDPSession();cdp.grantForegroundOnce('Page.bringToFront','本機合成登入狀態與切換帳號的互動驗證');await cdp.send('Page.bringToFront');
    page.setDefaultTimeout(15000);await page.setViewport({width:1360,height:1020});page.on('pageerror',e=>errors.push(e.message));
    // Fetch interception is required here to substitute only the local Auth module.
    await page.setRequestInterception(true);page.on('request',intercept);
    await page.goto(`${base}/admin-learning.html?auth-test=1`,{waitUntil:'networkidle0'});
    await check('未登入與非教師：不查名冊／答案，登入沿用共用入口',async()=>{
      await page.waitForFunction(()=>window.__fixtureAuth&&!document.querySelector('#locked').hidden);assert.equal(calls.length,0);
      await page.click('#teacher-login');assert.equal(await page.evaluate(()=>window.__fixtureLogin.returnTo),`${base}/admin-learning.html?auth-test=1`);
      await page.evaluate(()=>window.__fixtureAuth.change('student'));await page.waitForFunction(()=>document.querySelector('#identity').textContent==='student@example.invalid');assert.equal(calls.length,0);
    });
    await check('教師登入後可選學生，token 更新不重載名冊或關閉明細',async()=>{
      await page.evaluate(()=>window.__fixtureAuth.change('teacherA'));await page.waitForSelector('[data-student-code="60301"]');await page.click('[data-student-code="60301"]');await page.waitForSelector('#records .record-row');
      await page.click('#records .record-row:first-of-type button');await page.waitForSelector('#detail-content table');const count=calls.length;
      await page.evaluate(()=>window.__fixtureAuth.refresh());await new Promise(r=>setTimeout(r,150));assert.equal(calls.length,count);assert.equal(await page.$eval('#detail-dialog',e=>e.open),true);await page.keyboard.press('Escape');
    });
    await check('登出同步清掉姓名、名冊與明細，無舊學生 DOM',async()=>{
      const state=await page.evaluate(()=>{window.__fixtureAuth.change(null);return{hidden:document.querySelector('#workspace').hidden,name:document.querySelector('#student-title').textContent,rows:document.querySelector('#roster-list').children.length};});
      assert.deepEqual(state,{hidden:true,name:'',rows:0});await page.waitForFunction(()=>!document.querySelector('#locked').hidden);
    });
    await check('教師 A→B：舊帳號延遲回應不覆蓋或登出新帳號',async()=>{
      await page.evaluate(()=>window.__fixtureAuth.change('teacherA'));await page.waitForSelector('[data-student-code="60301"]');delaySeat=1;await page.click('[data-student-code="60301"]');
      await page.evaluate(()=>window.__fixtureAuth.change('teacherB'));await page.waitForFunction(()=>document.querySelector('#identity').textContent==='teacherB@example.invalid'&&document.querySelector('[data-student-code="60302"]'));
      delaySeat=null;await page.click('[data-student-code="60302"]');await page.waitForSelector('#summary-cards .summary');await new Promise(r=>setTimeout(r,1100));
      assert.equal(await page.$eval('#workspace',e=>e.hidden),false);assert.equal(await page.$eval('#student-title',e=>e.textContent),'示範同學 02');
    });
    await check('教師切成學生：立即隱藏並清空全部學習內容',async()=>{
      const state=await page.evaluate(()=>{window.__fixtureAuth.change('student');return{hidden:document.querySelector('#workspace').hidden,name:document.querySelector('#student-title').textContent,rows:document.querySelector('#roster-list').children.length};});assert.deepEqual(state,{hidden:true,name:'',rows:0});
      await page.waitForFunction(()=>!document.querySelector('#locked').hidden);
    });
    await check('憑證失效回 401：移除舊資料並提示重新登入；重新登入可恢復',async()=>{
      await page.evaluate(()=>window.__fixtureAuth.change('teacherB'));await page.waitForSelector('[data-student-code="60301"]');await page.click('[data-student-code="60301"]');await page.waitForSelector('#summary-cards .summary');
      await page.evaluate(()=>window.__fixtureAuth.expire());await page.click('#refresh-student');await page.waitForFunction(()=>!document.querySelector('#locked').hidden);
      assert.match(await page.$eval('#global-status',e=>e.textContent),/教師登入已失效/);assert.equal(await page.$eval('#student-title',e=>e.textContent),'');assert.equal(await page.$eval('#roster-list',e=>e.children.length),0);
      await page.evaluate(()=>window.__fixtureAuth.change('teacherB'));await page.waitForSelector('[data-student-code="60301"]');await page.click('[data-student-code="60301"]');await page.waitForSelector('#summary-cards .summary');assert.equal(await page.$eval('#global-status',e=>e.textContent),'');
    });
    assert.deepEqual(errors,[]);await Promise.allSettled([...inflight]);page.off('request',intercept);await page.setRequestInterception(false);
    await page.goto(`${base}/admin-learning.html?local=1`,{waitUntil:'networkidle0'});await page.waitForSelector('#records .record-row');await page.click('#tab-papers');await page.waitForFunction(()=>document.querySelector('#paper-filter-status').textContent.includes('23'));
    await check('科目／狀態篩選涵蓋全卷集合，空結果可清除後恢復',async()=>{
      await page.select('#paper-subject','英語');await page.select('#paper-state','completed');await page.click('#paper-filters button[type="submit"]');await page.waitForFunction(()=>document.querySelector('#paper-filter-status').textContent.includes('符合 5 / 全部 23'));
      assert.equal(await page.$$('#records .record-row').then(x=>x.length),5);
      assert.ok(await page.$$eval('#records .record-row',rows=>rows.every(r=>r.textContent.includes('英語')&&r.textContent.includes('已完成'))));
      await page.select('#paper-state','unstarted');await page.click('#paper-filters button[type="submit"]');await page.waitForSelector('#records .empty');assert.match(await page.$eval('#records',e=>e.textContent),/沒有符合篩選條件/);
      await page.click('#clear-paper-filters');await page.waitForFunction(()=>document.querySelector('#paper-filter-status').textContent.includes('符合 23 / 全部 23'));
    });
    await page.evaluate(()=>document.querySelector('#student-profile').scrollIntoView());await safeScreenshot(page,{path:path.join(out,'04-filters-desktop.png'),fullPage:false});
    await check('390px 科目篩選不溢出、換學生清除篩選條件',async()=>{
      await page.setViewport({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.select('#paper-subject','英語');await page.click('#paper-filters button[type="submit"]');await page.waitForFunction(()=>document.querySelector('#paper-filter-status').textContent.includes('符合 6'));
      await page.click('[data-student-code="60302"]');await page.waitForSelector('#summary-cards .summary');await page.waitForFunction(()=>document.querySelector('#paper-filter-status').textContent.includes('全部 0'));
      assert.equal(await page.$eval('#paper-subject',e=>e.value),'');assert.equal(await page.$eval('#paper-state',e=>e.value),'all');
    });
    await page.setViewport({width:1360,height:1020});await page.click('[data-student-code="60301"]');await page.waitForSelector('#summary-cards .summary');await page.waitForSelector('#records .record-row');await page.evaluate(()=>window.scrollTo(0,0));
    const report={passed:true,syntheticAuth:true,realGoogleOAuthTested:false,tests,errors,checkedAt:new Date().toISOString()};await fs.writeFile(path.join(out,'auth-browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,count:tests.length,out}));
  }catch(error){await fs.writeFile(path.join(out,'auth-browser-report.json'),JSON.stringify({passed:false,tests,errors,error:error.message},null,2));throw error;}
  finally{page.off('request',intercept);await Promise.allSettled([...inflight]);await page.setRequestInterception(false).catch(()=>{});await browser.disconnect();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
