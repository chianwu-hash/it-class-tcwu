const fs=require('node:fs'),assert=require('node:assert/strict');
const {connectCdp,safeScreenshot}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
const base='http://127.0.0.1:3143',url=base+'/grade3/115-1/week13.html?qa=style',out='.chat-mode/evidence/week13-style';
const fixture=fs.readFileSync('automation/tests/grade3-week13-browser.cjs','utf8').match(/const fixture=`([\s\S]*?)`;/)[1].replaceAll('${base}',base);
(async()=>{fs.mkdirSync(out,{recursive:true});const c=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl:url}),p=c.page,errors=[],measurements={};let lastShot=0;
const shot=async name=>{const delay=10000-(Date.now()-lastShot);if(delay>0)await new Promise(r=>setTimeout(r,delay));await safeScreenshot(p,{path:`${out}/${name}.png`});lastShot=Date.now();};
try{
 assert.equal(p.url(),url);c.session.grantForegroundOnce('Page.bringToFront','Compare same-size reference and Week13 layouts.');await c.session.send('Page.bringToFront');await p.setCacheEnabled(false);await p.setRequestInterception(true);p.on('pageerror',e=>errors.push(e.message));
 p.on('request',r=>{if(new URL(r.url()).pathname==='/shared/auth.js')return r.respond({contentType:'application/javascript',body:fixture});if(/supabase\.co/.test(r.url()))return r.abort();return r.continue();});
 await p.evaluateOnNewDocument(()=>{window.fixtureUser=null;window.fixtureVisibility=[];});
 for(const [name,file]of [['week20','/grade3/week20.html'],['week10','/grade3/115-1/week10.html'],['week13','/grade3/115-1/week13.html']]){
  await p.goto(base+file,{waitUntil:'networkidle2'});await p.evaluate(()=>document.fonts.ready);
  for(const width of [1280,390]){await p.setViewport({width,height:950});await p.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';scrollTo(0,0);});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name+width);await shot(`${name}-${width}-hero`);
   if(name==='week13'){
    measurements[width]=await p.evaluate(()=>[...document.querySelectorAll('main > section.card .card-heading')].map(h=>{const i=h.querySelector('.icon'),t=h.querySelector('h2');return {round:getComputedStyle(i).borderRadius,color:getComputedStyle(i).backgroundColor,glyph:getComputedStyle(i.querySelector('i'),'::before').content,noOverlap:i.getBoundingClientRect().right<=t.getBoundingClientRect().left};}));
    assert.equal(measurements[width].length,9);assert.ok(measurements[width].every(x=>x.round==='50%'&&x.glyph!=='none'&&x.noOverlap));assert.equal(await p.evaluate(()=>document.fonts.check('900 23px "Font Awesome 6 Free"')),true);
    for(const section of ['tab','fast-tasks']){await p.$eval('#'+section,e=>e.scrollIntoView({block:'start'}));await shot(`week13-${width}-${section}`);}
    assert.ok(await p.$eval('#typing-levels-container',e=>e.inert));assert.equal(await p.$eval('#mood-practice',e=>e.disabled),false);
   }
  }
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(out+'/result.json',JSON.stringify({passed:true,measurements,pageerrors:errors,realStudentWrites:0},null,2));console.log('Style desktop/mobile and reference comparisons passed');
}finally{await p.close().catch(()=>{});await c.disconnect();}})().catch(e=>{console.error(e.stack);process.exitCode=1});
