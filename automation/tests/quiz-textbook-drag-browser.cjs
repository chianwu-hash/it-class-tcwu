// Leased AI Work Browser only; actual entrypoints, synthetic auth and textbook.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {chromium}=require('D:/projects/browser-automation-workflow/node_modules/playwright');
const base=process.env.QUIZ_STUDY_PREVIEW_ORIGIN||'http://localhost:18976',out=process.env.TEXTBOOK_DRAG_EVIDENCE;
if(!out)throw Error('Set TEXTBOOK_DRAG_EVIDENCE to a private evidence directory');
fs.mkdirSync(out,{recursive:true});
const baseline=process.argv.includes('--baseline');
(async()=>{const browser=await chromium.connectOverCDP(process.env.CDP_URL);const checks=[],errors=[];
 try{
  const page=browser.contexts()[0].pages()[0];assert.equal(new URL(page.url()).origin,base);
  const session=await page.context().newCDPSession(page);session.grantForegroundOnce('Page.bringToFront','實測課本滑鼠拖曳，確認不進入原生圖片拖放');await session.send('Page.bringToFront');await session.detach();
  page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());
  if(baseline){const source=execFileSync('git',['show','50e4c676:shared/image-lightbox.js'],{encoding:'utf8'});await page.route('**/shared/image-lightbox.js*',r=>r.fulfill({contentType:'text/javascript',body:source}));}
  const click=selector=>page.locator(selector).first().evaluate(n=>n.click());
  const state=()=>page.evaluate(()=>document.querySelector('#lightbox-img').style.transform);
  const ready=()=>page.waitForFunction(()=>document.querySelector('#lightbox.is-textbook:not(.hidden)')&&document.querySelector('#lightbox-img').style.visibility!=='hidden'&&!document.querySelector('.qtb-reading-status')?.textContent.includes('正在'));
  for(const width of baseline?[1280]:[1280,390])for(const mode of baseline?['quiz']:['quiz','past-exam']){
   await page.setViewportSize({width,height:900});const query=new URLSearchParams({preview:'drag-'+Date.now(),preview_user:'a',preview_study:'1',cloud:'1',session:'00000000-0000-4000-8000-000000000001',paper:'synthetic'});
   await page.goto(base+'/grade6/115-1/'+mode+'.html?'+query);await page.locator('.qtb-entry').first().waitFor();await click('input[type=radio]');await click('.qtb-entry');await ready();
   const image=page.locator('#lightbox-img'),stage=page.locator('#lightbox-stage');
   await page.evaluate(()=>{window.nativeDrags=0;document.querySelector('#lightbox-stage').addEventListener('dragstart',()=>window.nativeDrags++);});
   const beforeDrag=await state();
   const box=await stage.boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
   const drag=async()=>{await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-30,y-110,{steps:10});await page.mouse.up();};
   await drag();assert.notEqual(await state(),beforeDrag);checks.push({width,mode,test:'80% real mouse pan'});
   await click('#lightbox-reset');const fullWidth=await state();await drag();assert.notEqual(await state(),fullWidth);checks.push({width,mode,test:'100% real mouse pan'});
   // Reproduce a browser/add-on making the image draggable despite its initial
   // markup/CSS. The component must still own the gesture at event level.
   await image.evaluate(n=>{n.draggable=true;n.style.pointerEvents='auto';n.style.webkitUserDrag='element';});
   await page.evaluate(()=>window.nativeDrags=0);await click('#lightbox-reset');const start=await state();await drag();const native=await page.evaluate(()=>window.nativeDrags),moved=(await state())!==start;
   if(baseline){assert(native>0);checks.push({width,mode,test:'baseline native image drag reproduced',native,moved});continue;}
   assert.equal(native,0);assert(moved);checks.push({width,mode,test:'draggable image cannot steal gesture',native,moved});
   const canceled=await stage.evaluate(n=>!n.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true})));assert(canceled);
   const prior=await state();await stage.evaluate(n=>n.addEventListener('contextmenu',e=>e.preventDefault(),{once:true}));await page.mouse.move(x,y);await page.mouse.down({button:'right'});await page.mouse.move(x+30,y+30,{steps:3});await page.mouse.up({button:'right'});assert.equal(await state(),prior);
   await image.evaluate(n=>{n.draggable=false;n.style.pointerEvents='';n.style.webkitUserDrag='';});
   const remembered=await state(),pageNumber=await page.locator('.qtb-page-nav select').inputValue();await page.locator('.qtb-page-nav select').selectOption('79');await ready();await page.locator('.qtb-page-nav select').selectOption(pageNumber);await ready();assert.equal(await state(),remembered);
   await click('#lightbox-close');assert.equal(await page.locator('input:checked').count(),1);await click('.qtb-entry');await ready();assert.equal(await state(),remembered);checks.push({width,mode,test:'page and reopen preserve position and answer'});
   await click('#lightbox-reset');await click('#lightbox-zoom-out');await click('#lightbox-zoom-out');await page.mouse.dblclick(x,y);assert.equal(await page.locator('#lightbox-scale').innerText(),'220%');checks.push({width,mode,test:'trusted double click still zooms'});
   await stage.evaluate(n=>n.addEventListener('pointerdown',e=>window.lastPointer=e.pointerId,{once:true}));await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+15,y+15,{steps:3});
   const captured=await state();await stage.evaluate(n=>n.releasePointerCapture(window.lastPointer));await page.mouse.move(x+40,y+40,{steps:3});await page.mouse.up();assert.equal(await state(),captured);checks.push({width,mode,test:'lost capture stops pan without stuck gesture'});
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,baseline?'drag-baseline.private.json':'drag-after.private.json'),JSON.stringify({passed:true,checks,errors,syntheticOnly:true},null,2));console.log(JSON.stringify({passed:true,baseline,checks:checks.length}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1});
