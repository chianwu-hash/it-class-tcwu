const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const p=require('D:/projects/cdp-tools/node_modules/puppeteer-core');
const {PGlite}=require(path.join(process.env.TEMP,'codex-drive-validation/node_modules/@electric-sql/pglite'));
const teacher='00000000-0000-0000-0000-000000000001',student='00000000-0000-0000-0000-000000000002';
(async()=>{const db=new PGlite();let b,page;let role='student';let queue=Promise.resolve();const errors=[];
try{
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;create function public.is_teacher() returns boolean language sql as $$select auth.uid()='${teacher}'::uuid$$;create table public.student_enrollments(school_year smallint,email text,class_code text,seat_no smallint,display_name text);insert into auth.users values('${teacher}','chianwu@gmail.com',now()),('${student}','student@example.test',now());insert into public.student_enrollments values(115,'student@example.test','609',30,'測試學生');grant usage on schema public,auth to authenticated;`);
await db.exec(fs.readFileSync('supabase/reading.sql','utf8'));
const action=async(a,d={},uid=role==='teacher'?teacher:student)=>{await db.query("select set_config('test.uid',$1,false)",[uid]);return (await db.query('select public.reading_action($1,$2) as data',[a,JSON.stringify(d)])).rows[0].data};
await action('configure',{week_code:'01',starts_on:'2026-08-31',ends_on:'2026-09-06'},teacher);
await action('configure',{week_code:'02',starts_on:'2026-09-07',ends_on:'2026-09-13'},teacher);
b=await p.connect({browserURL:'http://127.0.0.1:9232',waitForInitiallyDiscoveredTargets:false});const s=await b.target().createCDPSession();const {targetId}=await s.send('Target.createTarget',{url:'about:blank'});page=await (await b.waitForTarget(t=>t._targetId===targetId)).page();await page.setCacheEnabled(false);await page.setViewport({width:1440,height:1000});
await page.setRequestInterception(true);page.on('pageerror',e=>errors.push(e.message));
page.on('request',req=>{const url=new URL(req.url());const reply=(body,type='application/json',status=200)=>req.respond({status,contentType:type,body:typeof body==='string'?body:JSON.stringify(body)});
 if(url.pathname==='/shared/auth.js')return reply(`export const SUPABASE_URL='https://upxgyusodibaqcrocdzj.supabase.co',SUPABASE_ANON_KEY='fixture';export const getStoredAccessToken=()=>null;export const isTeacher=s=>s?.user?.id==='${teacher}';`,'application/javascript');
 if(url.pathname==='/shared/navbar-auth.js')return reply(`export function initNavbarAuth({onSessionResolved}){const s={user:{id:'${role==='teacher'?teacher:student}',email:'${role==='teacher'?'chianwu@gmail.com':'student@example.test'}'},access_token:'fixture'};window.__resolveTestSession=onSessionResolved;document.querySelector('#auth-status').textContent=s.user.email;onSessionResolved(s);}`,'application/javascript');
 if(url.hostname==='upxgyusodibaqcrocdzj.supabase.co'){
  if(req.method()==='OPTIONS')return req.respond({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'}});
  const data=JSON.parse(req.postData()||'{}');
  const respond=(body,status=200)=>req.respond({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(body)});
  if(url.pathname.endsWith('/reading_action')){const uid=role==='teacher'?teacher:student;queue=queue.then(async()=>{try{await respond(await action(data.p_action,data.p_data,uid));}catch(e){await respond({message:e.message},400)}});return;}
  if(url.pathname.endsWith('/homework_action'))return respond({teacher:role==='teacher',max_file_bytes:104857600,assignments:[{id:'fixture-assignment',week_code:'02',title:'我們的班級名牌',instructions:'依課本 P22～28 完成作品',class_code:'*',state:'open'}]});
  return respond({message:'Unexpected fixture request'},400);
 }
 if(url.hostname==='127.0.0.1'||url.hostname==='cdn.tailwindcss.com'||url.hostname==='cdnjs.cloudflare.com')return req.continue();
 return req.abort();
});
const wait=async text=>page.waitForFunction(t=>document.body.innerText.includes(t)&&![...document.querySelectorAll('.reading-panel button')].some(b=>b.disabled),{timeout:15000},text);
const click=async(text,scope='body')=>{const found=await page.evaluate(({text,scope})=>{const b=[...document.querySelector(scope).querySelectorAll('button')].find(b=>b.textContent===text);if(!b||b.disabled)return false;b.click();return true;},{text,scope});assert(found,'Button not available: '+text)};
await page.goto('http://127.0.0.1:8126/grade6/115-1/homework.html',{waitUntil:'networkidle0'});await wait('分享本週閱讀');
assert(await page.evaluate(()=>document.querySelector('#homework-list').getBoundingClientRect().top<document.querySelector('#reading').getBoundingClientRect().top));
assert(!await page.$eval('#reading',e=>e.innerText.includes('未繳交')));
await click('分享本週閱讀');await page.$eval('.reading-dialog form',f=>{f.querySelector('select').value='school_library';f.querySelector('input').value='森林裡的秘密';f.querySelector('textarea').value='倒下的樹也能成為小動物的家。';f.requestSubmit()});await wait('本週已分享');
await click('老師回饋與歷史');await page.waitForSelector('.reading-version');assert.equal(await page.$$eval('.reading-version',e=>e.length),1);await click('關閉 ×','.reading-dialog');
await page.$eval('.reading-past',e=>e.open=true);await click('分享這一週','.reading-past');await page.$eval('.reading-dialog form',f=>{f.querySelector('select').value='parent_platform';f.querySelector('input').value='太空旅行';f.querySelector('textarea').value='我想知道火星上的一天有多長。';f.requestSubmit()});await wait('本週閱讀已分享');
const records=await action('list');assert.equal(records.periods.filter(p=>p.submission).length,2);
await page.screenshot({path:'tmp/reading-student-formal.png',fullPage:true});
role='teacher';await page.goto('http://127.0.0.1:8126/admin-homework.html',{waitUntil:'networkidle0'});await wait('設定學期閱讀週次');
await page.evaluate(()=>[...document.querySelectorAll('.reading-periods button')].filter(b=>b.textContent==='查看分享')[1].click());await wait('森林裡的秘密');await click('過關','.reading-gallery');await wait('評比已保存');
await click('查看小卡・繳交歷史','.reading-gallery');await page.waitForSelector('.reading-version textarea');await page.$eval('.reading-version textarea',e=>e.value='觀察得很仔細！');await click('儲存回饋','.reading-dialog');await wait('森林裡的秘密');
await click('收回評比','.reading-gallery');await wait('評比已保存');await click('過關','.reading-gallery');await wait('評比已保存');
await page.screenshot({path:'tmp/reading-teacher-formal.png',fullPage:true});
role='student';await page.goto('http://127.0.0.1:8126/grade6/115-1/homework.html',{waitUntil:'networkidle0'});await wait('本週已分享');await click('老師回饋與歷史');await page.waitForSelector('.reading-version');assert(await page.$eval('.reading-dialog',e=>e.innerText.includes('觀察得很仔細！')));await click('關閉 ×','.reading-dialog');
await click('查看／修改本週小卡');await page.$eval('.reading-dialog form',f=>{f.querySelector('textarea').value='我也發現樹上的洞可以讓鳥類躲雨。';f.requestSubmit()});await wait('本週已分享');await click('老師回饋與歷史');await page.waitForFunction(()=>document.querySelectorAll('.reading-version').length===2);assert(await page.$eval('.reading-dialog',e=>e.innerText.includes('觀察得很仔細！')&&e.innerText.includes('第 2 版・最新版')));await click('關閉 ×','.reading-dialog');
for(const [width,height] of [[1024,768],[390,844]]){await page.setViewport({width,height});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow at '+width);await click('查看／修改本週小卡');assert(await page.$eval('.reading-dialog',e=>e.getBoundingClientRect().width<=innerWidth));await click('關閉 ×','.reading-dialog');}
await page.evaluate(()=>window.__resolveTestSession(null));assert(!await page.$eval('#reading',e=>e.innerText.includes('森林裡的秘密')));
assert.deepEqual(errors,[]);console.log('PASS: production HTML + real reading SQL: submit, optional status, old-week backfill, teacher pass/feedback/retract, resubmit/history, 1440/1024/390 layouts, logout isolation. No live student writes.');
}finally{if(page)await page.close();if(b)await b.disconnect();await db.close();}})().catch(e=>{console.error(e);process.exitCode=1});
