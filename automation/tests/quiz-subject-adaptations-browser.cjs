// Use the registered lease wrapper and an exact localhost quiz-fixture target.
// Synthetic controls/media only; no auth, API writes or student answers.
const fs=require('node:fs'),assert=require('node:assert/strict'),{createRequire}=require('node:module');
const puppeteer=createRequire('D:/projects/cdp-tools/package.json')('puppeteer-core');
let browser,page;const checks=[];
(async()=>{try{
 browser=await puppeteer.connect({browserURL:process.env.CDP_URL,defaultViewport:null,waitForInitiallyDiscoveredTargets:false});
 page=await(await browser.waitForTarget(t=>t._targetId===process.env.AI_WORK_BROWSER_TARGET_ID)).page();
 assert.equal(new URL(page.url()).hostname,'localhost');
 const session=await page.createCDPSession();session.grantForegroundOnce('Page.bringToFront','驗證算式連續鍵盤操作及原生聽力播放');await session.send('Page.bringToFront');
 for(const width of [1280,390,320]){
  await page.setViewport({width,height:950});await page.evaluate(async()=>{
   document.querySelector('#subject-adaptation-test')?.remove();const host=document.createElement('form');host.id='subject-adaptation-test';host.addEventListener('submit',e=>{e.preventDefault();window.unwantedSubjectSubmit=true});document.body.append(host);
   const {renderWorkInput}=await import('./shared/quiz-work-response.mjs');renderWorkInput(host,{id:'synthetic-keyboard',type:'fields',work:{input:'expression',label:'算式'}},{raw:'',locked:false,onChange(){}});
   host.querySelector('button[aria-label="輸入7"]').focus();
  });
  await page.keyboard.press('Enter');await page.keyboard.press('Enter');
  assert.deepEqual(await page.evaluate(()=>({value:document.querySelector('#subject-adaptation-test input').value,key:document.activeElement.textContent,submitted:!!window.unwantedSubjectSubmit})),{value:'77',key:'7',submitted:false});
  await page.click('#subject-adaptation-test button[aria-label="輸入＋"]');assert.equal(await page.$eval('#subject-adaptation-test input',e=>e.value),'77＋');
  await page.$eval('#subject-adaptation-test input',e=>{e.value='77😀';e.setSelectionRange(4,4)});await page.click('#subject-adaptation-test button:last-child');assert.equal(await page.$eval('#subject-adaptation-test input',e=>e.value),'77');
  const audio=await page.evaluate(async()=>{
   const {renderContent}=await import('./shared/quiz-render.mjs'),{renderContent:renderPartner}=await import('./shared/partner-pilot/official-render.js'),{createMediaScope}=await import('./shared/quiz-media.mjs');
   const bytes=new Uint8Array(16044),view=new DataView(bytes.buffer),word=(at,s)=>[...s].forEach((c,i)=>bytes[at+i]=c.charCodeAt(0));word(0,'RIFF');view.setUint32(4,16036,true);word(8,'WAVE');word(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,8000,true);view.setUint32(28,8000,true);view.setUint16(32,1,true);view.setUint16(34,8,true);word(36,'data');view.setUint32(40,16000,true);bytes.fill(128,44);
   const url=URL.createObjectURL(new Blob([bytes],{type:'audio/wav'})),host=document.querySelector('#subject-adaptation-test');host.replaceChildren();const scope=createMediaScope({context:{},read:async()=>url});
   const content={text:'',media:[{kind:'audio',url:'https://quiz-media.invalid/00000000-0000-4000-8000-000000000001/'+'a'.repeat(64),alt:'合成測試音檔'}]};renderContent(host,content,{mediaScope:scope});let active=true;renderPartner(host,content,{mediaScope:{active:()=>active,resolve:async()=>url}});
   try{await new Promise(r=>setTimeout(r,0));const [a,b]=host.querySelectorAll('audio');a.muted=b.muted=true;await a.play();await b.play();const sequential=a.paused&&!b.paused;b.currentTime=0;await b.play();const replay=!b.paused;active=false;b.dispatchEvent(new Event('play'));const expired=b.paused;scope.dispose();return {sequential,replay,expired,disposed:a.paused&&!a.getAttribute('src')};}finally{scope.dispose();URL.revokeObjectURL(url);host.remove();}
  });assert.deepEqual(audio,{sequential:true,replay:true,expired:true,disposed:true});checks.push({width,keyboardEnter:true,pointerInput:true,unicodeDelete:true,...audio});
 }
 const proof={passed:true,checks};if(process.env.QUIZ_SUBJECT_BROWSER_OUT)fs.writeFileSync(process.env.QUIZ_SUBJECT_BROWSER_OUT,JSON.stringify(proof,null,2));console.log(JSON.stringify({passed:true,checks:checks.length}));
}finally{if(page&&!page.isClosed())await page.close();if(browser)await browser.disconnect();}})().catch(e=>{console.error(e.stack);process.exitCode=1});
