// Browser regression for the actual library + wrong-question + composer integration.
// All RPCs and records are synthetic. Delay the background paper refresh deliberately.
const fs=require('node:fs/promises'),cp=require('node:child_process'),assert=require('node:assert/strict'),{createRequire}=require('node:module');
const runtime=createRequire('D:/projects/cdp-tools/package.json'),{connectCdp}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
(async()=>{
 const {browser}=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl:process.env.QUIZ_BROWSER_URL,puppeteer:runtime('puppeteer-core')});
 const out='automation/output/quiz/extension-feedback-20261028',before=process.env.QUIZ_EXTENSION_BEFORE==='1';await fs.mkdir(out,{recursive:true});
 let grade=3,records=[],requests=[],lost=false,report={passed:false,before},serial=0;
 const sid='00000000-0000-4000-8000-000000000001',newSid=()=>`00000000-0000-4000-8000-${String(++serial+1).padStart(12,'0')}`;
 const catalog=()=>({volume:grade+'年級上學期',subject:'數學',unit:'第一單元'}),content=text=>({text,media:[]});
 try{
  const page=await browser.targets().find(t=>t._targetId===process.argv[2]).page(),c=await page.target().createCDPSession();page.setDefaultTimeout(12000);
  c.grantForegroundOnce('Page.bringToFront','驗證錯題延伸成功提示、延遲清單更新與安全重試');await c.send('Page.bringToFront');await page.setViewport({width:1280,height:960});
  await page.setRequestInterception(true);page.on('request',async r=>{
   const u=new URL(r.url());if(u.origin!=='http://127.0.0.1:4392')return r.abort();
   const send=data=>r.respond({contentType:'application/json',body:JSON.stringify(data)});
   if(u.pathname==='/__quiz-local')return send({local:true,pool:true});
   if(u.pathname==='/shared/auth.js')return r.respond({contentType:'text/javascript',body:'export const supabase={};export const resolveSession=async()=>null;export const isTeacher=()=>false;export const beginCentralizedLogin=()=>{};export const signOutAndReload=()=>{};'});
   if(u.pathname.endsWith('/navbar.js'))return r.respond({contentType:'text/javascript',body:''});
   if(u.pathname==='/__quiz-rpc'){
    const {action,data={}}=JSON.parse(r.postData());
    if(action==='library_sessions'){
     const rows=records.map(p=>({...p}));if(records.length)await new Promise(ok=>setTimeout(ok,1200));
     return send({role:'student',grade,sessions:[{id:sid,catalog:catalog(),title:'合成原卷',status:'open',total:10,answered:1,correct:0},...rows]});
    }
    if(action==='pool_catalog')return send({available:true,courses:[{id:'test-math',subject:'數學',grade,units:[{id:1,title:'第一單元',count:50}],extension_available:true}],name_characters:[]});
    if(action==='wrong_questions'){
     const common={catalog:catalog(),title:'合成原卷',attempt_id:'attempt-one',question_id:'source-question',number:1,answered_at:'2026-10-28T00:00:00Z'};
     if(data.action!=='detail')return send({facets:[{subject:'數學',unit:'第一單元'}],items:[{...common,preview:'原題與解析'}],total:1});
     return send({...common,response:'b',question:{id:'source-question',type:'single',prompt:content('原題：想一想，哪個答案適合？'),options:[{id:'a',content:content('選項甲')},{id:'b',content:content('選項乙')}]},review:{answer:{option_id:'a'},explanation:content('原題解析要留在這裡，不能被背景更新收起。')}});
    }
    if(action==='compose'){
     assert.equal(data.kind,'extension');requests.push(data);
     if(!records.length)records.push({id:newSid(),catalog:catalog(),generated:true,generated_kind:'extension',display_name:'數學同重點延伸練習',learning_point:'數與量',status:'open',total:3,answered:0,correct:0,saved_at:'2026-10-28T00:00:00Z',distribution:{actual:3,easy:1,medium:2,hard:0}});
     if(lost){lost=false;return r.abort('failed');}
     return send({session_id:records[0].id,display_name:records[0].display_name,distribution:records[0].distribution});
    }
    throw Error('unexpected_action:'+action);
   }
   if(!/^\/(shared\/[A-Za-z0-9_./-]+|grade[36]\/115-1\/quiz-library\.html)$/.test(u.pathname)||u.pathname.includes('..'))return r.respond({status:404,body:''});
   let text=before&&u.pathname==='/shared/quiz-library.mjs'?cp.execFileSync('git',['show','HEAD:shared/quiz-library.mjs'],{encoding:'utf8'}):await fs.readFile('.'+u.pathname,'utf8');
   if(u.pathname.endsWith('.html'))text=text.replace('<head>','<head><meta name="quiz-pool-local" content="1">');
   return r.respond({contentType:u.pathname.endsWith('.html')?'text/html;charset=utf-8':u.pathname.endsWith('.css')?'text/css':'text/javascript',body:text});
  });
  for(const scenario of [{grade:3},{grade:6,retry:true},{grade:3,earlyView:true}]){
   grade=scenario.grade;records=[];requests=[];lost=Boolean(scenario.retry);
   await page.goto(`http://127.0.0.1:4392/grade${grade}/115-1/quiz-library.html?local=1&student=1#wrong`,{waitUntil:'networkidle0'});
   await page.waitForSelector('#wrong-list button');await page.click('#wrong-list button');await page.waitForSelector('.wrong-extension button');
   await page.$eval('.wrong-extension button',b=>{b.click();b.click();});
   if(scenario.retry){await page.waitForFunction(()=>!document.querySelector('.wrong-extension button').disabled);await page.click('.wrong-extension button');}
   await page.waitForSelector('.wrong-extension[data-state="saved"] a');
   assert.equal(records.length,1);assert.equal(requests.length,scenario.retry?2:1);if(scenario.retry)assert.equal(requests[0].request_id,requests[1].request_id);
   const id=records[0].id;
   if(!scenario.earlyView){
    await page.waitForSelector(`[data-session-id="${id}"]`);
    assert.equal(await page.$eval('#wrong-detail',e=>e.hidden),false,'background paper refresh hid the explanation');
    assert.equal(await page.$eval('#tab-wrong',e=>e.getAttribute('aria-selected')),'true');
    assert.match(await page.$eval('.wrong-extension',e=>e.textContent),/已儲存到「我的自組卷」/);
    assert.ok((await page.$eval('.wrong-extension a',e=>e.href)).includes(id));
    assert.equal(await page.$eval('.wrong-extension>button',e=>e.disabled),true);
    if(grade===3&&!scenario.retry){await page.screenshot({path:out+'/saved.png',fullPage:false});}
   }
   await page.click('.wrong-extension-actions button');await page.waitForSelector(`[data-session-id="${id}"]`);
   await page.waitForFunction(id=>document.activeElement?.closest('[data-session-id]')?.dataset.sessionId===id,{},id);
   assert.equal(await page.$eval('#tab-mine',e=>e.getAttribute('aria-selected')),'true');
   await page.setViewport({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.setViewport({width:1280,height:960});
  }
  report={passed:true,grades:[3,6],backgroundRefreshPreservesDetail:true,savedMessageAndDirectStart:true,viewAndFocusNewPaper:true,earlyViewDuringRefresh:true,sameRequestIdRetry:true,singlePaper:true,mobile:true};console.log(JSON.stringify(report));
 }finally{await fs.writeFile(out+'/'+(before?'before':'after')+'.json',JSON.stringify(report,null,2));await browser.disconnect();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
