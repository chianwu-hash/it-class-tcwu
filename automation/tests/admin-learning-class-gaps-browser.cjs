const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const puppeteer=require('D:/projects/cdp-tools/node_modules/puppeteer-core');
const out=path.resolve(__dirname,'../output/admin-learning-class-gaps-20261101');
let phase='connect';
const mark=value=>{phase=value;console.log(JSON.stringify({phase:value}));};
(async()=>{
 const browser=await puppeteer.connect({browserURL:process.env.AI_WORK_BROWSER_CDP_URL,defaultViewport:null,protocolTimeout:20000});
 const target=browser.targets().find(t=>t._targetId===process.argv[2]);if(!target){await browser.disconnect();throw Error('owned_target_missing');}
 mark('target-found');const page=await target.page(),errors=[],results=[];let hooked=false,script;
 try{
  page.setDefaultTimeout(20000);page.on('pageerror',()=>errors.push('page_script_error'));
  script=await page.evaluateOnNewDocument(()=>{
   const original=window.fetch;window.__gapOriginal=original;window.__gapReads=[];window.__gapActions=[];
   window.fetch=async(...args)=>{
    const response=await original(...args);
    if(/^https:\/\/upxgyusodibaqcrocdzj\.supabase\.co\/rest\/v1\/rpc\/admin_learning_(action|rewards)$/.test(String(args[0]))){
     const body=JSON.parse(args[1].body);window.__gapActions.push(body.p_action);
     if(body.p_action==='class_rewards')window.__gapReads.push({status:response.status,data:await response.clone().json()});
    }
    return response;
   };
  });hooked=true;
  mark('navigate-local');await page.setViewport({width:1360,height:1020});await page.goto('http://localhost:3000/admin-learning.html',{waitUntil:'domcontentloaded'});
  const cdp=await page.target().createCDPSession();cdp.grantForegroundOnce('Page.bringToFront','驗證本機班級解鎖差額及必要的教師 Google 登入');await cdp.send('Page.bringToFront');
  mark('verify-teacher');let clicked=false,ready=false;
  for(let i=0;i<12;i++){
   const s=await page.evaluate(()=>({host:location.hostname,teacher:document.querySelector('#identity')?.textContent==='chianwu@gmail.com',ready:!!document.querySelector('#roster-list .student-button'),locked:document.querySelector('#locked')?.hidden===false}));
   if(s.host==='localhost'&&s.teacher&&s.ready){ready=true;break;}
   if(s.locked&&!clicked){clicked=true;mark('teacher-login');await page.click('#teacher-login');}
   if(s.host==='accounts.google.com'){const account=await page.$('[data-identifier="chianwu@gmail.com"]');if(account)await account.click();}
   await new Promise(r=>setTimeout(r,5000));
  }
  assert.equal(ready,true,'local_google_teacher_required');mark('teacher-ready');
  assert.equal(await page.$eval('#environment',e=>e.textContent.includes('尚未上線')),true);
  const verify=course=>page.evaluate(async course=>{
   const m=await import('/shared/admin-learning-garden.mjs'),sort=await import('/shared/admin-learning-rewards.mjs');
   const read=window.__gapReads.at(-1),s=m.summarizeClassGardenRewards(read.data,course),items=sort.sortClassRewards(s.items,document.querySelector('#reward-sort').value);
   const all=document.querySelector('#show-all-class-gaps').checked,rows=[...document.querySelectorAll('.class-reward-table tbody tr')];
   return {status:read.status,source:read.data.read_source,total:s.total,shown:rows.length,all,
    match:rows.every((row,i)=>{
     const expected=m.classUnlockConditions(items[i].garden,all),cell=row.querySelector('[data-count="unlockConditions"]'),groups=[...cell.querySelectorAll('.class-gap-list li')];
     return row.dataset.studentCode===items[i].student_code&&(cell.querySelector(':scope > .unlock-gap')?.textContent||'')===expected.message&&groups.length===expected.groups.length&&groups.every((li,j)=>
      li.querySelector('p').textContent===expected.groups[j].remaining&&li.dataset.gapStatus===expected.groups[j].status&&expected.groups[j].labels.every(label=>li.querySelector('strong').textContent.includes(label)));
    }),groups:rows.reduce((n,row)=>n+row.querySelectorAll('.class-gap-list li').length,0),reads:window.__gapReads.length};
  },course);
  for(const cls of ['301','604']){
   mark('verify-class-'+cls);
   const course=`grade${cls[0]}-115-1`;await page.select('#course',course);
   assert.equal(await page.$eval('#show-all-class-gaps',e=>e.checked),false);
   await page.waitForFunction(cls=>[...document.querySelector('#reward-class').options].some(o=>o.value===cls),{},cls);await page.select('#reward-class',cls);
   await page.waitForSelector('.class-reward-table tbody tr',{timeout:30000});
   const brief=await verify(course);assert.equal(brief.status,200);assert.equal(brief.source,'production-rpc');assert.equal(brief.shown,brief.total);assert.equal(brief.match,true);
   await page.click('#show-all-class-gaps');const full=await verify(course);assert.equal(full.match,true);assert.equal(full.reads,brief.reads);assert.ok(full.groups>brief.groups);
   await page.select('#reward-sort','flowers');assert.equal((await verify(course)).match,true);
   await page.click('#refresh-class-rewards');await page.waitForSelector('.class-reward-table tbody tr',{timeout:30000});
   const refreshed=await verify(course);assert.equal(refreshed.match,true);assert.equal(refreshed.all,true);assert.equal(refreshed.reads,full.reads+1);
   for(const width of [1360,1264,1024,768,390]){
    await page.setViewport({width,height:1020});
    const layout=await page.evaluate(()=>{
      const wrap=document.querySelector('.class-table-wrap'),bounds=wrap.getBoundingClientRect();
      return {page:document.documentElement.scrollWidth<=innerWidth+1,table:wrap.scrollWidth<=wrap.clientWidth+1,
       conditions:[...document.querySelectorAll('.class-garden-gaps')].every(cell=>{const r=cell.getBoundingClientRect();return r.left>=bounds.left-1&&r.right<=bounds.right+1&&cell.scrollWidth<=cell.clientWidth+1;})};
    });assert.equal(layout.page,true);assert.equal(layout.table,true);assert.equal(layout.conditions,true);
   }
   await page.setViewport({width:1360,height:1020});
   await page.click('#show-all-class-gaps');assert.equal((await verify(course)).match,true);
   const code=cls+(cls==='301'?'10':'01'),cell=await page.$(`.class-reward-table [data-student-code="${code}"] [data-count="unlockConditions"]`);
   if(cell){await cell.evaluate(e=>e.scrollIntoView({block:'center'}));await cell.screenshot({path:path.join(out,`grade${cls[0]}-conditions-only.png`)});}
   const redact=await page.addStyleTag({content:'.class-reward-table .class-student-link{visibility:hidden!important}'});
   await (await page.$('.class-reward-table tbody tr')).screenshot({path:path.join(out,`grade${cls[0]}-row-layout-names-hidden.png`)});
   await page.setViewport({width:390,height:844});await (await page.$('.class-reward-table tbody tr')).screenshot({path:path.join(out,`grade${cls[0]}-row-mobile-names-hidden.png`)});
   await redact.evaluate(e=>e.remove());await page.setViewport({width:1360,height:1020});
   results.push({grade:cls[0],students:brief.total,summaryMatches:true,allConditionsMatch:true,allGroups:full.groups,summaryGroups:brief.groups,toggleDoesNotRefetch:true,refreshKeepsView:true,mobile:true,conditionLayoutWidths:[1360,1264,1024,768,390],noHorizontalScroll:true});
  }
  assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>window.__gapActions.every(a=>['roster','class_rewards'].includes(a))),true);
  await page.$eval('#class-reward-section',e=>e.scrollIntoView({block:'start'}));
  await fs.writeFile(path.join(out,'browser-report.json'),JSON.stringify({passed:true,origin:'http://localhost:3000',localOnly:true,results,errors},null,2),'utf8');console.log(JSON.stringify({passed:true,localOnly:true,results}));
 }finally{
  if(hooked)await page.evaluate(()=>{if(window.__gapOriginal)window.fetch=window.__gapOriginal;delete window.__gapOriginal;delete window.__gapReads;delete window.__gapActions;}).catch(()=>{});
  if(script)await page.removeScriptToEvaluateOnNewDocument(script.identifier).catch(()=>{});
  await browser.disconnect();
 }
})().catch(e=>{console.error(phase+': '+e.message);process.exitCode=1});
