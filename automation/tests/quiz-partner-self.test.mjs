import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '../../tmp/quiz-runtime/node_modules/@electric-sql/pglite/dist/index.js';
import {partySizes,filterPapers} from '../../shared/partner-pilot/paper-picker.mjs';
const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const read=p=>fs.readFile(new URL('../../'+p,import.meta.url),'utf8');
const content=text=>({text,media:[]});
function document(total){return {schema:1,title:'合成自組卷',catalog:{subject:'數學',school_year:'115'},blocks:Array.from({length:total},(_,n)=>({id:'b'+n,material:content('共同材料'),questions:[{id:'q'+n,type:'single',prompt:content('合成題'+n),options:[{id:'a',content:content('甲')},{id:'b',content:content('乙')}],answer:{option_id:'a'},explanation:content('先想再試'+n)}]}))};}
test('picker separates private/self categories and preserves ordinary/exam capacity rules',()=>{
 assert.deepEqual(partySizes({kind:'leaf',total:10}),[2]);assert.deepEqual(partySizes({kind:'flower',total:10}),[2,3,4]);assert.deepEqual(partySizes({kind:'leaf',total:20}),[2,3,4]);
 const list=[{id:1,title:'小徑',subject:'數學'},{id:2,title:'自己的卷',subject:'國語',self:true},{id:3,title:'考古卷',subject:'數學',past:true}];
 assert.deepEqual(filterPapers(list,{category:'self'}).map(p=>p.id),[2]);assert.equal(filterPapers(list,{category:'past',subject:'國語'}).length,0);assert.equal(filterPapers(list,{query:'小徑'}).length,1);
});
test('self owner/code/room isolation, idempotency, capacity, correction, content dedup and original data',async()=>{
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
 for(const capacity of [3,4])await assert.rejects(()=>call(1,{action:'create',paper:'teacher-ten',capacity,team:'合成小隊',theme:'forest'}),/PAIR_ONLY/);
 assert.equal((await call(1,{action:'create',paper:'past-ten',capacity:4,team:'考古小隊',theme:'forest'})).capacity,4);
 let old=await call(1,{action:'snapshot',roomId:uid(701)});await assert.rejects(()=>call(1,{action:'start',roomId:old.id,revision:old.revision}),/PAIR_ONLY/);
 await call(3,{action:'leave',roomId:old.id,revision:old.revision});old=await call(1,{action:'snapshot',roomId:old.id});old=await call(1,{action:'resize',roomId:old.id,revision:old.revision,capacity:2});assert.equal(old.capacity,2);
 const allocations=[];for(const n of [1,2,3,4])allocations.push((await call(n,{action:'snapshot',roomId:uid(702)})).exercise.mine.length);assert.deepEqual(allocations,[3,3,2,2]);
 const cat=await call(1,{action:'catalog'});assert.deepEqual(new Set(cat.papers.filter(p=>p.self).map(p=>p.sourceSession)),new Set([ten,twenty]));
 for(const sid of [five,fifteen,other,extension])await assert.rejects(()=>create(1,sid),/SELF_UNAVAILABLE/);
 for(const capacity of [3,4])await assert.rejects(()=>create(1,ten,capacity),/PAIR_ONLY/);
 const requestId=crypto.randomUUID();let r=await create(1,ten,2,{requestId});assert.equal((await create(1,ten,2,{requestId})).id,r.id);
 await assert.rejects(()=>create(1,ten,2,{requestId,team:'變更'}),/REQUEST_REUSED/);
 assert.equal((await db.query('select count(*)::int n from partner_pilot.papers where origin=\'self\'')).rows[0].n,1);
 assert.equal(r.paperInfo.sourceVersion,null);assert(!JSON.stringify(r).includes(ten));
 for(const n of [1,2])await assert.rejects(()=>call(n,{action:'create',paper:r.paper,team:'不可',theme:'forest',capacity:2}),/SELF_UNAVAILABLE/);
 await assert.rejects(()=>call(3,{action:'snapshot',roomId:r.id}),/NOT_MEMBER/);
 await as(3);assert.equal((await db.query('select public.quiz_partner_pilot_can_subscribe($1) ok',[r.topic])).rows[0].ok,false);
 await assert.rejects(()=>call(5,{action:'lookup',code:r.code}),/ROOM_NOT_FOUND/);
 await assert.rejects(()=>call(2,{action:'join',roomId:r.id,code:'wrong'}),/SOURCE_CHANGED/);
 const preview=await call(2,{action:'lookup',code:r.code});assert.equal(preview.title,'合成10題');assert.equal(preview.paper,null);assert(!JSON.stringify(preview).includes(ten));
 r=await call(2,{action:'join',roomId:r.id,code:r.code});
 assert(!(await call(2,{action:'catalog'})).papers.some(p=>p.id===r.paper||p.sourceSession===ten));
 await assert.rejects(()=>call(3,{action:'join',roomId:r.id,code:r.code}),/ROOM_FULL/);
 r=await call(1,{action:'snapshot',roomId:r.id});await assert.rejects(()=>call(1,{action:'resize',roomId:r.id,revision:r.revision,capacity:3}),/PAIR_ONLY/);
 const start=async(members,room)=>{for(const n of members){room=await call(n,{action:'snapshot',roomId:room.id});room=await call(n,{action:'ready',roomId:room.id,revision:room.revision,ready:true});}return call(members.at(-1),{action:'start',roomId:room.id,revision:room.revision});};
 const complete=async(members,room,correct=false)=>{for(const n of members){const s=await call(n,{action:'snapshot',roomId:room.id});for(const q of s.exercise.mine)await call(n,{action:'answer',roomId:room.id,qid:q.id,expectedAttempt:q.attempts.length,choice:correct?0:1});}for(const n of members)await call(n,{action:'review',roomId:room.id,text:'一起再想想'});return call(members[0],{action:'finish',roomId:room.id});};
 r=await start([1,2],r);assert.equal(r.exercise.mine.length,5);assert(!JSON.stringify(r.exercise.mine).includes('先想再試'));
 r=await complete([1,2],r);assert.equal(r.exercise.award,null);
 let corrections=0;for(const n of [1,2]){const s=await call(n,{action:'snapshot',roomId:r.id});for(const q of s.exercise.mine){if(corrections===6)break;r=await call(n,{action:'answer',roomId:r.id,qid:q.id,expectedAttempt:q.attempts.length,choice:0});corrections++;if(corrections===5)assert.equal(r.exercise.award,null);}}
 assert.equal(r.exercise.correct,6);
 assert.equal(r.exercise.award.leaves,1);assert.equal(r.exercise.award.flowers,0);
 const reordered=document(10);reordered.blocks.reverse();for(const b of reordered.blocks){b.id='new'+b.id;b.questions[0].id='new'+b.questions[0].id;}
 const same=await seed(10,1,reordered);let second=await create(1,same);second=await call(2,{action:'join',roomId:second.id,code:second.code});second=await start([1,2],second);second=await complete([1,2],second,true);assert.equal(second.exercise.award.id,r.exercise.award.id);assert.equal(second.exercise.award.earnedHere,false);
 let changed=await create(1,ten);changed=await call(3,{action:'join',roomId:changed.id,code:changed.code});changed=await start([1,3],changed);changed=await complete([1,3],changed,true);assert.notEqual(changed.exercise.award.id,r.exercise.award.id);
 let four=await create(1,twenty,4);for(const n of [2,3,4])four=await call(n,{action:'join',roomId:four.id,code:four.code});four=await start([1,2,3,4],four);four=await complete([1,2,3,4],four,true);assert.equal(four.exercise.award.leaves,2);
 // Native material/layout/audio and explanation media remain room- and reveal-scoped.
 const rich=document(10),url='https://quiz-media.invalid/'+uid(99)+'/'+'a'.repeat(64),explain='https://quiz-media.invalid/'+uid(99)+'/'+'b'.repeat(64);
 rich.blocks[0].questions[0].prompt={text:'看圖',media:[{kind:'image',url,alt:'圖'}],layout:[{type:'paragraph',runs:[{type:'image',media_index:0,width:100}]}]};
 rich.blocks[0].questions[0].explanation={text:'解析音檔',media:[{kind:'audio',url:explain,alt:'聽解析'}]};
 const richSid=await seed(10,1,rich);await assert.rejects(()=>create(1,richSid),/SELF_MEDIA_UNAVAILABLE/);
 for(const [u,mime]of[[url,'image/png'],[explain,'audio/mpeg']])await db.query('insert into public.quiz_media_assets values($1,$2,$3,100)',[u,'synthetic/'+u.split('/').at(-1),mime]);
 let mediaRoom=await create(1,richSid);mediaRoom=await call(2,{action:'join',roomId:mediaRoom.id,code:mediaRoom.code});mediaRoom=await start([1,2],mediaRoom);
 const q=(await call(1,{action:'snapshot',roomId:mediaRoom.id})).exercise.mine[0];assert.equal(q.rich.prompt.layout[0].runs[0].media_index,0);
 const hashes=(await db.query('select hash,source_url from partner_pilot.media_map where paper_id=$1',[mediaRoom.paper])).rows;
 const media=async(n,hash)=>{await as(n);return(await db.query('select public.quiz_partner_pilot_media_descriptor($1,$2) data',[mediaRoom.id,hash])).rows[0].data;};
 const promptHash=hashes.find(h=>h.source_url===url).hash,explanationHash=hashes.find(h=>h.source_url===explain).hash;
 const descriptor=await media(1,promptHash);
 assert.equal(descriptor.mime,'image/png');assert.equal(descriptor.sha256,'a'.repeat(64));assert.notEqual(descriptor.sha256,promptHash);assert.equal(descriptor.url,url);assert.equal(descriptor.backend,'auto');
 await db.query('update public.quiz_media_assets set object_path=$1 where url=$2',['drive-all-subjects-'+'a'.repeat(64),url]);
 assert.equal((await media(1,promptHash)).backend,'auto');
 await assert.rejects(()=>media(1,explanationHash),/MEDIA_DENIED/);await assert.rejects(()=>media(3,promptHash),/SOURCE_CHANGED|NOT_MEMBER/);
 await call(1,{action:'answer',roomId:mediaRoom.id,qid:q.id,choice:0,expectedAttempt:0});assert.equal((await media(1,explanationHash)).mime,'audio/mpeg');
 // Personal deletion prevents NEW copies; previously shared rooms continue without changing private answers.
 await db.query('update public.quiz_generated_papers set deleted_at=now() where session_id=$1',[richSid]);await assert.rejects(()=>create(1,richSid),/SELF_UNAVAILABLE/);assert((await call(2,{action:'snapshot',roomId:mediaRoom.id})).started);assert.equal((await media(1,promptHash)).mime,'image/png');
 for(const sig of ['self_catalog()','copy_self(uuid,text)','self_document_ok(jsonb)','custom_invite_ok(uuid,text)','max_capacity(text)'])assert.equal((await db.query(`select has_function_privilege('authenticated',$1,'execute') ok`,['partner_pilot.'+sig])).rows[0].ok,false);
 const ownCopies=(await db.query("select count(*)::int n from partner_pilot.papers where owner_id=$1 and origin='self'",[uid(1)])).rows[0].n;
 for(let i=ownCopies;i<6;i++)await create(1,ten);
 await assert.rejects(()=>create(1,ten),/ROOM_RATE_LIMIT/);
 assert.equal((await create(1,ten,2,{requestId})).id,r.id,'retry original request does not consume burst quota');
 // Only test fixture setup/deletion changed source rows, not any partner operation.
 const current=(await personal()).rows[0].data;assert.deepEqual(current.attempts,original.attempts);assert.deepEqual(current.answers,original.answers);assert.deepEqual(current.leaves,original.leaves);
 console.log(JSON.stringify({ownerOnly:true,roomCopies:true,retrySafe:true,tenPairOnly:true,twentyFourPeople:true,correction:true,contentDedup:true,mediaReveal:true,privateAnswersUntouched:true}));
 }finally{await db.close();}
});
