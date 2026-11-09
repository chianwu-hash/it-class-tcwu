import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {randomUUID} from 'node:crypto';
import {createQuizDb,studentId,TEACHER,quizCall} from '../lib/quiz-local-db.mjs';
import {newDocument} from '../../shared/quiz-document.mjs';
import {readQuizStudy} from '../../shared/quiz-study-data.mjs';

const c=text=>({text,media:[]});
test('固定課本與學生解析：真SQL、答前／答後、本人／跨人、版本與撤回',async()=>{
 const db=await createQuizDb(undefined,{batch2:true,batch3:true,batch4:true});try{
 await db.exec(await fs.readFile('supabase/quiz-past-exams.sql','utf8'));
 await db.exec(await fs.readFile('supabase/quiz-study.sql','utf8'));
 await db.exec(await fs.readFile('supabase/quiz-study.sql','utf8')); // safe same-wrapper reinstall
 const [book,bank,version,session,pack,pv,pa,ppack]=Array.from({length:8},()=>randomUUID());
 const d=newDocument(),q=d.blocks[0].questions[0];d.catalog.volume='6年級上學期';q.id='water';q.prompt=c('水流變慢時，沙子會怎樣？');q.explanation=c('舊書商稿');
 await db.query('insert into public.quiz_banks(id,owner_id,draft) values($1,$2,$3)',[bank,TEACHER,d]);
 await db.query('insert into public.quiz_versions(id,bank_id,revision,document) values($1,$2,1,$3)',[version,bank,d]);
 await db.query("insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options) values($1,$2,$3,115,'[\"603\"]','immediate',false,false)",[session,TEACHER,version]);
 await db.query("insert into public.quiz_textbooks(id,grade,school_year,semester,title,source_sha256) values($1,6,115,1,'合成自然課本',$2)",[book,'b'.repeat(64)]);
 for(const [id,pages] of [['75',[75]],['79-80',[79,80]],['81',[81]]])await db.query("insert into public.quiz_textbook_pages(book_id,id,printed_pages,sequence,sha256,bytes) values($1,$2,$3,'unit3',$4,100)",[book,id,pages,id==='75'?'a'.repeat(64):id==='79-80'?'c'.repeat(64):'d'.repeat(64)]);
 const addPackage=async(id,kind,v)=>{await db.query("insert into public.quiz_study_packages(id,kind,version_id,approved,provenance) values($1,$2,$3,true,'{\"reviewed\":true}')",[id,kind,v]);};
 await addPackage(pack,'normal',version);
 await db.query("insert into public.quiz_study_items(package_id,question_id,book_id,primary_page,reference_pages,student_explanation,origin,teacher_notes) values($1,'water',$2,75,'{75,79,80}','水流變慢，帶不動那麼多沙子，沙子就留下來。','ai','{\"private_reason\":\"teacher-only\"}')",[pack,book]);
 await db.query('update public.quiz_textbooks set enabled=true where id=$1',[book]);await db.query('update public.quiz_study_packages set enabled=true where id=$1',[pack]);
 let s=await quizCall(db,studentId(1),'join',{session_id:session});
 assert.equal(s.study.versionId,version);assert.deepEqual(s.study.explanations,{});assert.equal(s.study.pages.length,3);assert.equal(s.study.pages[1].printedPages.join(','),'79,80');assert.ok(!JSON.stringify(s.study).includes('teacher-only'));
 const attempt=s.attempt_id;
 s=await quizCall(db,studentId(1),'submit',{session_id:session,question_id:q.id,request_id:randomUUID(),response:q.options[0].id,compact:true});
 assert.ok(s.study.explanations.water.text.includes('水流變慢'));assert.equal(s.compact,true);assert.equal(s.study.packageId,pack);
 const call=(uid,sql,args=[],role='authenticated')=>db.transaction(async tx=>{await tx.query("select set_config('quiz.test_uid',$1,true)",[uid||'']);await tx.exec('set local role '+role);return tx.query(sql,args);});
 const url=s.study.pages[0].url;
 const teacherAttempt=randomUUID();
 await db.query("insert into public.quiz_attempts(id,session_id,user_id,question_order,option_orders) values($1,$2,$3,'[\"water\"]','{}')",[teacherAttempt,session,TEACHER]);
 assert.equal((await call(TEACHER,'select public.quiz_textbook_media_access($1,$2,$3,$4) r',['normal',teacherAttempt,version,url])).rows[0].r.backend,'drive');
 await assert.rejects(call(TEACHER,'select public.quiz_textbook_media_access($1,$2,$3,$4)',['normal',attempt,version,url]),/attempt_unavailable/);
 assert.equal((await call(studentId(1),'select public.quiz_textbook_media_access($1,$2,$3,$4) r',['normal',attempt,version,url])).rows[0].r.backend,'drive');
 await assert.rejects(call(studentId(1),'select public.quiz_textbook_media_access($1,$2,$3,$4)',['normal',attempt,version,url.replace('a'.repeat(64),'f'.repeat(64))]),/media_unavailable/);
 await assert.rejects(call(studentId(2),'select public.quiz_textbook_media_access($1,$2,$3,$4)',['normal',attempt,version,url]),/attempt_unavailable/);
 await assert.rejects(call(studentId(1),'select public.quiz_textbook_media_access($1,$2,$3,$4)',['normal',attempt,randomUUID(),url]),/media_unavailable/);
 await assert.rejects(call(studentId(1),'select * from public.quiz_study_items'),/permission denied/);
 await assert.rejects(call(studentId(1),"select public.quiz_study_payload('normal',$1,$2,'[\"water\"]')",[attempt,version]),/permission denied/);
 await assert.rejects(call(null,'select public.quiz_textbook_media_access($1,$2,$3,$4)',['normal',attempt,version,url],'anon'),/permission denied/);
 await assert.rejects(db.query("update public.quiz_study_items set student_explanation='changed' where package_id=$1",[pack]),/study_fixed_version/);
 await assert.rejects(db.query("insert into public.quiz_study_items(package_id,question_id,origin) values($1,'late','ai')",[pack]),/study_fixed_version/);
 const replacement=randomUUID();await addPackage(replacement,'normal',version);await db.query('update public.quiz_study_packages set enabled=true where id=$1',[replacement]);
 assert.equal((await quizCall(db,studentId(1),'resume',{session_id:session})).study.packageId,pack);
 await db.query('update public.quiz_study_packages set enabled=false where id=$1',[pack]);
 assert.equal((await quizCall(db,studentId(1),'resume',{session_id:session})).study,undefined);
 await assert.rejects(call(studentId(1),'select public.quiz_textbook_media_access($1,$2,$3,$4)',['normal',attempt,version,url]),/media_unavailable/);
 // Complete shared past-exam group, including a self-check field, never split into questions.
 const pd={groups:[{id:'magnet',kind:'short',fields:[{id:'f1',label:'1',text:'磁力',points:2},{id:'f2',label:'2',text:'比較',points:2}]}]};
 await db.query("insert into public.quiz_past_papers(id,owner_id,grade,school_year,semester,title) values('test-study',$1,6,115,1,'合成原卷')",[TEACHER]);
 await db.query("insert into public.quiz_past_versions(id,paper_id,sha256,document,provenance) values($1,'test-study',$2,$3,'{}')",[pv,'e'.repeat(64),pd]);
 await db.query("insert into public.quiz_past_attempts(id,paper_id,version_id,user_id,school_year,semester,start_request) values($1,'test-study',$2,$3,115,1,$4)",[pa,pv,studentId(1),randomUUID()]);
 await addPackage(ppack,'past',pv);
 for(const f of ['f1','f2'])await db.query("insert into public.quiz_study_items(package_id,group_id,question_id,book_id,primary_page,reference_pages,student_explanation,origin) values($1,'magnet',$2,$3,75,'{75,79,80}','先看兩組實驗哪些條件相同，再比較不同的地方。','ai')",[ppack,f,book]);
 await db.query('update public.quiz_study_packages set enabled=true where id=$1',[ppack]);
 const snapshot=()=>db.transaction(async tx=>{await tx.query("select set_config('quiz.test_uid',$1,true)",[studentId(1)]);return (await tx.query('select public.quiz_past_snapshot($1) r',[pa])).rows[0].r;});
 const before=await snapshot();assert.equal(before.groups[0].fields.length,2);assert.deepEqual(before.study.explanations,{});assert.equal(before.study.references.magnet.fields.length,2);
 await db.query("insert into public.quiz_past_receipts values($1,'magnet',$2,'[]','[]',0,'self_checked')",[pa,randomUUID()]);
 for(const f of ['f1','f2'])await db.query("insert into public.quiz_past_answers values($1,'magnet',$2,'\"saved\"',null,2)",[pa,f]);
 const after=await snapshot();assert.equal(Object.keys(after.study.explanations).length,2);assert.equal(after.records.magnet.status,'self_checked');assert.equal(after.summary.score,0);
 assert.equal((await call(studentId(1),'select public.quiz_textbook_media_access($1,$2,$3,$4) r',['past',pa,pv,url])).rows[0].r.backend,'drive');
 await assert.rejects(call(studentId(2),'select public.quiz_textbook_media_access($1,$2,$3,$4)',['past',pa,pv,url]),/attempt_unavailable/);
 }finally{await db.close();}
});

test('前端拒絕跨版本、外部圖片及未揭答的學生解析',()=>{
 const snapshot={attempt_id:'a',version_id:'v',document:{questions:[{id:'q'}]},reviews:[],study:{schema:1,kind:'normal',attemptId:'a',versionId:'v',packageId:'p',pages:[{id:'79-80',bookId:'b',sequence:'u3',printedPages:[79,80],url:'https://quiz-media.invalid/00000000-0000-4000-8000-000000000001/'+'a'.repeat(64)}],references:{q:{bookId:'b',primary:79,references:[79,80]}},explanations:{q:{text:'答案說明',origin:'ai'}}}};
 assert.equal(readQuizStudy(snapshot,'normal').pages.length,1);assert.deepEqual(readQuizStudy(snapshot,'normal').explanations,{});
 snapshot.reviews=[{question_id:'q'}];assert.equal(readQuizStudy(snapshot,'normal').explanations.q.text,'答案說明');
 snapshot.study.versionId='other';assert.deepEqual(readQuizStudy(snapshot,'normal').references,{});
 snapshot.study.versionId='v';snapshot.study.pages[0].url='https://example.com/public.webp';assert.deepEqual(readQuizStudy(snapshot,'normal').references,{});
 snapshot.study.pages=[null,{bad:true}];assert.deepEqual(readQuizStudy(snapshot,'normal').pages,[]);
});
