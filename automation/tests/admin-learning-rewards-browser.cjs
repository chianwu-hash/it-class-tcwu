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
      const original=window.fetch;window.__rewardOriginal=original;window.__rewardReads=[];
      window.fetch=async(...args)=>{
        const response=await original(...args);
        if(String(args[0])==='/__learning-live'&&['rewards','garden_status'].includes(JSON.parse(args[1].body).p_action)){
          window.__rewardReads.push({status:response.status,data:await response.clone().json()});
        }
        return response;
      };
    });
    await page.setViewport({width:1360,height:1020});
    await page.goto('http://localhost:3000/admin-learning.html',{waitUntil:'networkidle0'});
    await page.waitForSelector('#roster-list .student-button',{timeout:20000});
    assert.equal(await page.$eval('#identity',e=>e.textContent),'chianwu@gmail.com');
    const samples=JSON.parse(await fs.readFile(path.join(out,'live-samples.private.json'),'utf8'));
    for(const sample of samples){
      const grade=sample.class_code[0],code=sample.class_code+String(sample.seat_no).padStart(2,'0');
      await page.select('#course',`grade${grade}-115-1`);
      await page.waitForFunction(cls=>[...document.querySelector('#class-filter').options].some(o=>o.value===cls),{},sample.class_code);
      await page.select('#class-filter',sample.class_code);await page.click('#roster-search button');
      await page.waitForSelector(`[data-student-code="${code}"]`);await page.click(`[data-student-code="${code}"]`);
      await page.waitForSelector('[data-reward-total="leaves"]',{timeout:25000});
      const result=await page.evaluate(async course=>{
        const read=window.__rewardReads.at(-1),module=await import('/shared/admin-learning-rewards.mjs');
        const expected=module.summarizeLearningRewards(read.data,course);
        const leaves=Number(document.querySelector('[data-reward-total="leaves"] strong').textContent);
        const flowers=Number(document.querySelector('[data-reward-total="flowers"] strong').textContent);
        return {status:read.status,source:read.data.read_source,leaves,flowers,pendingHalf:expected.pendingHalf,
          match:expected.leaves===leaves&&expected.flowers===flowers,
          sum:expected.groups.reduce((s,g)=>s+g.leaves,0)===leaves&&expected.groups.reduce((s,g)=>s+g.flowers,0)===flowers,
          sources:document.querySelectorAll('.reward-sources li').length,
          expectedSources:expected.items.length,groups:expected.groups.length,expectedGroups:(course.startsWith('grade3')?3:5)+(read.data.past_flowers?.length?1:0)};
      },`grade${grade}-115-1`);
      assert.equal(result.status,200);assert.equal(result.source,'cloud-readonly');assert.equal(result.match,true);assert.equal(result.sum,true);assert.equal(result.sources,result.expectedSources);
      assert.equal(result.groups,result.expectedGroups);results.push({grade,...result});
      await page.$eval('#reward-content details',e=>e.open=true);assert.equal(await page.$$('.reward-sources strong').then(a=>a.length),result.sources);
      await page.$eval('#reward-content details',e=>e.open=false);
      await page.setViewport({width:390,height:844});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
      await page.setViewport({width:1360,height:1020});
    }
    assert.deepEqual(errors,[]);
    await page.$eval('#reward-section',e=>e.scrollIntoView({block:'center'}));
    const box=await page.$('#reward-section');await box.screenshot({path:path.join(out,'rewards-only.png')});
    await fs.writeFile(path.join(out,'rewards-browser-report.json'),JSON.stringify({passed:true,results,errors},null,2),'utf8');
    console.log(JSON.stringify({passed:true,results}));
  }finally{
    await page.evaluate(()=>{if(window.__rewardOriginal)window.fetch=window.__rewardOriginal;delete window.__rewardOriginal;delete window.__rewardReads;}).catch(()=>{});
    if(script)await page.removeScriptToEvaluateOnNewDocument(script.identifier).catch(()=>{});
    await browser.disconnect();
  }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
