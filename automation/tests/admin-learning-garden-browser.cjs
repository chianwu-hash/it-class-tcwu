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
   const original=window.fetch;window.__gardenOriginal=original;window.__gardenReads=[];window.__gardenActions=[];
   window.fetch=async(...args)=>{
    const response=await original(...args);
    if(String(args[0])==='/__learning-live'){
     const body=JSON.parse(args[1].body);window.__gardenActions.push(body.p_action);
     if(body.p_action==='garden_status')window.__gardenReads.push({status:response.status,data:await response.clone().json()});
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
   const grade=sample.class_code[0],course=`grade${grade}-115-1`,code=sample.class_code+String(sample.seat_no).padStart(2,'0');
   await page.select('#course',course);
   await page.waitForFunction(cls=>[...document.querySelector('#class-filter').options].some(o=>o.value===cls),{},sample.class_code);
   await page.select('#class-filter',sample.class_code);await page.click('#roster-search button');
   await page.waitForSelector(`[data-student-code="${code}"]`);await page.click(`#roster-list [data-student-code="${code}"]`);
   await page.waitForSelector('[data-garden-level]',{timeout:30000});
   const result=await page.evaluate(async course=>{
    const read=window.__gardenReads.at(-1),m=await import('/shared/admin-learning-garden.mjs'),state=m.summarizeGardenStatus(read.data,course);
    const unlocked=state.features.filter(f=>f.status==='unlocked').map(f=>f.key);
    const displayed=[...document.querySelectorAll('.garden-unlocked-list [data-feature-key]')].map(e=>e.dataset.featureKey);
    return {status:read.status,source:read.data.read_source,level:state.level,uiLevel:document.querySelector('[data-garden-level]').dataset.gardenLevel,
     hasGrowth:!!read.data.garden.growth,unlockedCount:unlocked.length,exactUnlocked:JSON.stringify(unlocked)===JSON.stringify(displayed),
     ownedItems:read.data.garden.unlocks.length,canonicalCatalog:read.data.garden.catalog.length,
     pending:state.features.filter(f=>f.status==='pending').length,
     pastFlowers:read.data.past_flowers.length,leaves:state.leaves,flowers:state.flowers,
     newLeaves:state.newLeaves,newFlowers:state.newFlowers};
   },course);
   assert.equal(result.status,200);assert.equal(result.source,'cloud-readonly');assert.equal(result.uiLevel,result.level===null?'unknown':String(result.level));
   assert.equal(result.exactUnlocked,true);assert.equal(result.canonicalCatalog,9);results.push({grade,...result});
   await page.$eval('.garden-learning-status details',e=>e.open=true);
   assert.equal(await page.$$('.garden-learning-status details li').then(a=>a.length)>0,true);
   const gapsMatch=await page.evaluate(async course=>{
     const m=await import('/shared/admin-learning-garden.mjs'),s=m.summarizeGardenStatus(window.__gardenReads.at(-1).data,course);
     return s.features.filter(f=>!['unlocked','pending'].includes(f.status)).every(f=>document.querySelector(`[data-locked-feature-key="${f.key}"] .unlock-gap`)?.textContent===f.remaining);
   },course);assert.equal(gapsMatch,true);
   if(grade==='3')await (await page.$('.garden-learning-status')).screenshot({path:path.join(out,'garden-remaining-conditions-only.png')});
   await page.$eval('.garden-learning-status details',e=>e.open=false);
   await page.setViewport({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   await page.setViewport({width:1360,height:1020});
  }
  assert.deepEqual(errors,[]);
  assert.equal(await page.evaluate(()=>window.__gardenActions.some(a=>/growth|unlock|save|seen/.test(a))),false);
  await page.$eval('.garden-learning-status',e=>e.scrollIntoView({block:'center'}));
  await (await page.$('.garden-learning-status')).screenshot({path:path.join(out,'garden-status-only.png')});
  await fs.writeFile(path.join(out,'garden-status-browser-report.json'),JSON.stringify({passed:true,results,errors},null,2),'utf8');
  console.log(JSON.stringify({passed:true,results}));
 }finally{
  await page.evaluate(()=>{if(window.__gardenOriginal)window.fetch=window.__gardenOriginal;delete window.__gardenOriginal;delete window.__gardenReads;delete window.__gardenActions;}).catch(()=>{});
  if(script)await page.removeScriptToEvaluateOnNewDocument(script.identifier).catch(()=>{});
  await browser.disconnect();
 }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
