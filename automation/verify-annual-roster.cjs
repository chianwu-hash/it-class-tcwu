const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'automation/output/annual-roster-115');
fs.mkdirSync(output, { recursive: true });
const stub = `
const AUTH_STORAGE_KEY='test-auth', SUPABASE_ANON_KEY='', SUPABASE_URL='';
const getAdminRedirectUrl=()=>'', getStoredAccessToken=()=>null;
const isTeacher=()=>true, resolveSession=async()=>({user:{id:'teacher',email:'test@example.invalid'}});
const sharedSignInWithGoogle=()=>{}, signOutAndReload=()=>{};
window.testCalls=[];
window.mockVisibility=[{course_id:'grade3-115-1',week_code:'01',is_visible:true},{course_id:'grade6-115-1',week_code:'01',is_visible:true},{course_id:'grade3-114-2',week_code:'03',is_visible:false}];
const supabase={auth:{onAuthStateChange:()=>{}},rpc(name,args){
 window.testCalls.push({name,args});
 if(name==='admin_list_student_enrollments')return Promise.resolve({data:[
 {user_id:'student',email:'student@example.invalid',class_code:args.p_school_year===115?'603':'301',seat_no:1,display_name:'Test Student',student_code:args.p_school_year===115?'60301':'30101'},
 {user_id:null,email:'pending@example.invalid',class_code:args.p_school_year===115?'604':'302',seat_no:2,display_name:'Pending Student'}
 ]});
 if(name==='admin_list_progress')return {range:async(from,to)=>{
 const count=args.p_course_id==='grade6-115-1'?1001:args.p_course_id==='grade3-114-2'?1:0;
 return {data:Array.from({length:Math.max(0,Math.min(to+1,count)-from)},(_,i)=>({user_id:'student',email:'student@example.invalid',course_id:args.p_course_id,week_code:'01',activity_key:'typing_task_'+(from+i),activity_type:'typing',current_level:2,completed:false,updated_at:'2026-09-05T01:00:00Z'}))};
 }};
 throw Error('Unexpected RPC: '+name);
}};
`;
let html = fs.readFileSync(path.join(root, 'admin-progress.html'), 'utf8');
html = html.replace(/import\s*\{[\s\S]*?\}\s*from "\.\/shared\/auth.js";/, () => stub)
    .replace('from "./shared/course-context.js"', 'from "/shared/course-context.js"')
    .replace('if (!accessToken) {', `
        if(functionName==='admin_list_week_visibility')return window.mockVisibility;
        if(functionName==='admin_set_week_visibility'){
            window.testCalls.push({name:functionName,args:payload});
            window.mockVisibility.find(r=>r.course_id===payload.p_course_id && r.week_code===payload.p_week_code).is_visible=payload.p_is_visible;
            return null;
        }
        if (!accessToken) {`);
fs.writeFileSync(path.join(output, 'verify.html'), html, 'utf8');

async function main() {
    const tab = await (await fetch('http://127.0.0.1:9232/json/new?about:blank', { method: 'PUT' })).json();
    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen=resolve; ws.onerror=reject; });
    let id=0;
    const pending=new Map();
    ws.onmessage = event => {
        const result=JSON.parse(event.data);
        const call=pending.get(result.id);
        if(call){pending.delete(result.id);clearTimeout(call.timer);result.error?call.reject(result.error):call.resolve(result.result);}
    };
    function send(method,params={}) {
        return new Promise((resolve,reject)=>{
            const callId=++id;
            const timer=setTimeout(()=>{pending.delete(callId);reject(Error('CDP timeout: '+method));},15000);
            pending.set(callId,{resolve,reject,timer});
            ws.send(JSON.stringify({id:callId,method,params}));
        });
    }
    async function evaluate(expression) {
        const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
        if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
        return result.result.value;
    }
    async function waitFor(expression) {
        for(let i=0;i<6;i++){
            if(await evaluate(expression))return;
            await new Promise(resolve=>setTimeout(resolve,5000));
        }
        throw Error('UI did not reach expected state');
    }
    try {
        await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
        await send('Page.navigate',{url:'http://127.0.0.1:8000/automation/output/annual-roster-115/verify.html'});
        await waitFor(`document.querySelector('#summary-text')?.textContent.includes('1001')`);
        const current=await evaluate(`({year:document.querySelector('#school-year-filter').value,classes:[...document.querySelector('#class-filter').options].map(o=>o.value),roster:document.querySelector('#roster-summary').textContent,body:document.querySelector('#progress-tbody').textContent})`);
        assert.equal(current.year,'115');
        assert(current.classes.includes('603') && current.classes.includes('604'));
        assert(!current.classes.includes('301'));
        assert(current.roster.includes('2') && current.roster.includes('1'));
        assert(current.body.includes('60301'));
        assert.deepEqual(await evaluate(`[...document.querySelectorAll('[data-next-visible]')].map(b=>b.dataset.courseId)`),['grade3-115-1','grade6-115-1']);
        await evaluate(`document.querySelector('[data-course-id="grade6-115-1"][data-next-visible]').click()`);
        await waitFor(`document.querySelector('[data-course-id="grade6-115-1"][data-next-visible]')?.dataset.nextVisible==='true'`);
        const saved=await evaluate(`window.testCalls.find(c=>c.name==='admin_set_week_visibility').args`);
        assert.deepEqual(saved,{p_course_id:'grade6-115-1',p_grade:'grade6',p_week_code:'01',p_is_visible:false});
        assert.equal(await evaluate(`window.mockVisibility.find(r=>r.course_id==='grade3-115-1').is_visible`),true);
        fs.writeFileSync(path.join(output,'desktop.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
        await evaluate(`document.querySelector('#school-year-filter').value='114';document.querySelector('#school-year-filter').dispatchEvent(new Event('change'));`);
        await waitFor(`document.querySelector('#progress-tbody')?.textContent.includes('30101')`);
        const previous=await evaluate(`({courses:[...document.querySelector('#course-filter').options].map(o=>o.value),classes:[...document.querySelector('#class-filter').options].map(o=>o.value)})`);
        assert(previous.classes.includes('301') && !previous.classes.includes('603'));
        assert(previous.courses.filter(Boolean).every(c=>c.includes('-114-')));
        assert(await evaluate(`[...document.querySelectorAll('[data-next-visible]')].every(b=>b.dataset.courseId.includes('-114-'))`));
        await evaluate(`document.querySelector('#course-filter').value='grade3-114-2';document.querySelector('#course-filter').dispatchEvent(new Event('change'))`);
        assert(await evaluate(`document.querySelector('#grade6-visibility-list').parentElement.classList.contains('hidden')`));
        assert(await evaluate(`document.querySelector('[data-course-id="grade3-114-2"][data-week-code="03"]').dataset.nextVisible==='true'`));
        await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
        assert.equal(await evaluate('document.documentElement.scrollWidth > innerWidth'),false);
        console.log('PASS: annual rosters, pagination, year/course week-card filters, scoped toggle payload, preserved old visibility, mobile width.');
    } finally {
        ws.close();
        await fetch(`http://127.0.0.1:9232/json/close/${tab.id}`);
        fs.unlinkSync(path.join(output,'verify.html'));
    }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
