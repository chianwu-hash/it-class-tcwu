import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';import {pathToFileURL} from 'node:url';
const source=path.resolve(process.env.PAST_SOURCE_ROOT||process.cwd()),root=path.join(source,'automation/output/past-extension-production-20261102'),local=path.join(source,'automation/output/past-full-learning-20261101');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const {createQuizDb,PGlite,TEACHER,studentId}=await import(pathToFileURL(path.join(source,'automation/lib/quiz-local-db.mjs')));
const {demoWrongResponses}=await import(pathToFileURL(path.join(source,'automation/lib/past-demo-responses.mjs')));
const bundle=read(local+'/source-bundle.private.json'),map=read(local+'/learning-map.private.json'),packet=read(local+'/publisher-practice.private.json'),cloud=read(root+'/paper-before.private.json');
const db=await createQuizDb(undefined,{batch2:true,batch3:true,batch4:true});db.exec=PGlite.prototype.exec.bind(db);
const cloudSql=[];const lit=v=>"'"+String(v).replaceAll("'","''")+"'",j=v=>lit(JSON.stringify(v))+'::jsonb';
const admin=async(sql,args=[])=>{let expanded=sql;for(let i=args.length;i>0;i--){const v=args[i-1],value=typeof v==='object'?j(v):typeof v==='string'&&/^[a-f0-9-]{36}$/i.test(v)?`coalesce((select v::uuid from pg_temp.learning_test_ids where k=${lit(v)}),${lit(v)}::uuid)`:lit(v);expanded=expanded.replaceAll('$'+i,value);}cloudSql.push(expanded+';');return db.query(sql,args);};
const exec=async sql=>{cloudSql.push(sql);return db.exec(sql);};
async function rpc(uid,name,data,action){
 const sql=action?`select public.${name}($1,$2) r`:`select public.${name}($1) r`,args=action?[action,data]:[data];
 const result=await db.transaction(async tx=>{await tx.query("select set_config('quiz.test_uid',$1,true)",[uid]);await tx.exec('set local role authenticated');return (await tx.query(sql,args)).rows[0].r;});
 const maps=['attemptId','attempt_id','sessionId'].filter(k=>typeof result[k]==='string').map(k=>`insert into pg_temp.learning_test_ids(k,v) values(${lit(result[k])},r->>${lit(k)}) on conflict(k) do update set v=excluded.v;`).join('');
 cloudSql.push(`select set_config('request.jwt.claim.sub',${lit(uid)},true);select set_config('request.jwt.claims',jsonb_build_object('sub',${lit(uid)},'email',${lit(uid===TEACHER?'chianwu@gmail.com':'learning-fixture@example.invalid')},'role','authenticated')::text,true);set local role authenticated;do $smoke$ declare r jsonb;begin r:=public.${name}(${action?lit(action)+',':''}pg_temp.learning_remap(${j(data)}));${maps}end $smoke$;reset role;`);return result;
}
async function rejected(uid,name,data,action){await assert.rejects(()=>rpc(uid,name,data,action));}
try{
 await db.exec(fs.readFileSync(path.join(source,'supabase/quiz-past-exams.sql'),'utf8'));
 const funcs=read(root+'/functions-before.private.json');
 const names=['quiz_student_identity','quiz_answer_guard','quiz_action','quiz_leaf_result','quiz_entry_context','quiz_wrong_refs','quiz_wrong_questions','quiz_rewards_before_past','quiz_rewards_before_past_flowers','quiz_rewards','quiz_past_snapshot_before_flowers','quiz_past_snapshot','quiz_past_action'];
 await db.exec('drop function public.quiz_past_snapshot(uuid)');
 for(const name of names)await db.exec(funcs.find(f=>f.proname===name).definition);
 for(const name of ['admin_learning_paper_rows','admin_learning_rewards'])await db.exec(fs.readFileSync(path.join(root,name+'.before.private.sql'),'utf8'));
 await db.exec(fs.readFileSync('supabase/quiz-learning.sql','utf8'));
 await db.query("update public.student_enrollments set class_code='301' where email in('student1@example.invalid','student2@example.invalid')");
 await db.query('insert into public.quiz_past_papers values($1,$2,3,115,1,$3,null,true)',[bundle.paperId,TEACHER,bundle.document.title]);
 await db.query('insert into public.quiz_past_versions(id,paper_id,sha256,document,provenance) values($1,$2,$3,$4,$5)',[cloud.active_version,bundle.paperId,bundle.sha256,bundle.document,bundle.provenance]);
 await db.query('update public.quiz_past_papers set active_version=$1',[cloud.active_version]);
 for(const a of bundle.assets)await db.query('insert into public.quiz_media_assets values($1,$2,$3,$4,$5)',[a.url,TEACHER,a.object_path,a.mime,a.bytes]);
 const uid1=studentId(1),uid2=studentId(2);
 await exec(`insert into public.quiz_learning_maps values(${lit(cloud.active_version)},${lit(bundle.paperId)},${lit(bundle.sha256)},${j(map)},true);`);
 for(const [concept,entry] of Object.entries(packet.documents)){
  const bank=randomUUID(),version=randomUUID();
  await admin('insert into public.quiz_banks(id,owner_id,draft) values($1,$2,$3)',[bank,TEACHER,entry.document]);
  await admin('insert into public.quiz_versions(id,bank_id,revision,document) values($1,$2,1,$3)',[version,bank,entry.document]);
  await admin('insert into public.quiz_learning_topics values($1,$2,$3)',[cloud.active_version,concept,version]);
 }
 await exec("update public.quiz_learning_settings set enabled=true,enabled_at=clock_timestamp()-interval '2 minutes';update public.quiz_integrity_settings set enabled=true;");
 const start=async(uid,correct)=>{
  let s=await rpc(uid,'quiz_past_action',{paper_id:bundle.paperId,request_id:randomUUID()},'start');
  for(const g of bundle.document.groups){
   await rpc(uid,'quiz_past_action',{paper_id:bundle.paperId,attempt_id:s.attemptId,group_id:g.id},'view');
   await admin("update public.quiz_past_views set started_at=clock_timestamp()-interval '2 minutes' where attempt_id=$1 and group_id=$2",[s.attemptId,g.id]);
   const responses=correct&&!['annotation','manual'].includes(g.kind)?g.fields.map(f=>({questionId:f.id,value:g.kind==='short'?f.answer[0]:f.answer})):demoWrongResponses(g);
   s=await rpc(uid,'quiz_past_action',{paper_id:bundle.paperId,attempt_id:s.attemptId,group_id:g.id,version:cloud.active_version,request_id:randomUUID(),confirmed:true,responses},'submit');
  }return s;
 };
 const wrong=await start(uid1,false),perfect=await start(uid2,true);assert.equal(wrong.summary.score,0);assert.equal(perfect.summary.score,perfect.summary.max);assert.equal(perfect.practice.flowerCount,1);
 const topics=await rpc(uid2,'quiz_learning',{action:'topics',attempt_id:perfect.attemptId});assert.equal(topics.concepts.length,22);
 assert.equal((await rpc(uid2,'quiz_learning',{action:'reviews'})).attempts.length,1);
 const list=await rpc(uid1,'quiz_wrong_questions',{action:'list',grade:3,page:0});assert.equal(list.total,66);
 for(const item of list.items){const d=await rpc(uid1,'quiz_wrong_questions',{action:'detail',grade:3,...item});assert(d.past_review.record.learningReview.explanation);}
 await rejected(uid2,'quiz_wrong_questions',{action:'detail',grade:3,...list.items[0]});
 assert.equal((await rpc(uid2,'quiz_wrong_questions',{action:'list',grade:3})).total,0);
 const qs=Object.values(packet.documents).flatMap(e=>e.document.blocks.flatMap(b=>b.questions));
 async function five(uid,questions,count=5){
  const doc=structuredClone(Object.values(packet.documents)[0].document);doc.title='合成自組卷';doc.blocks=[{id:'test',title:'',material:{text:'',media:[]},questions:structuredClone(questions.slice(0,count))}];
  const bank=randomUUID(),version=randomUUID(),session=randomUUID();
  await admin('insert into public.quiz_banks(id,owner_id,draft) values($1,$2,$3)',[bank,TEACHER,doc]);
  await admin('insert into public.quiz_versions(id,bank_id,revision,document) values($1,$2,1,$3)',[version,bank,doc]);
  await admin("insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options,access_mode) values($1,$2,$3,115,'[\"301\"]','immediate',false,false,'self')",[session,uid,version]);
  await admin("insert into public.quiz_generated_papers(session_id,user_id,request_id,config,actual_distribution) values($1,$2,$3,'{}','{}')",[session,uid,randomUUID()]);
  await rpc(uid,'quiz_action',{session_id:session},'join');return {session,questions:doc.blocks[0].questions};
 }
 async function answer(uid,s,q,correct=false){
  await rpc(uid,'quiz_action',{session_id:s,question_id:q.id},'view_question');
  await admin("update public.quiz_question_timing set first_seen=clock_timestamp()-interval '3 seconds' where attempt_id in(select id from public.quiz_attempts where session_id=$1 and user_id=$2)",[s,uid]);
  const request={session_id:s,question_id:q.id,response:correct?q.answer.option_id:q.options.find(o=>o.id!==q.answer.option_id).id,request_id:randomUUID(),compact:true};
  const r=await rpc(uid,'quiz_action',request,'submit');return {r,request};
 }
 // Two self-created five-question papers, all wrong, count ten unique questions.
 for(let k=0;k<2;k++){const p=await five(uid2,qs.slice(k*5,k*5+5));for(const q of p.questions)await answer(uid2,p.session,q);}
 assert.equal((await rpc(uid2,'quiz_learning',{action:'summary'})).leaves,1);
 const p=await five(uid1,qs.slice(0,5));for(const q of p.questions)await answer(uid1,p.session,q);
 assert.equal((await rpc(uid1,'quiz_learning',{action:'summary'})).count,5);
 // Extension overlaps one of those five, then contributes the next five new items.
 for(const c of topics.concepts.slice(2,5)){
  const request={action:'start',mode:'review',attempt_id:wrong.attemptId,version:cloud.active_version,concept_id:c.id,request_id:randomUUID()};
  const s=await rpc(uid1,'quiz_learning',request);assert.equal((await rpc(uid1,'quiz_learning',request)).sessionId,s.sessionId);
  await rejected(uid2,'quiz_action',{session_id:s.sessionId},'join');await rejected(uid2,'quiz_entry_context',{session_id:s.sessionId});
  await rpc(uid1,'quiz_action',{session_id:s.sessionId},'join');
  for(const q of packet.documents[c.id].document.blocks.flatMap(b=>b.questions)){const {r,request}=await answer(uid1,s.sessionId,q);const again=await rpc(uid1,'quiz_action',request,'submit');assert.equal(again.leaf.learning.earned_now,0);assert(r.leaf.learning);}
 }
 const summary=await rpc(uid1,'quiz_learning',{action:'summary'});assert.equal(summary.count,10);assert.equal(summary.leaves,1);
 const teacherSessions=await rpc(TEACHER,'quiz_action',{},'sessions');const teacherBanks=await rpc(TEACHER,'quiz_action',{},'list');
 assert.equal((await db.query("select count(*)::int n from public.quiz_learning_sessions where session_id=any($1::uuid[])",[teacherSessions.sessions.map(x=>x.id)])).rows[0].n,0);
 assert.equal((await db.query("select count(*)::int n from public.quiz_learning_topics t join public.quiz_versions v on v.id=t.version_id where v.bank_id=any($1::uuid[])",[teacherBanks.banks.map(x=>x.id)])).rows[0].n,0);
 assert.equal((await db.query("select count(*)::int n from public.admin_learning_paper_rows($1,115,'301') p join public.quiz_learning_sessions l on l.session_id=p.session_id",[uid1])).rows[0].n,0);
 const adminProjection=(await db.query("select pg_get_functiondef('public.admin_learning_rewards(text,text,jsonb)'::regprocedure) s")).rows[0].s;assert.equal(adminProjection.split('learning_private.session_id=s.id').length-1,3);
 const rewards=await rpc(uid2,'quiz_rewards',{});assert.equal(rewards.flowers.length,1);assert.equal(rewards.learningAwards.length,1);
 assert.deepEqual((await rpc(TEACHER,'quiz_rewards',{})).awards,[]);
 assert.equal((await rpc(uid1,'quiz_wrong_questions',{action:'list'})).total,71);
 assert.equal((await rpc(uid1,'quiz_past_action',{paper_id:bundle.paperId,attempt_id:wrong.attemptId},'resume')).summary.score,0);
 assert.equal((await rpc(uid2,'quiz_past_action',{paper_id:bundle.paperId,attempt_id:perfect.attemptId},'resume')).practice.flowerCount,1);
 // Existing ten-question accuracy reward keeps its original independent rule.
 const ten=await five(uid2,qs,10);let last;for(const q of ten.questions)last=(await answer(uid2,ten.session,q,true)).r;assert.equal(last.leaf.earned,true);assert.equal((await rpc(uid2,'quiz_learning',{action:'summary'})).count,10);
 await assert.rejects(()=>db.transaction(async tx=>{await tx.exec('set local role authenticated');return tx.query('select * from public.quiz_learning_maps');}),/permission denied/);
 fs.writeFileSync(root+'/production-pglite-results.private.json',JSON.stringify({passed:true,migrationSha256:createHash('sha256').update(fs.readFileSync('supabase/quiz-learning.sql')).digest('hex'),testSha256:createHash('sha256').update(fs.readFileSync('automation/tests/quiz-learning.test.mjs')).digest('hex'),functions:'live production snapshot',fivePlusFive:true,mixedFiveAndExtension:true,duplicateQuestion:true,crossOwner:true,fullScoreReview:true,pastWrong66:true,oldTenReward:true,originalFlowerPreserved:true},null,2));
 fs.writeFileSync(root+'/learning-smoke-body.private.sql',cloudSql.join('\n').replaceAll(TEACHER,cloud.owner_id));
 console.log('PASS production SQL adapter: 5+5, mixed 5/extension, owner/duplicates, 66 wrongs, full-score review, original flower and normal ten-question leaf');
 if(process.env.QUIZ_LEARNING_BROWSER==='1'){
  const {serveLearningFixture}=await import('../lib/quiz-learning-browser-fixture.mjs');await serveLearningFixture({db,source,bundle,uid1,uid2,root});
 }
}catch(e){console.error(JSON.stringify((await db.query("select (select row_to_json(s) from public.quiz_learning_settings s) cfg,(select json_agg(t) from public.quiz_integrity_settings t) timing,(select count(*) from public.quiz_learning_credits) credits,(select min(accepted_seconds) from public.quiz_question_timing) accepted")).rows));fs.writeFileSync(root+'/production-pglite-error.private.json',JSON.stringify({message:e.message,code:e.code,position:e.position,where:e.where,stack:e.stack?.split('\n').slice(-4)},null,2));console.error(JSON.stringify({message:e.message,code:e.code,position:e.position,where:e.where}));process.exitCode=1;}finally{await db.close();}
