// Local synthetic browser verification. Run only through the registered lease worker.
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const puppeteer=require('D:/projects/cdp-tools/node_modules/puppeteer-core');
const root=path.resolve(__dirname,'../..'),origin='http://127.0.0.1:4487';
const out=path.join(root,'.chat-mode/evidence/teacher-tree');
const course='grade3-115-1',stamp='2026-11-06T07:30:00Z';
const pupil={mapping:'linked',class_code:'301',seat_no:1,display_name:'合成測試同學'};
function snapshot(level=1,pet='dog',skin='b'){
 const awards=Array.from({length:level===2?44:3},(_,i)=>({id:'learning:115:1:'+i,source_type:'learning',grade:3,title:'合成延伸葉 '+i,half_units:2,awarded_at:stamp}));
 const flowers=Array.from({length:level===2?10:1},(_,i)=>({id:'past:synthetic'+i,source_type:'past_exam',grade:3,title:'合成考古卷 '+i,paper_id:'synthetic',attempt_id:'00000000-0000-4000-8000-000000000100',awarded_at:stamp}));
 return{identity:pupil,as_of:stamp,weekly_rows:[],foundation:[],assignments:[],periods:[],quiz:{awards,flowers,partner:[]},rehearsal:[],
  growth:level===2?{reward_version:2,foundation_reward_version:1,order:[],baseline:[],seen_at:null}:null,
  unlocks:['pet:'+pet],catalog:[{key:'pet:'+pet,pet,leaves:12}],choices:{pet,homes:{[pet]:pet==='dog'?'a':'b'},homeVisible:true,modes:{[pet]:'walk'}},skin};
}
const callbacks=`const listeners=[];let current={user:{id:'teacher',email:'teacher@example.invalid'},access_token:'synthetic'};
 export const SUPABASE_URL=location.origin,SUPABASE_ANON_KEY='synthetic',TEACHER_EMAILS=[],AUTH_STORAGE_KEY='synthetic',LOGIN_RETURN_KEY='synthetic';
 export const isTeacher=s=>s?.user?.id==='teacher';export const getStoredAccessToken=()=>current?.access_token;
 export const resolveSession=async()=>current;export const getSession=resolveSession;
 export const signInWithGoogle=()=>{};export const beginCentralizedLogin=()=>{};export const signOutAndReload=()=>{};
 export const getHomeRedirectUrl=()=>'/';export const getAdminRedirectUrl=()=>'/admin-learning.html';export const requireHttpForAuth=()=>{};export const storeLoginReturn=()=>{};export const consumePendingRedirect=()=>null;
 export const supabase={auth:{onAuthStateChange:fn=>{listeners.push(fn);}},rpc:()=>{throw Error('unexpected_student_rpc');}};
 window.__treeFixture={change(role){current=role?{user:{id:role,email:role+'@example.invalid'},access_token:'synthetic'}:null;listeners.forEach(fn=>fn('SIGNED_IN',current));}};`;
let data=snapshot(),delay=0,fail=false,calls=[];
const server=http.createServer(async(req,res)=>{
 try{
 const url=new URL(req.url,origin),reply=(status,body,type='application/json')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store'});res.end(body);};
 if(url.pathname==='/shared/auth.js')return reply(200,callbacks,'text/javascript');
 if(req.method==='POST'){
  let raw='';for await(const chunk of req)raw+=chunk;const p=JSON.parse(raw);calls.push({path:url.pathname,...p});
  if(p.p_action==='tree_snapshot'){const saved=structuredClone(data),slow=delay;if(slow)await new Promise(r=>setTimeout(r,slow));return reply(fail?503:200,JSON.stringify(fail?{message:'synthetic_outage'}:saved));}
  if(p.p_action==='roster')return reply(200,JSON.stringify({classes:['301'],total:1,items:[{...pupil,student_code:'30101',mappings:1}],limit:20,offset:0}));
  if(p.p_action==='profile')return reply(200,JSON.stringify({identity:pupil,as_of:stamp,weekly:{completed:1,recorded:1},typing:{english:1,zhuyin:0},papers:{completed:1,created:1}}));
  return reply(200,JSON.stringify({identity:pupil,as_of:stamp,weekly_rows:[],foundation:[],awards:[],assignments:[],periods:[],items:[],total:0,offset:0,limit:20}));
 }
 const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+path.sep))return reply(403,'{}');
 const ext=path.extname(file),types={'.mjs':'text/javascript','.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.mp3':'audio/mpeg'};
 if(!types[ext])return reply(404,'{}');reply(200,await fs.readFile(file),types[ext]);
 }catch{res.writeHead(404);res.end();}
});
(async()=>{
 await fs.mkdir(out,{recursive:true});await new Promise(r=>server.listen(4487,'127.0.0.1',r));
 console.log('synthetic_server_ready');
 const browser=await puppeteer.connect({browserURL:process.env.AI_WORK_BROWSER_CDP_URL,defaultViewport:null,protocolTimeout:30000});
 console.log('leased_browser_connected');
 const target=browser.targets().find(t=>t._targetId===process.env.AI_WORK_BROWSER_TARGET_ID);assert(target,'exact_target_required');const page=await target.page(),errors=[],results=[];
 const check=(name,condition)=>{assert(condition,name);results.push(name);console.log(name);};
 const url=()=>origin+'/my-tree.html?teacherView=1&course='+course+'&class_code=301&seat_no=1';
 const ready=()=>page.waitForFunction(()=>document.getElementById('leaf-text').textContent==='已入帳葉片',{polling:5000,timeout:30000});
 const sceneReady=()=>page.waitForFunction(()=>document.querySelector('.garden-upgrade iframe')?.contentWindow.__gardenScene?.snapshot().ready,{polling:5000,timeout:60000});
 try{
 page.on('pageerror',e=>errors.push(e.message));
 // Interception is needed to prove the synthetic run never reaches a real auth/data service.
 await page.setRequestInterception(true);page.on('request',r=>new URL(r.url()).origin===origin||r.url().startsWith('data:')?r.continue():r.abort());
 const cdp=await page.target().createCDPSession();cdp.grantForegroundOnce('Page.bringToFront','驗證教師努力樹的場景載入與寵物動畫');await cdp.send('Page.bringToFront');
 await page.setViewport({width:1360,height:980});
 await page.goto(origin+'/admin-learning.html',{waitUntil:'domcontentloaded'});await page.waitForSelector('.student-button');await page.click('.student-button');await page.waitForSelector('#student-tree-link');
 check('教師個人檔案提供獨立新分頁入口',await page.$eval('#student-tree-link',a=>a.target==='_blank'&&a.href.includes('teacherView=1')&&a.href.includes('seat_no=1')));
 await page.goto(url(),{waitUntil:'domcontentloaded'});await ready();
 check('讀取狀態會以輔助技術提示',await page.$eval('#notice-card',e=>e.getAttribute('role')==='status'&&e.getAttribute('aria-live')==='polite'));
 check('第一級沿用學生原本樹形、葉花可查來源',await page.$eval('#reward-layer',e=>e.querySelectorAll('.leaf').length===3&&e.querySelectorAll('.flower').length===1));
 await page.click('#reward-layer .leaf');check('點葉顯示來源且不提供學生操作連結',await page.$eval('#detail-text',e=>e.textContent.length>5&&!e.querySelector('a')));
 check('不顯示花色、寵物與樹型修改控制',await page.evaluate(()=>document.querySelector('.palette-card').hidden&&!document.querySelector('.garden-companions')));
 await page.evaluate(()=>document.querySelector('.tree-image').src='/assets/synthetic-missing.webp');await page.waitForFunction(()=>document.querySelector('.tree-image').complete&&!document.querySelector('.tree-image').naturalWidth,{polling:5000});
 await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='更新場景資訊').click());
 check('第一級圖檔失敗明確列入場景資訊',await page.evaluate(()=>[...document.querySelectorAll('details')].some(d=>d.textContent.includes('第一級樹形素材載入失敗'))));
 await page.evaluate(()=>document.querySelector('.tree-image').src='/assets/reward-tree/empty-tree-base-v1-q80.webp');await page.waitForFunction(()=>document.querySelector('.tree-image').naturalWidth>0,{polling:5000});
 await page.screenshot({path:path.join(out,'level-one.png'),fullPage:true});
 data=snapshot(2);await page.evaluate(()=>[...document.querySelectorAll('.actions button')].find(b=>b.textContent==='重新讀取').click());await ready();await sceneReady();
 for(const pet of ['cat','dog','rabbit'])for(const skin of ['a','b']){
  data=snapshot(2,pet,skin);await page.evaluate(()=>[...document.querySelectorAll('.actions button')].find(b=>b.textContent==='重新讀取').click());await ready();await sceneReady();
  const s=await page.evaluate(()=>document.querySelector('.garden-upgrade iframe').contentWindow.__gardenScene.snapshot());
  check(`第二級 ${pet}/${skin} 場景、花葉與素材`,s.pet===pet&&s.counts.leaves===44&&s.counts.flowers===10&&!s.assetIssues.length);
 }
 await page.screenshot({path:path.join(out,'level-two.png'),fullPage:true});
 await page.setViewport({width:390,height:844});
 check('手機版無水平溢出',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});
 await page.evaluate(()=>window.__treeFixture.change('student'));check('切換成學生立即清空資料與場景',await page.evaluate(()=>document.querySelector('.tree-shell').hidden&&!document.querySelector('iframe')&&document.getElementById('profile-title').textContent==='尚未讀取學生'));
 delay=1400;const prior=calls.length;await page.evaluate(()=>window.__treeFixture.change('teacher'));
 for(let i=0;i<20&&calls.length===prior;i++)await new Promise(r=>setTimeout(r,50));assert(calls.length>prior,'delayed_request_started');
 await page.evaluate(()=>window.__treeFixture.change(null));await new Promise(r=>setTimeout(r,1600));check('登出後晚到回應不回填學生資料',await page.$eval('.tree-shell',e=>e.hidden));
 delay=0;fail=true;await page.evaluate(()=>window.__treeFixture.change('teacher'));await page.waitForFunction(()=>document.getElementById('notice-card').classList.contains('error')&&document.getElementById('notice-card').textContent.includes('暫時無法讀取'),{polling:5000,timeout:15000});check('服務失敗顯示錯誤且不顯示為零成果',await page.$eval('#leaf-count',e=>e.textContent==='—'));
 check('所有樹查詢僅使用教師唯讀 RPC',calls.filter(c=>c.p_action==='tree_snapshot').every(c=>c.path==='/rest/v1/rpc/admin_learning_tree'));
 check('未呼叫學生升級、已讀、寵物或獎勵寫入端點',calls.every(c=>/^\/rest\/v1\/rpc\/admin_learning_(tree|action|rewards)$/.test(c.path)));
 check('無未捕捉瀏覽器例外',errors.length===0);
 await fs.writeFile(path.join(out,'browser.json'),JSON.stringify({passed:results.length,results,errors,calls},null,2));console.log(JSON.stringify({passed:results.length,results,errors}));
 }catch(e){await fs.writeFile(path.join(out,'failure.json'),JSON.stringify({message:e.message,results,errors,calls},null,2));throw e;}
 finally{await page.close();await browser.disconnect();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
