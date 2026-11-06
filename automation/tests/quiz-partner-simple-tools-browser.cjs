// Synthetic-only UI regression. Exact leased target; no real auth or data writes.
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const puppeteer=require('D:/projects/cdp-tools/node_modules/puppeteer-core');
const root=path.resolve(__dirname,'../..'),origin='http://127.0.0.1:4491',out=path.join(root,'.chat-mode/evidence/compact-header');
const server=http.createServer(async(req,res)=>{try{let name=new URL(req.url,origin).pathname;if(name==='/')name='/automation/fixtures/partner-focused.html';if(req.method!=='GET'||!/^\/(shared\/|automation\/fixtures\/partner-focused\.)/.test(name)||name.includes('..'))throw Error();const f=path.resolve(root,'.'+name);if(!f.startsWith(root+path.sep))throw Error();const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png'};res.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'});res.end(await fs.readFile(f));}catch{res.writeHead(404);res.end();}});
console.log('simple_tools_worker_started');
(async()=>{await fs.mkdir(out,{recursive:true});console.log('evidence_ready');await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(4491,'127.0.0.1',resolve);});console.log('preview_listening');const b=await puppeteer.connect({browserURL:process.env.AI_WORK_BROWSER_CDP_URL,defaultViewport:null,protocolTimeout:30000}),t=b.targets().find(t=>t._targetId===process.env.AI_WORK_BROWSER_TARGET_ID);assert(t,'exact_target_required');console.log('leased_browser_ready');const p=await t.page(),checks=[],errors=[];
const check=(name,ok)=>{assert(ok,name);checks.push(name);console.log(name);};const click=s=>p.$eval(s,e=>e.click());const wait=fn=>p.waitForFunction(fn,{polling:5000,timeout:15000});
try{
 p.on('pageerror',e=>errors.push(e.message));await p.setRequestInterception(true);p.on('request',r=>new URL(r.url()).origin===origin||r.url().startsWith('data:')?r.continue():r.abort());
 const c=await p.target().createCDPSession();c.grantForegroundOnce('Page.bringToFront','驗證簡化請教與標記介面的桌機手機操作');await c.send('Page.bringToFront');
 await p.setViewport({width:1366,height:900});await p.goto(origin,{waitUntil:'domcontentloaded'});await wait(()=>window.qa&&document.querySelector('[data-toggle-mark]'));
 await p.evaluate(()=>{qa.state.paperInfo.title='三上國語：第一課　字的小旅行（10題）';qa.render();});
 for(const width of [1920,1366,1024,390]){
  await p.setViewport({width,height:900});
  const h=await p.evaluate(()=>{const bar=document.querySelector('.focus-team-bar'),b=bar.getBoundingClientRect(),q=document.querySelector('.partner-workspace-question').getBoundingClientRect(),menu=bar.querySelector('.focus-team-info').getBoundingClientRect();return{height:b.height,gap:q.top-b.bottom,menuAtRight:menu.right>b.right-2,questionInBar:!!bar.querySelector('#focus-question-heading'),noOverflow:document.documentElement.scrollWidth<=innerWidth+1};});
  check(width+' 上方資訊不再堆成四列',h.height<=(width>=1000?78:120)&&h.questionInBar);check(width+' 題目貼近資訊列且用滿橫向空間',h.gap<=20&&h.menuAtRight&&h.noOverflow);
  if(width===1920||width===390)await p.screenshot({path:path.join(out,'header-'+width+'.png'),fullPage:true});
 }
 await p.setViewport({width:1366,height:900});
 await click('.focus-team-info>summary');
 check('小隊選單展開不推低題目',await p.evaluate(()=>{const bar=document.querySelector('.focus-team-bar').getBoundingClientRect(),q=document.querySelector('.partner-workspace-question').getBoundingClientRect(),body=document.querySelector('.focus-team-info-body');return q.top-bar.bottom<=20&&getComputedStyle(body).position==='absolute'&&body.getBoundingClientRect().right<=innerWidth;}));
 await click('.focus-team-info>summary');
 check('保留原本左右答題工作區',await p.$eval('[data-focus-content]',e=>e.classList.contains('workspace-desktop')));
 check('預設只顯示兩個支援操作',await p.$eval('.question-support-actions',e=>e.children.length===2&&e.textContent.includes('問夥伴')&&e.textContent.includes('這題不能只有我知道')));
 check('標記表單預設收起且無雙重摺疊標題',await p.evaluate(()=>!document.getElementById('mark-panel-101').open&&!document.querySelector('details.question-extras')&&document.getElementById('mark-panel-101').querySelector('summary').hidden));
 await click('[data-toggle-mark="101"]');check('展開狀態可被輔助技術辨識',await p.$eval('[data-toggle-mark="101"]',e=>e.getAttribute('aria-expanded')==='true'));
 check('完整表單位於兩按鈕下方',await p.evaluate(()=>{const a=document.querySelector('.question-support-actions').getBoundingClientRect(),b=document.getElementById('mark-panel-101').getBoundingClientRect();return b.top>=a.bottom&&b.width>=a.width-2;}));
 check('四個簡短理由且有預設選擇',await p.$eval('.mark-reasons',e=>e.querySelectorAll('input[type=radio]').length===4&&e.querySelector('input[value=hard]').checked));
 await click('.mark-reasons input[value=interesting]');await p.$eval('[data-draft="mark-101"]',e=>{e.value='這題的圖很有意思';e.dispatchEvent(new Event('input',{bubbles:true}));});
 await p.evaluate(()=>{window.markField=document.querySelector('[data-draft="mark-101"]');qa.note();});check('隊友更新保留標記輸入與DOM',await p.evaluate(()=>markField===document.querySelector('[data-draft="mark-101"]')&&markField.value==='這題的圖很有意思'&&document.getElementById('mark-panel-101').open));
 await click('[data-close-mark="101"]');check('收起不送出且保留草稿',await p.evaluate(()=>!document.getElementById('mark-panel-101').open&&qa.actions.length===0&&document.querySelector('[data-draft="mark-101"]').value==='這題的圖很有意思'));
 await click('[data-toggle-mark="101"]');check('重新展開保留選擇與文字',await p.$eval('.mark-reasons input[value=interesting]',e=>e.checked));
 await click('[data-normal-choices="101"] input[value="0"]');await click('.quiz-workspace-dock [data-save-exit]');await wait(()=>document.querySelector('[data-save-only]'));await click('[data-save-only]');await wait(()=>document.getElementById('resume-fixture'));await click('#resume-fixture');
 check('儲存接續還原標記展開與草稿',await p.evaluate(()=>document.getElementById('mark-panel-101').open&&document.querySelector('[data-draft="mark-101"]').value==='這題的圖很有意思'&&document.querySelector('.mark-reasons input[value=interesting]').checked));
 check('標記操作不影響未送出的答案',await p.$eval('[data-normal-choices="101"] input[value="0"]',e=>e.checked));
 await click('#mark-panel-101 form [type=submit]');await wait(()=>qa.actions.some(a=>a.action==='mark'));
 check('送出的標記契約與內容不變',await p.evaluate(()=>{const a=qa.actions.find(a=>a.action==='mark');return a.qid===101&&a.tag==='interesting'&&a.text==='這題的圖很有意思'&&qa.state.exercise.mine[0].attempts.length===0;}));
 check('成功後收起並顯示已標記',await p.evaluate(()=>!document.getElementById('mark-panel-101').open&&document.querySelector('[data-toggle-mark="101"]').textContent.includes('這題不能只有我知道')&&document.querySelector('[data-toggle-mark="101"]').title==='已加入共同回顧'));
 await click('[data-ask-q="101"]');check('問夥伴直接開啟正確題目的營地',await p.evaluate(()=>document.getElementById('camp-dialog').open&&document.querySelector('form[data-form=ask]')?.dataset.qid==='101'));await click('[data-camp-close]');await wait(()=>!document.getElementById('camp-dialog').open);
 await click('[data-workspace-primary]');await wait(()=>qa.state.exercise.mine[0].attempts.length===1);check('原本固定送答仍只送一份答案',await p.evaluate(()=>qa.actions.filter(a=>a.action==='answer'&&a.qid===101).length===1));
 await click('[data-workspace-primary]');await click('[data-toggle-mark="102"]');await p.evaluate(()=>qa.mode('offline'));await p.$eval('[data-draft="mark-102"]',e=>{e.value='離線先保留';e.dispatchEvent(new Event('input',{bubbles:true}));});await click('#mark-panel-102 form [type=submit]');check('儲存失敗保留表單與文字',await p.evaluate(()=>document.getElementById('mark-panel-102').open&&document.querySelector('[data-draft="mark-102"]').value==='離線先保留'));
 await p.evaluate(()=>{qa.mode('normal');qa.ui.setTransport({pending:false,busy:false,bad:false,message:''});document.querySelector('#status').textContent='';});
 for(const width of [1366,390]){await p.setViewport({width,height:900});await p.evaluate(()=>qa.ui.setTransport({pending:false,busy:false}));const r=await p.evaluate(()=>{const a=document.querySelector('.question-support-actions').getBoundingClientRect(),b=document.getElementById('mark-panel-102').getBoundingClientRect();return{below:b.top>=a.bottom,wide:b.width>=a.width-2,noOverflow:document.documentElement.scrollWidth<=innerWidth+1};});check(width+' 標記區全寬且無水平溢出',r.below&&r.wide&&r.noOverflow);await p.screenshot({path:path.join(out,'tools-'+width+'.png'),fullPage:true});}
 await p.evaluate(()=>{qa.reset();qa.ui.setTransport({pending:false,busy:false,bad:false,message:''});});
 await p.$eval('[data-unit-select]',e=>{e.value='201';e.dispatchEvent(new Event('change',{bubbles:true}));});
 check('考古題組各小題有清楚且獨立的支援操作',await p.$$eval('[data-toggle-mark]',es=>es.length===2&&es[0].dataset.toggleMark==='201'&&es[1].dataset.toggleMark==='202'));
 await click('[data-toggle-mark="201"]');await click('[data-toggle-mark="202"]');await click('#mark-panel-201 input[value=method]');
 check('多小題的標記理由不會互相取消',await p.evaluate(()=>document.querySelector('#mark-panel-201 input[value=method]').checked&&document.querySelector('#mark-panel-202 input[value=hard]').checked));
 await click('#mark-panel-201 form [type=submit]');check('只標記指定小題並保留其他展開區',await p.evaluate(()=>qa.actions.at(-1).qid===201&&qa.actions.at(-1).tag==='method'&&document.getElementById('mark-panel-202').open&&document.querySelectorAll('form[data-form=answer]').length===2));
 await p.evaluate(()=>{qa.reset();qa.showAllReview();});await click('[data-workspace-primary]');
 check('共同回顧的小隊說明維持正常文件流',await p.evaluate(()=>document.querySelector('form[data-form=review]')&&getComputedStyle(document.querySelector('.focus-team-info-body')).position==='static'&&!document.querySelector('.focus-team-bar>.focus-question-position')));
 await click('.learning-tabs [data-view=practice]');check('回到答題仍只有一份題次標題',await p.$$eval('#focus-question-heading',es=>es.length===1&&es[0].closest('.focus-team-bar')));
 check('無瀏覽器例外',errors.length===0);await fs.writeFile(path.join(out,'browser.json'),JSON.stringify({passed:checks.length,checks,errors},null,2));console.log(JSON.stringify({passed:checks.length,checks,errors}));
}catch(e){await fs.writeFile(path.join(out,'failure.json'),JSON.stringify({error:e.message,checks,errors},null,2));throw e;}finally{await p.close();await b.disconnect();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
