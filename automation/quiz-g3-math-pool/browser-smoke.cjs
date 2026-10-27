const fs=require('node:fs/promises');
const {createRequire}=require('node:module');
const {connectCdp,safeScreenshot}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
const req=createRequire('D:/projects/cdp-tools/package.json');
(async()=>{
 const targetUrl=process.env.QUIZ_BROWSER_URL||'http://127.0.0.1:4380/grade3/115-1/quiz-library.html?local=1&student=21';
 const {page,session,disconnect}=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl,puppeteer:req('puppeteer-core')});
 try{
  if((await session.send('Target.getTargetInfo')).targetInfo.targetId!==process.argv[2])throw Error('target_mismatch');
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width:1366,height:900});await page.goto(targetUrl,{waitUntil:'networkidle0'});
  console.log(JSON.stringify({errors,text:(await page.$eval('body',e=>e.innerText)).slice(0,5000)}));
  await safeScreenshot(page,{path:'automation/output/quiz/hanlin-g3-math-pool/qa/library.png',fullPage:false});
 }finally{await disconnect();}
})().catch(e=>{console.error(e);process.exitCode=1;});
