// 本機教師審閱包驗收，經註冊的AI工作瀏覽器租約執行。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {connectCdp}=require('D:/projects/cdp-tools/packages/cdp-safe-client'),puppeteer=require('D:/projects/cdp-tools/node_modules/puppeteer-core');
const root=path.resolve(__dirname,'../output/past-exams-review-20261030'),data=JSON.parse(fs.readFileSync(path.join(root,'review-data-claude.private.json'),'utf8')),targetId=process.argv[2];
(async()=>{
 const all=await(await fetch(process.env.CDP_URL+'/json/list')).json(),target=all.find(t=>t.id===targetId);assert(target);
 assert(new URL(target.url).hostname==='127.0.0.1');
 await require('../lib/past-browser-wake.cjs')(puppeteer,process.env.CDP_URL,target.id);
 const c=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl:target.url,puppeteer:{connect:o=>puppeteer.connect({...o,networkEnabled:false,protocolTimeout:30000,targetFilter:t=>['browser','tab'].includes(t.type())||t._targetId===target.id})}});
 const p=c.page,errors=[],key='past-exam-teacher-review:'+data.draftId;let ownsDraft=false;
 p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
 try{
  assert.equal(p.target()._targetId,targetId);await p.setViewport({width:1280,height:950});await p.reload({waitUntil:'domcontentloaded'});await p.waitForSelector('#P01');
  assert.deepEqual(await p.evaluate(()=>window.__reviewQA.data),data);
  assert.equal(await p.evaluate(k=>localStorage.getItem(k),key),null,'不可覆蓋已有的教師草稿');ownsDraft=true;
  const visible=()=>p.$$eval('.card:not(.hidden)',a=>a.length);
  assert.equal(await visible(),11);assert.equal((await p.evaluate(()=>window.__reviewQA.exportData())).decisions.length,0);
  await p.click('#P01 [data-accept]');
  let saved=await p.evaluate(()=>({json:window.__reviewQA.exportData(),md:window.__reviewQA.markdown()}));
  assert.equal(saved.json.decisions.length,1);assert.equal(saved.json.decisions[0].id,'P01');assert(saved.json.decisions[0].note.includes('ㄌㄨㄢˋ'));assert(saved.md.includes('官方原記號'));
  await p.reload({waitUntil:'domcontentloaded'});assert.equal(await p.$eval('#note-P01',n=>n.value),saved.json.decisions[0].note);
  assert((await p.$eval('#draftStatus',n=>n.textContent)).includes('已讀回'));
  await p.select('#status-P01','尚未確認');await p.$eval('#note-P01',n=>{n.value='';n.dispatchEvent(new Event('input',{bubbles:true}));});
  await p.select('#year','114-1');assert.equal(await visible(),3);await p.select('#subject','數學');assert.equal(await visible(),2);await p.type('#search','4069');assert.equal(await visible(),1);await p.click('#resetFilters');
  // 實際原頁圖載入、旋轉，以及桌機／手機水平溢出。
  await p.$eval('#P01 .view-page',n=>{n.closest('details').open=true;n.scrollIntoView({block:'center'});});await p.click('#P01 .view-page');
  await p.waitForFunction(()=>document.querySelector('#zoomImage').naturalWidth>0);await p.click('#rotate');assert((await p.$eval('#zoomImage',n=>n.style.transform)).includes('rotate(90deg)'));await p.click('#closeZoom');
  await p.evaluate(()=>{document.querySelector('#P01 .view-page').closest('details').open=false;scrollTo(0,0);});
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.screenshot({path:path.join(root,'review-claude-desktop.png')});
  for(const width of [390,360]){await p.setViewport({width,height:900,isMobile:true,hasTouch:true});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  await new Promise(r=>setTimeout(r,11000));await p.screenshot({path:path.join(root,'review-claude-mobile.png')});
  for(const category of ['明確答案建議','需確認處理方式','建議維持現況','缺稿先暫停']){await p.$eval(`[data-tab="${category}"]`,n=>n.click());assert.equal(await visible(),data.cards.filter(c=>c.category===category).length);}
  const paths=new Set();for(const card of data.cards){for(const page of card.pages){paths.add(page.image);paths.add(page.pdf.split('#')[0]);}for(const g of card.questions){for(const v of g.images)paths.add(v.image);for(const choice of g.choices)for(const v of choice.images)paths.add(v);}for(const v of card.claudeReview.viewedEvidence)paths.add(v);}
  for(const file of paths)assert(fs.statSync(path.join(root,file)).size>0,file);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(root,'qa-claude-results.private.json'),JSON.stringify({passed:true,cards:37,explicitApprovalOnly:true,draftReload:true,export:true,rotation:true,widths:[1280,390,360],referencedFiles:paths.size,errors},null,2));
 }finally{
  if(ownsDraft)await p.evaluate(k=>{localStorage.removeItem(k);window.__reviewQA.decisions.clear();},key).catch(()=>{});
  await p.close().catch(()=>{});await c.disconnect();
 }
 console.log('Claude review browser QA passed.');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
