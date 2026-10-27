const fs=require('node:fs/promises'),{createRequire}=require('node:module');
const {connectCdp}=require('D:/projects/cdp-tools/packages/cdp-safe-client'),runtime=createRequire('D:/projects/cdp-tools/package.json');
(async()=>{const {browser}=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl:'https://dash.cloudflare.com/6ecb5e147cf628802fbe42154ad531af/',puppeteer:runtime('puppeteer-core')});
 try{const target=browser.targets().find(t=>t._targetId===process.argv[2]);if(!target)throw Error('target_required');const page=await target.page();
  const c=await page.target().createCDPSession();c.grantForegroundOnce('Page.bringToFront','核對題庫上傳與Worker部署的可見帳號');await c.send('Page.bringToFront');await page.waitForFunction(()=>document.body.innerText.includes("Chianwu@gmail.com's Account"),{polling:5000,timeout:30000});
  await page.goto('https://console.cloud.google.com/home/dashboard?project=dingxi-it-homework-115&authuser=th990821%40mail.thps.ntpc.edu.tw',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>[...document.querySelectorAll('[aria-label],[title]')].some(n=>(n.getAttribute('aria-label')+' '+n.getAttribute('title')).includes('th990821@mail.thps.ntpc.edu.tw')),{polling:5000,timeout:45000});
  console.log(JSON.stringify({cloudflareVisibleAccount:'chianwu@gmail.com',googleVisibleAccount:'th990821@mail.thps.ntpc.edu.tw',verified:true}));
  await fs.writeFile('automation/output/quiz/hanlin-g3-math-pool/cloud/account-check.json',JSON.stringify({at:new Date().toISOString(),cloudflareVisibleAccount:'chianwu@gmail.com',googleVisibleAccount:'th990821@mail.thps.ntpc.edu.tw',verified:true},null,2),'utf8');
  await page.goto('https://dash.cloudflare.com/6ecb5e147cf628802fbe42154ad531af/workers-and-pages',{waitUntil:'domcontentloaded'});
 }finally{await browser.disconnect();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
