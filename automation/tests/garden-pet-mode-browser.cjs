const fs=require('fs'),assert=require('node:assert/strict'),{createRequire}=require('module'),r=createRequire('D:/projects/cdp-tools/package.json'),id=process.argv[2],out='D:/projects/it-class-tcwu/automation/output/pet-rest-persistence-20261101';
(async()=>{const b=await r('puppeteer-core').connect({browserURL:process.env.CDP_URL,networkEnabled:false,defaultViewport:null,targetFilter:t=>['browser','tab'].includes(t.type())||t._targetId===id});try{
 const p=await b.targets().find(t=>t._targetId===id).page();assert.equal(new URL(p.url()).origin,'http://127.0.0.1:4460');const c=await p.target().createCDPSession();c.grantForegroundOnce('Page.bringToFront','實際點擊寵物休息與散步按鈕並驗證重新進入');await c.send('Page.bringToFront');const errors=[];p.on('pageerror',e=>errors.push(e.message));
 const ready=()=>p.waitForFunction(()=>document.querySelector('[data-scene]>iframe')?.contentWindow.__gardenScene?.snapshot().ready,{timeout:60000,polling:5000});
 const saved=()=>p.waitForFunction(()=>document.querySelector('.garden-companions>p[role=status]')?.textContent==='選擇已儲存',{timeout:20000,polling:5000});
 const snapshot=()=>p.evaluate(()=>document.querySelector('[data-scene]>iframe').contentWindow.__gardenScene.snapshot());
 const read=()=>p.evaluate(async()=>{const r=await window.__gardenFixture.supabase.rpc('garden_companions',{p_course_id:'grade3-115-1',p_action:'get',p_data:{}});if(r.error)throw Error(r.error.message);return r.data});
 await p.reload({waitUntil:'domcontentloaded'});await ready();console.log('READY');const cases=[];
 for(const pet of ['cat','dog','rabbit']){
  await p.evaluate(async pet=>{await window.__gardenFixture.supabase.rpc('garden_companions',{p_course_id:'grade3-115-1',p_action:'save',p_data:{pet,petMode:'walk'}});await window.__gardenFixture.refresh()},pet);await ready();
  await p.click('.garden-pet-controls button:nth-of-type(2)');await saved();assert.equal((await read()).petMode,'rest');
  // Do not finish the entry animation. A reload must restore directly inside.
  await p.reload({waitUntil:'domcontentloaded'});await ready();const resting=await snapshot();assert.equal(resting.companion.mode,'rest');assert(resting.shelter?.inside||resting.controller?.inside,pet+' must start inside');assert(resting.cabinVisible);
  await p.click('.garden-pet-controls button:nth-of-type(1)');await saved();assert.equal((await read()).petMode,'walk');await p.reload({waitUntil:'domcontentloaded'});await ready();const walking=await snapshot();assert.equal(walking.companion.mode,'walk');assert(!walking.shelter?.inside&&!walking.controller?.inside);
  cases.push({pet,restReloadInside:true,walkReloadOutside:true});console.log('PASS '+pet);
 }
 // Rain forces rest but must not issue a database preference write.
 await p.evaluate(()=>document.querySelector('[data-scene]>iframe').contentWindow.__gardenScene.setAtmosphere('thunder',true));assert.equal((await read()).petMode,'walk');assert.equal((await snapshot()).companion.forceRest,true);
 await p.evaluate(()=>document.querySelector('[data-scene]>iframe').contentWindow.__gardenScene.setAtmosphere('day',true));assert.equal((await snapshot()).companion.mode,'rest');
 await p.reload({waitUntil:'domcontentloaded'});await ready();
 // A failed save must leave both the saved intent and scene walking.
 await p.evaluate(()=>{const s=window.__gardenFixture.supabase;window.__originalRpc=s.rpc;s.rpc=async(n,a)=>n==='garden_companions'&&a.p_action==='save'?{error:{message:'intentional fixture failure'}}:window.__originalRpc(n,a)});
 await p.click('.garden-pet-controls button:nth-of-type(2)');await p.waitForFunction(()=>document.querySelector('.garden-companions>p[role=status]').textContent.includes('尚未儲存'),{timeout:15000,polling:5000});assert.equal((await snapshot()).companion.mode,'walk');assert.equal((await read()).petMode,'walk');
 await p.evaluate(()=>window.__gardenFixture.supabase.rpc=window.__originalRpc);assert.deepEqual(errors,[]);
 fs.writeFileSync(out+'/browser-report.json',JSON.stringify({passed:true,cases,rainDoesNotPersist:true,saveFailureKeepsState:true,errors},null,2));console.log('PASS persistence, rain and failed save');
}finally{b.disconnect()}})().catch(e=>{console.error(e.stack);process.exitCode=1});
