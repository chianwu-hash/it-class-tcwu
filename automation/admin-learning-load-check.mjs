import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import {realpathSync} from 'node:fs';
import {createLearningDb,learningCall,TEACHER} from './lib/admin-learning-local-db.mjs';
import {newDocument,newQuestion,content} from '../shared/quiz-document.mjs';

// One isolated in-memory database; synthetic data only, no remote connection.
export async function checkLearningLoad(){
  const {db}=await createLearningDb();const started=performance.now();
  try{
    await db.exec(`create temporary table load_learners as select i,
      md5('learning-load-u-'||i)::uuid as uid,'load-'||i||'@example.invalid' as email,
      (case when i<=240 then 320 else 620 end + ((i-1)%240)/30+1)::text as class_code,
      (((i-1)%30)+1)::smallint as seat_no,
      case when i<=240 then 'grade3-115-1' else 'grade6-115-1' end as course
      from generate_series(1,480) i;
      insert into auth.users select uid,email,now() from load_learners;
      insert into public.student_enrollments select 115,email,class_code,seat_no,'負載合成同學 '||i from load_learners;`);
    const doc=newDocument();doc.title='負載合成卷';doc.catalog.subject='數學';doc.catalog.unit='合成資料測試';
    doc.blocks=[{id:'load-block',material:content('本機負載測試，非正式教材。'),questions:Array.from({length:20},(_,i)=>({...newQuestion(),id:`load-q-${i+1}`,prompt:content(`合成第 ${i+1} 題`)}))}];
    const bank=crypto.randomUUID();await db.query('insert into public.quiz_banks(id,owner_id,draft) values($1,$2,$3)',[bank,TEACHER,doc]);
    const version=(await db.query('insert into public.quiz_versions(bank_id,revision,document) values($1,1,$2) returning id',[bank,doc])).rows[0].id;
    await db.exec(`create temporary table load_papers as select u.*,n,
      md5('learning-load-s-'||u.i||'-'||n)::uuid as sid,
      md5('learning-load-a-'||u.i||'-'||n)::uuid as aid from load_learners u cross join generate_series(1,20)n;`);
    await db.query(`insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options,access_mode,created_at)
      select sid,uid,$1,115,jsonb_build_array(class_code),'complete',false,false,'self','2026-10-01'::timestamptz+n*interval '1 minute' from load_papers`,[version]);
    await db.exec(`insert into public.quiz_generated_papers(session_id,user_id,request_id,config,actual_distribution,display_name,deleted_at)
      select sid,uid,sid,'{}','{}','負載合成卷 '||n,case when n%10=0 then now() else null end from load_papers;`);
    await db.query(`insert into public.quiz_attempts(id,session_id,user_id,question_order,option_orders)
      select aid,sid,uid,$1,'{}' from load_papers`,[doc.blocks[0].questions.map(q=>q.id)]);
    await db.exec(`insert into public.quiz_answers(attempt_id,question_id,request_id,response,correct)
      select p.aid,'load-q-'||q.no,md5(p.aid::text||'-'||q.no)::uuid,'"a"',q.no%5<>0 from load_papers p cross join generate_series(1,20)q(no);
      create temporary table load_typing as select u.*,l.lesson_key,md5('load-progress-'||u.i||l.lesson_key)::uuid as pid
      from load_learners u cross join public.typing_foundation_lessons l where l.lesson_key in
      ('english-home-row-v1','english-top-row-v1','zhuyin-home-v1','zhuyin-top-v1');
      insert into public.typing_foundation_progress(id,course_id,learner_key,display_name,lesson_key,checkpoint,completed,completed_at)
      select pid,course,'google:'||uid,'負載合成同學 '||i,lesson_key,5,true,now() from load_typing;
      insert into public.typing_foundation_events(id,progress_id,revision,stage,correct,errors,elapsed_ms,interrupted,accuracy,wpm,passed)
      select md5(pid::text||n)::uuid,pid,1,(n%6)+1,96,1,60000,false,98.9,15,true from load_typing cross join generate_series(1,16)n;
      insert into public.student_progress(user_id,course_id,week_code,activity_key,current_level,completed)
      select uid,course,lpad(n::text,2,'0'),'load-activity',5,true from load_learners cross join generate_series(1,8)n;
      analyze;`);
    const hashes=async()=> (await db.query(`select 'answers' as source,count(*)::integer as count,md5(string_agg(md5(to_jsonb(x)::text),'' order by attempt_id,question_id)) as hash from public.quiz_answers x
      union all select 'events',count(*)::integer,md5(string_agg(md5(to_jsonb(x)::text),'' order by id)) from public.typing_foundation_events x`)).rows;
    const before=await hashes();
    const user={class_code:'621',seat_no:1},samples=[],measure=async(action,payload,validate)=>{
      const times=[];let bytes=0;
      for(let i=0;i<6;i++){
        const t=performance.now(),result=await learningCall(db,action,'grade6-115-1',payload);times.push(performance.now()-t);bytes=Buffer.byteLength(JSON.stringify(result));validate(result);
      }
      const sorted=times.slice(1).sort((a,b)=>a-b);samples.push({action,firstMs:+times[0].toFixed(2),medianMs:+sorted[2].toFixed(2),maxMs:+Math.max(...times).toFixed(2),responseBytes:bytes});
    };
    await measure('roster',{class_code:'621'},r=>{assert.equal(r.total,30);assert.equal(r.items.length,20);});
    await measure('profile',user,r=>{assert.equal(r.papers.created,20);assert.equal(r.typing.english,2);assert.equal(r.weekly.recorded,8);});
    await measure('typing',{...user,limit:50},r=>assert.equal(r.total,24));
    await measure('papers',{...user,subject:'數學',state:'completed',limit:10},r=>{assert.equal(r.total,20);assert.equal(r.items.length,10);assert.doesNotMatch(JSON.stringify(r),/option_id|explanation/);});
    const paper=(await learningCall(db,'papers','grade6-115-1',user)).items[0];
    await measure('paper',{...user,session_id:paper.session_id},r=>{assert.equal(r.total,20);assert.equal(r.correct,16);});
    const typing=(await learningCall(db,'typing','grade6-115-1',{...user,limit:50})).items.find(r=>r.progress_id);
    await measure('typing_events',{...user,progress_id:typing.progress_id},r=>assert.equal(r.total,16));
    const plan=(await db.query(`explain (analyze,buffers,format json) select * from public.quiz_answers where attempt_id=$1`,[paper.attempt_id])).rows[0]['QUERY PLAN'][0];
    const after=await hashes();assert.deepEqual(after,before,'Load reads must not alter saved answers or events');
    const counts={learners:480,papers:9600,answers:192000,typingEvents:30720,weeklyRecords:3840};
    return{passed:true,synthetic:true,engine:'PGlite (single local connection)',counts,samples,
      answerLookupPlan:plan,learningRowsUnchanged:true,elapsedSeconds:+((performance.now()-started)/1000).toFixed(2),
      limits:'Not a Supabase capacity/concurrency test; timings are local measurements only.'};
  }finally{await db.close();}
}
if(process.argv[1]&&realpathSync(process.argv[1])===realpathSync(fileURLToPath(import.meta.url))){
  try{const report=await checkLearningLoad();const dir=new URL('./output/admin-learning-20261101/',import.meta.url);await mkdir(dir,{recursive:true});await writeFile(new URL('load-report.json',dir),JSON.stringify(report,null,2));
    console.log(JSON.stringify({passed:report.passed,counts:report.counts,samples:report.samples,elapsedSeconds:report.elapsedSeconds}));}
  catch(e){console.error(e.message);process.exitCode=1;}
}
