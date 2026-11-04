// Every answer status (saved, too fast, errors) must be visible when the question-report form is on the page.
// Real product quiz.html/modules; Auth/RPC synthetic.
const fs=require('node:fs/promises'),assert=require('node:assert/strict'),{createRequire}=require('node:module');
const runtime=createRequire('D:/projects/cdp-tools/package.json'),{connectCdp}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
const origin=process.env.QUIZ_STATUS_ORIGIN||'http://localhost:4391',out=process.env.QUIZ_STATUS_OUT||'automation/output/quiz/status-visible';
const sid='30000000-0000-4000-8000-0000000000bb',content=t=>({text:t,media:[]});
const auth=`export const SUPABASE_URL='${origin}/mock-supabase',SUPABASE_ANON_KEY='synthetic-only';
window.fixtureSession={user:{id:'a',email:'a@example.invalid'},access_token:'fixture-a',expires_at:Math.floor(Date.now()/1000)+3600};
export const resolveSession=async()=>window.fixtureSession,getSession=async()=>({session:window.fixtureSession}),isTeacher=()=>false,beginCentralizedLogin=()=>{},signInWithGoogle=()=>{},signOutAndReload=async()=>{},signOutUser=async()=>{};
export const supabase={auth:{getSession:async()=>({data:{session:window.fixtureSession}}),onAuthStateChange:()=>{}},rpc:async()=>({data:[]})};`;
(async()=>{
 const {browser}=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl:process.env.QUIZ_BROWSER_URL,puppeteer:runtime('puppeteer-core')});
 try{
  await fs.mkdir(out,{recursive:true});const page=await browser.targets().find(t=>t._targetId===process.argv[2]).page();page.setDefaultTimeout(15000);
  const c=await page.target().createCDPSession();c.grantForegroundOnce('Page.bringToFront','驗證送出訊息可見');await c.send('Page.bringToFront');
  const questions=Array.from({length:2},(_,i)=>({id:'q'+i,type:'single',material:content(''),prompt:content('合成題 '+(i+1)),options:['甲','乙','丙','丁'].map((t,j)=>({id:'abcd'[j],content:content(t)}))}));
  let saved={},reply='ok';const errors=[],calls=[];
  const state=()=>({attempt_id:'att',session_id:sid,version_id:'v',status:'open',complete:false,leaf:{earned:false,reason:'not_eligible'},responses:{...saved},reviews:Object.keys(saved).map(id=>({question_id:id,correct:true,answer:{option_id:'a'},explanation:content('解析')})),document:{title:'訊息可見測試',catalog:{subject:'數學',volume:'3年級上學期'},questions}});
  page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);
  page.on('request',async r=>{try{
   const u=new URL(r.url());if(u.origin!==origin)return r.abort();
   const send=(d,status=200)=>r.respond({status,contentType:'application/json',body:JSON.stringify(d)});
   if(u.pathname==='/shared/auth.js')return r.respond({contentType:'text/javascript',body:auth});
   if(u.pathname.endsWith('/quiz_entry_context'))return send({role:'student',grade:3,subject:'數學',version_id:'v',identity:null});
   if(u.pathname.endsWith('/quiz_action')){const {p_action:a,p_data:d}=JSON.parse(r.postData());calls.push(a);
    if(a==='join'||a==='resume')return send(state());if(a==='view_question')return send({viewed:true});
    if(reply==='fast')return send({warning:'answer_too_fast',retry_after:2});
    if(reply==='error')return send({code:'P0001',message:'session_closed'},400);
    saved[d.question_id]=d.response;const {document,...compact}=state();return send({...compact,compact:true});}
   if(!/^\/(shared\/[A-Za-z0-9_./-]+|grade[36]\/115-1\/(quiz\.html|navbar\.js))$/.test(u.pathname))return r.respond({status:404,body:''});
   if(process.env.QUIZ_STATUS_LIVE==='1')return r.continue();
   const type=u.pathname.endsWith('.html')?'text/html;charset=utf-8':u.pathname.endsWith('.css')?'text/css':u.pathname.endsWith('.woff2')?'font/woff2':'text/javascript';
   return r.respond({contentType:type,body:await fs.readFile('.'+u.pathname)});
  }catch(e){errors.push(e.message);try{await r.respond({status:500,body:'fixture failed'});}catch{}}});
  // What a student can actually see: every status element with text, and whether it is rendered.
  const seen=()=>page.evaluate(()=>[...document.querySelectorAll('#server-quiz [role="status"]')].map(n=>({text:n.textContent.trim(),visible:n.getClientRects().length>0,inReport:Boolean(n.closest('.quiz-question-report'))})).filter(s=>s.text));
  const visibleText=async()=>(await seen()).filter(s=>s.visible).map(s=>s.text).join(' / ');
  await page.setViewport({width:1366,height:768});
  await page.goto(origin+`/grade3/115-1/quiz.html?cloud=1&session=${sid}`,{waitUntil:'networkidle0'});await page.waitForSelector('.quiz-question-report');
  const results={};
  const attempt=async(name,mode,pick)=>{reply=mode;if(pick)await page.click('.quiz-choices input[value="a"]');await page.click('#server-submit');await new Promise(r=>setTimeout(r,800));results[name]={visible:await visibleText(),all:await seen(),button:await page.$eval('#server-submit',b=>b.textContent.trim()).catch(()=>null)};};
  await attempt('noSelection','ok',false);
  await attempt('tooFast','fast',true);
  await attempt('serverError','error',true);
  await attempt('saved','ok',true);
  console.log(JSON.stringify({results,calls,errors}));
  await page.screenshot({path:out+'/after-save.png'});
  const fail=[];
  if(!/請先選擇/.test(results.noSelection.visible))fail.push('noSelection');
  if(!/結束場次|尚未送出/.test(results.serverError.visible))fail.push('serverError');
  if(!/已儲存/.test(results.saved.visible))fail.push('saved');
  assert.deepEqual(fail,[],'messages not visible: '+fail.join(','));
  assert.deepEqual(errors,[]);
 }finally{await browser.disconnect();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
