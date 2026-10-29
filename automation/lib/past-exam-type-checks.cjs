// 真前端操作；身分、媒體及資料庫由既有 localhost fixture 隔離。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
module.exports=async function({page:p,bundle,rpc,origin,out,errors}){
 const checks=[],screenshots=[],seenShots=new Set();let lastShot=0;
 const click=async selector=>{await p.$eval(selector,n=>n.scrollIntoView({block:'center'}));if(p.viewport().hasTouch)await p.tap(selector);else await p.click(selector);};
 async function shot(kind,width){if(kind==='single'||seenShots.has(kind+'-'+width))return;seenShots.add(kind+'-'+width);await p.$eval('.question-card',n=>n.scrollIntoView({block:'start'}));const delay=10000-(Date.now()-lastShot);if(delay>0)await new Promise(r=>setTimeout(r,delay));const name=kind+'-'+width+'.png';await p.screenshot({path:path.join(out,name),fullPage:true});lastShot=Date.now();screenshots.push(name);}
 async function submit(){await click('#submit');await p.waitForFunction(()=>document.querySelector('.local-saved')||document.querySelector('#status')?.textContent.includes('尚未確認'),{polling:100});if(!await p.$('.local-saved')){await click('#submit');await p.waitForSelector('.local-saved');}}
 for(const width of [1280,390]){
  await p.setViewport({width,height:900,isMobile:width<700,hasTouch:width<700,deviceScaleFactor:1});
  const started=await rpc('restart',{request_id:randomUUID()});assert.equal(started.status,200);
  const aid=started.data.attemptId;await p.goto(origin+'/grade3/115-1/past-exam.html?paper='+bundle.paperId+'&attempt='+aid,{waitUntil:'load'});await p.waitForSelector('.question-card');
  for(let i=0;i<bundle.document.groups.length;i++){
   const g=bundle.document.groups[i];await p.$eval('#steps',n=>n.closest('details').open=true);await click('.step:nth-child('+(i+1)+')');await p.waitForFunction(id=>document.querySelector('.question-card')?.dataset.groupId===id,{polling:100},g.id);await p.$eval('#steps',n=>n.closest('details').open=false);
   await p.$eval('.question-card',n=>n.scrollIntoView({block:'start'}));
   if(g.assets.length&&g.kind!=='annotation')await p.waitForFunction(()=>[...document.querySelectorAll('#workspace img')].every(n=>n.complete&&n.naturalWidth>0),{polling:100});
   const geometry=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,small:[...document.querySelectorAll('#workspace button,#workspace select,#workspace .choice-row')].filter(n=>!n.disabled&&n.getBoundingClientRect().height<43).map(n=>n.textContent),dock:{bottom:document.querySelector('.actions').getBoundingClientRect().bottom,height:innerHeight}}));
   assert.equal(geometry.overflow,false,g.id+' overflow '+width);assert.deepEqual(geometry.small,[],g.id+' small targets');assert.ok(Math.abs(geometry.dock.bottom-geometry.dock.height)<2);
   if(g.assets.length&&g.kind!=='annotation'){await click('.figure a');await p.waitForSelector('#lightbox:not(.hidden)',{visible:true});const before=await p.$eval('#lightbox-scale',n=>n.textContent);await click('#lightbox-zoom-in');assert.notEqual(await p.$eval('#lightbox-scale',n=>n.textContent),before);await click('#lightbox-close');await p.waitForSelector('#lightbox.hidden');}
   if(g.kind==='single'){await click('.choice-row:has(input[value="'+g.fields[0].answer+'"])');assert.equal(await p.$eval('input:checked',n=>n.value),g.fields[0].answer);}
   else if(g.kind==='mark'){
    await click('#submit');assert.ok(await p.$eval('#status',n=>n.textContent.includes('確認')));assert.ok(!await p.$('.local-saved'));
    for(const f of g.fields)if(f.answer)await click('.choice-row:has(input[data-field="'+f.id+'"])');
    assert.deepEqual(await p.$$eval('.answer-list input',nodes=>nodes.map(n=>n.checked)),g.fields.map(f=>f.answer));await click('.confirm');assert.equal(await p.$eval('#mark-confirm',n=>n.checked),true);
   }else if(g.kind==='sequence'){
    const order=g.fields[0].answer;for(let j=0;j<order.length;j++)await p.select('#order-'+j,order[j]);
    await click('.slot:nth-of-type(2) .order-line button:first-of-type');let moved=await p.$$eval('.order-line select',nodes=>nodes.map(n=>n.value));assert.deepEqual(moved,[order[1],order[0],...order.slice(2)]);
    await p.focus('.slot:nth-of-type(1) .order-line button:last-of-type');await p.keyboard.press('Enter');assert.deepEqual(await p.$$eval('.order-line select',nodes=>nodes.map(n=>n.value)),order);
   }else if(g.kind==='code'){for(let j=0;j<g.fields.length;j++)await p.select('#code-'+j,g.fields[j].answer);assert.deepEqual(await p.$$eval('.slot select',nodes=>nodes.map(n=>n.value)),g.fields.map(f=>f.answer));}
   else if(g.kind==='set'){
    for(let j=0;j<g.fields.length;j++){const f=g.fields[j];for(const code of f.answer)await click('.codes button[aria-label="第'+f.label+'欄代號'+code+'"]');const first='.codes button[aria-label="第'+f.label+'欄代號'+f.answer[0]+'"]';await click(first);assert.equal(await p.$eval(first,n=>n.getAttribute('aria-pressed')),'false');await click(first);}
    for(let j=0;j<g.fields.length;j++)assert.deepEqual((await p.$$eval('fieldset.slot:nth-of-type('+(j+1)+') button[aria-pressed=true]',ns=>ns.map(n=>n.textContent))).sort(),[...g.fields[j].answer].sort());
   }else if(g.kind==='annotation'){
    await p.waitForFunction(()=>document.querySelector('.drawing-board image')?.getAttribute('href'),{polling:100});assert.ok(!await p.$('.reference'));
    const board=async(x,y)=>{await p.$eval('.drawing-board',n=>n.scrollIntoView({block:'center'}));const b=await p.$eval('.drawing-board',n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});if(width<700)await p.touchscreen.tap(b.x+b.w*x,b.y+b.h*y);else await p.mouse.click(b.x+b.w*x,b.y+b.h*y);};
    await click('.drawing-tools button:nth-child(1)');await board(.4,.3);assert.equal(await p.$$eval('.drawing-board .dot',ns=>ns.length),1);
    await click('.drawing-tools button:nth-child(2)');await board(.4,.3);await board(.4,.6);assert.equal(await p.$$eval('.drawing-board .arrow',ns=>ns.length),1);
    await click('.drawing-tools button:nth-child(4)');assert.equal(await p.$$eval('.drawing-board .arrow',ns=>ns.length),0);await click('.direction-grid button:nth-child(8)');assert.equal(await p.$$eval('.drawing-board .arrow',ns=>ns.length),1);
    await click('.drawing-tools button:nth-child(3)');assert.equal(await p.$$eval('.drawing-board .dot,.drawing-board .arrow',ns=>ns.length),0);
    await click('.drawing-tools button:nth-child(1)');await p.$eval('.drawing-board',n=>n.focus());await p.keyboard.press('ArrowRight');await p.keyboard.press('Enter');await click('.direction-grid button:nth-child(8)');assert.equal(await p.$$eval('.drawing-board .dot,.drawing-board .arrow',ns=>ns.length),2);
   }
   await shot(g.kind,width);await submit();
   if(g.kind==='annotation'){await p.waitForFunction(()=>document.querySelector('.reference img')?.naturalWidth>0,{polling:100});const resumed=await rpc('resume',{attempt_id:aid});const result=resumed.data.records[g.id].results[0];assert.equal(result.correct,null);}
   checks.push({width,id:g.id,kind:g.kind,layout:true,interaction:true,submitted:true});fs.appendFileSync(path.join(out,'types-progress.jsonl'),JSON.stringify({at:new Date().toISOString(),width,id:g.id,kind:g.kind})+'\n');
  }
  const final=await rpc('resume',{attempt_id:aid});assert.equal(final.data.summary.score,92);assert.equal(final.data.practice.leafCount,1);assert.equal(final.data.practice.complete,true);
 }
 await p.setViewport({width:360,height:800,isMobile:true,hasTouch:true,deviceScaleFactor:1});await p.waitForSelector('.question-card');
 for(let i=29;i<bundle.document.groups.length;i++){await p.$eval('#steps',n=>n.closest('details').open=true);await click('.step:nth-child('+(i+1)+')');await p.waitForFunction(id=>document.querySelector('.question-card')?.dataset.groupId===id,{polling:100},bundle.document.groups[i].id);await p.$eval('#steps',n=>n.closest('details').open=false);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);checks.push({width:360,id:bundle.document.groups[i].id,kind:bundle.document.groups[i].kind,layout:true});}
 await p.evaluate(()=>window.__pastSession(null));await p.waitForFunction(()=>document.querySelector('#quiz-content').hidden,{polling:100});assert.equal(await p.$$eval('#past-exam img',ns=>ns.length),0);assert.deepEqual(errors,[]);
 const report={passed:true,source:origin,checks,screenshots,touch:'Chrome mobile emulation; not a physical device',automaticScore:92,leafCount:1,logoutClears:true,errors};fs.writeFileSync(path.join(out,'types-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,checks:checks.length,screenshots:screenshots.length}));
};
