// Task-owned leased browser; fixture auth only. Full per-character original/replay matrix.
const fs=require('node:fs'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),path=require('node:path');
const {connectCdp,safeScreenshot}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
const base='http://127.0.0.1:3143',url=base+'/grade3/115-1/week13.html?qa=guide',out=process.env.WEEK13_GUIDE_OUT||'.chat-mode/evidence/week13-guide';
const fixture=fs.readFileSync('automation/tests/grade3-week13-browser.cjs','utf8').match(/const fixture=`([\s\S]*?)`;/)[1].replaceAll('${base}',base);
(async()=>{
 fs.mkdirSync(out,{recursive:true});const {WEEK13_LEVELS:levels,getWeek13KeyboardTarget:target}=await import(pathToFileURL(path.resolve('grade3/115-1/week13-content.mjs')));
 const {buildKeyboardGuideModel:model}=await import(pathToFileURL(path.resolve('shared/typing-guide-model.mjs')));
 const c=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl:url}),p=c.page,errors=[],results=[];
 try{
  assert.equal(p.url(),url);c.session.grantForegroundOnce('Page.bringToFront','Verify native keyboard practice and per-character visible guide keys.');await c.session.send('Page.bringToFront');
  await p.setCacheEnabled(false);await p.setRequestInterception(true);p.on('pageerror',e=>errors.push(e.message));
  p.on('request',r=>{if(new URL(r.url()).pathname==='/shared/auth.js')return r.respond({contentType:'application/javascript',body:fixture});if(/supabase\.co/.test(r.url()))return r.abort();return r.continue();});
  await p.evaluateOnNewDocument(()=>{window.fixtureUser={user:{id:'synthetic-week13-guide',email:'synthetic@apps.ntpc.edu.tw'},access_token:'synthetic'};window.fixtureProgress={current_level:6,score:6,completed:true};window.fixtureVisibility=[];});
  await p.goto(url,{waitUntil:'networkidle2'});await p.waitForFunction(()=>document.querySelector('#input-level6').readOnly);
  await p.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';});
  // Native primary exercises: Shift, Tab forward/back, Enter and free clipboard.
  await p.click('#shift-practice');await p.keyboard.down('Shift');await p.keyboard.press('KeyA');await p.keyboard.up('Shift');await p.keyboard.type('!');
  assert.equal(await p.$eval('#shift-practice',e=>e.value),'A!');assert.match(await p.$eval('#shift-status',e=>e.textContent),/Shift/);
  await p.click('#tab-greeting');await p.keyboard.type('Hi!');await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.id),'tab-mood');
  await p.keyboard.type('happy');await p.keyboard.down('Shift');await p.keyboard.press('Tab');await p.keyboard.up('Shift');assert.equal(await p.evaluate(()=>document.activeElement.id),'tab-greeting');
  await p.keyboard.press('Tab');await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.id),'tab-wish');await p.keyboard.type('Hi');await p.keyboard.press('Enter');await p.keyboard.type('there');assert.equal(await p.$eval('#tab-wish',e=>e.value),'Hi\nthere');
  await p.keyboard.press('Tab');assert.notEqual(await p.evaluate(()=>document.activeElement.id),'tab-wish','Tab is not trapped');
  await p.$eval('#mood-practice',e=>{e.focus();e.value='開心😊';});assert.equal(await p.$eval('#mood-practice',e=>e.dispatchEvent(new Event('paste',{cancelable:true}))),true);
  for(const width of [1280,390]){
   await p.setViewport({width,height:950});await p.$eval('#input-level1',e=>e.focus());
   if(await p.$eval('#floating-kb-panel',e=>e.classList.contains('hidden')))await p.click('[data-typing-tool-toggle="keyboard"]');
   for(const variant of ['original','replay']){
    if(variant==='replay')for(let id=1;id<=6;id++)await p.$eval(`[data-replay="${id}"]`,e=>e.click());
    for(const l of levels.filter(l=>!process.env.WEEK13_GUIDE_BOSS_ONLY||l.id===6)){
     const answer=variant==='replay'?l.replay:l.ans;
     let offset=0;
     for(const [lineIndex,line]of answer.split('\n').entries()){
      await p.$eval('#input-level'+l.id,(e,v)=>{e.focus();e.value=v.answer;e.setSelectionRange(v.offset,v.offset);e.dispatchEvent(new KeyboardEvent('keyup',{bubbles:true,key:'ArrowDown'}));},{answer,offset});
      const t=target(line),m=model(typeof t==='string'?{lang:'en',text:t}:t);
      await p.waitForFunction(text=>[...document.querySelectorAll('#floating-kb-panel .kg-source')].map(e=>e.textContent).join('').replace(/\s+/g,'').includes(text.replace(/\s+/g,''))||!!document.querySelector('#floating-kb-panel [data-guide-all]:not([hidden])'),{},line);
      const all=await p.$('#floating-kb-panel [data-guide-all]:not([hidden])');if(all&&await all.evaluate(e=>e.getAttribute('aria-expanded')!=='true'))await all.click();
      assert.equal(await p.$$eval('#floating-kb-panel .kg-source',es=>es.map(e=>e.textContent).join('')),line);
      for(const item of m.items.filter(x=>x.kind==='han'||(x.kind==='letter'&&x.keys.length))){
       const selector=`#floating-kb-panel [data-guide-char="${item.id}"]`;
       await p.$eval(selector,e=>e.scrollIntoView({block:'nearest'}));
       if(await p.$eval(selector,e=>e.getAttribute('aria-pressed'))==='true')await p.click(selector);
       await p.click(selector);
       const keys=await p.$$eval('#floating-kb-panel .kg-key.is-target',es=>es.map(e=>e.dataset.key).sort());assert.deepEqual(keys,[...new Set(item.keys)].sort(),`${width}/${variant}/${l.id}/${lineIndex}/${item.char}`);
       if(item.kind==='han')assert.ok((await p.$eval('#floating-kb-panel .kg-status',e=>e.textContent)).includes(item.syllable));
       assert.equal(await p.evaluate(()=>document.activeElement.id),'input-level'+l.id);
      }
      results.push({width,variant,level:l.id,line:lineIndex+1,text:line,characters:m.items.length,passed:true});offset+=line.length+1;
     }
    }
    // Restore originals before changing viewport; replay toggles are per current answer.
    if(variant==='replay')for(let id=1;id<=6;id++){
     await p.$eval('#input-level'+id,e=>{e.readOnly=true;});
    }
   }
   await safeScreenshot(p,{path:`${out}/guide-${width}.png`});
   // Fresh page resets replay state without creating a saved score.
   await p.goto(url,{waitUntil:'networkidle2'});await p.waitForFunction(()=>document.querySelector('#input-level6').readOnly);
  }
  assert.deepEqual(errors,[]);assert.equal(await p.evaluate(()=>fixtureSaves.length),0);
  fs.writeFileSync(out+'/result.json',JSON.stringify({passed:true,results,realStudentWrites:0,pageerrors:errors},null,2));console.log(JSON.stringify({passed:true,lineCases:results.length,realStudentWrites:0}));
 }catch(e){await safeScreenshot(p,{path:out+'/failure.png'});throw e;}finally{await p.close().catch(()=>{});await c.disconnect();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
