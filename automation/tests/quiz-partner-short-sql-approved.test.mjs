import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import{randomUUID,createHash}from'node:crypto';
import{setupProductionQuizDB}from'../fixtures/production-quiz-db.mjs';
import{newDocument,content,validateDocument}from'../../shared/quiz-document.mjs';
import{presentationSignature}from'../../shared/quiz-presentation-signature.mjs';

const snapshotManifest=JSON.parse(await fs.readFile('supabase/production-snapshot/manifest.json','utf8'));
for(const mixed of[false,true])for(const frozen of[false,true])for(const upgrade of[true,false])test(`共同回顧只在全隊完成後帶回${mixed?'單選、簡答及多格':'多格'}題最新原作答；${frozen?'既有凍結':'一般自組'}小隊；${upgrade?'核准升級':'當前正式快照'}`,{skip:!upgrade&&snapshotManifest.functions['partner_pilot.learning_snapshot(uuid)'].md5==='1004e6e1be013387c2ab03f2d0571c4a'},async()=>{
 const{db,uid,as}=await setupProductionQuizDB({snapshot:true});
 const call=async(n,p)=>{await as(n,n?'authenticated':'anon');try{return(await db.query('select public.quiz_partner_pilot_action($1) data',[{requestId:randomUUID(),...p}])).rows[0].data;}finally{await db.exec('reset role');}};
 try{
  if(upgrade)await db.exec(await fs.readFile('automation/fixtures/partner-learning-snapshot-before-short.sql','utf8'));
  const schema=JSON.parse(await fs.readFile('supabase/production-snapshot/schema.json','utf8'));
  for(let n=1;n<=4;n++){await db.query('insert into auth.users(id,email,email_confirmed_at)values($1,$2,now())',[uid(n),n===1?'teacher@example.invalid':`s${n}@example.invalid`]);if(n>1){await db.query("insert into public.student_enrollments values(115,$1,'303',$2,$3)",[`s${n}@example.invalid`,n,'合成學生'+n]);await db.query('insert into partner_pilot.allowed_users(user_id,display_name)values($1,$2)',[uid(n),'合成學生'+n]);}}
  await db.exec('insert into partner_pilot.settings(id,enabled)values(true,true)');
  const d=newDocument();d.catalog.subject='數學';d.blocks=Array.from({length:10},(_,i)=>({id:'b'+i,material:content(''),questions:[{id:'synthetic_'+i,type:'fields',prompt:content('合成題：填（ ）、（ ）'),fields:[{id:'f1',label:'(1)原數值',input:'math'},{id:'f2',label:'(2)另一數值',input:'math'}],answer:{format:'fields-v1',fields:{f1:[String(i%2===0?2:4)],f2:[String(i%2===0?3:5)]}},explanation:content('合成解析'),...(i===2?{work:{input:'expression',label:'算式'}}:{})}]}));
  if(mixed)for(let i=6;i<10;i++)d.blocks[i].questions=[i<8?{id:'synthetic_short_'+i,type:'short',prompt:content('合成簡答：請填名稱'),answer:{accepted:['乙','合成乙']},explanation:content('合成解析')}:{id:'synthetic_single_'+i,type:'single',prompt:content('已核准原生單選合成來源'),options:[{id:'a',content:content('甲')},{id:'b',content:content('乙')}],answer:{option_id:'b'},explanation:content('合成解析')}];
  const source=d.blocks[0].questions[0],mediaUrl='https://quiz-media.invalid/'+uid(1)+'/'+'a'.repeat(64);
  source.prompt={text:'合成看圖\n(1)（ ）\n(2)（ ）',media:[{kind:'image',url:mediaUrl,alt:'合成原圖'}],layout:[{type:'paragraph',runs:[{type:'text',text:'合成看圖'}]},{type:'paragraph',runs:[{type:'text',text:'(1)'},{type:'image',media_index:0,width:120},{type:'text',text:'（ ）'}]},{type:'paragraph',runs:[{type:'text',text:'(2)（ ）'}]}]};
  await db.query('insert into public.quiz_media_assets(url,owner_id,object_path,mime,bytes)values($1,$2,$3,$4,$5)',[mediaUrl,uid(1),'synthetic/source','image/png',100]);validateDocument(d);
  const bank=randomUUID(),version=randomUUID(),session=randomUUID();await db.query('insert into public.quiz_banks(id,owner_id,draft)values($1,$2,$3)',[bank,uid(2),d]);await db.query('insert into public.quiz_versions(id,bank_id,revision,document)values($1,$2,1,$3)',[version,bank,d]);
  await db.query(`insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options,access_mode)values($1,$2,$3,115,'["303"]','immediate',false,false,'self')`,[session,uid(2),version]);await db.query('insert into public.quiz_generated_papers(session_id,user_id,request_id,config,actual_distribution)values($1,$2,$3,$4,$5)',[session,uid(2),randomUUID(),{kind:'self',count:10},{synthetic:10}]);
  let room=await call(2,{action:'create',paper:'self:'+session,team:'隔離回顧',theme:'forest',capacity:2}),rid=room.id;
  room=await call(3,{action:'join',roomId:rid,code:room.code});for(const n of[2,3]){room=await call(n,{action:'snapshot',roomId:rid});room=await call(n,{action:'ready',roomId:rid,revision:room.revision,ready:true});}room=await call(2,{action:'start',roomId:rid,revision:room.revision});
  const copied=room.exercise.mine.find(q=>q.normal?.id===source.id).normal,expected=structuredClone(source);expected.prompt.media[0].url='https://partner-media.invalid/'+createHash('sha256').update(mediaUrl).digest('hex');
  assert.equal(copied.prompt.media[0].url,expected.prompt.media[0].url);assert.equal(presentationSignature(copied),presentationSignature(expected));
  // Seed an already-started allocation-v1 fixture before installing its real
  // production guards. No guard is disabled during migration or verification.
  if(frozen){const owners=(await db.query('select i.qid,partner_pilot.owner_of($1,i.qid) owner from partner_pilot.paper_items i where i.paper_id=$2',[rid,room.paper])).rows;for(const q of owners)await db.query("insert into partner_pilot.allocations(room_id,qid,user_id,unit_id)values($1,$2,$3,$4)",[rid,q.qid,q.owner,'synthetic-'+q.qid]);await db.query('update partner_pilot.rooms set allocation_version=1 where id=$1',[rid]);}
  for(const t of schema.triggers.filter(t=>t.schema==='partner_pilot'))await db.exec(t.def);
  assert.equal((await db.query('select allocation_version from partner_pilot.rooms where id=$1',[rid])).rows[0].allocation_version,frozen?1:0);
  const raw=(q,value)=>{const base=Number(q.normal.id.split('_').at(-1))%2===0?2:4;return JSON.stringify({v:1,f:{f1:value??String(base),f2:String(base+1)},...(q.normal.work?{w:'原算式：1＋1＝2'}:{})});};
  const send=async(n,q,value)=>{const state=await call(n,{action:'snapshot',roomId:rid});return call(n,{action:'answer',roomId:rid,qid:q.id,...(q.normal?{response:q.normal.type==='short'?(value??'乙'):raw(q,value)}:{choice:Number(value??1)}),expectedAttempt:state.exercise.mine.find(v=>v.id===q.id)?.attempts.length??0});};
  const mine=room.exercise.mine,first=mine[0];await send(2,first,'1');await send(2,first);for(const q of mine.slice(1))await send(2,q);
  await db.query("insert into partner_pilot.notes(room_id,user_id,kind,qid,text)values($1,$2,'mark',$3,'合成公開討論')",[rid,uid(2),first.id]);
  const before=await call(3,{action:'snapshot',roomId:rid});assert.equal(before.exercise.reviewOpen,false);assert.ok(before.exercise.shared.length>0);assert.ok(before.exercise.shared.every(q=>!Object.hasOwn(q,'attempts')));
  const digest=async()=>(await db.query(`select t,md5(string_agg(h,',' order by h)) hash from (select 'questions' t,md5(to_jsonb(x)::text) h from partner_pilot.question_bank x union all select 'items',md5(to_jsonb(x)::text) from partner_pilot.paper_items x union all select 'papers',md5(to_jsonb(x)::text) from partner_pilot.papers x union all select 'answers',md5(to_jsonb(x)::text) from partner_pilot.answers x) r group by t order by t`)).rows;
  const hashes=await digest();const catalog=async()=>(await db.query("select p.oid::regprocedure::text signature,md5(pg_get_functiondef(p.oid)) md5,coalesce(p.proacl::text,'') acl,p.prosecdef security_definer from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','partner_pilot') and p.prokind in ('f','p') and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e') order by 1")).rows;const functionsBefore=await catalog();if(upgrade)await db.exec(await fs.readFile('supabase/quiz-partner-short-review.sql','utf8'));assert.deepEqual(await digest(),hashes);const functionsAfter=await catalog(),target='partner_pilot.learning_snapshot(uuid)';assert.deepEqual(functionsAfter.filter(r=>r.signature!==target),functionsBefore.filter(r=>r.signature!==target));const beforeTarget=functionsBefore.find(r=>r.signature===target),afterTarget=functionsAfter.find(r=>r.signature===target);assert.equal(afterTarget.md5,upgrade?'c430f84ec1928a5e834da4cb7c833e0f':snapshotManifest.functions[target].md5);assert.equal(afterTarget.acl,beforeTarget.acl);assert.equal(afterTarget.security_definer,beforeTarget.security_definer);
  const hidden=await call(3,{action:'snapshot',roomId:rid});assert.equal(hidden.exercise.reviewOpen,false);assert.ok(hidden.exercise.shared.every(q=>!Object.hasOwn(q,'attempts')));
  await assert.rejects(call(2,{action:'leave',roomId:rid,revision:hidden.revision}),/ALREADY_STARTED/);
  await assert.rejects(call(4,{action:'snapshot',roomId:rid}));await assert.rejects(call(0,{action:'snapshot',roomId:rid}));await assert.rejects(send(3,first));
  if(frozen)await assert.rejects(db.query("update partner_pilot.question_bank set title=title||' changed' where id=$1",[first.id]),/frozen|allocation/i);
  const lastWrong=mixed?hidden.exercise.mine.find(q=>q.normal?.type==='short'):hidden.exercise.mine[0];for(const q of hidden.exercise.mine)await send(3,q);await send(3,lastWrong,mixed?'原錯答':'99');const singleWrong=mixed?hidden.exercise.mine.find(q=>!q.normal):null;if(singleWrong)await send(3,singleWrong,'0');
  for(const n of[2,3]){const s=await call(n,{action:'snapshot',roomId:rid});assert.equal(s.exercise.reviewOpen,true);assert.equal(s.exercise.shared.length,10);for(const q of s.exercise.shared){assert.equal(q.attempts.length,1);if(q.normal?.type==='short'){assert.equal(q.attempts[0].value,q.id===lastWrong.id?'原錯答':'乙');assert.equal(q.attempts[0].choice,-1);}else if(q.normal){assert.equal(q.attempts[0].value,raw(q,q.id===lastWrong.id?'99':undefined));assert.equal(JSON.parse(q.attempts[0].value).f.f2,q.owner===uid(2)?'3':'5');}else{assert.equal(q.attempts[0].choice,q.id===singleWrong?.id?0:1);assert.equal(q.attempts[0].value,null);}assert.equal(q.attempts[0].correct,q.id!==lastWrong.id&&q.id!==singleWrong?.id);}if(n===2)assert.equal(s.exercise.mine.find(q=>q.id===first.id).attempts.length,2);}
  assert.equal((await db.query('select count(*)::int n from partner_pilot.answers where room_id=$1 and qid=$2',[rid,first.id])).rows[0].n,2);
  await assert.rejects(db.exec(await fs.readFile('supabase/quiz-partner-short-review.sql','utf8')),/baseline_changed/);await db.exec('rollback');
 }finally{await db.close();}
});

test('回顧相依函式換版時拒絕套用，不改 learning_snapshot',async()=>{
 const{db}=await setupProductionQuizDB({snapshot:true});try{
  await db.exec(await fs.readFile('automation/fixtures/partner-learning-snapshot-before-short.sql','utf8'));
  const before=(await db.query("select md5(pg_get_functiondef('partner_pilot.learning_snapshot(uuid)'::regprocedure)) hash")).rows[0].hash;
  const definition=(await db.query("select pg_get_functiondef('partner_pilot.owner_of(uuid,integer)'::regprocedure) body")).rows[0].body;
  const drifted=definition.replace('AS $function$','AS $function$\n-- synthetic dependency drift\n');assert.notEqual(drifted,definition);await db.exec(drifted);
  await assert.rejects(db.exec(await fs.readFile('supabase/quiz-partner-short-review.sql','utf8')),/dependency_changed/);await db.exec('rollback');
  assert.equal((await db.query("select md5(pg_get_functiondef('partner_pilot.learning_snapshot(uuid)'::regprocedure)) hash")).rows[0].hash,before);
 }finally{await db.close();}
});
