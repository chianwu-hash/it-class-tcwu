const {connectCdp}=require('D:/projects/cdp-tools/packages/cdp-safe-client');const puppeteer=require('D:/projects/browser-automation-workflow/node_modules/puppeteer-core');const fs=require('node:fs');
(async()=>{const c=await connectCdp({puppeteer,cdpUrl:process.env.CDP_URL,targetUrl:process.env.PARTNER_PREVIEW_URL}),p=c.page,out=[],errors=[];
const check=(name,ok)=>{out.push({name,ok});if(!ok)throw Error(name);};try{
if(p.target()._targetId!==process.argv[2])throw Error('target mismatch');p.on('pageerror',e=>errors.push(e.message));await p.reload({waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.qa,{polling:5000});
c.session.grantForegroundOnce('Page.bringToFront','驗證前景聊天提醒與回顧提示的點擊位置');await c.session.send('Page.bringToFront');
for(const width of [320,360,650,768,1280]){
 await p.setViewport({width,height:900});await p.evaluate(()=>{qa.reset();qa.showAllReview();qa.note('ask','這題可以一起想嗎？',102);});
 await p.waitForFunction(()=>getComputedStyle(document.querySelector('.partner-camp-toast')).display!=='none',{polling:5000});
 check('all floating buttons independently reachable at '+width,await p.evaluate(()=>{
 const nodes=[document.querySelector('[data-callout-review]'),document.querySelector('.partner-camp-toast button'),document.querySelector('.focus-team-bar [data-open-camp]')];
 return nodes.every(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.top>=0&&r.bottom<=innerHeight&&hit?.closest('button')===e;});}));
 check('no horizontal overflow at '+width,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
}
await p.$eval('.focus-team-bar [data-open-camp]',e=>e.click());await p.$eval('#camp-chat-text',e=>e.focus());
await p.evaluate(()=>{window.beforeFocus=document.activeElement;qa.note('chat','新的討論');});
check('camp open hides stage callout and peer event never steals focus',await p.evaluate(()=>getComputedStyle(document.querySelector('[data-review-callout]')).display==='none'&&document.activeElement===beforeFocus));
check('no uncaught error',!errors.length);fs.mkdirSync('.chat-mode/evidence/review-completion',{recursive:true});fs.writeFileSync('.chat-mode/evidence/review-completion/layout.json',JSON.stringify({out,errors}));console.log(JSON.stringify({passed:out.length,out}));
}catch(e){console.error(e);process.exitCode=1;}finally{await p.close();await c.disconnect();}})();
