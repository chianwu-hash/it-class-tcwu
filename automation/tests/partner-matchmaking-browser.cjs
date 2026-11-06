// Four exact leased targets. Synthetic identities/local database only; production UI modules.
const {chromium}=require('D:/projects/browser-automation-workflow/node_modules/playwright');
const fs=require('node:fs');
const base='http://localhost:8840',dir='.chat-mode/evidence/matchmaking';fs.mkdirSync(dir,{recursive:true});
(async()=>{const browser=await chromium.connectOverCDP(process.env.CDP_URL,{aiTargetIds:process.argv.slice(2),timeout:30000}),pages=[],checks=[],errors=[];
const check=(name,ok)=>{checks.push({name,ok});fs.writeFileSync(dir+'/progress.json',JSON.stringify({checks,errors},null,2));if(!ok)throw Error(name);};
const wait=(p,fn)=>p.waitForFunction(fn,null,{polling:5000,timeout:45000});
const click=(p,s)=>p.$eval(s,e=>e.click());
try{
 const context=browser.contexts()[0];for(const p of context.pages()){const session=await context.newCDPSession(p),info=await session.send('Target.getTargetInfo');await session.detach();if(!process.argv.slice(2).includes(info.targetInfo.targetId))throw Error('unowned target');p.on('pageerror',e=>errors.push(e.message));pages.push(p);}pages.sort((a,b)=>Number(new URL(a.url()).searchParams.get('actor'))-Number(new URL(b.url()).searchParams.get('actor')));
 if(pages.length!==4)throw Error('four owned targets required');
 await fetch(base+'/__qa/reset',{method:'POST',headers:{'x-prototype-session':'synthetic-team-only'}});
 for(let i=0;i<4;i++){await pages[i].goto(base+'/?actor='+(i+2),{waitUntil:'domcontentloaded'});await wait(pages[i],()=>!!document.querySelector('[data-find-partner]'));}
 const p=pages[0];check('three entry choices and no empty resume section',!await p.$('#resume-tasks')&&!!await p.$('[data-captain]')&&!!await p.$('[data-member]'));
 await click(p,'[data-member]');check('original invitation input retained',!!await p.$('#code'));await click(p,'[data-home]');
 await click(p,'[data-find-partner]');await wait(p,()=>!!document.querySelector('[data-match-join]'));check('voluntary consent before enqueue, grade-wide and self sharing disclosed',await p.$eval('.match-panel',e=>e.textContent.includes('同年級跨班')&&e.textContent.includes('自組卷')&&!!e.querySelector('[data-match-join]')));
 await p.evaluate(()=>{const native=window.fetch;let once=true;window.fetch=async(...args)=>{const r=await native(...args);if(once&&String(args[0]).includes('/__qa/match')&&JSON.parse(args[1]?.body||'{}').action==='join'){once=false;throw new TypeError('synthetic response lost');}return r;};});
 await click(p,'[data-match-join]');await wait(p,()=>document.querySelector('[data-match-pending]')?.hidden===false);check('uncertain join preserves same-request retry instead of enqueue twice',!!await p.$('[data-match-retry]'));await click(p,'[data-match-retry]');await wait(p,()=>!!document.querySelector('[data-match-countdown]'));
 await click(p,'[data-match-leave]');await wait(p,()=>!!document.querySelector('[data-match-join]'));
 // Retire the earlier retry-test cohort, then start a fresh real 30-second round.
 await fetch(base+'/__qa/expire',{method:'POST',headers:{'Content-Type':'application/json','x-prototype-session':'synthetic-team-only','x-prototype-actor':'2'},body:'{}'});
 for(const q of pages.slice(1)){await click(q,'[data-find-partner]');await wait(q,()=>!!document.querySelector('[data-match-join]'));}
 for(const q of pages)await click(q,'[data-match-join]');
 for(const q of pages)await wait(q,()=>!!document.querySelector('[data-match-countdown]'));
 check('four do not form early; waiting roster is private',await p.$eval('.match-panel',e=>!e.querySelector('.match-roster')&&e.textContent.includes('集合時間到')));
 await p.screenshot({path:dir+'/waiting.png',fullPage:true});
 // Real 30-second batch deadline; no time travel here. Hidden pages poll every 30 seconds.
 for(const q of pages)await wait(q,()=>!!document.querySelector('.match-roster'));
 check('all four see the same four-person roster',await pages.reduce(async(a,q)=>(await a)&&await q.$eval('.match-roster',e=>e.children.length===4),Promise.resolve(true)));
 let leader;for(const q of pages)if(await q.$('[data-match-start]'))leader=q;
 check('exactly one random captain controls selection and departure',(await Promise.all(pages.map(q=>q.$('[data-match-start]')))).filter(Boolean).length===1);
 await wait(leader,()=>!!document.querySelector('[data-paper]'));check('three/four-person team cannot pick a ten-question teacher paper',await leader.$$eval('[data-paper]',es=>es.every(e=>!e.textContent.includes('10題'))));
 await click(leader,'[data-paper]');await click(leader,'[data-match-select]');await wait(leader,()=>!document.querySelector('[data-match-start]')?.disabled);
 await leader.screenshot({path:dir+'/team.png',fullPage:true});await click(leader,'[data-match-start]');
 for(const q of pages)await wait(q,()=>!!document.querySelector('[data-normal-choices]'));
 check('all four enter original answer UI after explicit captain departure',true);
 await p.evaluate(()=>document.querySelector('[data-save-exit]').click());await wait(p,()=>!!document.querySelector('#resume-tasks'));check('original task resume retained; historical task does not force matchmaking',!!await p.$('[data-find-partner]'));
 await p.setViewportSize({width:390,height:844});check('entry remains within mobile viewport',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await click(p,'[data-find-partner]');await wait(p,()=>!!document.querySelector('[data-match-join]'));check('leaving completed pre-team does not auto-enqueue',!!await p.$('[data-match-exit]'));
 await p.screenshot({path:dir+'/mobile-consent.png',fullPage:true});check('no uncaught page exceptions',errors.length===0);
 for(const q of pages.slice(1)){await click(q,'[data-save-exit]');await wait(q,()=>!!document.querySelector('[data-find-partner]'));}
 fs.writeFileSync(dir+'/browser-results.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({passed:checks.length,checks,errors}));
}catch(e){fs.writeFileSync(dir+'/failure.json',JSON.stringify({checks,errors,error:e.message},null,2));throw e;}finally{await browser.close();}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
