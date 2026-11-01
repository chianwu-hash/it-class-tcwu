const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {safeScreenshot}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
const puppeteer=require('D:/projects/cdp-tools/node_modules/puppeteer-core');
const target=process.argv[2],base='http://127.0.0.1:4472',url=`${base}/admin-learning.html?local=1`;
const out=path.resolve(__dirname,'../output/admin-learning-20261101');
const tests=[],errors=[];
const check=(name,fn)=>Promise.resolve().then(fn).then(async()=>{tests.push({name,passed:true});await fs.writeFile(path.join(out,'browser-progress.json'),JSON.stringify({tests},null,2));});
(async()=>{
  await fs.mkdir(out,{recursive:true});
  // The shared URL matcher may select an older same-URL tab. Use the launcher's
  // exact target instead; run-background still guards the retained CDP endpoint.
  const browser=await puppeteer.connect({browserURL:process.env.AI_WORK_BROWSER_CDP_URL,defaultViewport:null,protocolTimeout:30000});
  const owned=browser.targets().find(t=>t._targetId===target);if(!owned){await browser.disconnect();throw new Error('owned_target_missing');}
  const page=await owned.page();
  try{
    assert.equal(page.target()._targetId,target,'Only use the leased exact page target');
    const session=await page.target().createCDPSession();
    session.grantForegroundOnce('Page.bringToFront','本機教師後台需以真實滑鼠／鍵盤驗證互動');await session.send('Page.bringToFront');
    page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(15000);
    page.on('pageerror',e=>errors.push(e.message));
    await page.evaluateOnNewDocument(()=>{
      const original=window.fetch;window.__learningReads=[];window.__learningFault=null;window.__learningDelay=null;
      window.fetch=async(input,options)=>{
        if(String(input).includes('__learning-rpc')){
          const b=JSON.parse(options.body);window.__learningReads.push({action:b.p_action,payload:b.p_payload});
          if(window.__learningFault===b.p_action)return new Response(JSON.stringify({error:'service_unavailable'}),{status:503});
          const result=await original(input,options);
          if(window.__learningDelay?.action===b.p_action&&b.p_payload.seat_no===window.__learningDelay.seat)await new Promise(r=>setTimeout(r,1000));
          return result;
        }
        return original(input,options);
      };
    });
    await page.setViewport({width:1360,height:1020});await page.goto(url,{waitUntil:'networkidle0'});
    await page.waitForFunction(()=>document.querySelector('#records .record-row'));
    await check('第一階段：三筆摘要＋完整名冊，不預取答案',async()=>{
      assert.equal(await page.$eval('#summary-cards',e=>e.children.length),3);
      assert.equal(await page.$eval('#student-title',e=>e.textContent),'示範同學 01');
      const requests=await page.evaluate(()=>window.__learningReads);assert.deepEqual(requests.map(r=>r.action),['roster','profile','typing']);
      await page.click('[data-track="zhuyin"]');await page.waitForFunction(()=>document.querySelector('#records .record-row')?.textContent.includes('中打'));
      assert.match(await page.$eval('#records',e=>e.textContent),/速度僅記錄/);
      await page.click('[data-track="english"]');await page.waitForFunction(()=>document.querySelector('#records .record-row')?.textContent.includes('英打'));
    });
    await safeScreenshot(page,{path:path.join(out,'01-desktop.png'),fullPage:false});
    await check('打字事件：有效／歷史版本、重置稽核與第二頁',async()=>{
      await page.click('#records .record-row:first-of-type button');await page.waitForSelector('#detail-content table');
      assert.match(await page.$eval('#detail-content',e=>e.textContent),/教師重置紀錄/);
      await page.evaluate(()=>[...document.querySelectorAll('#detail-paging button')].find(b=>b.textContent==='下一頁').click());
      await page.waitForFunction(()=>document.querySelector('#detail-paging')?.textContent.includes('21–26'));
      assert.match(await page.$eval('#detail-content',e=>e.textContent),/歷史/);await page.keyboard.press('Escape');
      assert.equal(await page.$eval('#detail-dialog',e=>e.open),false);
      assert.equal(await page.evaluate(()=>document.activeElement.textContent),'查看歷程（26）');
    });
    await check('試卷列表含未開始卷；仍未預載逐題明細',async()=>{
      await page.click('#tab-papers');await page.waitForFunction(()=>document.querySelector('#record-paging')?.textContent.includes('1–20'));
      assert.match(await page.$eval('#records',e=>e.textContent),/尚未開始/);
      assert.equal(await page.evaluate(()=>window.__learningReads.filter(x=>x.action==='paper').length),0);
      await page.evaluate(()=>[...document.querySelectorAll('#records article')].find(a=>a.textContent.includes('尚未開始')).querySelector('button').click());
      await page.waitForSelector('#detail-content .question-card');assert.match(await page.$eval('#detail-content',e=>e.textContent),/以固定版本的原始順序預覽/);await page.click('#close-detail');
      await page.evaluate(()=>[...document.querySelectorAll('#record-paging button')].find(b=>b.textContent==='下一頁').click());
      await page.waitForFunction(()=>document.querySelector('#record-paging')?.textContent.includes('21–23'));
      assert.match(await page.$eval('#records',e=>e.textContent),/學生列表已隱藏/);
    });
    await check('第二階段：單卷原答、亂序選項、公式、材料圖片與簡答題',async()=>{
      await page.click('#records .record-row:last-child button');await page.waitForSelector('#detail-content .question-card');
      assert.equal(await page.$$('#detail-content .question-card').then(x=>x.length),3);
      assert.match(await page.$eval('#detail-content .question-card:first-of-type',e=>e.textContent),/學生原答選項 A/);
      assert.equal(await page.$$('#detail-content .katex').then(x=>x.length)>0,true);
      await page.waitForFunction(()=>[...document.querySelectorAll('#detail-content img')].every(i=>i.complete&&i.naturalWidth>0));
      assert.match(await page.$eval('#detail-content',e=>e.textContent),/兩個四分之一等於二分之一/);
      assert.match(await page.$eval('#detail-content',e=>e.textContent),/可接受答案/);
    });
    await new Promise(r=>setTimeout(r,10000));await safeScreenshot(page,{path:path.join(out,'02-paper-detail.png'),fullPage:false});
    await check('錯題篩選查完整試卷，保留全卷分母',async()=>{
      await page.click('#only-wrong');await page.waitForFunction(()=>document.querySelectorAll('#detail-content .question-card').length===1);
      assert.match(await page.$eval('#detail-content',e=>e.textContent),/全卷已答 3 \/ 3/);
      const request=await page.evaluate(()=>window.__learningReads.at(-1));assert.equal(request.payload.filter,'wrong');await page.click('#close-detail');
    });
    await check('未完成卷：未答不顯示答錯，可開啟隱藏卷',async()=>{
      await page.evaluate(()=>[...document.querySelectorAll('#records article')].find(a=>a.textContent.includes('同重點延伸')).querySelector('button').click());
      await page.waitForSelector('#detail-content .question-card');assert.match(await page.$eval('#detail-content',e=>e.textContent),/尚未作答/);assert.match(await page.$eval('#detail-content',e=>e.textContent),/全卷已答 1 \/ 3/);await page.keyboard.press('Escape');
      await page.evaluate(()=>[...document.querySelectorAll('#records article')].find(a=>a.textContent.includes('學生列表已隱藏')).querySelector('button').click());
      await page.waitForSelector('#detail-content .question-card');assert.match(await page.$eval('#detail-content',e=>e.textContent),/學生列表已隱藏/);await page.click('#close-detail');
    });
    await check('空紀錄／未連結／衝突三種狀態分開',async()=>{
      await page.evaluate(()=>[...document.querySelectorAll('#roster-paging button')].find(b=>b.textContent==='下一頁').click());await page.waitForSelector('[data-student-code="60331"]');
      await page.click('[data-student-code="60331"]');await page.waitForFunction(()=>document.querySelector('#records')?.textContent.includes('目前沒有'));
      assert.match(await page.$eval('#summary-cards',e=>e.textContent),/0 \/ 0/);
      await page.click('[data-student-code="60332"]');await page.waitForFunction(()=>document.querySelector('#mapping-status')?.textContent.includes('尚未連結已驗證'));
      assert.equal(await page.$eval('#record-section',e=>e.hidden),true);
      await page.click('[data-student-code="60333"]');await page.waitForFunction(()=>document.querySelector('#mapping-status')?.textContent.includes('帳號對應需要確認'));
    });
    await check('快速切換學生：延遲舊回應不能覆蓋新學生',async()=>{
      await page.evaluate(()=>[...document.querySelectorAll('#roster-paging button')].find(b=>b.textContent==='上一頁').click());await page.waitForSelector('[data-student-code="60301"]');
      await page.evaluate(()=>window.__learningDelay={action:'profile',seat:1});await page.click('[data-student-code="60301"]');await page.click('[data-student-code="60302"]');
      await page.waitForFunction(()=>document.querySelector('#student-title')?.textContent==='示範同學 02'&&document.querySelector('#summary-cards')?.children.length===3);
      await new Promise(r=>setTimeout(r,1500));assert.equal(await page.$eval('#student-title',e=>e.textContent),'示範同學 02');
      assert.match(await page.$eval('#summary-cards',e=>e.textContent),/0 \/ 23/);await page.evaluate(()=>window.__learningDelay=null);
    });
    await check('單一來源讀取失敗：明示錯誤，可手動重試',async()=>{
      await page.evaluate(()=>window.__learningFault='weekly');await page.click('#tab-weekly');await page.waitForSelector('#records .error');
      assert.match(await page.$eval('#records',e=>e.textContent),/不代表學生沒有紀錄/);await page.evaluate(()=>window.__learningFault=null);await page.click('#records .error button');
      await page.waitForSelector('#records .record-row');assert.match(await page.$eval('#record-paging',e=>e.textContent),/1–20 \/ 23/);
    });
    await check('課程切換移除舊學生與明細，三年級門檻正確',async()=>{
      await page.select('#course','grade3-115-1');await page.waitForSelector('[data-student-code="30101"]');assert.equal(await page.$eval('#profile-content',e=>e.hidden),true);
      await page.click('[data-student-code="30101"]');await page.waitForSelector('#summary-cards .summary');await page.click('#tab-typing');await page.waitForSelector('#records .record-row');
      assert.match(await page.$eval('#records .record-row:first-of-type',e=>e.textContent),/8 WPM/);
    });
    await check('鍵盤分頁操作與 390px 手機不溢出',async()=>{
      await page.focus('#tab-typing');await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.querySelector('#tab-papers')?.getAttribute('aria-selected')==='true');
      await page.setViewport({width:390,height:844});await page.evaluate(()=>window.scrollTo(0,0));
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.click('#tab-typing');await page.waitForSelector('#records .record-row');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    });
    await new Promise(r=>setTimeout(r,10000));await safeScreenshot(page,{path:path.join(out,'03-mobile.png'),fullPage:true});
    await check('沒有背景輪詢、沒有正式網路或學習寫入',async()=>{
      const count=await page.evaluate(()=>window.__learningReads.length);await new Promise(r=>setTimeout(r,2200));assert.equal(await page.evaluate(()=>window.__learningReads.length),count);
      assert.equal(errors.length,0,JSON.stringify(errors));
    });
    await page.setViewport({width:1360,height:1020});await page.select('#course','grade6-115-1');await page.waitForSelector('[data-student-code="60301"]');await page.click('[data-student-code="60301"]');await page.waitForSelector('#records .record-row');await page.evaluate(()=>window.scrollTo(0,0));
    const report={passed:true,tests,errors,url,target,checkedAt:new Date().toISOString()};await fs.writeFile(path.join(out,'browser-report.json'),JSON.stringify(report,null,2),'utf8');console.log(JSON.stringify({passed:true,count:tests.length,out}));
  }catch(error){await fs.writeFile(path.join(out,'browser-report.json'),JSON.stringify({passed:false,tests,errors,error:error.message},null,2));throw error;}
  finally{await browser.disconnect();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
