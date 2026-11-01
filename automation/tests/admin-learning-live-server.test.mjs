import test from 'node:test';
import assert from 'node:assert/strict';
import {startLearningLiveServer} from '../admin-learning-live-server.mjs';

test('實際資料本機入口：真正 Auth/user 與 is_teacher 皆驗過後才讀，拒絕跨來源／匿名／學生／寫入',async()=>{
  const calls=[],reads=[];
  const fetcher=async(url,options)=>{
    calls.push({url,body:options.body});
    if(url.endsWith('/auth/v1/user')){
      if(options.headers.Authorization==='Bearer expired')return new Response('{}',{status:401});
      return new Response(JSON.stringify({id:'teacher-id',email:options.headers.Authorization==='Bearer student'?'student@example.invalid':'chianwu@gmail.com',email_confirmed_at:'2026-01-01'}));
    }
    if(url.endsWith('/rpc/is_teacher'))return new Response('true');
    if(url.endsWith('/functions/v1/quiz-media'))return new Response(JSON.stringify({url:'https://example.invalid/read-only-image'}));
    throw new Error('unexpected_upstream_call');
  };
  const app=await startLearningLiveServer({port:0,fetcher,reader:async(body,context)=>{reads.push({body,context});return body.p_action==='media'?{available:true}:{items:[],total:0,read_source:'cloud-readonly'};}});
  try{
    const post=(body,token='teacher',origin=app.origin,path='/__learning-live')=>fetch(app.origin+path,{method:'POST',headers:{Origin:origin,...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
    const body={p_action:'roster',p_course_id:'grade6-115-1',p_payload:{}};
    assert.equal((await post(body,null)).status,401);assert.equal((await post(body,'expired')).status,401);
    assert.equal((await post(body,'student')).status,403);assert.equal(reads.length,0);
    assert.equal((await post(body,'teacher','https://other.invalid')).status,403);
    assert.equal((await post({...body,p_action:'admin_reset'})).status,400);
    const response=await post(body);assert.equal(response.status,200);assert.equal((await response.json()).read_source,'cloud-readonly');assert.equal(reads.length,1);
    assert.equal(reads[0].context.user.email,'chianwu@gmail.com');
    const classBody={p_action:'class_rewards',p_course_id:'grade6-115-1',p_payload:{class_code:'603'}};
    assert.equal((await post(classBody,null)).status,401);assert.equal((await post(classBody,'student')).status,403);
    assert.equal((await post(classBody,'teacher','https://other.invalid')).status,403);assert.equal(reads.length,1);
    assert.equal((await post(classBody)).status,200);assert.equal(reads[1].body.p_action,'class_rewards');
    const gardenBody={p_action:'garden_status',p_course_id:'grade6-115-1',p_payload:{class_code:'603',seat_no:1}};
    assert.equal((await post(gardenBody,'student')).status,403);assert.equal(reads.length,2);
    assert.equal((await post(gardenBody)).status,200);assert.equal(reads[2].body.p_action,'garden_status');
    const media={course_id:'grade6-115-1',student:{class_code:'603',seat_no:1},session_id:crypto.randomUUID(),url:'https://quiz-media.invalid/test'};
    assert.equal((await post(media,'student',app.origin,'/__learning-live-media')).status,403);
    assert.equal((await post(media,'teacher',app.origin,'/__learning-live-media')).status,200);
    const signer=calls.find(c=>c.url.endsWith('/functions/v1/quiz-media'));assert.deepEqual(JSON.parse(signer.body),{action:'read',url:media.url,attempt_id:null});
    const html=await(await fetch(app.origin+'/admin-learning.html')).text();assert.ok(html.includes('admin-learning-backend'));assert.ok(html.includes('local-readonly'));
    assert.equal((await fetch(app.origin+'/.env')).status,404);assert.equal((await fetch(app.origin+'/supabase/admin_learning.sql')).status,404);
    assert.equal((await fetch(app.origin+'/admin-quiz.html')).status,404);
  }finally{await app.close();}
});

test('本機唯讀後端不可用不建立正式 RPC，媒體不授權就不取簽章',async()=>{
  const paths=[];const fetcher=async(url)=>{paths.push(url);return url.endsWith('/auth/v1/user')?new Response(JSON.stringify({email:'chianwu@gmail.com',email_confirmed_at:'2026-01-01'})):url.endsWith('/rpc/is_teacher')?new Response('true'):new Response('{}',{status:404});};
  const app=await startLearningLiveServer({port:0,fetcher});try{
    const response=await fetch(app.origin+'/__learning-live',{method:'POST',headers:{Origin:app.origin,Authorization:'Bearer teacher'},body:JSON.stringify({p_action:'roster',p_course_id:'grade6-115-1',p_payload:{}})});
    assert.equal(response.status,501);assert.equal((await response.json()).error,'live_reader_unavailable');
    assert.ok(paths.every(p=>p.includes('/auth/v1/user')||p.includes('/rpc/is_teacher')||p.includes('/rpc/admin_learning_action')));
  }finally{await app.close();}
});
