const fs=require('node:fs'),path=require('node:path'),{chromium}=require('D:/projects/browser-automation-workflow/node_modules/playwright');
const output=path.resolve('.chat-mode/home-style');fs.mkdirSync(output,{recursive:true});const checks=[],errors=[];let lastShot=0;
const check=(name,ok)=>{checks.push({name,ok:!!ok});fs.writeFileSync(path.join(output,'progress.private.json'),JSON.stringify({checks,errors},null,2));if(!ok)throw Error(name);};
const luminance=hex=>{const n=hex.replace('#',''),v=[0,2,4].map(i=>parseInt(n.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*v[0]+.7152*v[1]+.0722*v[2];};
(async()=>{const browser=await chromium.connectOverCDP(process.env.CDP_URL);try{
 const pages=browser.contexts().flatMap(c=>c.pages());if(pages.length!==1)throw Error('exact_target_required');const page=pages[0];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());const cdp=await page.context().newCDPSession(page);cdp.grantForegroundOnce('Page.bringToFront','Verify pets and subject colors on local homepage');await cdp.send('Page.bringToFront');
 for(const grade of [3,6])for(const width of [1280,390]){
  const label=`g${grade}-${width}`;await page.setViewportSize({width,height:1000});const suffix=`/grade${grade}/115-1/quiz-library.html?preview_home=1&preview=preview-style-${label}&preview_case=new`;
  await page.goto('http://localhost:8923'+suffix);await page.locator('.home-unit-group').first().waitFor();const oldHeight=await page.locator('.library-hero').evaluate(n=>n.getBoundingClientRect().height);
  await page.goto('http://localhost:8924'+suffix);await page.locator('.home-unit-group').first().waitFor();await page.locator('[data-partner-pilot-entry="main"] .partner-entry-art').waitFor();
  await page.waitForFunction(()=>[...document.querySelectorAll('.home-welcome-pets,.home-explore-pet,.partner-entry-art')].every(n=>n.complete&&n.naturalWidth>0),null,{polling:5000});
  check(label+' three pets decoded',await page.locator('.home-welcome-pets,.home-explore-pet,.partner-entry-art').count()===3);
  check(label+' pets visibly sized',await page.locator('.home-welcome-pets,.home-explore-pet,.partner-entry-art').evaluateAll(a=>a.every(n=>{const r=n.getBoundingClientRect();return r.width>=25&&r.height>=40&&getComputedStyle(n).display!=='none';})));
  check(label+' decorative accessible treatment and reserved dimensions',await page.locator('.home-welcome-pets,.home-explore-pet,.partner-entry-art').evaluateAll(a=>a.every(n=>n.alt===''&&n.getAttribute('aria-hidden')==='true'&&Number(n.getAttribute('width'))>0&&Number(n.getAttribute('height'))>0)));
  check(label+' hero not significantly taller',Math.abs(await page.locator('.library-hero').evaluate(n=>n.getBoundingClientRect().height)-oldHeight)<=12.5);
  check(label+' welcome pet does not overlap text',await page.locator('.library-hero').evaluate(n=>{const p=n.querySelector('img').getBoundingClientRect();return [...n.querySelectorAll('h1,.library-description')].every(t=>{const r=t.getBoundingClientRect();return r.right<=p.left||r.left>=p.right||r.bottom<=p.top||r.top>=p.bottom;});}));
  check(label+' no pets repeated within paper rows',await page.locator('.home-paper-row img').count()===0);
  check(label+' local subject SVG visible',await page.locator('.home-unit-heading .home-subject-icon svg').evaluateAll(a=>a.length>0&&a.every(n=>n.getBoundingClientRect().width>=19&&n.childElementCount>0)));
  const tokens=await page.locator('.home-subjects [data-subject]').evaluateAll(a=>a.filter(n=>n.dataset.subject).map(n=>{const s=getComputedStyle(n);return {subject:n.dataset.subject,ink:s.getPropertyValue('--home-subject-ink').trim(),wash:s.getPropertyValue('--home-subject-wash').trim()};}));
  check(label+' every subject distinct',new Set(tokens.map(t=>t.ink)).size===tokens.length);
  check(label+' subject ink contrast at least 4.5',tokens.every(t=>{const a=luminance(t.ink),b=luminance(t.wash);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5;}));
  check(label+' group and chip use same subject tokens',await page.locator('.home-unit-group').evaluateAll(groups=>groups.every(g=>{const b=[...document.querySelectorAll('.home-subjects button')].find(b=>b.dataset.subject===g.dataset.subject);return b&&getComputedStyle(b).getPropertyValue('--home-subject-ink')===getComputedStyle(g).getPropertyValue('--home-subject-ink');})));
  check(label+' no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  check(label+' grade hero remains correct',await page.locator('.library-hero').evaluate((n,g)=>{const c=getComputedStyle(n).backgroundImage;return g===6?c.includes('109, 40, 217'):c.includes('14, 116, 144');},grade));
  const elapsed=Date.now()-lastShot;if(elapsed<10000)await new Promise(r=>setTimeout(r,10000-elapsed));await page.screenshot({path:path.join(output,label+'.private.png'),fullPage:false});lastShot=Date.now();
  await page.locator('.home-subjects [data-subject="數學"]').click();check(label+' selected math remains orange with visible text',await page.locator('.home-subjects [data-subject="數學"]').evaluate(n=>n.getAttribute('aria-pressed')==='true'&&getComputedStyle(n).color==='rgb(194, 65, 12)'&&n.textContent.includes('數學')));
  await page.evaluate(()=>window.fixtureSwitch(null));check(label+' login lock hides discovery and controls',!await page.locator('.home-explore-pet').isVisible()&&!await page.locator('#cloud-library').isVisible());check(label+' welcome remains at login lock',await page.locator('.home-welcome-pets').isVisible());
 }
 check('no page exceptions',errors.length===0);await cdp.detach();fs.writeFileSync(path.join(output,'browser-proof.private.json'),JSON.stringify({passed:true,checks,errors},null,2));console.log(JSON.stringify({passed:true,count:checks.length}));
 }finally{await browser.close();}})().catch(e=>{fs.writeFileSync(path.join(output,'error.private.txt'),e.stack);console.error(e.stack);process.exitCode=1;});
