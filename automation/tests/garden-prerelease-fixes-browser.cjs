const fs=require('node:fs'),assert=require('node:assert/strict'),{createRequire}=require('node:module'),req=createRequire('D:/projects/cdp-tools/package.json');
const id=process.argv[2],out='D:/projects/it-class-tcwu/automation/output/effort-prerelease-fixes-20261031';
(async()=>{
 const b=await req('puppeteer-core').connect({browserURL:process.env.CDP_URL,networkEnabled:false,defaultViewport:null,targetFilter:t=>['browser','tab'].includes(t.type())||t._targetId===id});
 try{
  const p=await b.targets().find(t=>t._targetId===id).page();assert.equal(new URL(p.url()).origin,'http://127.0.0.1:4438');fs.mkdirSync(out,{recursive:true});
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  // This QA tab only: failed assets perform a real same-origin 404, without
  // enabling Network or altering the server, user tour, auth, or real records.
  await p.evaluateOnNewDocument(()=>{
   const desc=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
   Object.defineProperty(HTMLImageElement.prototype,'src',{...desc,set(v){const blocked=top.__qaBlockURL;desc.set.call(this,blocked&&String(v).includes(blocked)?'/garden/qa-intentional-missing.png':v)}});
  });
  await p.goto('http://127.0.0.1:4438/?qa=prerelease-fixes',{waitUntil:'domcontentloaded'});
  const ready=()=>p.waitForFunction(()=>document.querySelector('[data-scene]>iframe')?.contentWindow.__gardenScene?.snapshot().ready,{timeout:60000,polling:5000});
  await ready();const results=[];
  for(const pet of ['cat','dog','rabbit']){
   await p.evaluate(async pet=>{await window.__gardenFixture.supabase.rpc('garden_companions',{p_course_id:'grade3-115-1',p_action:'save',p_data:{pet,homeVisible:true}});await window.__gardenFixture.refresh()},pet);await ready();
   // Missing optional past-exam flower: ready with explicit warning, same IDs.
   const before=await p.evaluate(()=>{top.__qaBlockURL='flower-forest.png';const a=document.querySelector('[data-scene]>iframe').contentWindow.__gardenScene,s=a.snapshot();a.retry();return s.counts});
   await ready();
   const optional=await p.evaluate(()=>{const w=document.querySelector('[data-scene]>iframe').contentWindow,a=w.__gardenScene,s=a.snapshot();a.configure({flowers:[{id:'qa-past-flower',sourceType:'past_exam'}]});a.pause();return {ready:s.ready,issues:s.assetIssues,counts:s.counts,message:w.document.querySelector('#scene-load-message').textContent}});
   assert(optional.ready);assert(optional.issues.some(x=>x.id==='past-flower'&&!x.fatal));assert.deepEqual(optional.counts,before);
   await p.evaluate(()=>{top.__qaBlockURL=null;document.querySelector('[data-scene]>iframe').contentDocument.querySelector('#scene-retry').click()});await ready();
   assert.deepEqual(await p.evaluate(()=>document.querySelector('[data-scene]>iframe').contentWindow.__gardenScene.snapshot().assetIssues),[]);
   // Essential tree image failure must surface at the outer student scene.
   await p.evaluate(()=>{top.__qaBlockURL='/tree';document.querySelector('[data-scene]>iframe').contentWindow.__gardenScene.retry()});
   await p.waitForFunction(()=>document.querySelector('[data-scene]>iframe')?.contentWindow.__gardenScene?.snapshot().assetIssues.some(x=>x.fatal),{timeout:60000,polling:5000});
   const fatal=await p.evaluate(()=>{const w=document.querySelector('[data-scene]>iframe').contentWindow;return {s:w.__gardenScene.snapshot(),hidden:w.document.querySelector('#scene-retry').hidden,message:w.document.querySelector('#scene-load-message').textContent}});assert(!fatal.s.ready);assert(!fatal.hidden);assert(fatal.message.includes('重新讀取'));
   await p.evaluate(()=>{top.__qaBlockURL=null;document.querySelector('[data-scene]>iframe').contentDocument.querySelector('#scene-retry').click()});await ready();
   const longRun=await p.evaluate(()=>{const a=document.querySelector('[data-scene]>iframe').contentWindow.__gardenScene;a.setAtmosphere('day',true);a.setReduce(false);a.command('walk');a.play();a.pause();const before=a.snapshot();a.advanceForTest(600000);a.advanceForTest(60000);const after=a.snapshot();a.play();return {before,after,label:document.querySelector('[data-scene]>iframe').contentDocument.querySelector('#pet-tap').textContent}});
   assert(longRun.after.ready);assert.equal(longRun.after.manuallyPaused,true);assert(longRun.after.weatherTime-longRun.before.weatherTime>=659999);if(pet==='cat')assert(longRun.after.cycleCount>=2);
   assert.equal(longRun.label,'和'+({cat:'橘寶',dog:'布丁',rabbit:'蹦蹦'})[pet]+'打招呼');
   // Load while playing and while manually paused: retries retain intent.
   for(const paused of [true,false]){
    await p.evaluate(paused=>{const a=document.querySelector('[data-scene]>iframe').contentWindow.__gardenScene;paused?a.pause():a.play();a.retry()},paused);await ready();
    const s=await p.evaluate(()=>document.querySelector('[data-scene]>iframe').contentWindow.__gardenScene.snapshot());assert.equal(s.manuallyPaused,paused);assert.equal(s.playing,!paused);
   }
   results.push({pet,optional,fatalMessage:fatal.message,retry:true,cycles:longRun.after.cycleCount,simulatedMs:660000,names:longRun.label});console.log('PASS '+pet);
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(out+'/browser-report.json',JSON.stringify({passed:true,results,errors},null,2));console.log('PASS all');
 }finally{await b.disconnect()}
})().catch(e=>{console.error(e.stack);process.exitCode=1});
