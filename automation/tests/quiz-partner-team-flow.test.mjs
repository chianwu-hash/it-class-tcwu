import test from 'node:test';import assert from 'node:assert/strict';
import {setupTeamDB} from '../fixtures/partner-team-db.mjs';
import {pendingTeams} from '../../shared/partner-pilot/team-flow.mjs';
test('pending task cards omit finished records without losing them',()=>{const list=[{id:'a',started:false},{id:'b',phase:'practice'},{id:'c',finished:true},{id:'d',phase:'completed'}];assert.deepEqual(pendingTeams(list).map(r=>r.id),['a','b']);assert.equal(list.length,4);assert.deepEqual(pendingTeams([]),[]);});
test('captain-only full-roster start ignores ready; join/retry and original tasks stay intact',async()=>{
 const {db,call,set,uid,room,other}=await setupTeamDB();try{
  const old=await db.query(`select jsonb_agg(to_jsonb(r) order by id) data from partner_pilot.rooms r where id=any($1::uuid[])`,[[room.id,other.id]]);
  const before=await db.query(`select jsonb_build_object('answers',(select jsonb_agg(to_jsonb(a)) from partner_pilot.answers a),'awards',(select jsonb_agg(to_jsonb(a)) from partner_pilot.awards a),'leaves',(select jsonb_agg(to_jsonb(a)) from public.quiz_learning_leaves a),'drafts',(select jsonb_agg(to_jsonb(a)) from partner_pilot.drafts a)) data`);
  let r=await call(1,{action:'create',paper:'twenty',team:'合成新小隊',theme:'forest',capacity:3});const id=r.id;
  r=await call(2,{action:'join',roomId:id,code:r.code});
  await assert.rejects(()=>call(2,{action:'start',roomId:id,revision:r.revision}),/HOST_ONLY/);
  await assert.rejects(()=>call(1,{action:'start',roomId:id,revision:r.revision}),/NOT_READY/);
  await db.query(`update partner_pilot.members set ready=true where room_id=$1 and user_id=$2`,[id,uid(1)]);
  const request={action:'join',roomId:id,code:r.code,requestId:crypto.randomUUID()};r=await call(3,request);await call(3,request);
  assert.equal((await db.query('select count(*) n from partner_pilot.members where room_id=$1',[id])).rows[0].n,3);
  assert.equal((await db.query('select ready from partner_pilot.members where room_id=$1 and user_id=$2',[id,uid(1)])).rows[0].ready,true);
  r=await call(1,{action:'snapshot',roomId:id});r=await call(1,{action:'start',roomId:id,revision:r.revision});assert.equal(r.started,true);assert.equal((await call(2,{action:'snapshot',roomId:id})).started,true);
  const me=await call(1,{action:'me'}),card=me.rooms.find(r=>r.id===id);assert.equal(card.phase,'practice');assert.equal(card.title,'合成20題');assert.equal(card.members.length,3);assert(!JSON.stringify(card).includes('choice'));if(card.progress)assert.equal(card.progress.correct,null);assert(!JSON.stringify(card).includes('source_session'));
  assert(!((await call(4,{action:'me'})).rooms.some(r=>r.id===id)));
  assert.deepEqual((await db.query(`select jsonb_agg(to_jsonb(r) order by id) data from partner_pilot.rooms r where id=any($1::uuid[])`,[[room.id,other.id]])).rows[0],old.rows[0]);
  assert.deepEqual((await db.query(`select jsonb_build_object('answers',(select jsonb_agg(to_jsonb(a)) from partner_pilot.answers a),'awards',(select jsonb_agg(to_jsonb(a)) from partner_pilot.awards a),'leaves',(select jsonb_agg(to_jsonb(a)) from public.quiz_learning_leaves a),'drafts',(select jsonb_agg(to_jsonb(a)) from partner_pilot.drafts a)) data`)).rows[0],before.rows[0]);
  let waiting=await call(1,{action:'create',paper:'ten',team:'交棒小隊',theme:'forest',capacity:2});waiting=await call(2,{action:'join',roomId:waiting.id,code:waiting.code});await call(1,{action:'leave',roomId:waiting.id,revision:waiting.revision});waiting=await call(2,{action:'snapshot',roomId:waiting.id});assert.equal(waiting.host,uid(2));
  await assert.rejects(()=>call(2,{action:'resize',roomId:waiting.id,revision:waiting.revision,capacity:3}),/PAIR_ONLY/);
  for(const n of [1,2,3]){const snapshot=await call(n,{action:'snapshot',roomId:id});for(const q of snapshot.exercise.mine)await call(n,{action:'answer',roomId:id,qid:q.id,expectedAttempt:q.attempts.length,choice:0});}
  assert.equal((await call(1,{action:'me'})).rooms.find(r=>r.id===id).phase,'review');
  for(const n of [1,2,3])await call(n,{action:'review',roomId:id,text:'一起再想想'});
  const finished=await call(1,{action:'finish',roomId:id});assert.equal(finished.exercise.finished,true);assert.equal(finished.exercise.award.leaves,2);assert.equal(finished.exercise.award.record.stories.length,3);
  await db.query(`update public.quiz_sessions set status='closed' where id=(select source_session from partner_pilot.papers where id='twenty')`);
  const completed=(await call(1,{action:'me'})).rooms.find(r=>r.id===id);assert.equal(completed.phase,'completed');assert.equal(completed.paused,true);
  await set(1);await assert.rejects(()=>db.query('select partner_pilot.team_rooms()'),/permission denied/);await db.exec('reset role');
 }finally{await db.close();}
});
test('past-paper allocation trigger starts with no ready flags and keeps complete packs on one owner',async()=>{
 const {db,call,room,other}=await setupTeamDB();try{
  for(const capacity of [2,3,4]){
  let r=await call(1,{action:'create',paper:'packed',team:'整包考古小隊',theme:'forest',capacity});
  for(let n=2;n<=capacity;n++)r=await call(n,{action:'join',roomId:r.id,code:r.code});
  assert.equal((await db.query(`select count(*)::int n from partner_pilot.members where room_id=$1 and ready`,[r.id])).rows[0].n,0);
  r=await call(1,{action:'start',roomId:r.id,revision:r.revision});assert.equal(r.started,true);assert.equal(r.allocationVersion,1);
  assert.equal((await db.query(`select count(*)::int n from partner_pilot.allocations where room_id=$1`,[r.id])).rows[0].n,10);
  assert.equal((await db.query(`select count(*)::int n from (select unit_id from partner_pilot.allocations where room_id=$1 group by unit_id having count(distinct user_id)>1)x`,[r.id])).rows[0].n,0);
  const counts=[];for(let n=1;n<=capacity;n++)counts.push((await call(n,{action:'snapshot',roomId:r.id})).exercise.mine.length);assert.deepEqual(counts,({2:[5,5],3:[4,3,3],4:[4,3,2,1]})[capacity]);
  assert.equal((await db.query(`select count(*)::int n from partner_pilot.allocations where room_id=any($1::uuid[])`,[[room.id,other.id]])).rows[0].n,0);
  }
 }finally{await db.close();}
});
