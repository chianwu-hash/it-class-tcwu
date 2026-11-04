// Real product HTML/modules/DOM; only Auth/RPC/media origins are synthetic fixtures.
const fs=require('node:fs/promises'),assert=require('node:assert/strict'),{createRequire}=require('node:module');
const runtime=createRequire('D:/projects/cdp-tools/package.json'),{connectCdp}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
const origin=process.env.QUIZ_BATCH2_ORIGIN||'http://localhost:4391',out=process.env.QUIZ_BATCH2_OUT||'automation/output/quiz/batch2/browser';
const ids={bank:'10000000-0000-4000-8000-000000000001',version:'20000000-0000-4000-8000-000000000001',session:'30000000-0000-4000-8000-000000000001',attempt:'40000000-0000-4000-8000-000000000001',extension:'30000000-0000-4000-8000-000000000002'};
const c=text=>({text,media:[]}),catalog={school_year:'115',volume:'3年級上學期',subject:'數學',unit:'第一單元'},image='https://quiz-media.invalid/00000000-0000-4000-8000-000000000001/'+String(1).padStart(64,'0');
const q={id:'q-one',type:'single',block_id:'b-one',material:c(''),prompt:{text:'合成錯題圖',media:[{kind:'image',url:image,alt:'示意圖'}]},options:[{id:'b',content:c('原順序第一個')},{id:'a',content:c('原順序第二個')}]};
const document={schema:1,title:'固定版本測試',catalog,blocks:[{id:'b-one',material:c(''),questions:[{...q,answer:{option_id:'a'},explanation:c('完整解析')}]}]};delete document.blocks[0].questions[0].block_id;delete document.blocks[0].questions[0].material;
const auth=`export const SUPABASE_URL='${origin}/mock-supabase',SUPABASE_ANON_KEY='synthetic-only';
const users={a:{id:'a',email:'a@example.invalid'},b:{id:'b',email:'b@example.invalid'},teacher:{id:'teacher',email:'teacher@example.invalid'}};const callbacks=[];
window.fixtureSession={user:users[sessionStorage.getItem('fixture-user')||'a'],access_token:'fixture-'+(sessionStorage.getItem('fixture-user')||'a'),expires_at:Math.floor(Date.now()/1000)+3600};
window.fixtureSwitch=id=>{window.fixtureSession=id?{user:users[id],access_token:'fixture-'+id,expires_at:Math.floor(Date.now()/1000)+3600}:null;if(id)sessionStorage.setItem('fixture-user',id);else sessionStorage.removeItem('fixture-user');callbacks.forEach(f=>f(id?'SIGNED_IN':'SIGNED_OUT',window.fixtureSession));};
export const resolveSession=async()=>window.fixtureSession,isTeacher=s=>s?.user?.id==='teacher',beginCentralizedLogin=()=>{},signOutAndReload=async()=>window.fixtureSwitch(null);
export const supabase={auth:{getSession:async()=>({data:{session:window.fixtureSession}}),onAuthStateChange:f=>callbacks.push(f)},rpc:async()=>({data:[{email:window.fixtureSession?.user.email,class_code:'304',seat_no:1,display_name:'合成學生',student_code:'30401'}]})};`;
(async()=>{
 const {browser}=await connectCdp({cdpUrl:process.env.CDP_URL,targetUrl:process.env.QUIZ_BROWSER_URL,puppeteer:runtime('puppeteer-core')});
 try{
  await fs.mkdir(out,{recursive:true});const page=await browser.targets().find(t=>t._targetId===process.argv[2]).page();page.setDefaultTimeout(15000);
  const session=await page.target().createCDPSession();session.grantForegroundOnce('Page.bringToFront','驗證錯題及教師版本按需讀取');await session.send('Page.bringToFront');
  let canExtend=true,legacy=false,lost=true,delayDetail=false,releaseDetail,delayVersion=false,releaseVersion;const calls=[],errors=[],composed=new Map();
  page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);
  page.on('request',async request=>{try{
   const url=new URL(request.url());if(url.origin==='https://fixture.example.invalid')return request.respond({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="#86bfa7"/></svg>'});
   if(url.origin!==origin)return request.abort();
   const send=data=>request.respond({contentType:'application/json',body:JSON.stringify(data)});
   const deny=code=>request.respond({status:403,contentType:'application/json',body:JSON.stringify({message:code})});
   if(url.pathname==='/shared/auth.js')return request.respond({contentType:'text/javascript',body:auth});
   if(url.pathname.startsWith('/mock-supabase/')){
    const uid=request.headers().authorization?.replace('Bearer fixture-',''),body=JSON.parse(request.postData()||'{}'),name=url.pathname.split('/').at(-1),data=body.p_data||body.data||{};calls.push({uid,name,body});
    if(name==='quiz_library_sessions'){if(uid==='teacher')return deny('student_required');return send({role:'student',grade:3,sessions:[{id:ids.session,version_id:ids.version,title:'準備好的練習',catalog,total:2,answered:1,correct:0,status:'open',generated:false},...(composed.size?[{id:ids.extension,title:'延伸練習',catalog,total:3,answered:0,correct:0,status:'open',generated:true,display_name:'已保存延伸卷',generated_kind:'extension'}]:[])]});}
    if(name==='quiz_pool_catalog')return send({available:true,courses:[{id:'math',grade:3,subject:'數學',units:[{id:1,count:10}],extension_available:true}],name_characters:[]});
    if(name==='quiz_wrong_questions'){
     if(data.action==='detail'){if(delayDetail){delayDetail=false;await new Promise(r=>releaseDetail=r);}return send({attempt_id:ids.attempt,session_id:ids.session,...(legacy?{}:{version_id:ids.version,can_extend:canExtend}),question_id:q.id,answered_at:'2026-10-29T00:00:00Z',title:'錯題卷',catalog,number:1,preview:'合成錯題',question:q,response:'b',review:{question_id:q.id,correct:false,answer:{option_id:'a'},explanation:c('這一題的解析')}});}
     return send({role:'student',grade:3,total:uid==='b'?0:1,facets:[{subject:'數學',unit:'第一單元'}],items:uid==='b'?[]:[{attempt_id:ids.attempt,session_id:ids.session,question_id:q.id,answered_at:'2026-10-29T00:00:00Z',title:'錯題卷',catalog,number:1,preview:'合成錯題'}]});
    }
    if(name==='quiz_compose'){assert.equal(data.kind,'extension');const existing=composed.has(data.request_id);composed.set(data.request_id,ids.extension);if(lost){lost=false;return request.abort('failed');}return send({session_id:ids.extension,display_name:'已保存延伸卷',distribution:{actual:3,easy:1,medium:2,hard:0},reused:existing});}
    if(name==='quiz-media')return send({url:'https://fixture.example.invalid/figure.svg'});
    if(name==='quiz_version_browser'){
     if(uid!=='teacher')return deny('teacher_required');assert.equal(data.bank_id,ids.bank);
     if(data.action==='get'){if(delayVersion){delayVersion=false;await new Promise(r=>releaseVersion=r);}return send({id:ids.version,bank_id:ids.bank,revision:3,created_at:'2026-10-29T00:00:00Z',document});}
     return send({versions:[{id:ids.version,bank_id:ids.bank,revision:3,created_at:'2026-10-29T00:00:00Z',title:document.title,catalog,total:1}]});
    }
    if(name==='quiz_monitor'){assert.equal(uid,'teacher');assert.equal(data.session_id,ids.session);return send({status:'open',students:[{user_id:'a',answered:2,total:10,class_code:'304',seat_no:1,display_name:'合成學生',last_submitted_at:'2026-10-29T00:00:00Z'}]});}
    if(name==='quiz_action'){
     if(uid!=='teacher')return deny('teacher_required');
     if(body.p_action==='list')return send({banks:[{id:ids.bank,revision:3,title:document.title,catalog,updated_at:'2026-10-29T00:00:00Z'}]});
     if(body.p_action==='get')return send({id:ids.bank,revision:3,draft:document});
     if(body.p_action==='sessions')return send({sessions:[]});
     if(body.p_action==='open'){assert.equal(data.version_id,ids.version);return send({id:ids.session});}
     throw Error('unexpected old action '+body.p_action);
    }
    throw Error('unexpected endpoint '+name);
   }
   if(!/^\/(shared\/[A-Za-z0-9_./-]+|admin-quiz\.html|grade[36]\/115-1\/(quiz-library\.html|navbar\.js))$/.test(url.pathname)||url.pathname.includes('..'))return request.respond({status:404,body:''});
   if(process.env.QUIZ_BATCH2_LIVE==='1')return request.continue();
   const type=url.pathname.endsWith('.html')?'text/html;charset=utf-8':url.pathname.endsWith('.css')?'text/css':url.pathname.endsWith('.woff2')?'font/woff2':'text/javascript';
   return request.respond({contentType:type,body:await fs.readFile('.'+url.pathname)});
  }catch(e){errors.push(e.message);if(!request.isInterceptResolutionHandled?.())try{await request.respond({status:500,body:'fixture failed'});}catch{}}});
  const count=name=>calls.filter(c=>c.name===name).length;
  await page.setViewport({width:1366,height:768});await page.goto(origin+'/grade3/115-1/quiz-library.html',{waitUntil:'networkidle0'});await page.waitForSelector('.paper-start');assert.equal(count('quiz_pool_catalog'),0);assert.equal(count('quiz_library_sessions'),1);
  await page.click('#refresh-library');await page.waitForFunction(()=>!document.querySelector('#refresh-library').disabled);assert.equal(count('quiz_pool_catalog'),0);
  await page.click('#tab-wrong');await page.waitForSelector('.wrong-card button');await page.click('.wrong-card button');await page.waitForSelector('.wrong-extension');assert.equal(count('quiz_pool_catalog'),0,'new detail must not load composer catalog');
  assert.deepEqual(await page.$$eval('.wrong-option strong',nodes=>nodes.map(n=>n.textContent)),['A','B']);assert.match(await page.$eval('.wrong-option',n=>n.textContent),/原順序第一個/);
  await page.waitForFunction(()=>document.querySelector('#wrong-detail img')?.naturalWidth>0);const mediaBefore=count('quiz-media');await page.click('#wrong-detail img');await page.waitForSelector('#lightbox:not(.hidden)');await page.click('#lightbox-close');assert.equal(count('quiz-media'),mediaBefore);
  await page.click('.wrong-extension button');await page.waitForFunction(()=>document.querySelector('.wrong-extension [role="status"]')?.textContent&&!document.querySelector('.wrong-extension button').disabled);
  await page.click('.wrong-extension button');await page.waitForSelector('.wrong-extension[data-state="saved"]');const requests=calls.filter(c=>c.name==='quiz_compose');assert.equal(requests.length,2);assert.equal(requests[0].body.p_data.request_id,requests[1].body.p_data.request_id);assert.equal(composed.size,1);
  await page.click('#wrong-back');canExtend=false;await page.click('.wrong-card button');await page.waitForFunction(()=>!document.querySelector('#wrong-detail').hidden);assert.equal(await page.$('.wrong-extension'),null);assert.equal(count('quiz_pool_catalog'),0);
  await page.click('#wrong-back');legacy=true;await page.click('.wrong-card button');await page.waitForSelector('.wrong-extension');assert.equal(count('quiz_pool_catalog'),1,'old detail fallback retained');legacy=false;
  await page.click('#wrong-back');delayDetail=true;await page.click('.wrong-card button');await page.waitForFunction(()=>document.querySelector('#wrong-status').textContent.includes('正在讀取'));
  await page.evaluate(()=>fixtureSwitch('b'));await page.waitForFunction(()=>document.querySelector('#wrong-status').textContent.includes('目前沒有'));releaseDetail();await new Promise(r=>setTimeout(r,150));assert.equal(await page.$('#wrong-detail .question'),null);
  await page.evaluate(()=>sessionStorage.setItem('fixture-user','teacher'));await page.goto(origin+'/admin-quiz.html',{waitUntil:'networkidle0'});await page.waitForSelector('.bank-item');await page.click('.bank-item');await page.waitForSelector('.version-row');
  assert.equal(count('quiz_version_browser'),1);assert.equal(calls.filter(c=>c.name==='quiz_version_browser'&&c.body.p_data.action==='get').length,0);
  const clickVersion=text=>page.$$eval('.version-row button',(nodes,text)=>nodes.find(n=>n.textContent===text).click(),text);
  await clickVersion('用此版本開場');assert.equal(count('quiz_version_browser'),1,'selecting a version needs no document');assert.match(await page.$eval('#quiz-sessions',n=>n.textContent),/固定版本測試/);
  await clickVersion('預覽此版本');await page.waitForSelector('#preview-dialog[open]');assert.equal(calls.filter(c=>c.name==='quiz_version_browser'&&c.body.p_data.action==='get').length,1);assert.match(await page.$eval('#preview-body',n=>n.textContent),/完整解析/);await page.click('#close-preview');
  const monitor=await page.evaluate(async session_id=>{const {createQuizRequest}=await import('/shared/quiz-api.mjs');const request=await createQuizRequest({getSession:()=>fixtureSession});return request('monitor',{session_id});},ids.session);assert.equal(monitor.students[0].answered,2);assert.equal(count('quiz_monitor'),1);assert.equal(calls.filter(c=>c.name==='quiz_action'&&c.body.p_action==='monitor').length,0);
  delayVersion=true;await clickVersion('預覽此版本');await page.waitForFunction(()=>document.querySelector('#workspace').inert);await page.evaluate(()=>fixtureSwitch('a'));await page.waitForFunction(()=>document.querySelector('#workspace').hidden);releaseVersion();await new Promise(r=>setTimeout(r,150));assert.equal(await page.$('#preview-dialog[open]'),null);assert.equal(await page.$eval('#preview-body',n=>n.textContent),'');
  assert.deepEqual(errors,[]);const report={passed:true,libraryThin:true,initialCatalog:0,detailCatalog:0,optionsPreserved:true,scopedLightbox:true,sameRequestRetry:true,oneExtensionSaved:true,noExtensionWhenUnavailable:true,oldDetailFallback:true,lateDetailIsolated:true,teacherMetadataOnly:true,selectionWithoutDocument:true,previewSingleDocument:true,latePreviewIsolated:true,errors};await fs.writeFile(out+'/browser.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.disconnect();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
