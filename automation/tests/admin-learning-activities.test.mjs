import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {createLearningDb,learningCall,TEACHER,studentId,DEMO_MEDIA} from '../lib/admin-learning-local-db.mjs';
import {splitSnapshot} from '../lib/db-snapshot.mjs';

test('學習檔案：四年級／九年級、考古歷次版本、延伸卷、全域篩選與逐題唯讀隔離',async t=>{
 const {db,ids}=await createLearningDb();
 try{
  await db.exec(`create table public.quiz_learning_sessions(session_id uuid primary key,user_id uuid,source_attempt uuid,question_id text);
   create table public.quiz_past_papers(id text primary key,grade integer);
   create table public.quiz_past_versions(id uuid primary key,paper_id text,document jsonb,created_at timestamptz);
   create table public.quiz_past_attempts(id uuid primary key,paper_id text,version_id uuid,user_id uuid,school_year integer,semester integer,created_at timestamptz,completed_at timestamptz);
   create table public.quiz_past_receipts(attempt_id uuid,group_id text,status text,responses jsonb,results jsonb);
   create table public.quiz_past_answers(attempt_id uuid,group_id text,question_id text,response jsonb,correct boolean);
   revoke all on public.quiz_past_papers,public.quiz_past_versions,public.quiz_past_attempts,public.quiz_past_receipts,public.quiz_past_answers,public.quiz_learning_sessions from public,anon,authenticated;`);
  const blocks=splitSnapshot(await fs.readFile('supabase/production-snapshot/functions.sql','utf8'));
  // Current production readers depend on grade-sharing metadata/helper. This
  // older isolated fixture predates that view; install the exact read function.
  await db.exec("create view public.quiz_version_meta as select id version_id,document->'catalog' catalog from public.quiz_versions");
  await db.exec('alter table public.quiz_sessions add column library_visible boolean not null default true');
  await db.exec(blocks.find(b=>b.signature==='quiz_session_class_allowed(uuid,text)').definition+';');
  for(const b of blocks.filter(b=>['admin_learning_action','admin_learning_paper_rows','admin_learning_media_access','admin_learning_rewards'].some(n=>b.signature.startsWith(n+'('))))await db.exec(b.definition+';');
  // PostgreSQL formats pg_get_functiondef differently in PGlite. Live rollback exercises the exact guard.
  const sql=(await fs.readFile('supabase/admin-learning-activities.sql','utf8')).replace(/do \$guard\$[\s\S]*?end \$guard\$;/,'');
  await db.exec(sql);
  const fixtures=[];
  for(const grade of [3,4,6,9]){
   const uid=studentId(grade+80),cls=grade+'91';
   await db.query('insert into auth.users values($1,$2,now())',[uid,`scope${grade}@example.invalid`]);
   await db.query('insert into public.student_enrollments values(115,$1,$2,1,$3)',[`scope${grade}@example.invalid`,cls,`合成${grade}年級`]);
   const version=randomUUID(),attempt=randomUUID(),second=randomUUID(),paper='synthetic'+grade;
   const document={title:`合成${grade}年級舊版`,catalog:{subject:'國語'},groups:[
    {id:'g1',kind:'single',prompt:'舊題幹',assets:[{url:DEMO_MEDIA}],choices:[{id:'A',text:'甲'},{id:'B',text:'乙'}],fields:[{id:'q1',label:'1',answer:'B'}]},
    {id:'g2',kind:'short',prompt:'填答',fields:[{id:'q2',answer:['正確文字']}]},
    {id:'g3',kind:'manual',prompt:'自行核對',fields:[{id:'q3',reference:'參考資訊'}]}]};
   await db.query('insert into public.quiz_past_papers values($1,$2)',[paper,grade]);
   await db.query("insert into public.quiz_past_versions values($1,$2,$3,'2026-10-01'),($4,$2,$5,'2026-10-02')",[version,paper,document,second,{...document,title:'新版不能蓋掉舊作答'}]);
   await db.query("insert into public.quiz_past_attempts values($1,$2,$3,$4,115,1,now(),null),($5,$2,$6,$4,115,1,now(),null)",[attempt,paper,version,uid,randomUUID(),second]);
   await db.query('insert into public.quiz_past_receipts values($1,$2,$3,$4,$5),($1,$6,$7,$8,$9)',[attempt,'g1','graded',[{questionId:'q1',value:'A'}],[{questionId:'q1',official:'B'}],'g3','self_checked',[{questionId:'q3',value:{text:'原始自評文字'}}],[]]);
   await db.query('insert into public.quiz_past_answers values($1,$2,$3,$4,false)',[attempt,'g1','q1','"A"']);
   fixtures.push({grade,uid,cls,version,attempt});
  }
  await db.query('insert into public.quiz_learning_sessions values($1,$2,$3,$4)',[ids.original.session,studentId(1),fixtures[0].attempt,'q1']);
  const call=(a,p={},c='grade6-115-1',u=TEACHER,r='authenticated')=>learningCall(db,a,c,p,u,r);
  const digest=async()=>createHash('sha256').update(JSON.stringify(await Promise.all(['quiz_attempts','quiz_answers','quiz_past_attempts','quiz_past_answers','quiz_past_receipts','quiz_learning_sessions'].map(async n=>(await db.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') data from public.${n} t`)).rows[0].data)))).digest('hex');
  const before=await digest();
  await t.test('四個課程各自名冊／歷次考古作答／原版本與人工題',async()=>{
   for(const f of fixtures){const course=`grade${f.grade}-115-1`,who={class_code:f.cls,seat_no:1};
    const roster=await call('roster',{class_code:f.cls},course);assert.ok(roster.items.some(x=>x.display_name===`合成${f.grade}年級`));
    const papers=await call('papers',{...who,activity_type:'past_exam'},course);assert.equal(papers.total,2);assert.ok(papers.items.every(x=>x.access_mode==='past_exam'));
    const detail=await call('paper',{...who,session_id:f.attempt},course);assert.equal(detail.version_id,f.version);assert.match(detail.title,/舊版/);assert.equal(detail.total,3);assert.equal(detail.items[0].response,'A');assert.equal(detail.items[0].official,'B');assert.equal(detail.items[1].answered,false);assert.equal(detail.items[2].manual,true);assert.deepEqual(detail.items[2].response,{text:'原始自評文字'});
    const wrong=await call('paper',{...who,session_id:f.attempt,filter:'wrong'},course);assert.equal(wrong.filtered_total,1);assert.equal(wrong.total,3);assert.equal(wrong.items[0].question.id,'q1');
    const paged=await call('paper',{...who,session_id:f.attempt,limit:1,offset:1},course);assert.equal(paged.items[0].question.id,'q2');
   }
  });
  await t.test('延伸卷重新接入且保留原答案／題序；類型與科目在分頁前篩選',async()=>{
   const who={class_code:'603',seat_no:1};
   const list=await call('papers',{...who,activity_type:'extension',limit:1});assert.equal(list.total,1);assert.equal(list.items[0].session_id,ids.original.session);assert.equal(list.items[0].source_attempt_id,fixtures[0].attempt);
   const detail=await call('paper',{...who,session_id:ids.original.session});assert.ok(detail.items.length>0);assert.ok(detail.items.some(x=>x.answered));
   const self=await call('papers',{...who,activity_type:'self',limit:1,offset:1});assert.equal(self.items.length,1);assert.ok(self.total>1);assert.ok(self.items.every(x=>x.access_mode==='self'));
   const empty=await call('papers',{...who,activity_type:'extension',subject:'不存在'});assert.equal(empty.total,0);assert.ok(empty.all_total>0);
  });
  await t.test('匿名／學生／跨課程／其他人的attempt／直接內部函式均拒絕',async()=>{
   await assert.rejects(call('roster',{},'grade4-115-1','','anon'),/permission denied/);
   await assert.rejects(call('roster',{},'grade4-115-1',studentId(1)),/teacher_required/);
   await assert.rejects(call('papers',{class_code:'491',seat_no:1},'grade9-115-1'),/invalid_class/);
   await assert.rejects(call('paper',{class_code:'491',seat_no:1,session_id:fixtures[3].attempt},'grade4-115-1'),/paper_unavailable/);
   await assert.rejects(call('papers',{class_code:'603',seat_no:1,activity_type:'arbitrary'}),/invalid_request/);
   await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role authenticated');await tx.query("select public.admin_learning_past_detail($1,20,0,'all')",[fixtures[0].attempt]);}),/permission denied/);
  });
  await t.test('考古媒體只允許所選學生固定版本內的素材',async()=>{
   const f=fixtures[3],who={class_code:f.cls,seat_no:1};
   const media=(url,id=f.attempt)=>db.transaction(async tx=>{await tx.query("select set_config('quiz.test_uid',$1,true)",[TEACHER]);await tx.exec('set local role authenticated');return (await tx.query('select public.admin_learning_media_access($1,$2,$3,$4) r',['grade9-115-1',who,id,url])).rows[0].r;});
   assert.equal((await media(DEMO_MEDIA)).url,DEMO_MEDIA);
   await assert.rejects(media('https://quiz-media.invalid/not-in-this-version'),/media_unavailable/);
   await assert.rejects(media(DEMO_MEDIA,fixtures[0].attempt),/paper_unavailable/);
  });
  assert.equal(await digest(),before,'teacher reads must never mutate learning data');
 }finally{await db.close();}
});
