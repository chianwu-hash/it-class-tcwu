// Run through the leased shared browser against quiz-workshop-preview.mjs.
// Uses actual entrypoints with synthetic auth/media; never sends production answers.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('D:/projects/browser-automation-workflow/node_modules/playwright');
const base=process.env.QUIZ_STUDY_PREVIEW_ORIGIN||'http://localhost:8940';
const out=process.env.TEXTBOOK_ZOOM_EVIDENCE||'.chat-mode/textbook-zoom';fs.mkdirSync(out,{recursive:true});
const before=process.argv.includes('--before'),checks=[],errors=[],external=[];
const check=(name,ok)=>{checks.push({name,ok:!!ok});if(!ok)throw Error(name);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let lastScreenshot=0;
const write=x=>fs.writeFileSync(path.join(out,(before?'before':'after')+'.private.json'),JSON.stringify(x,null,2));
(async()=>{let page;try{
 const browser=await chromium.connectOverCDP(process.env.CDP_URL);page=browser.contexts()[0].pages()[0];
 if(!page||new URL(page.url()).origin!==base)throw Error('exact leased preview target required');
 const focus=await page.context().newCDPSession(page);
 try{focus.grantForegroundOnce('Page.bringToFront','驗證課本燈箱實際滑鼠與雙指操作');await focus.send('Page.bringToFront');}finally{await focus.detach();}
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(base+'/'))external.push(r.url());});
 await page.route('https://**/*',r=>r.abort());
 const wait=fn=>page.waitForFunction(fn,null,{timeout:30000,polling:100}),click=s=>page.locator(s).first().evaluate(n=>n.click()),scale=async()=>Number((await page.locator('#lightbox-scale').innerText()).replace('%',''));
 const open=async()=>{await click('.qtb-entry');await wait(()=>document.querySelector('#lightbox.is-textbook:not(.hidden)')&&document.querySelector('#lightbox-img').style.visibility!=='hidden');};
 const state=()=>page.evaluate(()=>({scale:document.querySelector('#lightbox-scale').textContent,transform:document.querySelector('#lightbox-img').style.transform}));
 const ready=()=>wait(()=>document.querySelector('#lightbox-img').style.visibility!=='hidden'&&!document.querySelector('.qtb-reading-status').textContent.includes('正在'));
 const select=async value=>{await page.locator('.qtb-page-nav select').selectOption(value);await ready();};
 const screenshot=async name=>{await sleep(Math.max(0,10000-(Date.now()-lastScreenshot)));await page.screenshot({path:path.join(out,name+'.png')});lastScreenshot=Date.now();};
 for(const width of [1280,390])for(const mode of ['quiz','past-exam']){
  await page.setViewportSize({width,height:844});
  const q=new URLSearchParams({preview:'zoom-'+Date.now(),preview_user:'a',preview_study:'1'});
  if(mode==='quiz'){q.set('cloud','1');q.set('session','00000000-0000-4000-8000-000000000001');}else q.set('paper','synthetic');
  await page.goto(base+'/grade6/115-1/'+mode+'.html?'+q);await wait(()=>document.querySelector('.qtb-entry'));
  const prefix=width+' '+mode+' ';
  await click('input[type=radio]');const checked=await page.locator('input:checked').count();
  await open();const initial=await scale();
  if(before){checks.push({name:prefix+'observed initial scale',value:initial});for(let i=0;i<12;i++)await click('#lightbox-zoom-out');checks.push({name:prefix+'observed lower bound',value:await scale()});if(width===1280&&mode==='past-exam')await screenshot('before-past-desktop');continue;}
  check(prefix+'first open 80%',initial===80);
  check(prefix+'correct protected media route',await page.evaluate(kind=>window.workshopCalls.some(c=>c.route==='/functions/v1/quiz-media'&&c.body.action==='textbook'&&c.body.kind===kind),mode==='quiz'?'normal':'past'));
  const initialPage=await page.locator('.qtb-page-nav select').inputValue();
  const top=await page.evaluate(()=>document.querySelector('#lightbox-img').getBoundingClientRect().top-document.querySelector('#lightbox-stage').getBoundingClientRect().top);
  check(prefix+'80% starts near top',Math.abs(top-12)<2);
  for(let i=0;i<9;i++)await click('#lightbox-zoom-out');check(prefix+'buttons stop at 20%',await scale()===20);
  await click('#lightbox-reset');check(prefix+'fit width remains 100%',await scale()===100);
  await click('#lightbox-zoom-in');await click('#lightbox-zoom-in');check(prefix+'zoom step 10%',await scale()===120);
  const stage=await page.locator('#lightbox-stage').boundingBox(),x=stage.x+stage.width/2,y=stage.y+stage.height/2;
  const preDrag=await state();await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+35,y-90,{steps:5});await page.mouse.up();
  const remembered=await state();check(prefix+'real mouse pan',remembered.transform!==preDrag.transform);
  await select('79');check(prefix+'new spread starts 80%',await scale()===80);
  check(prefix+'full 79–80 spread',await page.locator('#lightbox-img').evaluate(n=>n.naturalWidth===1640)&&(await page.locator('.qtb-page-nav select option:checked').innerText()).includes('79–80'));
  await page.getByRole('button',{name:'下一頁',exact:true}).evaluate(n=>n.click());await ready();check(prefix+'next page',await page.locator('.qtb-page-nav select').inputValue()==='81');
  await page.getByRole('button',{name:'上一頁',exact:true}).evaluate(n=>n.click());await ready();check(prefix+'previous page restores spread',await page.locator('.qtb-page-nav select').inputValue()==='79');
  await select(initialPage);check(prefix+'return restores scale and pan',JSON.stringify(await state())===JSON.stringify(remembered));
  await click('#lightbox-close');check(prefix+'answer selection retained',await page.locator('input:checked').count()===checked);
  await open();check(prefix+'reopen restores scale and pan',JSON.stringify(await state())===JSON.stringify(remembered));
  await select('79');check(prefix+'spread memory retained',await scale()===80);
  if(mode==='past-exam')await screenshot('after-past-'+width+'-80');
  await page.mouse.move(x,y);for(let i=0;i<6;i++)await page.mouse.wheel(0,200);check(prefix+'wheel minimum 20%',await scale()===20);
  await click('#lightbox-reset');await click('#lightbox-zoom-out');await click('#lightbox-zoom-out');
  const cdp=await page.context().newCDPSession(page);
  try{
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-70,y,id:1},{x:x+70,y,id:2}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-2,y,id:1},{x:x+2,y,id:2}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }finally{await cdp.detach();}
  check(prefix+'trusted touch pinch minimum 20%',await scale()===20);
  await page.keyboard.press('Escape');check(prefix+'Escape closes reader',await page.locator('#lightbox').evaluate(n=>n.classList.contains('hidden')));
  check(prefix+'focus restored',await page.locator('.qtb-entry').evaluate(n=>n===document.activeElement));
  await page.evaluate(()=>window.fixtureSwitch(null));await wait(()=>!document.querySelector('#lightbox-img').hasAttribute('src'));
  check(prefix+'logout clears image',true);
 }
 if(!before){
  // First initialization must not dictate later textbook settings, and textbook options must not leak back to ordinary images.
  const result=await page.evaluate(async()=>{const {initImageLightbox}=await import('/shared/image-lightbox.js');const box=initImageLightbox();await box.open('/__workshop-image.svg','一般題圖');const start=box.getState().scale;document.querySelector('#lightbox-zoom-out').click();const min=box.getState().scale;box.close();return{start,min};});
  check('ordinary past image defaults unchanged',result.start===1&&result.min===1);
  check('no JavaScript errors',!errors.length);check('no production backend calls',!external.some(u=>/supabase|workers\.dev/.test(u)));
 }
 write({passed:true,count:checks.length,checks,errors,blockedExternal:external,limitations:['實際答題入口與共享元件，登入與教材為本機合成資料；不代表真人OAuth端到端驗證。']});console.log(JSON.stringify({passed:true,count:checks.length,before}));
 }catch(e){write({passed:false,checks,errors,error:e.message,diagnostic:page?await page.locator('body').innerText().catch(()=>null):null});throw e;}
 // The guarded runner disconnects and releases its own connection; launcher cleans the registered page.
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
