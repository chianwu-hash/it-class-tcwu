import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {buildPeerSketchReviewMigration} from '../lib/quiz-partner-peer-sketch-review-migration.mjs';
import {PGlite} from '../../tmp/quiz-runtime/node_modules/@electric-sql/pglite/dist/index.js';
import {partySizes,filterPapers} from '../../shared/partner-pilot/paper-picker.mjs';
const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const read=p=>fs.readFile(new URL('../../'+p,import.meta.url),'utf8');
const content=text=>({text,media:[]});
function document(total){return {schema:1,title:'合成自組卷',catalog:{subject:'數學',school_year:'115'},blocks:Array.from({length:total},(_,n)=>({id:'b'+n,material:content('共同材料'),questions:[{id:'q'+n,type:'single',prompt:content('合成題'+n),options:[{id:'a',content:content('甲')},{id:'b',content:content('乙')}],answer:{option_id:'a'},explanation:content('先想再試'+n)}]}))};}
test('structured self papers preserve grading, privacy, old copies, drafts and capacity',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_app_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create schema realtime;create function realtime.send(jsonb,text,text,boolean) returns void language plpgsql as $$begin end$$;create function public.is_teacher() returns boolean language sql stable as $$select false$$;`);
 await db.exec(await read('automation/fixtures/quiz-partner-before.sql'));
 await db.exec(`create table public.foundation_milestone_policy(id boolean,activated_at timestamptz);insert into public.foundation_milestone_policy values(true,now());
 create table public.quiz_versions(id uuid primary key,document jsonb);
 alter table public.quiz_generated_papers add column user_id uuid,add column config jsonb,add column display_name text,add column deleted_at timestamptz,add column created_at timestamptz default now();
 create table public.quiz_attempts(id uuid,user_id uuid,session_id uuid);create table public.quiz_answers(id uuid,response jsonb);
 insert into public.quiz_attempts values('${uid(80)}','${uid(1)}','${uid(90)}');insert into public.quiz_answers values('${uid(81)}','{"saved":"private"}');`);
 const snapshot=await read('supabase/production-snapshot/functions.sql');
 for(const name of ['public.quiz_valid_runs','public.quiz_valid_content','public.quiz_validate']){const i=snapshot.indexOf('CREATE OR REPLACE FUNCTION '+name+'(');await db.exec(snapshot.slice(i,snapshot.indexOf('$function$;',i)+11));}
 for(let n=1;n<=5;n++){await db.query('insert into auth.users values($1,$2,now(),$3)',[uid(n),`qa${n}@example.invalid`,{providers:['google']}]);await db.query('insert into public.student_enrollments values(115,$1,$2,$3,$4)',[`qa${n}@example.invalid`,n===5?'601':'301',n,'合成夥伴'+n]);}
 const personal=()=>db.query(`select jsonb_build_object('attempts',(select jsonb_agg(to_jsonb(x)) from public.quiz_attempts x),'answers',(select jsonb_agg(to_jsonb(x)) from public.quiz_answers x),'leaves',(select jsonb_agg(to_jsonb(x)) from public.quiz_learning_leaves x),'sessions',(select jsonb_agg(to_jsonb(x) order by id) from public.quiz_sessions x),'generated',(select jsonb_agg(to_jsonb(x) order by session_id) from public.quiz_generated_papers x)) data`);
 const seed=async(total,owner=1,doc=document(total),kind='self')=>{const sid=crypto.randomUUID(),vid=crypto.randomUUID();await db.query('insert into public.quiz_versions values($1,$2)',[vid,doc]);await db.query(`insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options,access_mode) values($1,$2,$3,115,'["301"]','immediate',false,true,'self')`,[sid,uid(owner),vid]);await db.query('insert into public.quiz_generated_papers(session_id,user_id,config,display_name) values($1,$2,$3,$4)',[sid,uid(owner),{kind,count:total},'合成'+total+'題']);return sid;};
 const ten=await seed(10),twenty=await seed(20),five=await seed(5),fifteen=await seed(15),other=await seed(10,2),extension=await seed(10,1,document(10),'extension');
 for(const [id,total,kind]of[['teacher-ten',10,'leaf'],['teacher-twenty',20,'leaf'],['past-ten',10,'flower']]){
  const version=crypto.randomUUID(),sid=crypto.randomUUID();
  if(kind==='leaf')await db.query(`insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options,access_mode) values($1,$2,$3,115,'["301"]','immediate',false,false,'practice')`,[sid,uid(1),version]);
  else await db.query(`insert into public.quiz_past_papers values($1,$2,3,115,1,$1,$3,true)`,[id,uid(1),version]);
  await db.query(`insert into partner_pilot.papers(id,title,grade,subject,kind,total,content_key,source_version,is_real,source_session,past_meta) values($1,$1,3,'數學',$2,$3,$1,$4,true,$5,$6)`,[id,kind,total,version,kind==='leaf'?sid:null,kind==='flower'?{sourcePaper:id}:null]);
  for(let n=1;n<=total;n++){const qid=(kind==='flower'?3000:total*100)+n;await db.query(`insert into partner_pilot.question_bank(id,title,prompt,options,correct,explanation) values($1,'合成原卷題','想想看','["甲","乙"]',0,'解析')`,[qid]);await db.query('insert into partner_pilot.paper_items values($1,$2,$3)',[id,n,qid]);}
 }
 await db.exec(await read('supabase/quiz-partner-production.sql'));await db.exec(await read('supabase/quiz-partner-stability.sql'));
 await db.exec('update partner_pilot.settings set enabled=true');
 for(const n of [1,2,3,4]){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid(n)]);await db.exec('select partner_pilot.register_self()');}
 for(const [id,started,count]of[[uid(701),false,3],[uid(702),true,4]]){await db.query(`insert into partner_pilot.rooms(id,code,team,theme,paper,capacity,host,started) values($1,$2,'舊小隊','forest','teacher-ten',$3,$4,$5)`,[id,started?'777702':'777701',count,uid(1),started]);for(let n=1;n<=count;n++)await db.query('insert into partner_pilot.members(room_id,user_id,ready) values($1,$2,true)',[id,uid(n)]);}
 const original=(await personal()).rows[0].data;
 await db.exec(await read('supabase/quiz-partner-self.sql'));
 await db.exec(await read('supabase/quiz-partner-media-fix.sql'));await db.exec('update partner_pilot.settings set enabled=true');
 const as=async n=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[n?uid(n):'']);
 const call=async(n,p)=>{await as(n);return(await db.query('select public.quiz_partner_pilot_action($1) data',[{requestId:crypto.randomUUID(),...p}])).rows[0].data;};
 const create=(n,sid,capacity=2,extra={})=>call(n,{action:'create',paper:'self:'+sid,team:'合成小隊',theme:'forest',capacity,...extra});

 await db.exec((await read('supabase/quiz-partner-message-media.sql')).split('-- Copy the old body')[0]+'commit;');
 const names=['public.quiz_math_answer_normalize','public.quiz_fields_response','public.quiz_fields_grade','public.quiz_fields_value','public.quiz_fields_validate','public.quiz_open_validate','partner_pilot.self_document_ok','partner_pilot.copy_self','partner_pilot.import_teacher_library_session','partner_pilot.action_core','partner_pilot.learning_snapshot_pre_message_media','partner_pilot.learning_snapshot','partner_pilot.team_rooms'];
 const beforeDefinitions=JSON.parse(await read('automation/fixtures/quiz-partner-structured-before.json')).definitions;
 for(const name of names){const i=snapshot.indexOf('CREATE OR REPLACE FUNCTION '+name+'(');assert(i>=0,name);await db.exec(beforeDefinitions[name]??snapshot.slice(i,snapshot.indexOf('$function$;',i)+11));}
 await db.exec(await read('supabase/quiz-partner-structured-answers.sql'));
 const structured=document(10);
 const field=(id,input,extra={})=>({id,label:'原題答案',input,...extra});
 const options=[{id:'1',content:content('甲')},{id:'2',content:content('乙')}];
 const kinds=[
 {type:'fields',fields:[field('one','single',{options})],answer:{format:'fields-v1',fields:{one:['2']}}},
 {type:'fields',fields:[field('pick','set',{options})],answer:{format:'fields-v1',fields:{pick:[['1']]}}},
 {type:'fields',fields:[field('order','sequence',{options})],answer:{format:'fields-v1',fields:{order:[['2','1']]}}},
 {type:'fields',fields:[field('x','math'),field('y','text')],answer:{format:'fields-v1',fields:{x:['1/2'],y:['乙']}}},
 {type:'short',answer:{accepted:['二分之一']}},
 {type:'open',fields:[field('write','text')],answer:{format:'self-review-v1',fields:{write:{examples:['合成例答'],criteria:['符合題意']}}}},
 ];
 const responses=[{v:1,f:{one:'2'}},{v:1,f:{pick:['1']}},{v:1,f:{order:['2','1']}},{v:1,f:{x:'1/2',y:'乙'}},'二分之一',{v:1,f:{write:'我的想法'}}];
 for(let i=0;i<10;i++){let q=structured.blocks[i].questions[0];delete q.options;structured.blocks[i].questions[0]={...q,...kinds[i%kinds.length]};}
 const sid=await seed(10,1,structured),before=(await personal()).rows[0].data;
 const cat=await call(1,{action:'catalog'});assert(cat.papers.some(p=>p.sourceSession===sid));
 let room=await create(1,sid);room=await call(2,{action:'join',roomId:room.id,code:room.code});
 for(const n of [1,2]){room=await call(n,{action:'snapshot',roomId:room.id});room=await call(n,{action:'ready',roomId:room.id,revision:room.revision,ready:true});}
 room=await call(2,{action:'start',roomId:room.id,revision:room.revision});
 assert.equal(room.exercise.gradedTotal,9);assert.equal(room.exercise.mine.length,5);
 assert.equal((await db.query('select partner_pilot.team_rooms() data')).rows[0].data.find(r=>r.id===room.id).progress.graded,9);
 assert(!JSON.stringify(room).includes('合成例答'));assert(room.exercise.mine.every(q=>!q.normal.answer&&!q.rich.normal.answer));
 const first=room.exercise.mine[0];await assert.rejects(()=>call(1,{action:'answer',roomId:room.id,qid:first.id,expectedAttempt:0,response:'x'}),/OWN_QUESTION_ONLY/);
 const rawDraft=JSON.stringify(responses[(first.number-1)%6]);
 await call(2,{action:'save_draft',roomId:room.id,draftRevision:0,state:{drafts:{['answer-'+first.id]:rawDraft},attempts:{[first.id]:0},editing:[],open:[],view:'practice'}});
 assert.equal((await call(2,{action:'snapshot',roomId:room.id})).exercise.privateDraft.state.drafts['answer-'+first.id],rawDraft);
 for(const n of [1,2]){
  const snap=await call(n,{action:'snapshot',roomId:room.id});
  for(const q of snap.exercise.mine){
   const raw=responses[(q.number-1)%6],response=typeof raw==='string'?raw:JSON.stringify(raw);
   if(q.normal.type==='fields')await assert.rejects(()=>call(n,{action:'answer',roomId:room.id,qid:q.id,expectedAttempt:0,response:'{}'}),/invalid_response/);
   const req={action:'answer',roomId:room.id,qid:q.id,expectedAttempt:0,response,requestId:crypto.randomUUID()};
   const answer=await call(n,req),saved=answer.exercise.mine.find(x=>x.id===q.id);
   assert.equal(saved.attempts.length,1);assert.equal(saved.attempts[0].value,response);
   assert.equal(saved.attempts[0].correct,q.normal.type==='open'?null:true);assert(saved.normalReference);
   assert.equal((await call(n,req)).exercise.mine.find(x=>x.id===q.id).attempts.length,1);
   await assert.rejects(()=>call(n,{...req,requestId:crypto.randomUUID()}),/ANSWER_CHANGED/);
  }
 }
 room=await call(1,{action:'snapshot',roomId:room.id});assert.equal(room.exercise.correct,9);assert(room.exercise.reviewOpen);
 for(const n of [1,2])room=await call(n,{action:'review',roomId:room.id,text:'一起核對'});
 room=await call(1,{action:'finish',roomId:room.id});
 assert(room.exercise.finished);assert.equal(room.exercise.award.leaves,1);
 const after=(await personal()).rows[0].data;assert.deepEqual(after,before,'partner does not mutate private fixed documents, answers or leaves');
 // New copier still uses exactly the original zero-based single path.
 let classic=await create(1,ten);classic=await call(2,{action:'join',roomId:classic.id,code:classic.code});
 for(const n of [1,2]){classic=await call(n,{action:'snapshot',roomId:classic.id});classic=await call(n,{action:'ready',roomId:classic.id,revision:classic.revision,ready:true});}
 classic=await call(2,{action:'start',roomId:classic.id,revision:classic.revision});
 const cq=classic.exercise.mine[0];assert.equal(cq.normal,null);
 const cs=await call(2,{action:'answer',roomId:classic.id,qid:cq.id,expectedAttempt:0,choice:0});assert.equal(cs.exercise.mine[0].attempts[0].correct,true);
 // Teacher library import uses the same validated structured copy contract.
 await db.exec('create table public.quiz_learning_sessions(session_id uuid);');
 const teacherSid=crypto.randomUUID(),teacherVid=crypto.randomUUID(),teacherDoc=structuredClone(structured);teacherDoc.catalog.volume='3年級上學期';
 await db.query('insert into public.quiz_versions values($1,$2)',[teacherVid,teacherDoc]);
 await db.query(`insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options,access_mode) values($1,$2,$3,115,'["301"]','immediate',false,false,'practice')`,[teacherSid,uid(1),teacherVid]);
 const teacherPaper=(await db.query('select partner_pilot.import_teacher_library_session($1) id',[teacherSid])).rows[0].id;
 assert.equal((await db.query('select count(*)::int n from partner_pilot.question_bank q join partner_pilot.paper_items i on i.qid=q.id where i.paper_id=$1 and q.normal_question is not null',[teacherPaper])).rows[0].n,10);
 // Nested field media keeps the same room membership and explanation reveal gate.
 const mediaDoc=structuredClone(structured),image='https://quiz-media.invalid/'+uid(99)+'/'+'a'.repeat(64),audio='https://quiz-media.invalid/'+uid(99)+'/'+'b'.repeat(64);
 mediaDoc.blocks[0].questions[0].fields[0].options[0].content.media=[{kind:'image',url:image,alt:'合成選項圖'}];
 mediaDoc.blocks[0].questions[0].explanation={text:'合成解析音檔',media:[{kind:'audio',url:audio,alt:'合成解析'}]};
 for(const [url,mime]of [[image,'image/png'],[audio,'audio/mpeg']])await db.query('insert into public.quiz_media_assets values($1,$2,$3,100)',[url,'synthetic/'+url.split('/').at(-1),mime]);
 const mediaSid=await seed(10,1,mediaDoc);let mr=await create(1,mediaSid);mr=await call(2,{action:'join',roomId:mr.id,code:mr.code});
 for(const n of [1,2]){mr=await call(n,{action:'snapshot',roomId:mr.id});mr=await call(n,{action:'ready',roomId:mr.id,revision:mr.revision,ready:true});}mr=await call(2,{action:'start',roomId:mr.id,revision:mr.revision});
 let mq,owner;for(const n of [1,2]){const s=await call(n,{action:'snapshot',roomId:mr.id});const q=s.exercise.mine.find(q=>q.number===1);if(q){mq=q;owner=n;}}
 assert(mq.rich.normal.fields[0].options[0].content.media[0].url.startsWith('https://partner-media.invalid/'));assert(!mq.normalReference);
 const hashes=(await db.query('select hash,source_url from partner_pilot.media_map where paper_id=$1',[mr.paper])).rows;
 const readMedia=async(n,url)=>{await as(n);return (await db.query('select public.quiz_partner_pilot_media_descriptor($1,$2) data',[mr.id,hashes.find(h=>h.source_url===url).hash])).rows[0].data;};
 assert.equal((await readMedia(owner,image)).mime,'image/png');await assert.rejects(()=>readMedia(owner,audio),/MEDIA_DENIED/);await assert.rejects(()=>readMedia(3,image),/NOT_MEMBER|SOURCE_CHANGED/);
 await call(owner,{action:'answer',roomId:mr.id,qid:mq.id,expectedAttempt:0,response:JSON.stringify({v:1,f:{one:'2'}})});assert.equal((await readMedia(owner,audio)).mime,'audio/mpeg');
 await assert.rejects(db.exec(await read('supabase/quiz-partner-structured-answers.sql')),/BASELINE_CHANGED/);await db.exec('rollback');
 for(const sig of ['copy_self(uuid,text)','self_document_ok(jsonb)','action_core(jsonb)'])assert.equal((await db.query("select has_function_privilege('authenticated',$1,'execute') ok",['partner_pilot.'+sig])).rows[0].ok,false);
 // Opt-in handwritten open tasks use the same partner form and retain raw strokes.
 await db.exec(await read('supabase/quiz-open-sketch-helpers.sql'));
 const openMigration=await read('supabase/quiz-open-sketch.sql'),openStart=openMigration.indexOf('CREATE OR REPLACE FUNCTION public.quiz_open_validate(');
 await db.exec(openMigration.slice(openStart,openMigration.indexOf('$function$;',openStart)+11));
 await db.exec(await read('supabase/quiz-partner-open-sketch.sql'));
 const peerFixture=JSON.parse(await read('automation/fixtures/quiz-partner-peer-sketch-review-before.json'));
 const peerSql=(await read('supabase/quiz-partner-peer-sketch-review.sql')).replaceAll('\r\n','\n');
 assert.equal(buildPeerSketchReviewMigration(peerFixture.definition),peerSql);
 assert.equal(buildPeerSketchReviewMigration(peerFixture.definition.replaceAll('\n','\r\n')),peerSql,'line endings do not change the approved migration');
 const peerAcl=async()=> (await db.query("select proacl::text acl from pg_proc where oid='partner_pilot.learning_snapshot_pre_message_media(uuid)'::regprocedure")).rows[0].acl;
 const peerAclBefore=await peerAcl();await db.exec(peerSql);assert.equal(await peerAcl(),peerAclBefore,'existing execution grants are preserved');
 const sharedCurrent=(await call(1,{action:'snapshot',roomId:room.id})).exercise.shared;
 assert(sharedCurrent.some(q=>q.normal?.type==='fields'),'fixture includes approved ordinary fields');
 for(const q of sharedCurrent){
  if(q.normal?.type==='fields'){
   const raw=responses[(q.number-1)%6];assert.equal(q.attempts.length,1);assert.equal(q.attempts[0].value,JSON.stringify(raw),'approved fields review retains latest original response');
  }else assert(!Object.hasOwn(q,'attempts'),'unapproved legacy text/choice review scope remains private');
 }
 const handwriting=document(10),ink={version:1,strokes:Array.from({length:20},(_,i)=>Array.from({length:50},(_,j)=>[i/20,j/50]))},penRaw=JSON.stringify({v:1,f:{work:ink}});
 assert(penRaw.length>2000);
 for(const b of handwriting.blocks){const original=b.questions[0];b.questions=[{id:original.id,type:'open',prompt:content('合成列式題，保留手寫過程'),explanation:content('自行核對步驟，不判筆跡正確'),fields:[{id:'work',label:'手寫過程',input:'sketch'}],answer:{format:'self-review-v1',fields:{work:{examples:['合成參考'],criteria:['保留完整計算']}}}}];}
 const penSource=await seed(10,1,handwriting),personalBefore=(await personal()).rows[0].data;
 let penRoom=await create(1,penSource);penRoom=await call(2,{action:'join',roomId:penRoom.id,code:penRoom.code});
 for(const n of[1,2]){penRoom=await call(n,{action:'snapshot',roomId:penRoom.id});penRoom=await call(n,{action:'ready',roomId:penRoom.id,revision:penRoom.revision,ready:true});}
 penRoom=await call(2,{action:'start',roomId:penRoom.id,revision:penRoom.revision});assert.equal(penRoom.exercise.gradedTotal,0);
 const expectedPen=new Map();
 const marked=(await call(1,{action:'snapshot',roomId:penRoom.id})).exercise.mine[0];
 await call(1,{action:'ask',roomId:penRoom.id,qid:marked.id,text:'合成題：先討論步驟'});
 for(const n of[1,2]){
  const current=await call(n,{action:'snapshot',roomId:penRoom.id});assert(!JSON.stringify(current).includes('合成參考'));
  for(const q of current.exercise.mine){
   const uniqueInk=structuredClone(ink);uniqueInk.strokes[0][0]=[(q.id%1000)/1000,n/10];const response=JSON.stringify({v:1,f:{work:uniqueInk}});expectedPen.set(q.id,response);
   const request={action:'answer',roomId:penRoom.id,qid:q.id,expectedAttempt:0,response,requestId:crypto.randomUUID()};
   await assert.rejects(call(n===1?2:1,{...request}),/OWN_QUESTION_ONLY/);
   await assert.rejects(call(n,{...request,response:JSON.stringify({v:1,f:{work:{version:1,strokes:[]}}})}),/invalid_response/);
   const saved=(await call(n,request)).exercise.mine.find(x=>x.id===q.id);assert.equal(saved.attempts[0].correct,null);assert.equal(saved.attempts[0].value,response);
   assert.equal((await call(n,request)).exercise.mine.find(x=>x.id===q.id).attempts.length,1);
  }
  if(n===1){const waiting=await call(2,{action:'snapshot',roomId:penRoom.id});assert(waiting.exercise.shared.some(q=>q.id===marked.id));assert(waiting.exercise.shared.every(q=>!Object.hasOwn(q,'attempts')),'marked questions must not leak peer ink before all answers');}
 }
 penRoom=await call(1,{action:'snapshot',roomId:penRoom.id});assert(penRoom.exercise.reviewOpen);assert.equal(penRoom.exercise.correct,0);
 for(const n of[1,2]){const snap=await call(n,{action:'snapshot',roomId:penRoom.id});assert.equal(snap.exercise.shared.length,10);for(const q of snap.exercise.shared){assert.equal(q.attempts.length,1);assert.equal(q.attempts[0].value,expectedPen.get(q.id));assert.equal(q.attempts[0].correct,null);}}
 const changed=JSON.stringify({v:1,f:{work:{version:1,strokes:[[[.2,.2],[.8,.8]]],colors:['#b83246']}}});
 await call(1,{action:'answer',roomId:penRoom.id,qid:marked.id,expectedAttempt:1,response:changed});expectedPen.set(marked.id,changed);
 const corrected=await call(2,{action:'snapshot',roomId:penRoom.id});assert.equal(corrected.exercise.shared.find(q=>q.id===marked.id).attempts.length,1);assert.equal(corrected.exercise.shared.find(q=>q.id===marked.id).attempts[0].value,changed);
 assert.equal((await call(1,{action:'snapshot',roomId:penRoom.id})).exercise.mine.find(q=>q.id===marked.id).attempts.length,2,'original attempt history is retained');
 if(process.env.QUIZ_PEER_REVIEW_SNAPSHOTS){await fs.writeFile(process.env.QUIZ_PEER_REVIEW_SNAPSHOTS,JSON.stringify({viewers:await Promise.all([1,2].map(async n=>({viewer:{id:uid(n),name:'合成夥伴'+n},snapshot:await call(n,{action:'snapshot',roomId:penRoom.id})}))),expected:Object.fromEntries(expectedPen)}));}
 for(const n of[1,2])penRoom=await call(n,{action:'review',roomId:penRoom.id,text:'核對手寫過程'});
 penRoom=await call(1,{action:'finish',roomId:penRoom.id});assert(penRoom.exercise.finished);
 assert.deepEqual((await personal()).rows[0].data,personalBefore,'handwritten partner work does not change personal answers');
 await assert.rejects(call(3,{action:'snapshot',roomId:penRoom.id}),/NOT_MEMBER/);
 await assert.rejects(call(0,{action:'snapshot',roomId:penRoom.id}),/ACCESS_DENIED/);
 await assert.rejects(db.exec(await read('supabase/quiz-partner-open-sketch.sql')),/partner_sketch_baseline_changed/);await db.exec('rollback');
 await assert.rejects(db.exec(await read('supabase/quiz-partner-peer-sketch-review.sql')),/peer_sketch_review_baseline_changed/);await db.exec('rollback');
 }finally{await db.close();}
});
