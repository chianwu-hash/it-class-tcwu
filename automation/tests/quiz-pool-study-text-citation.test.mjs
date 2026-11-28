import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {setupProductionQuizDB} from '../fixtures/production-quiz-db.mjs';
import {newQuestion,content} from '../../shared/quiz-document.mjs';

const install=await fs.readFile('supabase/quiz-pool-study-text-citation.sql','utf8');
const rollback=await fs.readFile('supabase/quiz-pool-study-text-citation-rollback.sql','utf8');
const oldMd5='76fc3552b43d5989c17c8832938a3833',newMd5='78d18e6366e891fd4a91ea53b322ced2';
const binderHash=async db=>(await db.query("select md5(pg_get_functiondef('public.quiz_bind_composed_study()'::regprocedure)) h")).rows[0].h;
async function assertRestored(db){
 assert.equal(await binderHash(db),oldMd5);
 assert.equal((await db.query("select md5(pg_get_constraintdef(oid)) h from pg_constraint where conrelid='public.quiz_pool_study_sources'::regclass and conname='quiz_pool_study_sources_reference_shape'")).rows[0].h,'fc94f18029f09b8ff0cdd3e56bcd0eff');
 assert.equal((await db.query("select to_regprocedure('public.quiz_text_citation_valid(jsonb,text,jsonb,jsonb)') h")).rows[0].h,null);
}
async function fixture(){
 const f=await setupProductionQuizDB({snapshot:true}),{db,uid}=f;
 await db.exec(`create type public.quiz_draw_candidate as (question_id text,group_key text,unit_ids jsonb,knowledge_code text,difficulty integer,seen bigint,rank text,unit_bucket bigint);
 create trigger bind_composed_study after insert on public.quiz_generated_papers for each row execute function public.quiz_bind_composed_study();
 create trigger pool_study_source_immutable before update or delete on public.quiz_pool_study_sources for each row execute function public.quiz_pool_study_source_guard();
 create trigger study_insert_guard before insert on public.quiz_study_items for each row execute function public.quiz_study_insert_guard();`);
 for(const table of ['quiz_study_packages','quiz_study_items','quiz_study_attempts'])await db.exec(`create trigger study_immutable before update or delete on public.${table} for each row execute function public.quiz_study_immutable()`);
 for(const grade of [3,4,6,9]){
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[uid(grade),`student${grade}@example.invalid`]);
  await db.query('insert into public.student_enrollments(school_year,email,class_code,seat_no,display_name) values(115,$1,$2,1,$3)',[`student${grade}@example.invalid`,grade+'01','合成學生']);
 }
 const call=async(grade,p,fn='quiz_action')=>{await f.as(grade);try{
  if(fn==='quiz_action'){const {action,...data}=p;return(await db.query('select public.quiz_action($1,$2) r',[action,data])).rows[0].r;}
  return(await db.query('select public.quiz_compose($1) r',[p])).rows[0].r;
 }finally{await db.exec('reset role');}};
 async function source(grade,i,{course=`synthetic-text-g${grade}`,notesGrade=grade}={}){
  await db.query('insert into public.quiz_courses(id,grade,definition,enabled) values($1,$2,$3,true) on conflict do nothing',[course,grade,{school_year:'115',volume:grade+'年級上學期',subject:'數學',publisher:'合成',units:{1:'合成單元'}}]);
  const q=newQuestion();q.id=course+'_'+i;q.prompt=content('合成題目');q.explanation=content('原有解析');
  await db.query("insert into public.quiz_question_pool(question_id,source_item_id,group_key,unit_ids,knowledge_code,knowledge_name,difficulty,source_version,publisher_explanation,question,checks,usable) values($1,$1,$1,'[1]','synthetic','合成',0,$2,false,$3,'{}',true)",[q.id,'a'.repeat(64),q]);
  await db.query('insert into public.quiz_pool_membership values($1,$2,false)',[q.id,course]);
  const hash=(await db.query("select encode(sha256(convert_to($1::jsonb::text,'UTF8')),'hex') h",[q])).rows[0].h;
  const citation={schema:1,course_id:course,grade:notesGrade,school_year:115,semester:1,title:'合成教材',publisher:'合成',subject:'數學',source_version:'a'.repeat(64),question_sha256:hash,references:[{source_role:'teacher_guide',source_sha256:'b'.repeat(64),pdf_page:2,printed_page:20,chapter:'合成章節'}]};
  const notes={book_match_status:i%2?'verified_text_citation_related':'verified_text_citation_direct',text_citation:citation,teacher_note_marker:'never disclose'};
  const provenance={reviewed:true,source_version:'a'.repeat(64)};
  const save=(n=notes,p=provenance)=>db.query("insert into public.quiz_pool_study_sources(question_id,course_id,question,book_id,primary_page,reference_pages,student_explanation,teacher_notes,provenance,enabled) values($1,$2,$3,null,null,'{}','合成固定解析與教材文字引用',$4,$5,true)",[q.id,course,q,n,p]);
  return{q,course,citation,notes,provenance,save};
 }
 return{...f,call,source};
}

test('文字引用形狀守衛、完整交易回滾、重裝與並行變更拒絕',async()=>{
 const f=await fixture(),{db}=f;
 try{
  assert.equal(await binderHash(db),oldMd5);assert(install.endsWith('commit;\n'));assert(!install.includes('\r'));
  const marker='\nbegin;\n',body=install.slice(install.indexOf(marker)+marker.length,-8);
  await db.exec('begin;'+body+'rollback;');assert.equal(await binderHash(db),oldMd5);
  assert.equal((await db.query("select to_regprocedure('public.quiz_text_citation_valid(jsonb,text,jsonb,jsonb)') h")).rows[0].h,null);
  await db.exec(install);await db.exec(install);assert.equal(await binderHash(db),newMd5);
  const s=await f.source(9,0),invalid=[
   n=>{delete n.text_citation;},n=>{n.text_citation.references=[];},n=>{n.text_citation.references={};},
   n=>{n.text_citation.question_sha256='0'.repeat(64);},n=>{n.text_citation.course_id='another-course';},
   n=>{n.text_citation.grade='9';},n=>{n.text_citation.school_year='115';},n=>{n.text_citation.semester=3;},
   n=>{n.text_citation.title=' ';},n=>{n.text_citation.subject='';},n=>{n.text_citation.source_version='wrong';},
   n=>{n.text_citation.references[0].printed_page=0;},n=>{n.text_citation.references[0].pdf_page='2';},
   n=>{n.text_citation.references[0].source_sha256='x'.repeat(64);},n=>{n.text_citation.references[0].chapter=' ';},
  ];
  for(const change of invalid){const notes=structuredClone(s.notes);change(notes);await assert.rejects(s.save(notes),e=>e.code==='23514');}
  await assert.rejects(s.save(s.notes,{reviewed:false,source_version:'a'.repeat(64)}),e=>e.code==='23514');
  await assert.rejects(s.save(s.notes,{reviewed:true,source_version:'c'.repeat(64)}),e=>e.code==='23514');
  const malformed=[null,[],true,{},42];for(const value of malformed){const [{ok}]=(await db.query('select public.quiz_text_citation_valid($1,$2,$3,$4) ok',[s.q,s.course,value,s.provenance])).rows;assert.notEqual(ok,true);}
  for(const page of ['1-1','75-5','75-20','9999-999']){
   const notes=structuredClone(s.notes);notes.text_citation.references[0].printed_page=page;
   assert.equal((await db.query('select public.quiz_text_citation_valid($1,$2,$3,$4) ok',[s.q,s.course,notes,s.provenance])).rows[0].ok,true);
   await db.exec('begin;');await s.save(notes);
   assert.deepEqual((await db.query('select teacher_notes from public.quiz_pool_study_sources where question_id=$1',[s.q.id])).rows[0].teacher_notes,notes);
   await assert.rejects(db.exec(rollback),/text_citation_sources_require_rollback_plan/);await db.exec('rollback;');
   assert.equal((await db.query('select count(*)::int n from public.quiz_pool_study_sources')).rows[0].n,0);
  }
  for(const page of ['20','0-1','75-0','075-5','75-05','75--5','75-5\n','75-5 ','75-5x','75-5/6','10000-1','75-1000','７５-５','75－5','75–5',10000,-1,20.5,{},null]){
   const notes=structuredClone(s.notes);notes.text_citation.references[0].printed_page=page;
   await assert.rejects(s.save(notes),e=>e.code==='23514');
  }
  const incompleteRollback=rollback.replace('drop function if exists public.quiz_text_citation_valid(jsonb,text,jsonb,jsonb);','-- deliberately incomplete rollback');
  await assert.rejects(db.exec(incompleteRollback),/text_citation_rollback_mismatch/);await db.exec('rollback;');
  assert.equal(await binderHash(db),newMd5);
  assert.equal((await db.query("select md5(pg_get_constraintdef(oid)) h from pg_constraint where conrelid='public.quiz_pool_study_sources'::regclass and conname='quiz_pool_study_sources_reference_shape'")).rows[0].h,'435a724e9e48805057337bf23ea34bb0');
  await db.exec(rollback);await assertRestored(db);await db.exec(rollback);await assertRestored(db);
  await db.exec(install);await s.save();await assert.rejects(db.exec(rollback),/text_citation_sources_require_rollback_plan/);await db.exec('rollback;');assert.equal(await binderHash(db),newMd5);
  await db.exec("create or replace function public.quiz_text_citation_valid(p_question jsonb,p_course text,p_notes jsonb,p_provenance jsonb) returns boolean language sql immutable as 'select false'");
  await assert.rejects(db.exec(install),/text_citation_contract_changed/);await db.exec('rollback;');
  await assert.rejects(db.exec(rollback),/text_citation_contract_changed/);await db.exec('rollback;');
 }finally{await db.close();}
});

test('三四六九年級實際組卷RPC、答後文字、舊固定包與精確來源守衛',async()=>{
 const f=await fixture(),{db}=f;
 try{
  await db.exec(install);const originals=[];
  for(const grade of [3,4,6,9]){
   for(let i=0;i<5;i++){const s=await f.source(grade,i);if(grade===9)s.notes.text_citation.references[0].printed_page=i%2?'75-20':'75-5';await s.save();originals.push(s.q);}
   const request={kind:'self',course_id:`synthetic-text-g${grade}`,units:[1],difficulty:'medium',count:5,request_id:randomUUID()};
   const made=await f.call(grade,request,'quiz_compose'),joined=await f.call(grade,{action:'join',session_id:made.session_id});
   assert.equal((await f.call(grade,request,'quiz_compose')).session_id,made.session_id);
   if(grade===9){
    const items=(await db.query('select teacher_notes from public.quiz_study_items where package_id=$1',[joined.study.packageId])).rows;
    assert.equal(items.length,5);assert.deepEqual(new Set(items.map(r=>r.teacher_notes.text_citation.references[0].printed_page)),new Set(['75-5','75-20']));
   }
   assert.deepEqual(joined.study.pages,[]);assert.deepEqual(joined.study.references,{});assert.deepEqual(joined.study.explanations,{});
   assert.doesNotMatch(JSON.stringify(joined),/合成固定解析|teacher_note_marker|text_citation|question_sha256/);
   const q=originals.find(x=>x.id===joined.document.questions[0].id);
   const answered=await f.call(grade,{action:'submit',session_id:made.session_id,question_id:q.id,response:q.answer.option_id,request_id:randomUUID(),compact:true});
   assert.equal(answered.study.explanations[q.id].text,'合成固定解析與教材文字引用');
   assert.equal(Object.keys(answered.study.explanations).length,1);
   await assert.rejects(f.call(grade===9?6:9,{action:'join',session_id:made.session_id}),/session_unavailable|session_access_denied/);
   await db.query('update public.quiz_pool_study_sources set enabled=false where course_id=$1',[request.course_id]);
   assert.equal((await f.call(grade,{action:'resume',session_id:made.session_id})).study.packageId,joined.study.packageId);
   const unbound=await f.call(grade,{...request,request_id:randomUUID()},'quiz_compose');assert.equal((await f.call(grade,{action:'join',session_id:unbound.session_id})).study,undefined);
   await db.query('update public.quiz_pool_study_sources set enabled=true where course_id=$1',[request.course_id]);
   assert.equal((await f.call(grade,{action:'resume',session_id:unbound.session_id})).study,undefined);
   await db.query("update public.quiz_question_pool set source_version=$1 where question_id like $2",['c'.repeat(64),request.course_id+'_%']);
   const changed=await f.call(grade,{...request,request_id:randomUUID()},'quiz_compose');assert.equal((await f.call(grade,{action:'join',session_id:changed.session_id})).study,undefined);
  }
  for(const role of ['anon','authenticated']){
   await f.as(null,role);await assert.rejects(db.query('select * from public.quiz_pool_study_sources'),/permission denied/);
   await assert.rejects(db.query("select public.quiz_text_citation_valid('{}','x','{}','{}')"),/permission denied/);await db.exec('reset role');
  }
  await assert.rejects(db.query("update public.quiz_pool_study_sources set student_explanation='changed'"),/study_fixed_version/);
  await assert.rejects(db.query('delete from public.quiz_pool_study_sources'),/study_fixed_version/);
  for(const q of originals)assert.deepEqual((await db.query('select question from public.quiz_question_pool where question_id=$1',[q.id])).rows[0].question,q);
  const mismatch='synthetic-grade-mismatch';for(let i=0;i<5;i++){const s=await f.source(9,i,{course:mismatch,notesGrade:6});await s.save();}
  const bad=await f.call(9,{kind:'self',course_id:mismatch,units:[1],count:5,request_id:randomUUID()},'quiz_compose');assert.equal((await f.call(9,{action:'join',session_id:bad.session_id})).study,undefined);
  for(const [suffix,mutate] of [
   ['year',course=>db.query("update public.quiz_courses set definition=jsonb_set(definition,'{school_year}','\"114\"') where id=$1",[course])],
   ['subject',course=>db.query("update public.quiz_courses set definition=jsonb_set(definition,'{subject}','\"自然\"') where id=$1",[course])],
   ['question',course=>db.query("update public.quiz_question_pool set question=jsonb_set(question,'{prompt,text}','\"changed synthetic question\"') where question_id like $1",[course+'_%'])],
  ]){
   const course='synthetic-mismatch-'+suffix;for(let i=0;i<5;i++){const s=await f.source(9,i,{course});await s.save();}await mutate(course);
   const made=await f.call(9,{kind:'self',course_id:course,units:[1],count:5,request_id:randomUUID()},'quiz_compose');assert.equal((await f.call(9,{action:'join',session_id:made.session_id})).study,undefined);
  }
 }finally{await db.close();}
});

test('原頁連結及明確無可靠對照分支不變；不把已核引用假冒無對照',async()=>{
 const f=await fixture(),{db}=f;
 try{
  await db.exec(install);const course='synthetic-legacy-mixed',book=randomUUID();
  await db.query("insert into public.quiz_textbooks(id,grade,school_year,semester,title,source_sha256,enabled) values($1,9,115,1,'合成原頁',$2,false)",[book,'b'.repeat(64)]);
  await db.query("insert into public.quiz_textbook_pages(book_id,id,printed_pages,sequence,sha256,bytes) values($1,'page20','{20}','unit1',$2,100)",[book,'c'.repeat(64)]);
  await db.query('update public.quiz_textbooks set enabled=true where id=$1',[book]);
  const questions=[];
  for(let i=0;i<5;i++){
   const s=await f.source(9,i,{course});questions.push(s.q);
   const linked=i<3,notes=linked?{book_match_status:'verified_text_citation_direct',teacher_note_marker:true}:{book_match_status:'no_reliable_match',unmatched_explanation:'合成來源明確無可靠對照',teacher_note_marker:true};
   await db.query("insert into public.quiz_pool_study_sources(question_id,course_id,question,book_id,primary_page,reference_pages,student_explanation,teacher_notes,provenance,enabled) values($1,$2,$3,$4,$5,$6,'原有分支固定解析',$7,'{}',true)",[s.q.id,course,s.q,linked?book:null,linked?20:null,linked?[20]:[],notes]);
  }
  const made=await f.call(9,{kind:'self',course_id:course,units:[1],count:5,request_id:randomUUID()},'quiz_compose');const joined=await f.call(9,{action:'join',session_id:made.session_id});
  assert.equal(joined.study.pages.length,1);assert.equal(Object.keys(joined.study.references).length,3);assert.deepEqual(joined.study.explanations,{});
  assert.doesNotMatch(JSON.stringify(joined),/teacher_note_marker|原有分支固定解析/);
  for(const shown of joined.document.questions){const q=questions.find(q=>q.id===shown.id);
   const answered=await f.call(9,{action:'submit',session_id:made.session_id,question_id:q.id,response:q.answer.option_id,request_id:randomUUID(),compact:true});assert.equal(answered.study.explanations[q.id].text,'原有分支固定解析');
  }
 }finally{await db.close();}
});
