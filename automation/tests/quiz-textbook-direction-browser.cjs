// Actual entrypoints, isolated synthetic snapshots; only book IDs are substituted to exercise reviewed settings.
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('D:/projects/browser-automation-workflow/node_modules/playwright');
const base=process.env.QUIZ_STUDY_PREVIEW_ORIGIN||'http://localhost:8944',out=process.env.TEXTBOOK_DIRECTION_EVIDENCE||'.chat-mode/textbook-direction';fs.mkdirSync(out,{recursive:true});
const books={3:'c26493b9-ec9f-5f17-91af-99dc2d88a508',6:'c29f895f-17e1-59eb-b81e-49e58d2210f4'},checks=[],errors=[],external=[],networkFailures=[];let bookId,shotAt=0,page;
const check=(name,ok)=>{checks.push({name,ok:!!ok});if(!ok)throw Error(name);};
const save=x=>fs.writeFileSync(path.join(out,'direction-browser.private.json'),JSON.stringify(x,null,2));
(async()=>{try{
 const b=await chromium.connectOverCDP(process.env.CDP_URL);page=b.contexts()[0].pages()[0];if(new URL(page.url()).origin!==base)throw Error('exact leased preview page required');
 const c=await page.context().newCDPSession(page);try{c.grantForegroundOnce('Page.bringToFront','驗證國語課本左右翻頁與滑鼠閱讀位置');await c.send('Page.bringToFront');}finally{await c.detach();}
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(base+'/'))external.push(r.url());});await page.route('https://**/*',r=>r.abort());
 page.on('requestfailed',r=>networkFailures.push({url:r.url(),error:r.failure()}));page.on('console',m=>{if(m.type()==='error')networkFailures.push({console:m.text()});});
 await page.route('**/__workshop-rpc',async route=>{const response=await route.fetch(),d=await response.json();if(d.study){for(const p of d.study.pages)p.bookId=bookId;for(const ref of Object.values(d.study.references))ref.bookId=bookId;}await route.fulfill({response,json:d});});
 const wait=fn=>page.waitForFunction(fn,null,{polling:100,timeout:15000}),click=s=>page.locator(s).first().evaluate(n=>n.click());
 const ready=()=>wait(()=>document.querySelector('#lightbox.is-textbook:not(.hidden)')&&document.querySelector('#lightbox-img').style.visibility!=='hidden'&&!document.querySelector('.qtb-reading-status').textContent.includes('正在'));
 const open=async()=>{await click('.qtb-entry');await ready();},scale=()=>page.locator('#lightbox-scale').innerText(),value=()=>page.locator('.qtb-page-nav select').inputValue();
 const select=async p=>{await page.locator('.qtb-page-nav select').selectOption(p);await ready();};
 const nav=label=>page.getByRole('button',{name:label,exact:true}).evaluate(n=>n.click());
 const state=()=>page.evaluate(()=>({scale:document.querySelector('#lightbox-scale').textContent,transform:document.querySelector('#lightbox-img').style.transform}));
 for(const width of [1280,390])for(const grade of [3,6])for(const mode of ['quiz','past-exam']){
  bookId=books[grade];await page.setViewportSize({width,height:844});const p=width+' '+grade+' '+mode+' ';
  const q=new URLSearchParams({preview:'direction-'+Date.now(),preview_user:'a',preview_study:'1'});if(mode==='quiz'){q.set('cloud','1');q.set('session','00000000-0000-4000-8000-000000000001');}else q.set('paper','synthetic');
  await page.goto(base+'/grade'+grade+'/115-1/'+mode+'.html?'+q);await wait(()=>document.querySelector('.qtb-entry'));
  await click('input[type=radio]');await page.evaluate(()=>document.querySelector('#server-quiz,#past-exam').dataset.subject='國語');await open();
  const layout=await page.locator('.qtb-page-nav').evaluate(e=>({direction:e.dataset.readingDirection,buttons:[...e.querySelectorAll('button')].map(n=>({label:n.getAttribute('aria-label'),text:n.textContent,x:n.getBoundingClientRect().x}))}));
  check(p+'左下一頁／右上一頁',layout.direction==='rtl'&&layout.buttons[0].label==='下一頁'&&layout.buttons[0].text==='‹'&&layout.buttons[1].label==='上一頁'&&layout.buttons[1].text==='›'&&layout.buttons[0].x<layout.buttons[1].x);
  check(p+'首次80%',await scale()==='80%');
  await select('75');await nav('下一頁');await ready();check(p+'下一頁按頁碼遞增且保留79–80拉頁',await value()==='79'&&(await page.locator('.qtb-page-nav select option:checked').innerText()).includes('79–80'));
  await nav('上一頁');await ready();check(p+'上一頁按頁碼遞減',await value()==='75');
  await select('4');check(p+'首頁上一頁停用',await page.getByRole('button',{name:'上一頁',exact:true}).isDisabled());
  await select('115');check(p+'末頁下一頁停用',await page.getByRole('button',{name:'下一頁',exact:true}).isDisabled());
  await select('75');await click('#lightbox-zoom-in');await click('#lightbox-zoom-in');const box=await page.locator('#lightbox-stage').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+25,y-70,{steps:4});await page.mouse.up();const memory=await state();
  await nav('下一頁');await ready();await nav('上一頁');await ready();check(p+'翻回保留倍率和平移',JSON.stringify(await state())===JSON.stringify(memory));
  await click('#lightbox-close');check(p+'選答保留',await page.locator('input:checked').count()===1);await open();check(p+'重開保留倍率和平移',JSON.stringify(await state())===JSON.stringify(memory));
  await click('#lightbox-reset');check(p+'適合寬度100%',await scale()==='100%');for(let i=0;i<12;i++)await click('#lightbox-zoom-out');check(p+'最小20%',await scale()==='20%');
  await click('#lightbox-reset');await click('#lightbox-zoom-out');await click('#lightbox-zoom-out');
  if(grade===6&&mode==='past-exam'){await new Promise(r=>setTimeout(r,Math.max(0,10000-(Date.now()-shotAt))));await page.screenshot({path:path.join(out,'rtl-'+width+'.png')});shotAt=Date.now();}
  await click('#lightbox-close');await page.evaluate(()=>window.fixtureSwitch(null));await wait(()=>!document.querySelector('#lightbox-img').hasAttribute('src'));check(p+'登出清圖',true);
 }
 // Unknown book shown under a 國語 subject must keep its own default LTR; subject never determines binding.
 bookId='00000000-0000-4000-8000-000000000099';await page.goto(base+'/grade6/115-1/quiz.html?preview=direction-unknown&preview_user=a&preview_study=1&cloud=1&session=00000000-0000-4000-8000-000000000001');await wait(()=>document.querySelector('.qtb-entry'));await page.evaluate(()=>document.querySelector('#server-quiz,#past-exam').dataset.subject='國語');await open();
 check('未登記教材不因國語名稱翻轉',await page.locator('.qtb-page-nav').evaluate(n=>n.dataset.readingDirection==='ltr'&&n.querySelector('button').getAttribute('aria-label')==='上一頁'));
 check('沒有JavaScript錯誤',!errors.length);check('沒有正式後端請求',!external.some(u=>/supabase|workers\.dev/.test(u)));
 save({passed:true,count:checks.length,checks,errors,blockedExternal:external,limitations:['原答題入口及共用閱讀器；合成登入、頁碼與圖片，測試替換為已核教材ID，不讀寫正式學生資料。']});console.log(JSON.stringify({passed:true,count:checks.length}));
 }catch(e){save({passed:false,checks,errors,networkFailures,error:e.message,diagnostic:page?await page.locator('body').innerText().catch(()=>null):null});throw e;}
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
