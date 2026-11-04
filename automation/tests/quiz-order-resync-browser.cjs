// 10/30 第七節：作答頁與雲端題序不一致時，一直按送出造成每人每秒數次 question_order。
// Real product quiz.html/modules; Auth/RPC synthetic. Verifies automatic re-sync and bounded requests.
const fs=require('node:fs/promises'),assert=require('node:assert/strict'),{createRequire}=require('node:module');
const runtime=createRequire('D:/projects/cdp-tools/package.json'),{connectCdp}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
const origin=process.env.QUIZ_RESYNC_ORIGIN||'http://localhost:4391',out=process.env.QUIZ_RESYNC_OUT||'automation/output/quiz/order-resync/browser';
const sid='30000000-0000-4000-8000-0000000000aa',content=t=>({text:t,media:[]});
const auth=`export const SUPABASE_URL='${origin}/mock-supabase',SUPABASE_ANON_KEY='synthetic-only';
window.fixtureSession={user:{id:'a',email:'a@example.invalid'},access_token:'fixture-a',expires_at:Math.floor(Date.now()/1000)+3600};const cb=[];
export const resolveSession=async()=>window.fixtureSession,getSession=async()=>({session:window.fixtureSession}),isTeacher=()=>false,beginCentralizedLogin=()=>{},signInWithGoogle=()=>{},signOutAndReload=async()=>{},signOutUser=async()=>{};
export const supabase={auth:{getSession:async()=>({data:{session:window.fixtureSession}}),onAuthStateChange:f=>cb.push(f)},rpc:async()=>({data:[]})};`;
(async()=>{
 const {browser}=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl:process.env.QUIZ_BROWSER_URL,puppeteer:runtime('puppeteer-core')});
 try{
  await fs.mkdir(out,{recursive:true});const page=await browser.targets().find(t=>t._targetId===process.argv[2]).page();page.setDefaultTimeout(15000);
  const c=await page.target().createCDPSession();c.grantForegroundOnce('Page.bringToFront','驗證題序不一致時自動同步');await c.send('Page.bringToFront');
  const questions=Array.from({length:3},(_,i)=>({id:'q'+i,type:'single',material:content(''),prompt:content('合成題 '+(i+1)),options:['甲','乙','丙'].map((t,j)=>({id:'abc'[j],content:content(t)}))}));
  // server = cloud truth; shown = what join hands the page (ahead of the cloud: q0 looks answered).
  let server={},shown={q0:'a'},mode='ahead';const calls=[],errors=[];
  const state=responses=>({attempt_id:'att',session_id:sid,version_id:'v',status:'open',complete:Object.keys(responses).length===3,leaf:{earned:false,reason:'not_eligible'},responses:{...responses},
   reviews:Object.keys(responses).map(id=>({question_id:id,correct:responses[id]==='a',answer:{option_id:'a'},explanation:content('解析')})),document:{title:'題序同步測試',catalog:{subject:'國語',volume:'6年級上學期'},questions}});
  const next=()=>questions.find(q=>!(q.id in server))?.id;
  page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);
  page.on('request',async r=>{try{
   const u=new URL(r.url());if(u.origin!==origin)return r.abort();
   const send=(d,status=200)=>r.respond({status,contentType:'application/json',body:JSON.stringify(d)});
   if(u.pathname==='/shared/auth.js')return r.respond({contentType:'text/javascript',body:auth});
   if(u.pathname==='/mock-supabase/rest/v1/rpc/quiz_entry_context'){calls.push({a:'entry',t:Date.now()});return send({role:'student',grade:6,subject:'國語',version_id:'v',identity:null});}
   if(u.pathname==='/mock-supabase/rest/v1/rpc/quiz_action'){
    const {p_action:a,p_data:d}=JSON.parse(r.postData());calls.push({a,q:d.question_id,t:Date.now()});
    if(a==='join')return send(state(shown));
    if(a==='resume')return send(state(mode==='broken'?shown:server));
    const wrong=mode==='broken'||d.question_id!==next();
    if(wrong)return send({code:'P0001',message:'question_order'},400);
    if(a==='view_question')return send({viewed:true});
    server[d.question_id]=d.response;const {document,...compact}=state(server);return send({...compact,compact:true});
   }
   if(!/^\/(shared\/[A-Za-z0-9_./-]+|grade[36]\/115-1\/(quiz\.html|navbar\.js))$/.test(u.pathname))return r.respond({status:404,body:''});
   if(process.env.QUIZ_RESYNC_LIVE==='1')return r.continue();
   const type=u.pathname.endsWith('.html')?'text/html;charset=utf-8':u.pathname.endsWith('.css')?'text/css':u.pathname.endsWith('.woff2')?'font/woff2':'text/javascript';
   return r.respond({contentType:type,body:await fs.readFile('.'+u.pathname)});
  }catch(e){errors.push(e.message);try{await r.respond({status:500,body:'fixture failed'});}catch{}}});
  const count=(a,since=0)=>calls.filter(x=>x.a===a&&x.t>=since).length,text=()=>page.$eval('#server-quiz',n=>n.textContent);
  await page.setViewport({width:1366,height:768});
  // 1. Page is ahead of the cloud: it shows q1 as next, cloud needs q0. View fails once → automatic resume → back to q0.
  await page.goto(origin+`/grade6/115-1/quiz.html?cloud=1&session=${sid}`,{waitUntil:'networkidle0'});
  await page.waitForFunction(()=>/已和雲端同步/.test(document.querySelector('#server-quiz')?.textContent||''));
  assert.match(await text(),/第 1 題/);assert.equal(count('resume'),1);
  // Then answering continues normally through the whole paper.
  for(let i=0;i<3;i++){
   await page.waitForSelector('.quiz-choices input:not([disabled])');await new Promise(r=>setTimeout(r,300));
   await page.click('.quiz-choices input[value="a"]');await page.click('#server-submit');
   await page.waitForFunction(n=>/答案已儲存/.test(document.querySelector('#server-quiz')?.textContent||''),{},i);
   assert.equal(Object.keys(server).length,i+1);
   if(i<2){const nextBtn=await page.$$eval('button',bs=>bs.findIndex(b=>b.textContent.trim()==='下一題'));assert.ok(nextBtn>=0);await page.evaluate(k=>[...document.querySelectorAll('button')][k].click(),nextBtn);}
  }
  assert.deepEqual(server,{q0:'a',q1:'a',q2:'a'});
  // 2. Worst case: cloud keeps disagreeing. Even with a student mashing 送出 for 10 s, requests stay bounded.
  server={};shown={q0:'a'};mode='broken';const t0=Date.now();
  await page.goto(origin+`/grade6/115-1/quiz.html?cloud=1&session=${sid}`,{waitUntil:'networkidle0'});
  await page.waitForSelector('.quiz-choices input');
  const end=Date.now()+10000;let clicks=0;
  while(Date.now()<end){await page.evaluate(()=>{const i=document.querySelector('.quiz-choices input:not([disabled])');if(i){i.click();}document.querySelector('#server-submit:not([disabled])')?.click();});clicks++;await new Promise(r=>setTimeout(r,100));}
  const reqs=calls.filter(x=>x.t>=t0&&['view_question','submit','resume'].includes(x.a)).length;
  // Each click can still send one submit, but no automatic chain: view/resume are rate-limited to one re-sync per 5 s.
  const auto=count('view_question',t0)+count('resume',t0);
  assert.ok(auto<=8,`automatic view/resume requests ${auto}`);assert.ok(count("submit",t0)<=12,`submits while held ${count("submit",t0)}`);
  assert.match(await text(),/不一致/);
  assert.deepEqual(errors,[]);
  const report={passed:true,resyncedToCloudNext:true,completedAfterResync:true,worstCase:{clicks,requests:reqs,automatic:auto,submits:count('submit',t0)},errors};
  await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.disconnect();}
})().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});
