const fs=require('node:fs');
const path=require('node:path');
const {connectCdp}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
(async()=>{
 const mode=process.argv[2]||'inspect';
 if(!['inspect','deploy','test','verify','roster'].includes(mode))throw new Error('Unsupported SQL operation');
 const c=await connectCdp({cdpUrl:'http://127.0.0.1:9232',targetUrl:'https://supabase.com/dashboard/project/upxgyusodibaqcrocdzj/sql'});
 try{
  const page=c.page;await page.bringToFront();
  if(mode==='inspect') {
    await page.evaluate(()=>{const img=[...document.querySelectorAll('img')].find(e=>e.alt==='chianwu-hash');img?.closest('button')?.click();});
    await new Promise(r=>setTimeout(r,500));
    console.log(await page.evaluate(()=>[...document.querySelectorAll('[role="menu"]')].map(e=>e.innerText)));
  }
  const state=await page.evaluate(()=>({url:location.href,project:document.body.innerText.includes("chianwu-hash's Project"),org:document.body.innerText.includes("chianwu-hash's Org"),
   accountVisible:[...document.querySelectorAll('img')].some(e=>e.alt==='chianwu-hash'),models:window.monaco?.editor?.getModels?.().length||0,
   buttons:[...document.querySelectorAll('button')].map(b=>({label:b.getAttribute('aria-label'),title:b.getAttribute('title'),text:b.textContent.trim().slice(0,50)})).filter(b=>/account|profile|avatar|user/i.test(`${b.label} ${b.title} ${b.text}`))}));
  console.log(JSON.stringify(state));if(mode==='inspect')return;
  if(!state.url.includes('/project/upxgyusodibaqcrocdzj/sql/')||!state.project||!state.org||!state.accountVisible||state.models!==1)throw new Error('Confirm the visible account, target project, and single SQL editor before deployment.');
  const query=mode==='roster' ? "select (select count(*) from public.student_enrollments where school_year=115 and class_code like '3%') as grade3_google_roster_count, (select count(*) from public.typing_foundation_progress where course_id='grade3-115-1' and learner_key like 'card:%') as grade3_card_progress_count;" : mode==='verify' ? "select (select count(*) from public.typing_foundation_progress where learner_key in ('card:99999','google:cbb41c53-97a1-483c-897b-8337a0e10227')) as synthetic_progress_remaining, (select count(*) from public.class_card_students where course_id='grade3-115-1' and class_code='999' and seat_no=99) as synthetic_cards_remaining, has_table_privilege('anon','public.typing_foundation_progress','SELECT') as anon_direct_read;" : fs.readFileSync(path.join(__dirname,'../supabase',mode==='test'?'typing_foundation.test.sql':'typing_foundation.sql'),'utf8');
  await page.evaluate(sql=>window.monaco.editor.getModels()[0].setValue(sql),query);
  const clicked=await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/^Run\s/.test(b.textContent.trim()));if(!b||b.disabled)return false;b.click();return true;});
  if(!clicked)throw new Error('SQL Run button unavailable');
  await new Promise(r=>setTimeout(r,5000));
  await page.waitForFunction(()=>!document.body.innerText.includes('Running...'),{timeout:30000});
  const result=await page.evaluate(()=>{const text=document.body.innerText,index=text.indexOf('Results\n');return {success:/Success\. No rows returned/i.test(text),error:/Error running SQL query|Failed to run sql query|ERROR:/i.test(text),tail:index<0?'':text.slice(index,index+850),dialogs:[...document.querySelectorAll('[role="dialog"]')].map(e=>e.innerText.slice(0,200))};});
  console.log(JSON.stringify(result));if(result.error||result.dialogs.length||(!result.success&&!['verify','roster'].includes(mode)))throw new Error('SQL completion not confirmed');
 }finally{c.disconnect();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
