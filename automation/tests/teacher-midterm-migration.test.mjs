import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {setupProductionQuizDB} from '../fixtures/production-quiz-db.mjs';
import {newDocument,newQuestion,content} from '../../shared/quiz-document.mjs';
import {MIDTERM_UNITS,selectMidtermQuestions} from '../lib/teacher-midterm-selector.mjs';
import {buildTeacherMidtermMigration} from '../lib/teacher-midterm-migration.mjs';
test('十份期中20題固定新版本、來源漂移拒絕／rollback、重跑防重與四人2葉',async t=>{
 const f=await setupProductionQuizDB(),{db,uid}=f,plans=[];
 const partner=async(n,p)=>{await f.as(n);try{return(await db.query('select public.quiz_partner_pilot_action($1) r',[{...p,requestId:crypto.randomUUID()}])).rows[0].r;}finally{await db.exec('reset role');}};
 try{
 await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[uid(1),'teacher@example.invalid']);
 for(let n=2;n<=6;n++){await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[uid(n),`student${n}@example.invalid`]);await db.query('insert into public.student_enrollments(school_year,email,class_code,seat_no,display_name) values(115,$1,$2,$3,$4)',[`student${n}@example.invalid`,n===6?'603':'30'+n,n,'合成同學'+n]);}
 await db.exec('create trigger quiz_version_meta after insert or update of document on public.quiz_versions for each row execute function public.quiz_version_meta_trigger()');
 await db.exec('create trigger partner_freeze_allocation before insert or update on partner_pilot.rooms for each row execute function partner_pilot.freeze_allocation()');
 await db.exec('insert into partner_pilot.settings values(true,true)');
 await db.exec(await fs.readFile('supabase/quiz-grade-sharing.sql','utf8'));await db.exec(await fs.readFile('supabase/quiz-partner-import-teacher.sql','utf8'));
 for(const[index,[course,units]]of Object.entries(MIDTERM_UNITS).entries()){
  const grade=course.includes('-g3-')?3:6,definition={school_year:'115',volume:grade+'年級上學期',subject:'合成科目'+index,publisher:'合成版本',units:Object.fromEntries(units.map(u=>[u,'單元'+u]))};
  await db.query('insert into public.quiz_courses values($1,$2,$3,true)',[course,grade,definition]);
  const candidates=[];for(const u of units)for(const d of [-3,0,3])for(let n=0;n<12;n++){const id=`c${index}u${u}d${d+3}n${n}`,q=newQuestion();q.id=id;q.prompt=content('合成條件 '+id);q.explanation=content('合成解析');candidates.push({id,family:id,units:[u],difficulty:d,has_explanation:true,question:q});}
  const selected=selectMidtermQuestions({id:course,questions:candidates}),seedSession=uid(100+index),oldVersion=uid(200+index),oldBank=uid(300+index),old=newDocument();old.catalog={...old.catalog,...definition};delete old.catalog.units;
  await db.query('insert into public.quiz_banks(id,owner_id,draft) values($1,$2,$3)',[oldBank,uid(1),old]);await db.query('insert into public.quiz_versions(id,bank_id,revision,document) values($1,$2,1,$3)',[oldVersion,oldBank,old]);
  await db.query("insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options,access_mode) values($1,$2,$3,115,'[]','immediate',false,true,'practice')",[seedSession,uid(1),oldVersion]);
  for(const q of selected){await db.query('insert into public.quiz_question_pool values($1,$1,$1,$2,$3,$3,$4,$3,true,$5,$6,true)',[q.id,q.units,'synthetic',q.difficulty,q.question,{}]);await db.query('insert into public.quiz_pool_membership values($1,$2,true)',[q.id,course]);q.fingerprint=(await db.query("select md5(jsonb_build_object('question',question,'units',unit_ids,'usable',usable,'difficulty',difficulty,'course',$2::text)::text) hash from public.quiz_question_pool where question_id=$1",[q.id,course])).rows[0].hash;}
  const doc={schema:1,title:'合成期中20題',catalog:{...old.catalog,unit:'期中20題'}};
  plans.push({course,grade,subject:definition.subject,definition,units,seedSession,bank:uid(400+index),version:uid(500+index),session:uid(600+index),title:doc.title,template:{schema:1},catalog:doc.catalog,selected:selected.map((q,i)=>({id:q.id,unit:q.selectedUnit,fingerprint:q.fingerprint,newQuestion:'frozen-q'+i}))});
 }
 const sql=buildTeacherMidtermMigration(plans),oldVersions=(await db.query('select jsonb_agg(to_jsonb(v) order by id) rows from public.quiz_versions v')).rows[0].rows;
 await t.test('題源變更即拒絕整筆，沒有部分新卷殘留',async()=>{await db.query('update public.quiz_question_pool set usable=false where question_id=$1',[plans[0].selected[0].id]);await assert.rejects(db.exec(sql),/MIDTERM_QUESTION_CHANGED/);await db.exec('rollback');assert.equal((await db.query('select count(*)::int n from public.quiz_versions')).rows[0].n,10);await db.query('update public.quiz_question_pool set usable=true where question_id=$1',[plans[0].selected[0].id]);});
 await t.test('10份×20題、alias、partner同步建立，重跑不重複且舊版本保持',async()=>{await db.exec(sql);await db.exec(sql);assert.equal((await db.query('select count(*)::int n from partner_pilot.papers')).rows[0].n,10);assert.equal((await db.query('select count(*)::int n from partner_pilot.paper_items')).rows[0].n,200);assert.equal((await db.query('select count(*)::int n from public.quiz_pool_aliases')).rows[0].n,200);assert.deepEqual((await db.query('select jsonb_agg(to_jsonb(v) order by id) rows from public.quiz_versions v where id=any($1::uuid[])',[oldVersions.map(v=>v.id)])).rows[0].rows,oldVersions);});
 await t.test('四班同年級可用20題，四人完成與回顧後各2葉，跨年級拒絕',async()=>{let room=await partner(2,{action:'create',paper:'real-'+plans[0].version,capacity:4,team:'合成四人小隊',theme:'forest'});for(const n of [3,4,5])room=await partner(n,{action:'join',roomId:room.id,code:room.code});await assert.rejects(partner(6,{action:'join',roomId:room.id,code:room.code}),/SOURCE_CHANGED/);room=await partner(2,{action:'start',roomId:room.id,revision:room.revision});
  for(const n of [2,3,4,5]){const own=await partner(n,{action:'snapshot',roomId:room.id});assert.equal(own.exercise.mine.length,5);for(const q of own.exercise.mine){const correct=(await db.query('select correct from partner_pilot.question_bank where id=$1',[q.id])).rows[0].correct;await partner(n,{action:'answer',roomId:room.id,qid:q.id,choice:correct,expectedAttempt:0});}}
  for(const n of [2,3,4,5])room=await partner(n,{action:'review',roomId:room.id,text:'合成回顧確認'});
  assert(room.exercise.finished);assert.equal(room.exercise.award.leaves,2);assert.equal(room.exercise.award.flowers,0);assert.equal((await db.query('select count(*)::int n from partner_pilot.awards')).rows[0].n,1);
 });
 }finally{await db.close();}
});
