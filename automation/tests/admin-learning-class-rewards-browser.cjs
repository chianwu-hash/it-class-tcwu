const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const puppeteer=require('D:/projects/cdp-tools/node_modules/puppeteer-core');
const out=path.resolve(__dirname,'../output/admin-learning-20261101');
(async()=>{
  const browser=await puppeteer.connect({browserURL:process.env.AI_WORK_BROWSER_CDP_URL,defaultViewport:null});
  const target=browser.targets().find(t=>t._targetId===process.argv[2]);
  if(!target){await browser.disconnect();throw Error('owned_target_missing');}
  const page=await target.page(),errors=[],results=[];let script;
  try{
    page.on('pageerror',()=>errors.push('page_script_error'));
    script=await page.evaluateOnNewDocument(()=>{
      const original=window.fetch;window.__classOriginal=original;window.__classReads=[];
      window.fetch=async(...args)=>{
        const response=await original(...args);
        if(String(args[0])==='/__learning-live'){
          const body=JSON.parse(args[1].body);
          if(body.p_action==='class_rewards'){
            const data=await response.clone().json();window.__classReads.push({status:response.status,data});
            if(window.__holdClass===body.p_payload.class_code){
              await new Promise(resolve=>{window.__releaseClass=resolve;});
            }
          }
        }
        return response;
      };
    });
    await page.setViewport({width:1360,height:1020});
    await page.goto('http://localhost:3000/admin-learning.html',{waitUntil:'networkidle0'});
    await page.waitForSelector('#roster-list .student-button',{timeout:20000});
    assert.equal(await page.$eval('#identity',e=>e.textContent),'chianwu@gmail.com');
    for(const cls of ['301','604']){
      const course=`grade${cls[0]}-115-1`;
      await page.select('#course',course);
      assert.equal(await page.$$('.class-reward-table tbody tr').then(a=>a.length),0);
      await page.waitForFunction(c=>[...document.querySelector('#reward-class').options].some(o=>o.value===c),{},cls);
      await page.select('#reward-class',cls);
      await page.waitForSelector('.class-reward-table tbody tr',{timeout:30000});
      const stats=await page.evaluate(async course=>{
        const read=window.__classReads.at(-1),module=await import('/shared/admin-learning-rewards.mjs'),garden=await import('/shared/admin-learning-garden.mjs');
        const expected=garden.summarizeClassGardenRewards(read.data,course);
        const rows=[...document.querySelectorAll('.class-reward-table tbody tr')];
        const actualTotals=Object.fromEntries([...document.querySelectorAll('[data-class-total]')].map(e=>[e.dataset.classTotal,Number(e.querySelector('strong').textContent)]));
        const expectedRows=module.sortClassRewards(expected.items,'seat');
        return {status:read.status,source:read.data.read_source,total:read.data.total,rows:rows.length,
          allRowsMatch:rows.every((row,i)=>row.dataset.studentCode===expectedRows[i].student_code&&['leaves','flowers','pendingHalf'].every(key=>
            row.querySelector(`[data-count="${key}"]`).textContent===(expectedRows[i][key]===null?'—':key==='pendingHalf'?expectedRows[i][key]?'半片':'無':String(expectedRows[i][key])))),
          totalsMatch:['leaves','flowers','pendingHalves'].every(k=>actualTotals[k]===expected.totals[k]),
          gardenRowsMatch:rows.every((row,i)=>{
            const g=expectedRows[i].garden,level=row.querySelector('[data-count="gardenLevel"]'),features=row.querySelector('[data-count="unlockedFeatures"]');
            if(!g)return level.textContent==='—'&&!features.querySelector('[data-feature-key]');
            return level.querySelector('strong')?.textContent===(g.level===null?'待確認':`第 ${g.level} 級`)
              &&JSON.stringify([...features.querySelectorAll('[data-feature-key]')].map(e=>e.dataset.featureKey))===JSON.stringify(g.features.filter(f=>f.status==='unlocked').map(f=>f.key))
              &&(!g.synchronizationPending||level.textContent.includes('待同步升級'));
          }),
          levelTwo:expected.items.filter(r=>r.garden?.level===2).length,
          leaves:expected.totals.leaves,flowers:expected.totals.flowers,unlinked:expected.totals.unlinked,
          conflict:expected.totals.conflict,linked:expected.totals.linked};
      },course);
      assert.equal(stats.status,200);assert.equal(stats.source,'cloud-readonly');assert.equal(stats.total,stats.rows);
      assert.ok(stats.rows>20);assert.equal(stats.allRowsMatch,true);assert.equal(stats.totalsMatch,true);
      assert.equal(stats.gardenRowsMatch,true);
      for(const sort of ['leaves','flowers','seat']){
        await page.select('#reward-sort',sort);
        const order=await page.evaluate(async({sort,course})=>{
          const m=await import('/shared/admin-learning-rewards.mjs'),s=m.summarizeClassRewards(window.__classReads.at(-1).data,course);
          return [...document.querySelectorAll('.class-reward-table tbody tr')].every((r,i)=>r.dataset.studentCode===m.sortClassRewards(s.items,sort)[i].student_code);
        },{sort,course});assert.equal(order,true);
      }
      // Roster search and pagination do not shrink the class table or totals.
      await page.type('#student-search','000000');await page.click('#roster-search button');
      await page.waitForFunction(()=>!document.querySelector('#roster-list').hasAttribute('aria-busy'));
      assert.equal(await page.$$('.class-reward-table tbody tr').then(a=>a.length),stats.rows);
      const readsBefore=await page.evaluate(()=>window.__classReads.length);
      await page.click('#refresh-class-rewards');await page.waitForSelector('.class-reward-table tbody tr',{timeout:30000});
      assert.equal(await page.evaluate(()=>window.__classReads.length),readsBefore+1);
      // Click a student from the last roster seat, including beyond page 1.
      const code=await page.$eval('.class-reward-table tbody tr:last-child',e=>e.dataset.studentCode);
      const expected=await page.$eval('.class-reward-table tbody tr:last-child',e=>({leaves:e.querySelector('[data-count="leaves"]').textContent,flowers:e.querySelector('[data-count="flowers"]').textContent,
        level:e.querySelector('[data-count="gardenLevel"] strong')?.textContent,
        unlocked:[...e.querySelectorAll('[data-feature-key]')].map(e=>e.dataset.featureKey)}));
      await page.click('.class-reward-table tbody tr:last-child button');
      await page.waitForFunction(()=>!document.querySelector('#summary-cards').hasAttribute('aria-busy'));
      if(expected.leaves!=='—'){
        await page.waitForSelector('[data-reward-total="leaves"]',{timeout:25000});
        assert.equal(await page.$eval('[data-reward-total="leaves"] strong',e=>e.textContent),expected.leaves);
        assert.equal(await page.$eval('[data-reward-total="flowers"] strong',e=>e.textContent),expected.flowers);
        assert.equal(await page.$eval('[data-garden-level]',e=>e.textContent.includes('第 '+e.dataset.gardenLevel+' 級')||e.dataset.gardenLevel==='unknown'),true);
        assert.deepEqual(await page.$$eval('.garden-learning-status [data-feature-key]',items=>items.map(e=>e.dataset.featureKey)),expected.unlocked);
        assert.equal(await page.$eval('[data-garden-level]',(e,level)=>level==='待確認'?e.dataset.gardenLevel==='unknown':level==='第 '+e.dataset.gardenLevel+' 級',expected.level),true);
      }else{
        assert.equal(await page.$eval('#reward-section',e=>e.hidden),true);
      }
      assert.equal(await page.$$('.class-reward-table tbody tr').then(a=>a.length),stats.rows);
      await page.setViewport({width:390,height:844});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
      await page.setViewport({width:1360,height:1020});results.push({grade:cls[0],...stats});
    }
    // Hold an old response after it has arrived, then switch classes. Even if
    // cancellation cannot stop that promise, the epoch must reject its DOM update.
    await page.evaluate(()=>{window.__holdClass='603';});await page.select('#reward-class','603');
    await page.waitForFunction(()=>typeof window.__releaseClass==='function',{timeout:25000});
    await page.select('#reward-class','604');await page.waitForSelector('.class-reward-table tbody tr',{timeout:30000});
    await page.evaluate(()=>{window.__releaseClass();delete window.__holdClass;delete window.__releaseClass;});
    await page.waitForFunction(()=>document.querySelector('.class-reward-table caption')?.textContent.startsWith('604 班'));
    assert.equal(await page.$$eval('.class-reward-table tbody tr',rows=>rows.every(r=>r.dataset.studentCode.startsWith('604'))),true);
    assert.deepEqual(errors,[]);
    await page.$eval('#class-reward-section',e=>e.scrollIntoView({block:'start'}));
    // Screenshot only aggregate controls and totals, above the student-name table.
    const bounds=await page.$eval('#class-reward-section',e=>{const r=e.getBoundingClientRect(),table=e.querySelector('.table-wrap').getBoundingClientRect();return{x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:table.y-r.y-4};});
    await page.screenshot({path:path.join(out,'class-rewards-totals-only.png'),clip:bounds});
    await fs.writeFile(path.join(out,'class-rewards-browser-report.json'),JSON.stringify({passed:true,results,errors},null,2),'utf8');
    console.log(JSON.stringify({passed:true,results,staleResponseRejected:true}));
  }finally{
    await page.evaluate(()=>{window.__releaseClass?.();if(window.__classOriginal)window.fetch=window.__classOriginal;for(const k of ['__classOriginal','__classReads','__holdClass','__releaseClass'])delete window[k];}).catch(()=>{});
    if(script)await page.removeScriptToEvaluateOnNewDocument(script.identifier).catch(()=>{});
    await browser.disconnect();
  }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
