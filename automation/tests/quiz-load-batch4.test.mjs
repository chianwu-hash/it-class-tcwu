import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createQuizDb,quizCall,studentId,TEACHER} from '../lib/quiz-local-db.mjs';
import {newDocument,newQuestion,content} from '../../shared/quiz-document.mjs';
const sql=f=>readFile('supabase/'+f,'utf8');
const rpc=(db,uid,name,data,role='authenticated')=>db.transaction(async tx=>{
 await tx.query("select set_config('quiz.test_uid',$1,true)",[uid||'']);await tx.exec('set local role '+role);
 return (await tx.query(data===undefined?`select public.${name}() result`:`select public.${name}($1) result`,data===undefined?[]:[JSON.stringify(data)])).rows[0].result;
});
async function setup(){const db=await createQuizDb(undefined,{batch2:false,batch3:false});for(const f of ['quiz-wrong-questions.sql','quiz-pool.sql','quiz-rewards.sql','quiz-load-batch1.sql','quiz-load-batch2.sql','quiz-load-batch3.sql'])await db.exec(await sql(f));return db;}
async function alias(db,name){const s=(await db.query('select pg_get_functiondef(oid) s from pg_proc where proname=$1 and pronamespace=\'public\'::regnamespace',[name])).rows[0].s;await db.exec(s.replace('public.'+name+'(', 'public.'+name+'_before4('));}
const without=(o,k)=>{const c={...o};delete c[k];return c;};
async function seedPool(db,prefix,n){const q=newQuestion();for(let i=0;i<n;i++)await db.query('insert into public.quiz_question_pool values($1,$1,$2,$3,$4,$4,$5,$6,true,$7,$8,true)',[prefix+i,'g_'+prefix+i,JSON.stringify([[1],[1,2],[2],[],[10,2]][i%5]),'k'+i%3,[-3,0,3][i%3],'test',{...q,id:prefix+i},{}]);}

test('第四批：目錄快取與原函式深比相同，題池／課程／單元歸屬／角色異動後自動失效',async()=>{
 const db=await setup();try{
  await alias(db,'quiz_pool_catalog');const hashes=(await db.query("select proname,md5(pg_get_functiondef(oid)) h from pg_proc where proname in('quiz_action','quiz_answer_guard','quiz_leaf_result','quiz_student_document','quiz_wrong_questions') order by 1")).rows;
  await db.exec(await sql('quiz-load-batch4.sql'));
  assert.deepEqual((await db.query("select proname,md5(pg_get_functiondef(oid)) h from pg_proc where proname in('quiz_action','quiz_answer_guard','quiz_leaf_result','quiz_student_document','quiz_wrong_questions') order by 1")).rows,hashes);
  await seedPool(db,'p',30);
  await db.exec("insert into public.quiz_courses values('disabled',6,'{}',false),('empty',6,'{}',true),('six',6,'{\"subject\":\"自然\",\"volume\":\"6年級上學期\",\"units\":{\"1\":\"一\",\"2\":\"二\",\"10\":\"十\"}}',true);insert into public.quiz_pool_membership values('p3','six',true),('p4','disabled',false),('p8','six',false),('p13','six',true)");
  const same=async()=>{for(const grade of [3,6]){await db.query('update public.student_enrollments set class_code=$1',[grade+'03']);
   for(let i=0;i<2;i++)assert.deepEqual(await rpc(db,studentId(1),'quiz_pool_catalog'),await rpc(db,studentId(1),'quiz_pool_catalog_before4'));}};
  await same();assert.equal((await db.query('select count(*)::int n from public.quiz_catalog_cache')).rows[0].n,2);
  const mutations=["update public.quiz_question_pool set usable=false where question_id in ('p1','p2')","insert into public.quiz_pool_membership values('p9','six',true)",
   "update public.quiz_pool_membership set knowledge_reliable=false where course_id='six'","update public.quiz_courses set enabled=false where id='six'",
   "update public.quiz_courses set enabled=true,definition=jsonb_set(definition,'{units,2}','\"改名\"') where id='six'",
   "update public.quiz_name_characters set enabled=false where id like 'pokemon%'","delete from public.quiz_question_pool where question_id='p13'"];
  for(const m of mutations){await db.exec(m);assert.equal((await db.query('select count(*)::int n from public.quiz_catalog_cache')).rows[0].n,0,m);await same();}
  await seedPool(db,'new',7);await same();
  // 教師、未登入照舊；快取表與內部函式不可直接存取。
  assert.deepEqual(await rpc(db,TEACHER,'quiz_pool_catalog').catch(e=>e.message),await rpc(db,TEACHER,'quiz_pool_catalog_before4').catch(e=>e.message));
  await assert.rejects(rpc(db,null,'quiz_pool_catalog'),/login_required/);
  await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role authenticated');await tx.query('select * from public.quiz_catalog_cache');}),/permission denied/);
  for(const f of ['quiz_catalog_build(3)','quiz_nav_identity(\'x\')',`quiz_paper_card('${crypto.randomUUID()}')`])
   await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role authenticated');await tx.query('select public.'+f);}),/permission denied/,f);
 }finally{await db.close();}
});

test('第四批：清單與開卷資料與第三批相同，只多本人名冊標籤；組卷回傳卡片等於清單項目',async()=>{
 const db=await setup();try{
  for(const fn of ['quiz_library_sessions','quiz_entry_context','quiz_compose'])await alias(db,fn);
  await db.exec(await sql('quiz-load-batch4.sql'));await db.query("update public.student_enrollments set class_code='301'");
  await seedPool(db,'c',40);
  const d=newDocument();d.catalog={...d.catalog,subject:'數學',volume:'3年級上學期'};d.blocks=[{id:'b',material:content('材料'),questions:[newQuestion(),newQuestion()]}];
  const bank_id=crypto.randomUUID();await quizCall(db,TEACHER,'save',{bank_id,expected_revision:0,document:d});const v=await quizCall(db,TEACHER,'publish',{bank_id,expected_revision:1});
  const practice={session_id:crypto.randomUUID()};await quizCall(db,TEACHER,'open',{...practice,version_id:v.id,school_year:115,class_codes:['301'],reveal:'immediate',access_mode:'practice'});
  const other={session_id:crypto.randomUUID()};await quizCall(db,TEACHER,'open',{...other,version_id:v.id,school_year:115,class_codes:['302'],reveal:'immediate',access_mode:'practice'});
  const me=studentId(1),you=studentId(2);
  const compare=async uid=>{const now=await rpc(db,uid,'quiz_library_sessions',{}),old=await rpc(db,uid,'quiz_library_sessions_before4',{});
   assert.deepEqual(without(now,'identity'),old);const e=(await db.query("select e.* from public.student_enrollments e join auth.users u on lower(u.email)=e.email where u.id=$1",[uid])).rows[0];
   assert.deepEqual(now.identity,{email:e.email,class_code:e.class_code,seat_no:e.seat_no,display_name:e.display_name,student_code:e.class_code+String(e.seat_no).padStart(2,'0')});return now;};
  await compare(me);
  const composed=[];
  for(const data of [{kind:'self',count:5,units:[1],course_id:'115-1-hanlin-g3-math',difficulty:'medium',request_id:crypto.randomUUID()},{kind:'self',count:10,units:[1,2],request_id:crypto.randomUUID()}]){
   const r=await rpc(db,me,'quiz_compose',data);composed.push(r);
   const lib=await compare(me);assert.deepEqual(r.paper,lib.sessions.find(s=>s.id===r.session_id));
   const again=await rpc(db,me,'quiz_compose',data);assert.deepEqual(again,{...r,reused:true});
   assert.deepEqual(without(again,'paper'),without(await db.transaction(async tx=>{await tx.query("select set_config('quiz.test_uid',$1,true)",[me]);await tx.exec('set local role authenticated');return (await tx.query('select public.quiz_compose_before4($1) r',[JSON.stringify(data)])).rows[0].r;}),'paper'));
  }
  // 作答後重送仍回最新進度；他人看不到卡片。
  await quizCall(db,me,'join',{session_id:composed[0].session_id});
  const first=composed[0].paper;await compare(me);await compare(you);
  for(const [uid,sid] of [[me,practice.session_id],[me,other.session_id],[me,composed[0].session_id],[you,composed[0].session_id],[me,crypto.randomUUID()],[TEACHER,practice.session_id]]){
   const now=await rpc(db,uid,'quiz_entry_context',{session_id:sid}).catch(e=>e.message),old=await rpc(db,uid,'quiz_entry_context_before4',{session_id:sid}).catch(e=>e.message);
   assert.deepEqual(typeof now==='string'?now:without(now,'identity'),old);
  }
  await db.query('delete from public.quiz_version_meta');
  assert.deepEqual(without(await rpc(db,me,'quiz_entry_context',{session_id:practice.session_id}),'identity'),await rpc(db,me,'quiz_entry_context_before4',{session_id:practice.session_id}));
  assert.equal(first.answered,0);
  await db.query('update public.quiz_generated_papers set deleted_at=now()');
  assert.equal(await db.transaction(async tx=>{await tx.query("select set_config('quiz.test_uid',$1,true)",[me]);return (await tx.query('select public.quiz_paper_card($1) c',[composed[0].session_id])).rows[0].c;}),null);
 }finally{await db.close();}
});
