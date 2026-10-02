const assert=require('node:assert/strict');
const {connectCdp}=require('D:/projects/cdp-tools/packages/cdp-safe-client');
(async()=>{
const s=await connectCdp({cdpUrl:'http://127.0.0.1:9232',targetUrl:'https://it-class-tcwu.vercel.app/admin-homework.html'});
const ctx=await s.browser.createBrowserContext(),p=await ctx.newPage();
let rows=[],writes=[],failUser='',delay=false;const errors=[];
const seed=()=>{rows=[['a','601','submitted'],['b','601','submitted'],['c','601','needs_revision'],['d','602','submitted'],['e','601','passed']].map(([id,cls,status],i)=>({id:'v'+id,user_id:id,class_code:cls,seat_no:i+1,display_name:'測試'+id,status,review_seq:0,source:'school_library',book:'測試書'+id,reflection:'測試心得',feedback:''}));writes=[];};seed();
p.on('pageerror',e=>errors.push(e.message));await p.setCacheEnabled(false);await p.setRequestInterception(true);
p.on('request',async r=>{const u=new URL(r.url());
if(u.pathname==='/__reading_bulk_test')return r.respond({contentType:'text/html',body:`<html lang="zh-TW"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/shared/homework.css"><link rel="stylesheet" href="/shared/homework-portal.css"><main id="root"></main><script type="module">import {initReading} from '/shared/reading-ui.js';window.reading=initReading({root:document.querySelector('#root'),teacher:true});reading.setSession({user:{id:'teacher'},access_token:'mock'});</script></html>`});
if(u.pathname==='/shared/auth.js')return r.respond({contentType:'text/javascript',body:"export const SUPABASE_URL=location.origin+'/mock',SUPABASE_ANON_KEY='mock',getStoredAccessToken=()=>null;"});
if(u.pathname.startsWith('/mock/')){
const {p_action:a,p_data:d}=JSON.parse(r.postData());let result={},status=200;
if(a==='list')result={periods:[{id:'period',week_code:'03',starts_on:'2026-09-14',ends_on:'2026-09-20',enabled:true}]};
else if(a==='roster')result={students:rows};
else if(a==='review'){assert.equal(d.period_id,'period');writes.push(d);const v=rows.find(v=>v.user_id===d.user_id);if(delay)await new Promise(r=>setTimeout(r,300));if(d.user_id===failUser||d.version_id!==v.id||d.review_seq!==v.review_seq){status=400;result={message:'review_changed'};}else{v.status=d.status;v.review_seq++;}}
else throw Error('unexpected action '+a);
return r.respond({status,contentType:'application/json',body:JSON.stringify(result)});
}if(u.hostname.endsWith('supabase.co'))return r.abort();return r.continue();});
const click=text=>p.evaluate(t=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent===t);if(!b||b.disabled)throw Error('button unavailable '+t);b.click()},text);
const filters=async(cls,state,search='')=>p.evaluate(({cls,state,search})=>{const [c,s]=document.querySelectorAll('.hw-filters select');c.value=cls;s.value=state;document.querySelector('.hw-filters input').value=search;s.dispatchEvent(new Event('change'));},{cls,state,search});
const ready=()=>p.waitForFunction(()=>document.querySelector('.hw-filters select')&&!document.querySelector('.hw-filters select').disabled);
const open=async()=>{await p.goto('http://localhost:3000/__reading_bulk_test',{waitUntil:'networkidle2'});await click('查看分享');await ready();};
const bulk=async()=>{await p.click('[data-reading-bulk]');await ready();};
try{
await open();assert(await p.$eval('[data-reading-bulk]',b=>b.parentElement.hidden));
await filters('601','submitted');assert.equal(await p.$eval('[data-reading-bulk]',b=>b.textContent),'目前篩選全部過關（2張）');
await click('再努力');await ready();assert.equal(rows.find(r=>r.user_id==='a').status,'needs_revision');assert.equal(await p.$eval('.hw-filters select',e=>e.value),'601');assert.equal(await p.$eval('[data-reading-bulk]',b=>b.textContent),'目前篩選全部過關（1張）');
await bulk();assert.deepEqual(writes.map(w=>[w.user_id,w.status]),[['a','needs_revision'],['b','passed']]);assert.equal(rows.find(r=>r.user_id==='d').status,'submitted');assert(await p.$eval('[data-reading-bulk]',b=>b.disabled));
seed();await open();await filters('','submitted','測試d');await bulk();assert.deepEqual(writes.map(w=>w.user_id),['d']);
seed();failUser='b';await open();await filters('','submitted');await bulk();assert.deepEqual(writes.map(w=>w.user_id),['a','b']);assert.equal(rows.find(r=>r.user_id==='d').status,'submitted');assert(await p.$eval('#root',e=>e.innerText.includes('已確認過關 1 張')&&e.innerText.includes('批次已停止')));
failUser='';await bulk();assert.deepEqual(writes.map(w=>w.user_id),['a','b','b','d']);assert(await p.$eval('[data-reading-bulk]',b=>b.disabled));
seed();await open();await filters('601','submitted');await p.setViewport({width:390,height:900});await p.screenshot({path:'tmp/reading-bulk-mobile.png',fullPage:true});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
delay=true;await p.click('[data-reading-bulk]');await p.waitForFunction(()=>document.querySelector('.hw-filters select').disabled);await p.evaluate(()=>reading.setSession(null));await new Promise(r=>setTimeout(r,700));assert.equal(writes.length,1);assert.equal(await p.$('[data-reading-bulk]'),null);
assert.deepEqual(errors,[]);console.log('PASS: pending-only, class/search scope, keep revision/pass untouched, retain filters, zero disabled, conflict stop/retry, mobile, logout stops batch; no live writes');
}finally{await ctx.close();await s.disconnect()}
})().catch(e=>{console.error(e);process.exitCode=1});
