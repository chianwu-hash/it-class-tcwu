const fs=require('node:fs'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const {connectCdp,safeScreenshot}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
const base='http://127.0.0.1:3000',url=base+'/grade3/115-1/week11.html?qa=edit-practice',out='.chat-mode/evidence/edit';
const fixture=fs.readFileSync('automation/tests/grade3-week11-browser.cjs','utf8').match(/const fixture=`([\s\S]*?)`;/)[1].replaceAll('${base}',base);
(async()=>{
 fs.mkdirSync(out,{recursive:true});const {EDIT_TASKS:tasks}=await import(pathToFileURL(require('node:path').resolve('grade3/115-1/week11-edit-practice.mjs')));
 const c=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl:url}),p=c.page,errors=[],writes=[];let offline=false;
 if(p.url()!==url)throw Error('wrong exact target');
 c.session.grantForegroundOnce('Page.bringToFront','Test native editing keys in the exact classroom practice page.');await c.session.send('Page.bringToFront');
 p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message));await p.setRequestInterception(true);
 p.on('request',r=>{const u=new URL(r.url());
  if(u.hostname.endsWith('supabase.co')){writes.push({method:r.method(),path:u.pathname});return r.abort();}
  if(u.pathname==='/shared/auth.js')return r.respond({contentType:'application/javascript',body:fixture});
  if(offline&&u.pathname==='/grade3/115-1/week11.js')return r.respond({contentType:'application/javascript',body:'// Simulate weekly auth module unavailable; warm-up is independent.'});
  return r.continue();
 });
 const card=id=>'[data-edit-task="'+id+'"]',input=id=>'#edit-input-'+id;
 const click=(id,action)=>p.click(card(id)+' [data-edit-'+action+']');
 const value=id=>p.$eval(input(id),e=>e.value),feedback=id=>p.$eval(card(id)+' [data-edit-feedback]',e=>e.textContent);
 const reset=id=>click(id,'reset'),check=id=>click(id,'check');
 const rights=async n=>{for(let i=0;i<n;i++)await p.keyboard.press('ArrowRight');};
 function removedIndex(seed,target){for(let i=0;i<seed.length;i++)if(seed.slice(0,i)+seed.slice(i+1)===target)return i;throw Error('not one deletion');}
 async function solve(task,v){
  const id=task.id;await p.click(input(id));
  if(id==='lines'){
   await p.keyboard.press('ArrowUp');await p.keyboard.press('Home');await rights(removedIndex(v.seed.split('\n')[0],v.target.split('\n')[0]));await p.keyboard.press('Delete');
   await p.keyboard.press('ArrowDown');await p.keyboard.press('Home');await rights(removedIndex(v.seed.split('\n')[1],v.target.split('\n')[1]));await p.keyboard.press('Delete');
  }else{
   const index=removedIndex(v.seed,v.intermediate);await p.keyboard.press('Home');await rights(index+(task.key==='deleteContentForward'?0:1));await p.keyboard.press(task.key==='deleteContentForward'?'Delete':'Backspace');
   if(id==='replace')await p.keyboard.type('e');
  }
  assert.equal(await value(id),v.target);await check(id);assert.match(await feedback(id),/練好了/);assert.equal(await p.$eval(card(id)+' [data-edit-replay]',e=>e.disabled),false);
 }
 try{
  await p.goto(url,{waitUntil:'networkidle2'});await p.waitForFunction(()=>document.querySelector('#edit-practice')?.dataset.initialized==='true');
  assert.ok(await p.$eval('#input-level1',e=>e.disabled));assert.equal(await p.$eval('#edit-input-backspace',e=>e.disabled),false);
  for(const t of tasks){assert.equal(await value(t.id),t.variants[0].seed);assert.ok(await p.$eval(card(t.id)+' [data-edit-replay]',e=>e.disabled));await check(t.id);assert.doesNotMatch(await feedback(t.id),/練好了/);}
  await p.click(input('backspace'));await p.keyboard.press('Home');await rights(1);await p.keyboard.press('Delete');await check('backspace');assert.match(await feedback('backspace'),/要練 Backspace/);assert.ok(await p.$eval(card('backspace')+' [data-edit-replay]',e=>e.disabled));await reset('backspace');
  await p.keyboard.down('Control');await p.keyboard.press('KeyA');await p.keyboard.up('Control');await p.keyboard.type(tasks[0].variants[0].target);await check('backspace');assert.match(await feedback('backspace'),/整段/);await reset('backspace');
  for(const event of ['paste','drop','cut'])assert.equal(await p.$eval(input('backspace'),(e,name)=>e.dispatchEvent(new Event(name,{bubbles:true,cancelable:true})),event),false);
  await p.$eval(input('replace'),e=>e.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'測'})));assert.ok(await p.$eval(card('replace')+' [data-edit-check]',e=>e.disabled));assert.ok(await p.$eval(card('replace')+' [data-edit-key]',e=>e.disabled));
  await p.$eval(input('replace'),e=>e.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:''})));assert.equal(await p.$eval(card('replace')+' [data-edit-check]',e=>e.disabled),false);
  for(const task of tasks)await solve(task,task.variants[0]);assert.match(await p.$eval('[data-edit-summary]',e=>e.textContent),/4／4/);
  for(const task of tasks){await click(task.id,'replay');assert.equal(await value(task.id),task.variants[1].seed);assert.ok(await p.$eval(card(task.id)+' [data-edit-replay]',e=>e.disabled));await solve(task,task.variants[1]);}
  // Touch-sized auxiliary keys use the same local-edit checks, without losing the caret.
  await reset('backspace');const v=tasks[0].variants[1],i=removedIndex(v.seed,v.target)+1;
  for(let n=0;n<v.seed.length-i;n++)await p.click(card('backspace')+' [data-edit-key="left"]');await p.click(card('backspace')+' [data-edit-key="backward"]');await check('backspace');assert.match(await feedback('backspace'),/練好了/);
  assert.equal(await p.evaluate(()=>window.fixtureSaves?.length||0),0);assert.deepEqual(writes,[]);
  for(const width of [1280,390]){await p.setViewport({width,height:900});await p.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';document.querySelector('#edit-practice').scrollIntoView();});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await safeScreenshot(p,{path:out+'/practice-'+width+'.png'});}
  await p.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);assert.equal(await p.$eval(card('delete')+' [data-edit-feedback]',e=>getComputedStyle(e).animationName),'none');
  offline=true;await p.reload({waitUntil:'networkidle2'});await p.waitForFunction(()=>document.querySelector('#edit-practice')?.dataset.initialized==='true');await solve(tasks[0],tasks[0].variants[0]);
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);const report={passed:true,checks:['anonymous warm-up / weekly lock','four tasks x two variants with native keys','wrong deletion key rejected','whole rewrite rejected','paste/drop/cut blocked','IME composition guard','reset/replay/new question lock','auxiliary keys and caret','desktop/mobile no overflow','reduced motion','warm-up works with weekly module unavailable'],writes:0,pageerrors:errors};fs.writeFileSync(out+'/result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await p.close().catch(()=>{});await c.disconnect();}
})().catch(e=>{console.error(e.stack);process.exitCode=1});
