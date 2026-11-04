const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),{createRequire}=require('node:module'),r=createRequire('D:/projects/cdp-tools/package.json');
const {connectCdp}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
(async()=>{const [id,out]=process.argv.slice(2),p=r('puppeteer-core'),{browser}=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl:'https://it-class-tcwu.vercel.app/',puppeteer:{connect:o=>p.connect({...o,protocolTimeout:15000,targetFilter:t=>['browser','tab'].includes(t.type())||t._targetId===id})}});let page;try{
 page=await browser.targets().find(t=>t._targetId===id).page();const c=await page.target().createCDPSession();c.grantForegroundOnce('Page.bringToFront','核對正式老師卷與自組卷 Unit 1／Unit 3，僅讀取清單、不建立作答');await c.send('Page.bringToFront');await c.detach();
 await page.waitForFunction(()=>document.querySelector('#auth-status')?.title?.includes('chianwu@apps.ntpc.edu.tw')&&!document.querySelector('#compose-toggle')?.disabled,{polling:100,timeout:20000});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.click('#tab-preset');await page.select('#subject-filter','英語');
 const labels=await page.$$eval('#cloud-papers .paper-card h3',ns=>ns.map(n=>n.textContent));assert.deepEqual(labels.sort(),['Unit 1 Whale Watching','Unit 3 From Farm to Table']);
 await page.screenshot({path:path.join(out,'live-teacher-english.png'),fullPage:false});
 await page.click('#compose-toggle');await page.waitForSelector('#compose-course option');await page.select('#compose-course','115-1-kang-g6-en');
 const units=await page.$$eval('#compose-units input',ns=>ns.map(n=>({id:Number(n.value),label:n.parentElement.textContent})));assert.deepEqual(units.map(u=>u.id),[1,3]);assert(units[1].label.includes('From Farm to Table'));
 await page.screenshot({path:path.join(out,'live-composer-english.png'),fullPage:false});await page.setViewport({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 const report={passed:true,schoolAccountVerified:true,teacherUnits:labels,composerUnits:units,mobileNoOverflow:true,writes:0,pageErrors:errors};await fs.writeFile(path.join(out,'browser-live-verified.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(e){if(page)console.error(JSON.stringify(await page.evaluate(()=>({url:location.href,label:document.querySelector('#auth-status')?.textContent,status:document.querySelector('#cloud-lock')?.textContent}))));throw e;}finally{await page?.close().catch(()=>{});await browser.disconnect();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
