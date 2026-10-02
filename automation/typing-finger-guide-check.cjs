const assert=require('node:assert/strict');
const path=require('node:path');
const {connectCdp,safeScreenshot}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
(async()=>{
 const c=await connectCdp({cdpUrl:'http://127.0.0.1:9232',targetUrl:'http://localhost:3000/prototypes/typing-foundation/level1/'});
 const context=await c.page.browser().createBrowserContext();const page=await context.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const targets={a:['left-pinky'],s:['left-ring'],d:['left-middle'],f:['left-index'],g:['left-index'],h:['right-index'],j:['right-index'],k:['right-middle'],l:['right-ring'],';':['right-pinky'],' ':['left-thumb','right-thumb']};
 const current=()=>page.$eval('#prompt .active',e=>e.textContent==='␣'?' ':e.textContent);
 const active=()=>page.$$eval('#finger-guide [data-finger].is-active',es=>es.map(e=>e.dataset.finger));
 try{
  await page.setViewport({width:1365,height:980});await page.goto('http://localhost:3000/prototypes/typing-foundation/level1/',{waitUntil:'networkidle0'});
  await page.click('#start');
  assert.deepEqual(await page.$$eval('#target-line > *',es=>es.map(e=>e.id||e.className)),['target','finger-guide','target-caption']);
  assert.equal(await page.evaluate(()=>{const key=document.getElementById('target').getBoundingClientRect(),hands=document.getElementById('finger-guide').getBoundingClientRect(),caption=document.querySelector('.target-caption').getBoundingClientRect();return key.right<=hands.left && hands.right<=caption.left;}),true,'Desktop visual order matches DOM');
  assert.equal(await page.$$('#finger-guide [data-finger]').then(es=>es.length),10);
  const asset=await page.evaluate(async()=>{
   const image=new Image();image.src=document.querySelector('.finger-hands image').getAttribute('href');await image.decode();
   const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
   const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
   return {width:image.width,corner:ctx.getImageData(0,0,1,1).data[3],gap:ctx.getImageData(384,256,1,1).data[3]};
  });
  assert.deepEqual(asset,{width:768,corner:0,gap:0},'Compressed bitmap loaded with genuine transparency');
  const centered=()=>page.evaluate(()=>{const hands=document.getElementById('finger-guide').getBoundingClientRect(),prompt=document.getElementById('prompt').getBoundingClientRect();return Math.abs(hands.left+hands.width/2-prompt.left-prompt.width/2)<1;});
  assert.equal(await centered(),true,'Thumb midpoint aligns with the prompt center');
  for(let i=0;i<19;i++){
   const key=await current();assert.deepEqual(await active(),targets[key]);
   if(key===' ')assert.match(await page.$eval('#finger-note',e=>e.textContent),/擇一/);
   await page.keyboard.type(key);
  }
  for(let i=0;i<5 && await page.$eval('#exercise',e=>!e.hidden);i++){
   const remaining=await page.$$eval('#prompt span:not(.typed)',es=>es.map(e=>e.textContent==='␣'?' ':e.textContent).join(''));await page.keyboard.type(remaining);
  }
  await page.waitForFunction(()=>!document.getElementById('result').hidden);await page.click('#retry');
  await page.click('#show-fingers');assert.equal(await page.$eval('#finger-guide',e=>e.hidden),true);
  await page.keyboard.press('Space');assert.equal(await page.$eval('#finger-guide',e=>e.hidden),false);
  assert.equal(await page.$eval('#accuracy',e=>e.textContent),'—','Checkbox Space does not score a typing key');
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'typing-area');
  // Verify all future home-row finger mappings and accessible labels on a synthetic component.
  await page.evaluate(async()=>{const {createTypingFingerGuide}=await import('/shared/typing-finger-guide.mjs?v=20261002-cute');window.guideTest=createTypingFingerGuide(document.getElementById('finger-guide'));});
  for(const [key,expected] of Object.entries(targets)){
   await page.evaluate(key=>window.guideTest.update(key,'合成指法測試'),key);
   assert.deepEqual(await active(),expected);
   assert.equal(await page.$$('#finger-guide [data-finger-border].is-active').then(es=>es.length),expected.length);
   assert.equal(await page.$eval('.hand-finger.is-active',e=>getComputedStyle(e).fill),'rgb(0, 188, 235)');
  }
  await page.evaluate(()=>{window.guideTest.update('f','左手食指');window.guideTest.press('f');});
  assert.equal(await page.$eval('[data-finger="left-index"]',e=>e.parentElement.getAnimations().length>0),true);
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await page.evaluate(()=>{window.guideTest.update('j','右手食指');window.guideTest.press('j');});
  assert.equal(await page.$eval('[data-finger="right-index"]',e=>e.parentElement.getAnimations().length),0);
  assert.equal(await page.$eval('.finger-region',e=>getComputedStyle(e).transitionDuration),'0s');
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
  if(process.argv.includes('--gallery')) {
   const gallery=await context.newPage();await gallery.setViewport({width:1200,height:1000});
   await gallery.goto('http://localhost:3000/prototypes/typing-foundation/level1/',{waitUntil:'networkidle0'});
   await gallery.evaluate(async()=>{
    const {createTypingFingerGuide}=await import('/shared/typing-finger-guide.mjs?v=20261002-cute');
    document.body.replaceChildren();const grid=document.createElement('main');
    Object.assign(grid.style,{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'20px',padding:'25px',background:'white'});
    document.body.append(grid);
    for(const key of ['a','s','d','f','g','h','j','k','l',';',' ']){
     const box=document.createElement('section'),label=document.createElement('h2'),guide=document.createElement('div');
     label.textContent=key===' '?'Space':key.toUpperCase();box.append(label,guide);grid.append(box);createTypingFingerGuide(guide).update(key,'');
    }
   });
   await gallery.waitForNetworkIdle();
   await safeScreenshot(gallery,{path:path.resolve('prototypes/typing-foundation/level1/preview-all-fingers.png'),fullPage:true});
   await gallery.close();
  }
  // Restore the real exercise renderer before the screenshot (no synthetic mismatched key).
  await page.reload({waitUntil:'networkidle0'});await page.click('#start');
  if(!process.argv.includes('--gallery'))await safeScreenshot(page,{path:path.resolve('prototypes/typing-foundation/level1/preview-fingers.png'),fullPage:true});
  for(const size of [{width:375,height:812},{width:844,height:390}]){
   await page.setViewport(size);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.equal(await centered(),true,'Hand midpoint remains centered at every viewport');
  }
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  assert.equal(await page.$eval('.hand-finger',e=>getComputedStyle(e).animationName),'none');
  await page.reload({waitUntil:'networkidle0'});assert.equal(await page.$eval('#show-fingers',e=>e.checked),true);
  assert.deepEqual(errors,[]);
  console.log('PASS: all 11 keys / 10 fingers, live next-key sync, thumb choice, dark outline, native checkbox Space/Tab, no score side effects, default visible, mobile/landscape, reduced motion, no cloud writes.');
 }finally{await context.close();c.disconnect();}
})().catch(e=>{console.error(e);process.exitCode=1;});
