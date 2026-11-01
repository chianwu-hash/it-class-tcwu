import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createLearningDb,learningCall,TEACHER,studentId,DEMO_MEDIA} from '../lib/admin-learning-local-db.mjs';
import {startLearningServer} from '../admin-learning-local-server.mjs';
import {responseLabel,orderedOptions,optionLetter,paperAccuracy,typingPolicy} from '../../shared/admin-learning-model.mjs';
import {createHandler} from '../../supabase/functions/admin-learning-media/handler.mjs';
import {createLearningRequest,beginLearningTeacherLogin} from '../../shared/admin-learning-api.mjs';

test('教師登入：已有學生帳號改用共享 Google 選帳號流程，未登入仍走集中入口',async()=>{
  const calls=[],auth={isTeacher:s=>s?.user?.id==='teacher',signInWithGoogle:options=>{calls.push(['google',options]);return{error:null};},beginCentralizedLogin:options=>{calls.push(['central',options]);return true;}};
  await beginLearningTeacherLogin({auth,session:{user:{id:'student'}},returnTo:'https://example.invalid/admin-learning.html'});
  await beginLearningTeacherLogin({auth,session:null,returnTo:'https://example.invalid/admin-learning.html'});
  assert.deepEqual(calls.map(c=>c[0]),['google','central']);assert.ok(calls.every(c=>c[1].returnTo.endsWith('/admin-learning.html')));
});

test('教師唯讀 SQL：年度名冊、身分、課程隔離、分頁、事件、完整試卷與媒體',async t=>{
  const {db,ids}=await createLearningDb();const who={class_code:'603',seat_no:1};
  const call=(a,p={},c='grade6-115-1',u=TEACHER,r='authenticated')=>learningCall(db,a,c,p,u,r);
  const snapshot=async()=>{
    const rows=[];for(const table of ['student_progress','typing_foundation_progress','typing_foundation_events','typing_foundation_resets','quiz_attempts','quiz_answers','quiz_sessions','quiz_generated_papers'])
      rows.push((await db.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') as data from public.${table} t`)).rows[0].data);
    return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
  };
  try{
    const before=await snapshot();
    await t.test('匿名及學生拒絕，無任意 user_id、跨年級、寫入動作',async()=>{
      await assert.rejects(call('roster',{},undefined,'','anon'),/permission denied/);
      for(const a of ['roster','profile','paper','typing_events'])await assert.rejects(call(a,who,undefined,studentId(1)),/teacher_required/);
      await assert.rejects(call('profile',{...who,user_id:studentId(2)}),/invalid_request/);
      await assert.rejects(call('profile',{class_code:'301',seat_no:1}),/invalid_class/);
      await assert.rejects(call('profile',{class_code:'603',seat_no:99}),/student_unavailable/);
      await assert.rejects(call('admin_reset',who),/invalid_action/);
      await assert.rejects(call(null,who),/invalid_action/);
      await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role authenticated');await tx.query('select * from public.admin_learning_paper_rows($1,115,$2)',[studentId(1),'603']);}),/permission denied/);
    });
    await t.test('完整名冊、尚未對應與衝突，不洩漏 UUID 或 email',async()=>{
      const page=await call('roster');assert.equal(page.total,33);assert.equal(page.items.length,20);assert.deepEqual(page.classes,['603']);
      const next=await call('roster',{offset:20});assert.equal(next.items.length,13);
      assert.equal((await call('roster',{search:'示範同學 01'})).total,1);
      assert.equal((await call('profile',{class_code:'603',seat_no:32})).identity.mapping,'unlinked');
      assert.equal((await call('profile',{class_code:'603',seat_no:33})).identity.mapping,'conflict');
      assert.doesNotMatch(JSON.stringify(page),/example.invalid|00000000/);
      await assert.rejects(call('roster',{limit:0}),/invalid_page/);await assert.rejects(call('roster',{offset:100001}),/invalid_page/);
    });
    await t.test('摘要以目前學生／課程過濾，無資料不等於 0 分',async()=>{
      const profile=await call('profile',who);assert.equal(profile.identity.display_name,'示範同學 01');assert.equal(profile.weekly.recorded,2);
      assert.equal(profile.typing.english,1);assert.equal(profile.typing.zhuyin,1);assert.equal(profile.papers.created,23);assert.equal(profile.papers.started,22);
      assert.equal((await call('profile',{class_code:'301',seat_no:1},'grade3-115-1')).weekly.recorded,0);
      assert.equal((await call('profile',{class_code:'603',seat_no:31})).papers.created,0);
    });
    await t.test('週次、打字單位、重置版本與事件穩定分頁',async()=>{
      const weekly=await call('weekly',{class_code:'603',seat_no:2});assert.equal(weekly.total,23);assert.equal((await call('weekly',{class_code:'603',seat_no:2,offset:20})).items.length,3);
      const typing=await call('typing',{...who,limit:50});assert.equal(typing.total,24);
      assert.ok(typing.items.some(x=>x.rate_unit==='characters_per_minute'));
      const home=typing.items.find(x=>x.progress_id===ids.home);assert.equal(home.revision,2);assert.equal(home.resets,1);assert.equal(home.events,26);
      assert.doesNotMatch(JSON.stringify(typing),/fingerprint|practice_session|teacher_id/);
      const a=await call('typing_events',{...who,progress_id:ids.home}),b=await call('typing_events',{...who,progress_id:ids.home,offset:20});
      assert.equal(a.total,26);assert.equal(b.items.length,6);assert.equal(new Set([...a.items,...b.items].map(x=>x.id)).size,26);
      assert.equal(a.resets[0].previous_revision,1);assert.equal((await call('typing_events',{...who,progress_id:ids.home,revision:1})).total,3);
      await assert.rejects(call('typing_events',{class_code:'603',seat_no:2,progress_id:ids.home}),/progress_unavailable/);
    });
    await t.test('試卷列表按需分頁、保留軟刪除與未開始卷，不預送題目答案',async()=>{
      const papers=await call('papers',who);assert.equal(papers.total,23);assert.equal(papers.items.length,20);
      const last=await call('papers',{...who,offset:20});assert.equal(last.items.length,3);
      const unstarted=papers.items.find(x=>x.attempt_id===null);
      assert.equal((await call('paper',{...who,session_id:unstarted.session_id})).started,false);
      assert.equal(new Set([...papers.items,...last.items].map(x=>x.session_id)).size,23);
      assert.ok(papers.items.some(x=>x.attempt_id===null));assert.ok(last.items.some(x=>x.source_attempt_id));
      assert.ok(last.items.some(x=>x.hidden));assert.doesNotMatch(JSON.stringify(papers),/explanation|option_id|accepted|question_order|response/);
    });
    await t.test('逐題固定版本、學生原始選項順序、未答與全卷錯題篩選',async()=>{
      const data=await call('paper',{...who,session_id:ids.original.session});assert.equal(data.total,3);assert.equal(data.correct,2);assert.equal(data.started,true);
      assert.deepEqual(data.items[0].option_order,['b','a']);assert.equal(data.items[0].response,'b');assert.equal(data.items[0].question.answer.option_id,'a');
      assert.equal(data.items[2].question.type,'short');assert.equal(data.items[2].response,'兩個四分之一等於二分之一');assert.ok(data.items[1].material.media.length);
      const wrong=await call('paper',{...who,session_id:ids.original.session,filter:'wrong',limit:1});assert.equal(wrong.total,3);assert.equal(wrong.filtered_total,1);assert.equal(wrong.items.length,1);
      assert.equal((await call('paper',{...who,session_id:ids.original.session,offset:1,limit:1})).items[0].number,2);
      const partial=(await call('papers',who)).items.find(x=>Number(x.answered)===0&&x.attempt_id);
      assert.ok((await call('paper',{...who,session_id:partial.session_id})).items.every(x=>!x.answered&&x.response===null));
      await assert.rejects(call('paper',{...who,session_id:ids.stranger.session}),/paper_unavailable/);
      await assert.rejects(call('paper',{class_code:'603',seat_no:2,session_id:ids.original.session}),/paper_unavailable/);
    });
    await t.test('科目／狀態篩選先套整個學生集合，保留全部科目及正確分頁分母',async()=>{
      const all=await call('papers',who);assert.equal(all.all_total,23);assert.deepEqual(all.subjects,['數學','英語']);
      const english=await call('papers',{...who,subject:'英語',limit:2});assert.equal(english.total,6);assert.equal(english.all_total,23);assert.equal(english.items.length,2);
      assert.ok(english.items.every(x=>x.subject==='英語'));assert.equal((await call('papers',{...who,subject:'英語',offset:4,limit:2})).items.length,2);
      const complete=await call('papers',{...who,subject:'英語',state:'completed'});assert.equal(complete.total,5);
      const ongoing=await call('papers',{...who,subject:'英語',state:'in_progress'});assert.equal(ongoing.total,1);
      const hidden=await call('papers',{...who,state:'hidden'});assert.equal(hidden.total,1);assert.equal(hidden.items[0].hidden,true);
      const empty=await call('papers',{...who,subject:'英語',state:'unstarted'});assert.equal(empty.total,0);assert.equal(empty.all_total,23);assert.deepEqual(empty.subjects,['數學','英語']);
      assert.equal((await call('papers',{class_code:'603',seat_no:31,subject:'英語'})).all_total,0);
      await assert.rejects(call('papers',{...who,state:'unknown'}),/invalid_request/);
    });
    await t.test('媒體綁教師、所選學生與單卷固定版本，不可讀任意媒體',async()=>{
      const media=(user,url=DEMO_MEDIA,session=ids.original.session)=>db.transaction(async tx=>{
        await tx.query("select set_config('quiz.test_uid',$1,true)",[user]);await tx.exec('set local role authenticated');
        return(await tx.query('select public.admin_learning_media_access($1,$2,$3,$4) as asset',['grade6-115-1',who,session,url])).rows[0].asset;
      });
      assert.equal((await media(TEACHER)).url,DEMO_MEDIA);
      await assert.rejects(media(studentId(1)),/teacher_required/);await assert.rejects(media(TEACHER,'https://elsewhere.invalid/secret'),/media_unavailable/);
      await assert.rejects(media(TEACHER,DEMO_MEDIA,ids.stranger.session),/paper_unavailable/);
    });
    assert.equal(await snapshot(),before,'Reading all APIs must not change any learning record');
  }finally{await db.close();}
});

test('正確率分母、原答案與亂序標籤，不混用中英打單位或門檻',()=>{
  const q={type:'single',options:[{id:'a'},{id:'b'}]};assert.deepEqual(orderedOptions(q,['b','a']).map(x=>x.id),['b','a']);
  assert.equal(optionLetter(q,['b','a'],'b'),'A');assert.equal(responseLabel(q,['b','a'],'b'),'選項 A');assert.equal(responseLabel(q,[],null,false),'尚未作答');
  assert.equal(responseLabel({type:'short'},[],'  原答  '),'  原答  ');assert.equal(paperAccuracy({answered:1,total:3,correct:1}),'1 / 1 題（100%）');
  assert.match(typingPolicy({track:'zhuyin'},'grade6-115-1'),/速度僅記錄/);assert.match(typingPolicy({track:'english',speed:12,starter_speed:8},'grade3-115-1'),/8 WPM/);
});

test('獨立媒體端點：未驗權不呼叫 Storage，不接受寫入或跨來源',async()=>{
  const calls=[];const env=k=>({QUIZ_ALLOWED_ORIGINS:'http://127.0.0.1:4472',SUPABASE_URL:'https://example.invalid',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_test'}[k]);
  const fetcher=async(url,options)=>{calls.push({url,options});return url.includes('/rpc/')?new Response(JSON.stringify({url:DEMO_MEDIA,mime:'image/png',object_path:'owner/hash'})):new Response(JSON.stringify({signedURL:'/object/sign/quiz-media/owner/hash?token=demo'}));};
  const handler=createHandler({env,fetcher}),req=(body,origin='http://127.0.0.1:4472')=>new Request('https://example.invalid/functions/v1/admin-learning-media',{method:'POST',headers:{Origin:origin,Authorization:'Bearer demo'},body:JSON.stringify(body)});
  assert.equal((await handler(req({url:DEMO_MEDIA,student:{class_code:'603',seat_no:1},session_id:crypto.randomUUID(),course_id:'grade6-115-1'}))).status,200);assert.equal(calls.length,2);
  assert.equal((await handler(req({},'https://other.invalid'))).status,403);
  const denied=createHandler({env,fetcher:async()=>new Response('{}',{status:403})});assert.equal((await denied(req({}))).status,403);
});

test('正式查詢 adapter：非教師不送請求，切換帳號後舊回應失效',async()=>{
  let session={user:{id:'teacher-a'},access_token:'test-token'},sent=0;
  const auth={isTeacher:s=>s?.user?.id?.startsWith('teacher-'),SUPABASE_URL:'https://example.invalid',SUPABASE_ANON_KEY:'public',getStoredAccessToken:()=>null};
  const request=createLearningRequest({auth,getSession:()=>session,fetcher:async()=>{sent++;session={user:{id:'teacher-b'}};return new Response('{}');}});
  await assert.rejects(request('profile','grade6-115-1',{class_code:'603',seat_no:1}),e=>e.code==='identity_changed');assert.equal(sent,1);
  session={user:{id:'student-a'}};await assert.rejects(request('roster','grade6-115-1'),e=>e.code==='teacher_required');assert.equal(sent,1);
  session={user:{id:'teacher-a'},access_token:'expired'};
  const expired=createLearningRequest({auth,getSession:()=>session,fetcher:async()=>new Response('expired',{status:401})});
  await assert.rejects(expired('roster','grade6-115-1'),e=>e.code==='session_expired');
});

test('本機 HTTP：只服務白名單、同來源 cookie 與教師唯讀動作',async()=>{
  const app=await startLearningServer({port:0});try{
    const root=await fetch(`${app.origin}/admin-learning.html?local=1`);assert.equal(root.status,200);const cookie=root.headers.get('set-cookie').split(';')[0];
    const body=JSON.stringify({p_action:'roster',p_course_id:'grade6-115-1',p_payload:{}});
    assert.equal((await fetch(`${app.origin}/__learning-rpc`,{method:'POST',body})).status,403);
    const headers={Origin:app.origin,Cookie:cookie,'Content-Type':'application/json'};
    assert.equal((await fetch(`${app.origin}/__learning-rpc`,{method:'POST',headers,body})).status,200);
    assert.equal((await fetch(`${app.origin}/__learning-rpc`,{method:'POST',headers:{...headers,'x-learning-role':'student'},body})).status,400);
    assert.equal((await fetch(`${app.origin}/shared/auth.js`)).status,404);assert.equal((await fetch(`${app.origin}/.env`)).status,404);
  }finally{await app.close();}
});
