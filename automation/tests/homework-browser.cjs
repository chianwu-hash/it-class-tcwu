const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {connectCdp,safeScreenshot}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
const root=path.resolve(__dirname,'../..');let actor=null,calls=[],offset=0,interrupted=false,submission=null;
const assignment={id:'10000000-0000-0000-0000-000000000001',course_id:'grade6-115-1',week_code:'01',class_code:'601',title:'Canva 影片作業',instructions:'交一段自己的影片',state:'open'};
const server=http.createServer(async(req,res)=>{
 try{
 const p=new URL(req.url,'http://localhost').pathname;res.setHeader('Cache-Control','no-store');
 if(p==='/favicon.ico'){res.writeHead(204).end();return;}
 if(p==='/shared/auth.js'){
 res.setHeader('Content-Type','text/javascript');return res.end(`export const SUPABASE_URL='http://localhost:3000';export const SUPABASE_ANON_KEY='test';export const getStoredAccessToken=()=> 'test';export const isTeacher=s=>s?.user?.email==='chianwu@gmail.com';export const resolveSession=async()=>(${JSON.stringify(actor)});export const beginCentralizedLogin=()=>{window.__loginCalled=true};export const signOutAndReload=()=>{};export const supabase={auth:{onAuthStateChange:fn=>{window.__authChange=fn}}};`);
 }
 if(p==='/rest/v1/rpc/reading_action'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({periods:[]}));}
 if(p==='/rest/v1/rpc/homework_action'||p==='/functions/v1/homework'||p==='/rest/v1/rpc/homework_review'){
 const parts=[];for await(const c of req)parts.push(c);const buf=Buffer.concat(parts);let body;
 if(req.headers['content-type'].startsWith('multipart/form-data')){
 const form=await new Response(buf,{headers:{'Content-Type':req.headers['content-type']}}).formData();body={action:'chunk',offset:Number(form.get('offset')),size:form.get('chunk').size};
 }else body=JSON.parse(buf);
 const action=body.p_action||body.action;calls.push(action);res.setHeader('Content-Type','application/json');let data={};
 if(action==='list')data={assignments:[{...assignment,submission}],max_file_bytes:104857600,teacher:actor?.user?.email==='chianwu@gmail.com'};
 if(action==='prepare')data={done:false,offset};
 if(action==='chunk'){
 assert.equal(body.offset,offset);offset+=body.size;
 if(!interrupted){interrupted=true;res.statusCode=503;return res.end(JSON.stringify({error:'service_unavailable'}));}
 const done=offset===9*1024*1024;
 if(done)submission={upload_id:'upload',status:'submitted',file_name:'canva.mp4',submitted_at:new Date().toISOString(),feedback:''};
 data={done,offset};
 }
 if(action==='roster')data={assignment,students:[{user_id:'student',class_code:'601',seat_no:1,display_name:'測試同學',...submission,drive_file_id:'test-file'}]};
 if(action==='save'){assert.equal(body.p_data.upload_id,'upload');submission.status=body.p_data.status;data={ok:true};}
 return res.end(JSON.stringify(data));
 }
 const target=path.resolve(root,'.'+p);if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html;charset=utf-8');res.end(await fs.readFile(target));
 }catch(e){res.writeHead(500).end();console.error(e.message);}
});
(async()=>{
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(3000,'127.0.0.1',resolve)});
 let c,page;let stage='start';
 try{
 const puppeteer=require('D:/projects/cdp-tools/node_modules/puppeteer-core');const browser=await puppeteer.connect({browserURL:'http://127.0.0.1:9232',waitForInitiallyDiscoveredTargets:false});c={browser,disconnect:()=>browser.disconnect()};const rootSession=await browser.target().createCDPSession();const {targetId}=await rootSession.send('Target.createTarget',{url:'about:blank'});page=await (await browser.waitForTarget(t=>t._targetId===targetId)).page();await page.setCacheEnabled(false);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 stage='anonymous';await page.goto('http://localhost:3000/grade6/115-1/homework.html');await page.waitForFunction(()=>document.getElementById('auth-status')?.textContent==='未登入');
 assert.equal(await page.$eval('#refresh-homework',e=>e.disabled),true);assert.deepEqual(calls,[]);await page.click('#login-btn');assert.equal(await page.evaluate(()=>window.__loginCalled),true);
 stage='student';actor={user:{id:'student',email:'student@school.test'}};await page.reload();await page.waitForSelector('input[type=file]');
 await page.$eval('.submission-details',e=>e.open=true);
 assert.equal(await page.$eval('progress',e=>e.hidden),true);
 await page.evaluate(()=>{const input=document.querySelector('input[type=file]'),zone=document.querySelector('.homework-dropzone');const picker=new DataTransfer();picker.items.add(new File(['picture'],'picked.png',{type:'image/png'}));input.files=picker.files;input.dispatchEvent(new Event('change',{bubbles:true}));if(!zone.textContent.includes('picked.png'))throw Error('Picker selection not displayed');const dt=new DataTransfer();dt.items.add(new File([new Uint8Array(9*1024*1024)],'canva.mp4',{type:'video/mp4'}));zone.dispatchEvent(new DragEvent('dragenter',{bubbles:true,cancelable:true,dataTransfer:dt}));if(!zone.classList.contains('is-dragging'))throw Error('Drop highlight missing');zone.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));if(input.files[0].name!=='canva.mp4'||zone.classList.contains('is-dragging'))throw Error('Drop selection failed');dt.items.add(new File(['second'],'second.png'));zone.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));if(input.files.length!==1||input.files[0].name!=='canva.mp4')throw Error('Multiple files replaced selection');const bad=new DataTransfer();bad.items.add(new File(['bad'],'bad.exe'));zone.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:bad}));if(input.files[0].name!=='canva.mp4')throw Error('Invalid file replaced selection');});
 assert.equal(offset,0);assert(await page.$eval('.homework-dropzone',e=>e.getBoundingClientRect().height>=190));
 await safeScreenshot(page,{path:path.join(root,'tmp/homework-dropzone.png'),fullPage:true});
 await page.evaluate(()=>{document.querySelector('form').requestSubmit();const dt=new DataTransfer();dt.items.add(new File(['busy'],'busy.png'));document.querySelector('.homework-dropzone').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));if(document.querySelector('input[type=file]').files[0].name!=='canva.mp4')throw Error('Busy upload selection changed');});await page.waitForFunction(()=>document.getElementById('homework-status').textContent.includes('稍後'));
 assert.equal(offset,4*1024*1024);assert.equal(submission,null);assert.equal(await page.$eval('progress',e=>e.hidden),true);
 stage='resume';await page.click('form button');await page.waitForFunction(()=>document.getElementById('homework-status').textContent.includes('已繳交，'));
 assert.equal(offset,9*1024*1024);assert.equal(submission.status,'submitted');assert.equal(calls.filter(x=>x==='chunk').length,3);assert.equal(await page.$eval('progress',e=>e.hidden),true);assert(await page.$eval('#homework-status',e=>e.textContent.includes('上傳完成')));
 stage='reload';await page.reload();await page.waitForFunction(()=>document.querySelector('.badge')?.textContent.includes('待評'));
 stage='tree-model';const tree=await page.evaluate(async()=>{
 const {deriveRewardTreeModel}=await import('/shared/reward-tree-model.js');const {homeworkTreeData}=await import('/shared/homework-api.js');
 const a={id:'test',course_id:'grade6-115-1',week_code:'01',title:'影片',submission:{status:'passed',feedback:'已確認'}};
 const data=homeworkTreeData([a]);const passed=deriveRewardTreeModel(data.rows,data.activities);a.submission.status='submitted';const next=homeworkTreeData([a]);const reupload=deriveRewardTreeModel(next.rows,next.activities);
 const legacy=deriveRewardTreeModel([{course_id:'old',week_code:'01',activity_key:'typing',completed:true}],[{courseId:'old',weekCode:'01',activityKey:'typing',type:'typing',totalLevels:3}]);
 return {passed:[passed.leaves.length,passed.flowers.length],reupload:[reupload.leaves.length,reupload.flowers.length],legacy:[legacy.leaves.length,legacy.flowers.length]};});
 assert.deepEqual(tree,{passed:[2,0],reupload:[1,0],legacy:[2,1]});
 stage='student-admin';await page.goto('http://localhost:3000/admin-homework.html');await page.waitForFunction(()=>document.getElementById('auth-status').textContent.includes('student'));assert.equal(await page.$eval('#teacher-tools',e=>e.hidden),true);
 stage='teacher';actor={user:{id:'teacher',email:'chianwu@gmail.com'}};await page.reload();await page.waitForSelector('#assignment-list button');
 await page.evaluate(()=>Array.from(document.querySelectorAll('button')).find(n=>n.textContent==='查看收件與評比').click());await page.waitForSelector('#roster-list button');
 await page.evaluate(()=>Array.from(document.querySelectorAll('#roster-list button')).find(n=>n.textContent==='過關').click());
 await page.waitForFunction(()=>document.getElementById('homework-status').textContent.includes('同步保存'));assert.equal(submission.status,'passed');
 stage='refocus';const before=calls.length;await page.evaluate(()=>window.__authChange('SIGNED_IN',{user:{id:'teacher',email:'chianwu@gmail.com'}}));assert.equal(calls.length,before);
 stage='mobile';await page.setViewport({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);console.log('PASS file picker, drag/drop selection and highlight, multi-file/invalid-format rejection, no auto-upload, busy selection lock, anonymous/student isolation, 9 MB interrupted/resumed upload, persisted status, teacher review, tree rewards, no refocus fetch, mobile layout. Mock Auth/API only.');
 }catch(e){throw new Error(`${stage}: ${e.message}`)}finally{if(page)await page.close();if(c)await c.disconnect();server.closeAllConnections();server.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;server.close()});
