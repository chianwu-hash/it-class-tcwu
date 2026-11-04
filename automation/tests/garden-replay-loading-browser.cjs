const fs=require('node:fs'),assert=require('node:assert/strict'),{createRequire}=require('node:module'),req=createRequire('D:/projects/cdp-tools/package.json'),id=process.argv[2],out='D:/projects/it-class-tcwu/automation/output/effort-prerelease-fixes-20261031';
(async()=>{const b=await req('puppeteer-core').connect({browserURL:process.env.CDP_URL,networkEnabled:false,defaultViewport:null,targetFilter:t=>['browser','tab'].includes(t.type())||t._targetId===id});try{
 const p=await b.targets().find(t=>t._targetId===id).page();assert.equal(new URL(p.url()).origin,'http://127.0.0.1:4438');const errors=[];p.on('pageerror',e=>errors.push(e.message));const rows=[];
 const ready=()=>p.waitForFunction(()=>document.querySelector('[data-scene]>iframe')?.contentWindow.__gardenScene?.snapshot().ready,{timeout:60000,polling:5000});await ready();
 for(const paused of [false,true]){
  await p.evaluate(paused=>{const a=document.querySelector('[data-scene]>iframe').contentWindow.__gardenScene;paused?a.pause():a.play();a.retry();if(a.snapshot().ready)throw Error('expected loading');document.querySelector('[data-replay]').click()},paused);
  await p.waitForFunction(()=>document.querySelector('.garden-growth-inline')?.contentWindow.__growthPreview?.snapshot().ready,{timeout:60000,polling:5000});
  await p.evaluate(()=>document.querySelector('.garden-growth-inline').contentWindow.__growthPreview.finish());
  await p.waitForFunction(()=>!document.querySelector('.garden-growth-inline'),{timeout:15000,polling:5000});await ready();
  const s=await p.evaluate(()=>document.querySelector('[data-scene]>iframe').contentWindow.__gardenScene.snapshot());assert.equal(s.manuallyPaused,paused);assert.equal(s.playing,!paused);rows.push({paused,restored:true});
 }
 const names=await p.evaluate(()=>[...document.querySelectorAll('.garden-companion-options button span')].map(x=>x.textContent));assert.deepEqual(names,['橘寶','布丁','蹦蹦']);assert.deepEqual(errors,[]);
 fs.writeFileSync(out+'/replay-loading-report.json',JSON.stringify({passed:true,rows,names,errors},null,2));console.log('PASS replay during load and names');
 // Leave this isolated local preview playing, with no artificial fault enabled.
 await p.evaluate(()=>document.querySelector('[data-scene]>iframe').contentWindow.__gardenScene.play());
}finally{await b.disconnect()}})().catch(e=>{console.error(e.stack);process.exitCode=1});
