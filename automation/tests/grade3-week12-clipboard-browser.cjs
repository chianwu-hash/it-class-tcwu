// Registered AI browser only; native pointer selection and OS clipboard shortcuts.
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {connectCdp,safeScreenshot}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
const base='http://127.0.0.1:3000',url=base+'/grade3/115-1/week12.html?qa=clipboard',out='.chat-mode/evidence/clipboard';
const fixture=fs.readFileSync('automation/tests/grade3-week12-browser.cjs','utf8').match(/const fixture=`([\s\S]*?)`;/)[1].replaceAll('${base}',base);
(async()=>{
 fs.mkdirSync(out,{recursive:true});const {CLIPBOARD_TASKS:tasks}=await import(pathToFileURL(path.resolve('grade3/115-1/week12-clipboard.mjs')));
 const c=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl:url}),p=c.page,errors=[],network=[];
 try{
  assert.equal(p.url(),url);c.session.grantForegroundOnce('Page.bringToFront','Test real pointer selection and native copy, cut, paste, undo and redo in the course exercise.');await c.session.send('Page.bringToFront');
  await p.goto('about:blank');p.setDefaultTimeout(12000);p.on('pageerror',e=>errors.push(e.message));await p.setCacheEnabled(false);await p.setRequestInterception(true);
  p.on('request',r=>{const u=new URL(r.url());if(u.pathname==='/shared/auth.js')return r.respond({contentType:'application/javascript',body:fixture});if(u.hostname.endsWith('supabase.co')){network.push(r.method());return r.abort();}return r.continue();});
  await p.goto(url,{waitUntil:'networkidle2'});await p.setViewport({width:1280,height:900});await p.evaluate(()=>document.documentElement.style.scrollBehavior='auto');
  const sel=id=>'#clip-input-'+id,card=id=>'[data-clip-task="'+id+'"]';
  const shortcut=async key=>{await p.keyboard.down('Control');await p.keyboard.press(key);await p.keyboard.up('Control');};
  const val=id=>p.$eval(sel(id),e=>e.value);
  async function point(id,index){return p.$eval(sel(id),(e,n)=>{const s=getComputedStyle(e),r=e.getBoundingClientRect(),lines=e.value.slice(0,n).split('\n');const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.font=s.font;return {x:r.left+parseFloat(s.borderLeftWidth)+parseFloat(s.paddingLeft)+ctx.measureText(lines.at(-1)).width-e.scrollLeft,y:r.top+parseFloat(s.borderTopWidth)+parseFloat(s.paddingTop)+(lines.length-.5)*parseFloat(s.lineHeight)-e.scrollTop};},index);}
  async function select(id,start,end){await p.$eval(sel(id),e=>e.scrollIntoView({block:'center',behavior:'instant'}));const a=await point(id,start),b=await point(id,end);await p.mouse.move(a.x,a.y);await p.mouse.down();await p.mouse.move(b.x,b.y,{steps:12});await p.mouse.up();assert.equal(await p.$eval(sel(id),e=>e.value.slice(e.selectionStart,e.selectionEnd)),(await val(id)).slice(start,end),'pointer selection '+id);}
  async function destination(id,index){await p.$eval(sel(id),e=>e.scrollIntoView({block:'center',behavior:'instant'}));const q=await point(id,index);await p.mouse.click(q.x,q.y);assert.equal(await p.$eval(sel(id),e=>e.selectionStart),index,'destination '+id);}
  async function check(id,ok){await p.click(card(id)+' [data-clip-check]');const result=await p.$eval(card(id),e=>({passed:e.classList.contains('clip-passed'),message:e.querySelector('[data-clip-feedback]').textContent}));assert.equal(result.passed,ok,id+': '+result.message);}
  async function solve(t,v){
   const start=v.seed.indexOf(v.word);await select(t.id,start,start+v.word.length);
   if(!v.target){await check(t.id,true);return;}
   await shortcut(v.kind==='cut'?'KeyX':'KeyC');
   let current=await val(t.id);
   if(v.kind==='cut')assert.equal(current,v.seed.slice(0,start)+v.seed.slice(start+v.word.length));else assert.equal(current,v.seed);
   if(v.replace){const k=current.lastIndexOf(v.replace);await select(t.id,k,k+v.replace.length);}
   else await destination(t.id,v.kind==='cut'&&t.id==='decide'?current.indexOf('\n'):current.length);
   await shortcut('KeyV');assert.equal(await val(t.id),v.target);await check(t.id,true);
  }
  for(const task of tasks){for(let index=0;index<2;index++){
   if(index){await p.click(card(task.id)+' [data-clip-replay]');assert.equal(await val(task.id),task.variants[index].seed);assert.ok(await p.$eval(card(task.id)+' [data-clip-replay]',e=>e.disabled));}
   await solve(task,task.variants[index]);
  }}
  // An identical final result typed from scratch is insufficient.
  const t=tasks[1],v=t.variants[1];await p.click(card(t.id)+' [data-clip-reset]');await p.click(sel(t.id));await shortcut('KeyA');await p.keyboard.type(v.target);await check(t.id,false);
  // Native undo after a wrong paste restores cut provenance; redo restores actual state.
  await p.click(card('cut')+' [data-clip-reset]');const cut=tasks[2].variants[1],at=cut.seed.indexOf(cut.word);await select('cut',at,at+cut.word.length);await shortcut('KeyX');const afterCut=await val('cut');await destination('cut',0);await shortcut('KeyV');await check('cut',false);await p.click(sel('cut'));await shortcut('KeyZ');assert.equal(await val('cut'),afterCut);await destination('cut',afterCut.length);await shortcut('KeyV');await check('cut',true);
  await p.click(sel('cut'));await shortcut('KeyZ');await check('cut',false);await p.click(sel('cut'));await shortcut('KeyY');assert.equal(await val('cut'),cut.target);await check('cut',true);
  // A reset creates an independent native undo scope and no previous question can return.
  await p.click(card('cut')+' [data-clip-replay]');await p.click(sel('cut'));await shortcut('KeyZ');assert.equal(await val('cut'),tasks[2].variants[0].seed);
  // Selection-only success becomes invalid as soon as the range changes.
  await destination('select',0);await check('select',false);
  const first=tasks[0].variants[1],firstAt=first.seed.indexOf(first.word);await select('select',firstAt,firstAt+first.word.length);await p.keyboard.press('Tab');await p.keyboard.press('Enter');assert.ok(await p.$eval(card('select'),e=>e.classList.contains('clip-passed')),'keyboard check preserves selection');
  await p.click(card('select')+' [data-clip-hint]');assert.ok(await p.$eval(card('select'),e=>e.classList.contains('clip-passed')),'hints do not erase a valid success state');
  await p.$eval(sel('copy'),e=>e.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true})));assert.ok(await p.$eval(card('copy')+' [data-clip-check]',e=>e.disabled));await p.$eval(sel('copy'),e=>e.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true})));assert.equal(await p.$eval(card('copy')+' [data-clip-check]',e=>e.disabled),false);
  for(const width of [1280,390]){await p.setViewport({width,height:900});await p.$eval('#clipboard',e=>e.scrollIntoView({block:'start',behavior:'instant'}));assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await safeScreenshot(p,{path:`${out}/clipboard-${width}.png`});}
  // Warm-up is independent from the auth/progress module.
  await p.evaluate(()=>document.querySelector('#clipboard details').open=false);await p.click('.section-links a[href="#clipboard"]');assert.ok(await p.$eval('#clipboard details',e=>e.open));
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
  const result={passed:true,pageerrors:errors,realStudentWrites:0,checks:['10 native pointer selections','copy and cut native OS clipboard','all variants target and operation checks','typed-answer rejection','wrong paste, undo, correct paste','native undo and redo restores proof','new textarea isolates undo across questions','selection changes revoke success','390/1280 no overflow','section navigation reopens collapsed card']};fs.writeFileSync(out+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await p.close().catch(()=>{});await Promise.race([c.disconnect(),new Promise(r=>setTimeout(r,2000))]);}
})().then(()=>process.exit(0)).catch(e=>{console.error(e.stack);process.exit(1);});
