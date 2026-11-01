import test from 'node:test';
import assert from 'node:assert/strict';
import {createLearningDb,learningCall,DEMO_MEDIA,studentId,TEACHER} from '../lib/admin-learning-local-db.mjs';
import {buildLearningRewardsRpc} from '../lib/admin-learning-production.mjs';
import {compileLearningReads,createLearningReadOnlyReader,compileGardenCatalog} from '../lib/admin-learning-readonly-reader.mjs';
import {readFile} from 'node:fs/promises';

test('本機唯讀橋接與候選 RPC 共用 SELECT：全部讀取動作與篩選結果一致',async()=>{
  const {db,ids}=await createLearningDb();const reader=await createLearningReadOnlyReader({query:async(sql,args)=>(await db.query(sql,args)).rows});
  const normalize=data=>{const d=structuredClone(data);delete d.as_of;delete d.read_source;return d;};
  try{
    for(const [action,payload] of [['roster',{}],['roster',{class_code:'603',offset:20}],['profile',{}],['weekly',{}],['typing',{limit:50}],
      ['typing_events',{progress_id:ids.home}],['typing_events',{progress_id:ids.home,offset:20,revision:1}],['papers',{}],['papers',{subject:'英語',state:'completed'}],
      ['paper',{session_id:ids.original.session}],['paper',{session_id:ids.original.session,filter:'wrong'}]]){
      const params=action==='roster'?payload:{class_code:'603',seat_no:1,...payload};
      const expected=await learningCall(db,action,'grade6-115-1',params),actual=await reader({p_action:action,p_course_id:'grade6-115-1',p_payload:params});
      assert.deepEqual(normalize(actual),normalize(expected),action);
    }
    for(const seat_no of [32,33]){
      const p={class_code:'603',seat_no:seat_no};const actual=await reader({p_action:'profile',p_course_id:'grade6-115-1',p_payload:p});
      assert.equal(actual.identity.mapping,seat_no===32?'unlinked':'conflict');
    }
    await assert.rejects(reader({p_action:'paper',p_course_id:'grade6-115-1',p_payload:{class_code:'603',seat_no:2,session_id:ids.original.session}}),/paper_unavailable/);
    await assert.rejects(reader({p_action:'roster',p_course_id:'grade6-115-1',p_payload:{class_code:'301'}}),/invalid_class/);
    await assert.rejects(reader({p_action:'profile',p_course_id:'grade6-115-1',p_payload:{class_code:'603',seat_no:1,user_id:'fake'}}),/invalid_request/);
    assert.equal((await reader({p_action:'media',p_course_id:'grade6-115-1',p_payload:{class_code:'603',seat_no:1,session_id:ids.original.session,url:DEMO_MEDIA}})).available,true);
    await assert.rejects(reader({p_action:'media',p_course_id:'grade6-115-1',p_payload:{class_code:'603',seat_no:2,session_id:ids.original.session,url:DEMO_MEDIA}}),/paper_unavailable/);
  }finally{await db.close();}
});

test('唯讀編譯器拒絕未預期的寫入與公共函式，輸入使用參數不組 SQL',async()=>{
  const source=await readFile(new URL('../../supabase/admin_learning.sql',import.meta.url),'utf8');
  const compile=compileLearningReads(source);assert.ok(compile('papers').includes('$4::jsonb'));
  assert.throws(()=>compile('admin_reset'),/invalid_action/);
  const poisoned=source.replace("'weekly',(select jsonb_build_object", "'weekly',(select public.untrusted_write(jsonb_build_object");
  assert.throws(()=>compileLearningReads(poisoned)('profile'),/readonly_contract_changed/);
  const catalog="CREATE FUNCTION public.garden_item_catalog() RETURNS void LANGUAGE sql IMMUTABLE AS $function$values ('pet:cat','貓窩','cat','b',12,3,'/cat.webp')$function$";
  assert.ok(compileGardenCatalog(catalog).startsWith('values'));
  assert.throws(()=>compileGardenCatalog(catalog.replace('IMMUTABLE','VOLATILE')),/readonly_contract_changed/);
  assert.throws(()=>compileGardenCatalog(catalog.replace('12,3',"public.side_effect(),3")),/readonly_contract_changed/);
  assert.throws(()=>compileGardenCatalog(catalog.replace('values','select')),/readonly_contract_changed/);
});

test('花葉唯讀資料隔人隔課：舊獎勵一整葉、半葉欄位相容、只取目前評比與學生可見任務',async()=>{
  const {db,ids}=await createLearningDb();
  try{
    // Isolated in-memory schema only, never run against a cloud database.
    await db.exec(`create table public.quiz_leaf_awards(id uuid default gen_random_uuid(),user_id uuid,attempt_id uuid,grade integer,total integer,correct integer,awarded_at timestamptz default now());
      create table public.quiz_past_leaves(id uuid default gen_random_uuid(),user_id uuid,attempt_id text,paper_id text,school_year integer,semester integer,awarded_at timestamptz default now());
      create table public.quiz_past_attempts(id text);
      create table public.quiz_past_papers(id text,title text,grade integer);
      create table public.garden_growth(user_id uuid,course_id text,grown_at timestamptz default now(),seen_at timestamptz,baseline jsonb,pet_unlocked_at timestamptz,reward_version integer,leaf_floor integer,flower_floor integer);
      create table public.garden_item_unlocks(user_id uuid,item_key text,course_id text,unlocked_at timestamptz default now());
      create function public.garden_item_catalog() returns table(item_key text,label text,pet text,home text,leaves integer,flowers integer,portrait text) language sql immutable as $$values ('pet:cat','橘寶與貓窩','cat','b',12,3,'/cat.webp'),('pet:dog','布丁與狗窩','dog','a',24,6,'/dog.webp')$$;
      create table public.homework_assignments(id text,course_id text,week_code text,title text,state text,class_code text);
      create table public.homework_uploads(id text);
      create table public.homework_submissions(assignment_id text,user_id uuid,upload_id text,status text,submitted_at timestamptz,reviewed_at timestamptz);
      create table public.reading_periods(id text,course_id text,week_code text,starts_on date,enabled boolean);
      create table public.reading_versions(id text,status text,submitted_at timestamptz,reviewed_at timestamptz);
      create table public.reading_submissions(period_id text,user_id uuid,version_id text);
      create table public.garden_test_setup(user_id uuid,course_id text,leaves integer,flowers integer);
      insert into public.homework_assignments values('visible','grade6-115-1','02','公開任務','open','603'),('otherclass','grade6-115-1','02','其他班','open','604'),('draft','grade6-115-1','02','草稿','draft','603');
      insert into public.homework_uploads values('upload');
      insert into public.reading_periods values('old','grade6-115-1','02','2026-09-01',false),('future','grade6-115-1','03','2099-01-01',true);
      insert into public.reading_versions values('latest','needs_revision',now(),now()),('historical','passed',now(),now());`);
    await db.query('insert into public.quiz_leaf_awards(user_id,attempt_id,grade,total,correct) values($1,$2,6,10,8),($3,$4,6,10,10)',[studentId(1),ids.original.id,studentId(3),ids.stranger.id]);
    await db.query("insert into public.homework_submissions values('visible',$1,'upload','needs_revision',now(),now())",[studentId(1)]);
    await db.query("insert into public.reading_submissions values('old',$1,'latest')",[studentId(1)]);
    const reader=await createLearningReadOnlyReader({query:async(sql,args)=>(await db.query(sql,args)).rows});
    const read=(course='grade6-115-1',class_code='603',seat_no=1)=>reader({p_action:'rewards',p_course_id:course,p_payload:{class_code,seat_no}});
    const first=await read();assert.equal(first.awards.length,1);assert.equal(first.awards[0].half_units,2);
    const status=()=>reader({p_action:'garden_status',p_course_id:'grade6-115-1',p_payload:{class_code:'603',seat_no:1}});
    const before=await status();assert.equal(before.garden.growth,null);assert.equal(before.garden.catalog.length,2);assert.deepEqual(before.garden.unlocks,[]);
    await db.query("insert into public.garden_growth(user_id,course_id,baseline,reward_version,leaf_floor,flower_floor) values($1,'grade6-115-1','[]',2,44,10),($2,'grade3-114-2','[]',2,44,10)",[studentId(1),studentId(3)]);
    await db.query("insert into public.garden_item_unlocks(user_id,item_key,course_id) values($1,'pet:cat','grade3-114-2'),($2,'pet:dog','grade6-115-1')",[studentId(1),studentId(3)]);
    const saved=await status();assert.equal(saved.garden.growth.reward_version,2);assert.deepEqual(saved.garden.unlocks.map(i=>i.key),['pet:cat']);
    assert.equal(saved.garden.unlocks[0].course_id,'grade3-114-2');
    await db.exec("insert into public.quiz_past_attempts values('past-attempt');insert into public.quiz_past_papers values('past-paper','考古測試',6)");
    await db.query("insert into public.quiz_past_leaves(user_id,attempt_id,paper_id,school_year,semester) values($1,'past-attempt','past-paper',115,1),($2,'past-attempt','past-paper',115,1)",[studentId(1),studentId(3)]);
    assert.equal((await status()).past_flowers.length,1);
    await db.exec('delete from public.quiz_past_leaves');
    assert.deepEqual(first.assignments.map(a=>a.id),['visible']);assert.equal(first.assignments[0].submission.status,'needs_revision');
    assert.deepEqual(first.periods.map(p=>p.id),['old']);assert.equal(first.periods[0].submission.status,'needs_revision');
    assert.equal(first.rehearsal,null);assert.equal((await read('grade6-115-1','603',2)).awards.length,0);
    const g3=await read('grade3-115-1','301',1);assert.deepEqual(g3.awards,[]);assert.deepEqual(g3.assignments,[]);assert.deepEqual(g3.periods,[]);
    const classRead=payload=>reader({p_action:'class_rewards',p_course_id:'grade6-115-1',p_payload:payload});
    const all=await classRead({class_code:'603'});assert.equal(all.total,33);assert.equal(all.items.length,33);
    assert.equal(all.items[0].seat_no,1);assert.equal(all.items.at(-1).seat_no,33);
    const normalize=d=>{const r=structuredClone(d);delete r.as_of;return r;};
    const {garden:classGarden,...classReward}=all.items[0].rewards;
    assert.deepEqual(normalize(classReward),normalize(first));
    assert.deepEqual(classGarden,saved.garden);
    const catalogDef=(await db.query("select pg_get_functiondef('public.garden_item_catalog()'::regprocedure) as definition")).rows[0].definition;
    await db.exec(buildLearningRewardsRpc(await readFile(new URL('../../supabase/admin_learning.sql',import.meta.url),'utf8'),catalogDef));
    const rpc=(action,payload,user=TEACHER,role='authenticated')=>db.transaction(async tx=>{
      await tx.query("select set_config('quiz.test_uid',$1,true)",[user]);await tx.exec(`set local role ${role}`);
      return (await tx.query('select public.admin_learning_rewards($1,$2,$3) as result',[action,'grade6-115-1',payload])).rows[0].result;
    });
    const clean=value=>JSON.parse(JSON.stringify(value,(key,v)=>['as_of','read_source'].includes(key)?undefined:v));
    assert.deepEqual(clean(await rpc('class_rewards',{class_code:'603'})),clean(all));
    assert.deepEqual(clean(await rpc('garden_status',{class_code:'603',seat_no:1})),clean(saved));
    await assert.rejects(rpc('class_rewards',{class_code:'603'},studentId(1)),/teacher_required/);
    await assert.rejects(rpc('garden_status',{class_code:'603',seat_no:1},'','anon'),/permission denied/);
    await assert.rejects(rpc('class_rewards',{class_code:'301'}),/invalid_class/);
    await assert.rejects(rpc('class_rewards',{class_code:'603',user_id:studentId(1)}),/invalid_request/);
    await assert.rejects(rpc('save',{class_code:'603',seat_no:1}),/invalid_action/);
    assert.equal(all.items.find(r=>r.seat_no===32).rewards.identity.mapping,'unlinked');
    assert.equal(all.items.find(r=>r.seat_no===33).rewards.identity.mapping,'conflict');
    assert.ok(!JSON.stringify(all).includes('student1@example.invalid'));
    assert.equal((await classRead({class_code:'699'})).total,0);
    await assert.rejects(classRead({}),/invalid_class/);
    await assert.rejects(classRead({class_code:'301'}),/invalid_class/);
    await assert.rejects(classRead({class_code:'603',limit:20}),/invalid_class/);
    await assert.rejects(classRead({class_code:'603',search:'only one'}),/invalid_class/);
    await db.exec('alter table public.quiz_leaf_awards add column half_units integer default 1');
    assert.equal((await read()).awards[0].half_units,1);
    assert.equal((await read('grade6-115-1','603',32)).identity.mapping,'unlinked');
    assert.equal((await read('grade6-115-1','603',33)).identity.mapping,'conflict');
    await assert.rejects(read('grade6-115-1','603',99),/student_unavailable/);
  }finally{await db.close();}
});
