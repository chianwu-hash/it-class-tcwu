const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const puppeteer=require('D:/projects/cdp-tools/node_modules/puppeteer-core');
const out=path.resolve(__dirname,'../output/admin-learning-20261101'),target=process.argv[2];
(async()=>{
  const samples=JSON.parse(await fs.readFile(path.join(out,'live-samples.private.json'),'utf8'));
  const browser=await puppeteer.connect({browserURL:process.env.AI_WORK_BROWSER_CDP_URL,defaultViewport:null,protocolTimeout:30000});
  const owned=browser.targets().find(t=>t._targetId===target);if(!owned){await browser.disconnect();throw Error('owned_target_missing');}
  const page=await owned.page();let script;const tests=[],errors=[],summaries=[];
  const check=async(name,fn)=>{await fn();tests.push({name,passed:true});};
  try{
    const cdp=await page.target().createCDPSession();cdp.grantForegroundOnce('Page.bringToFront','驗證本機真正教師登入及既有學習紀錄的讀取');await cdp.send('Page.bringToFront');
    page.setDefaultTimeout(20000);await page.setViewport({width:1360,height:1020});page.on('pageerror',()=>errors.push('page_script_error'));
    script=await page.evaluateOnNewDocument(()=>{
      const original=window.fetch;window.__learningOriginalFetch=original;window.__learningLiveData={};window.__learningLiveReads=[];
      window.fetch=async(input,options)=>{
        const response=await original(input,options);
        if(String(input)==='/__learning-live'){
          const body=JSON.parse(options.body),data=await response.clone().json();
          window.__learningLiveData[body.p_action]=data;window.__learningLiveReads.push({action:body.p_action,status:response.status,source:data.read_source});
        }
        return response;
      };
    });
    await page.goto('http://localhost:3000/admin-learning.html',{waitUntil:'networkidle0'});
    await check('真 Google 教師身分、伺服器驗證與雲端名冊',async()=>{
      await page.waitForSelector('#roster-list .student-button');assert.equal(await page.$eval('#identity',e=>e.textContent),'chianwu@gmail.com');
      assert.equal(await page.evaluate(()=>window.__learningLiveData.roster.read_source),'cloud-readonly');assert.equal(await page.$eval('#workspace',e=>e.hidden),false);
    });
    for(const sample of samples){
      const grade=sample.class_code[0],code=sample.class_code+String(sample.seat_no).padStart(2,'0');
      const summary={grade,weeklyRecords:0,typingProgress:0,typingEvents:0,papers:0,questions:0,images:0};
      await page.select('#course',`grade${grade}-115-1`);
      await page.waitForFunction(cls=>[...document.querySelector('#class-filter').options].some(o=>o.value===cls),{},sample.class_code);
      await page.select('#class-filter',sample.class_code);await page.waitForFunction(()=>!document.querySelector('#roster-list').hasAttribute('aria-busy'));
      await page.$eval('#student-search',(e,value)=>e.value=value,code);await page.click('#roster-search button');
      await page.waitForSelector(`[data-student-code="${code}"]`);await page.click(`[data-student-code="${code}"]`);await page.waitForSelector('#summary-cards .summary');
      await check(`${grade} 年級實際摘要與名冊姓名一致`,async()=>{
        const matched=await page.evaluate(()=>{const d=window.__learningLiveData.profile;return d.read_source==='cloud-readonly'&&document.querySelector('#student-title').textContent===d.identity.display_name
          &&document.querySelectorAll('.summary .metric')[0].textContent===d.weekly.completed+' / '+d.weekly.recorded
          &&document.querySelectorAll('.summary .metric')[2].textContent===d.papers.completed+' / '+d.papers.created;});assert.equal(matched,true);
      });
      await page.click('#tab-weekly');await page.waitForFunction(()=>!document.querySelector('#records').hasAttribute('aria-busy'));
      await check(`${grade} 年級週次紀錄讀回`,async()=>{
        const d=await page.evaluate(()=>({source:window.__learningLiveData.weekly?.read_source,total:window.__learningLiveData.weekly?.total,returned:window.__learningLiveData.weekly?.items?.length,visible:document.querySelectorAll('#records .record-row').length}));
        assert.equal(d.source,'cloud-readonly');assert.equal(d.returned,d.visible);summary.weeklyRecords=d.total;
      });
      await page.click('#tab-typing');await page.waitForFunction(()=>document.querySelector('#records .typing-filters'));
      const track=await page.evaluate(()=>{const rows=window.__learningLiveData.typing.items;const item=rows.find(r=>r.track==='english'&&r.progress_id&&r.events>0)||rows.find(r=>r.progress_id&&r.events>0)||rows.find(r=>r.progress_id);return item?.track;});
      if(track){
        await page.click(`[data-track="${track}"]`);
        const index=await page.evaluate(track=>{const rows=window.__learningLiveData.typing.items.filter(r=>r.track===track);let n=rows.findIndex(r=>r.progress_id&&r.events>0);return n<0?rows.findIndex(r=>r.progress_id):n;},track);
        await page.click(`#records .record-row:nth-of-type(${index+1}) button`);
        await page.waitForFunction(()=>!document.querySelector('#detail-content').hasAttribute('aria-busy'));
        await check(`${grade} 年級打字進度與事件明細讀回`,async()=>{
          const d=await page.evaluate(()=>({source:window.__learningLiveData.typing_events?.read_source,total:window.__learningLiveData.typing_events?.total,
            progress:window.__learningLiveData.typing.items.filter(r=>r.progress_id).length,visible:document.querySelectorAll('#detail-content tbody tr').length,returned:window.__learningLiveData.typing_events?.items?.length}));
          assert.equal(d.source,'cloud-readonly');assert.equal(d.visible,d.returned);summary.typingProgress=d.progress;summary.typingEvents=d.total;
        });await page.click('#close-detail');
      }
      await page.click('#tab-papers');await page.waitForFunction(()=>window.__learningLiveData.papers?.read_source==='cloud-readonly'&&!document.querySelector('#records').hasAttribute('aria-busy'));
      const index=await page.evaluate(()=>{const rows=window.__learningLiveData.papers.items;let n=rows.findIndex(r=>r.answered>0&&r.correct<r.answered);return n<0?rows.findIndex(r=>r.answered>0):n;});assert.ok(index>=0);
      summary.papers=await page.evaluate(()=>window.__learningLiveData.papers.total);
      await page.click(`#records .record-row:nth-of-type(${index+1}) button`);await page.waitForFunction(()=>window.__learningLiveData.paper?.read_source==='cloud-readonly'&&!document.querySelector('#detail-content').hasAttribute('aria-busy'));
      await check(`${grade} 年級固定版本、原答與逐題順序`,async()=>{
        const d=await page.evaluate(async()=>{
          const data=window.__learningLiveData.paper,model=await import('/shared/admin-learning-model.mjs');const articles=[...document.querySelectorAll('#detail-content .question-card')];
          return{source:data.read_source,total:data.total,returned:data.items.length,visible:articles.length,
            matches:data.items.every((item,i)=>articles[i]?.querySelector('h3')?.textContent.startsWith('第 '+item.number+' 題')&&articles[i].querySelector('.answer-box span')?.textContent===model.responseLabel(item.question,item.option_order,item.response,item.answered))};
        });assert.equal(d.source,'cloud-readonly');assert.equal(d.returned,d.visible);assert.equal(d.matches,true);summary.questions=d.total;
      });
      const imageCount=await page.$$('#detail-content img').then(x=>x.length);
      if(imageCount){
        // These are genuinely lazy images in a long paper. Bring each into the
        // dialog viewport rather than expecting offscreen images to load early.
        for(const image of await page.$$('#detail-content img')){
          await image.evaluate(i=>i.scrollIntoView({block:'center'}));
          await page.waitForFunction(i=>i.complete&&i.naturalWidth>0,{timeout:20000,polling:5000},image);
        }
        await check(`${grade} 年級實際題目圖片可讀`,async()=>{assert.equal(await page.$$('#detail-content figure [role="alert"]').then(x=>x.length),0);summary.images=imageCount;});
      }
      await page.click('#only-wrong');await page.waitForFunction(()=>!document.querySelector('#detail-content').hasAttribute('aria-busy'));
      await check(`${grade} 年級真實錯題篩選`,async()=>assert.equal(await page.evaluate(()=>window.__learningLiveData.paper.items.every(i=>i.answered&&!i.correct)),true));await page.click('#close-detail');
      await page.setViewport({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.setViewport({width:1360,height:1020});
      summaries.push(summary);
    }
    await check('實際查閱沒有非讀取動作或頁面腳本錯誤',async()=>{
      const records=await page.evaluate(()=>window.__learningLiveReads);assert.ok(records.every(r=>r.status===200&&r.source==='cloud-readonly'));assert.deepEqual(errors,[]);
    });
    await fs.writeFile(path.join(out,'real-google-live-report.json'),JSON.stringify({passed:true,realGoogle:true,teacherVerified:true,readOnlyRole:'supabase_read_only_user',
      tests,summaries,errors,studentNamesRetained:false,studentAnswersRetained:false,deployed:false,checkedAt:new Date().toISOString()},null,2));
    await page.evaluate(()=>{window.fetch=window.__learningOriginalFetch;delete window.__learningOriginalFetch;delete window.__learningLiveData;delete window.__learningLiveReads;window.scrollTo(0,0);});
    console.log(JSON.stringify({passed:true,tests:tests.length,summaries}));
  }catch(error){await fs.writeFile(path.join(out,'real-google-live-report.json'),JSON.stringify({passed:false,tests,summaries,errors,error:'live_validation_failed',checkedAt:new Date().toISOString()},null,2));console.error(error.name+': '+(error.name==='AssertionError'?'live_assertion_failed':error.message));process.exitCode=1;}
  finally{if(script)await page.removeScriptToEvaluateOnNewDocument(script.identifier).catch(()=>{});await browser.disconnect();}
})();
