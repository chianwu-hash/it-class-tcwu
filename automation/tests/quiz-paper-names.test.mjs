import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {createQuizDb,quizCall,studentId,TEACHER} from '../lib/quiz-local-db.mjs';import {newQuestion,content} from '../../shared/quiz-document.mjs';
import {buildNamingMigration} from '../lib/quiz-name-migration.mjs';
const rpc=(db,uid,name,data={})=>db.transaction(async tx=>{await tx.query("select set_config('quiz.test_uid',$1,true)",[uid||'']);await tx.exec('set local role authenticated');return (await tx.query(`select public.${name}($1) result`,[JSON.stringify(data)])).rows[0].result;});
const poolSql=await readFile('supabase/quiz-pool.sql','utf8');
async function legacyPaper(db,user,grade,generated=true,deleted=false){
 const sid=crypto.randomUUID(),vid=crypto.randomUUID(),bid=crypto.randomUUID(),request=crypto.randomUUID(),questions=Array.from({length:10},(_,i)=>{const q=newQuestion();q.id='legacy_'+i;q.prompt=content('遷移合成題 '+i);return q;});
 const document={schema:1,title:generated?'舊自組卷':'老師正式期中卷',catalog:{school_year:'115',volume:grade+'年級上學期',subject:'數學',publisher:'合成',unit:'第一單元'},blocks:questions.map(q=>({id:'b_'+q.id,material:content(''),questions:[q]}))};
 await db.query('insert into public.quiz_banks(id,owner_id,draft) values($1,$2,$3)',[bid,user,JSON.stringify(document)]);await db.query('insert into public.quiz_versions(id,bank_id,revision,document) values($1,$2,1,$3)',[vid,bid,JSON.stringify(document)]);
 await db.query("insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options,access_mode) values($1,$2,$3,115,$4,'immediate',false,false,$5)",[sid,user,vid,JSON.stringify([grade+'01']),generated?'self':'practice']);
 const config={kind:'self',count:10,units:[1],attempt_id:null,question_id:null,name:'舊的任意測試名稱'};
 if(generated)await db.query("insert into public.quiz_generated_papers(session_id,user_id,request_id,config,actual_distribution,display_name,created_at,deleted_at) values($1,$2,$3,$4,$5,$6,$7,$8)",[sid,user,request,JSON.stringify(config),'{}',config.name,deleted?'2026-10-02':'2026-10-01',deleted?'2026-10-03':null]);
 return {sid,vid,request,document,config};
}
const snapshot=async db=>JSON.stringify(await Promise.all(['quiz_versions','quiz_answers','quiz_leaf_awards'].map(async t=>(await db.query(`select to_jsonb(x) value from public.${t} x order by to_jsonb(x)::text`)).rows)));

test('主題角色白名單、主題內隨機、完全隨機、冪等重送與偽造輸入隔離',async()=>{
 const db=await createQuizDb();try{
  await db.query("update public.student_enrollments set class_code='301'");await db.exec(await readFile('supabase/quiz-wrong-questions.sql','utf8'));await db.exec(poolSql);
  for(let i=0;i<18;i++){const q=newQuestion();q.id='choice_'+i;await db.query('insert into public.quiz_question_pool values($1,$1,$1,$2,$3,$3,$4,$5,true,$6,$7,true)',[q.id,'[1]','knowledge',[-3,0,3][i%3],'v1',JSON.stringify(q),'{}']);}
  const base={kind:'self',count:5,units:[1]},compose=c=>rpc(db,studentId(1),'quiz_compose',{...base,request_id:crypto.randomUUID(),...c});
  const config={name_work:'寶可夢',name_character:'pokemon-eevee',request_id:crypto.randomUUID()};const chosen=await compose(config);assert.match(chosen.display_name,/寶可夢・伊布/);assert.equal((await compose(config)).session_id,chosen.session_id);
  await assert.rejects(compose({...config,name_character:'pokemon-pikachu'}),/submission_conflict/);
  const themed=await compose({name_work:'三麗鷗'});assert.match(themed.display_name,/三麗鷗・/);const random=await compose({});assert.match(random.display_name,/^三年級數學｜.+・.+｜003$/);
  for(const c of [{name_work:'任意名稱'},{name_work:'寶可夢',name_character:'conan-conan'},{name_character:'pokemon-eevee'},{name_work:'寶可夢',name_character:'<script>'}])await assert.rejects(compose(c),/paper_name_choice_invalid/);
  for(const c of [{name_work:4},{name_work:null},{name_character:[]},{kind:'extension',name_work:'寶可夢',count:3}])await assert.rejects(compose(c),/invalid_request/);
  assert.equal((await db.query('select count(*)::int n from public.quiz_generated_papers')).rows[0].n,3);
  const catalog=await db.transaction(async tx=>{await tx.query("select set_config('quiz.test_uid',$1,true)",[studentId(1)]);await tx.exec('set local role authenticated');return (await tx.query('select public.quiz_pool_catalog() r')).rows[0].r;});assert.equal(catalog.name_characters.length,22);assert.ok(catalog.name_characters.every(p=>p.id&&p.work&&p.character));assert.doesNotMatch(JSON.stringify(catalog),/option_id|explanation/);
 }finally{await db.close();}
});

test('舊自組與已刪卷安全換名，老師卷、版本、答案及葉片不變，重跑不重編號',async()=>{
 const db=await createQuizDb();try{
  await db.query("update public.student_enrollments set class_code=case when email='student1@example.invalid' then '301' else '601' end");await db.exec(await readFile('supabase/quiz-rewards.sql','utf8'));
  const one=await legacyPaper(db,studentId(1),3),removed=await legacyPaper(db,studentId(1),3,true,true),six=await legacyPaper(db,studentId(2),6),teacher=await legacyPaper(db,TEACHER,3,false);
  const joined=await quizCall(db,studentId(1),'join',{session_id:one.sid});for(const [i,q] of joined.document.questions.entries())await quizCall(db,studentId(1),'submit',{session_id:one.sid,question_id:q.id,response:i<6?'a':'b',request_id:crypto.randomUUID()});
  await db.query("insert into public.quiz_leaf_awards(user_id,attempt_id,fingerprint,grade,total,correct) values($1,$2,'legacy-fingerprint',3,10,6)",[studentId(1),joined.attempt_id]);
  await db.exec('create table public.student_progress(id integer primary key,completed boolean);insert into public.student_progress values(1,true)');
  const before=await snapshot(db),oldAwards=await rpc(db,studentId(1),'quiz_rewards');await db.exec(buildNamingMigration(poolSql));assert.equal(await snapshot(db),before);
  const names=(await db.query('select session_id,display_name,name_number from public.quiz_generated_papers')).rows;
  assert.match(names.find(p=>p.session_id===one.sid).display_name,/^三年級數學｜.+・.+｜001$/);assert.match(names.find(p=>p.session_id===removed.sid).display_name,/｜002$/);assert.match(names.find(p=>p.session_id===six.sid).display_name,/^六年級數學｜.+・.+｜001$/);
  const resumed=await quizCall(db,studentId(1),'resume',{session_id:one.sid});assert.equal(Object.keys(resumed.responses).length,10);assert.doesNotMatch(resumed.document.title,/任意|測試/);
  const awards=await rpc(db,studentId(1),'quiz_rewards');assert.equal(awards.awards.length,oldAwards.awards.length);assert.equal(awards.awards[0].id,oldAwards.awards[0].id);assert.equal(awards.awards[0].correct,6);assert.equal(awards.awards[0].title,resumed.document.title);
  assert.equal((await db.query('select document from public.quiz_versions where id=$1',[teacher.vid])).rows[0].document.title,'老師正式期中卷');
  const retry=await rpc(db,studentId(1),'quiz_compose',{kind:'self',count:10,units:[1],request_id:one.request,name:'舊客戶端改成另一個名稱'});assert.equal(retry.session_id,one.sid);assert.equal(retry.display_name,resumed.document.title);
  await db.exec(poolSql);assert.deepEqual((await db.query('select session_id,display_name,name_number from public.quiz_generated_papers')).rows,names);assert.equal(await snapshot(db),before);
  const tampered=poolSql.replace('commit;','update public.quiz_answers set correct=false;commit;');await assert.rejects(db.exec(buildNamingMigration(tampered)),/naming_changed_protected_data/);await db.exec('rollback');assert.equal(await snapshot(db),before);
 }finally{await db.close();}
});

test('作品角色配對、忽略偽造名稱、跨科流水號不回收，併發與重送只建一卷，私有與鎖名',async()=>{
 const db=await createQuizDb();try{
  await db.query("update public.student_enrollments set class_code='301'");await db.exec(await readFile('supabase/quiz-wrong-questions.sql','utf8'));await db.exec(poolSql);
  for(const [course,subject] of [['math','數學'],['science','自然']]){const id=course==='math'?'115-1-hanlin-g3-math':'test-science';if(course==='science')await db.query('insert into public.quiz_courses values($1,3,$2,true)',[id,JSON.stringify({volume:'3年級上學期',subject,publisher:'合成',units:{1:'第一單元'}})]);for(let i=0;i<18;i++){const q=newQuestion();q.id=course+'_'+i;q.prompt=content('合成題 '+i);await db.query('insert into public.quiz_question_pool values($1,$1,$1,$2,$3,$3,$4,$5,true,$6,$7,true)',[q.id,'[1]','knowledge',[-3,0,3][i%3],'v1',JSON.stringify(q),'{}']);await db.query('insert into public.quiz_pool_membership values($1,$2,true)',[q.id,id]);}}
  const config={kind:'self',count:5,units:[1],request_id:crypto.randomUUID(),name:'<不接受的自由輸入>',display_name:undefined};delete config.display_name;
  const [first,again]=await Promise.all([rpc(db,studentId(1),'quiz_compose',config),rpc(db,studentId(1),'quiz_compose',config)]);assert.equal(first.session_id,again.session_id);assert.equal(first.display_name,again.display_name);assert.match(first.display_name,/｜001$/);assert.doesNotMatch(first.display_name,/不接受/);
  await rpc(db,studentId(1),'quiz_delete_paper',{session_id:first.session_id});const next=await rpc(db,studentId(1),'quiz_compose',{...config,course_id:'test-science',request_id:crypto.randomUUID()});assert.match(next.display_name,/^三年級自然｜.+・.+｜002$/);
  const own=(await db.query('select * from public.quiz_generated_papers where session_id=$1',[next.session_id])).rows[0],person=(await db.query('select * from public.quiz_name_characters where id=$1',[own.name_character_id])).rows[0];assert.equal(next.display_name,`三年級自然｜${person.work}・${person.character}｜002`);
  await assert.rejects(rpc(db,studentId(1),'quiz_rename_paper',{session_id:next.session_id,name:'再次嘗試'}),/paper_name_locked/);await assert.rejects(db.query('update public.quiz_generated_papers set display_name=$1 where session_id=$2',['硬改',next.session_id]),/paper_name_locked/);
  for(const table of ['quiz_name_characters','quiz_name_counters'])await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role authenticated');await tx.query('select * from public.'+table);}),/permission denied/);
  await db.query("update public.quiz_name_counters set last_number=999 where user_id=$1",[studentId(1)]);const large=await rpc(db,studentId(1),'quiz_compose',{...config,request_id:crypto.randomUUID()});assert.match(large.display_name,/｜1000$/);
 }finally{await db.close();}
});
