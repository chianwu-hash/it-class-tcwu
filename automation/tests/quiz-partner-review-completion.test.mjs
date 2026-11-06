import test from 'node:test';import assert from 'node:assert/strict';
import {setupReviewDB} from '../fixtures/partner-review-db.mjs';
import {taskCardState,pendingTeams} from '../../shared/partner-pilot/team-flow.mjs';
test('task list distinguishes personal review, waiting peers, corrections and prior award',()=>{
 const r={started:true,capacity:2,members:[{name:'甲',reviewed:true},{name:'乙',reviewed:false}],progress:{total:10,submitted:10,graded:10,correct:10,reviewed:1,meReviewed:false,award:null}};
 assert.match(taskCardState(r).label,/待你/);assert.match(taskCardState(r).detail,/等待乙/);
 r.progress.meReviewed=true;assert.match(taskCardState(r).label,/等待夥伴/);
 r.finished=true;r.progress.correct=5;assert.match(taskCardState(r).detail,/再訂正 1/);assert.equal(pendingTeams([r]).length,1);
 r.progress.award={leaves:1,flowers:0,earnedHere:false};assert.equal(pendingTeams([r]).length,0);assert.match(taskCardState(r).detail,/相同題目/);
});
test('last explicit review completes and awards once; first review never finishes; old data and grants preserved',async()=>{
 const f=await setupReviewDB(),{db,call,room,other,uid}=f;try{
 const old=(await db.query('select to_jsonb(r) data from partner_pilot.rooms r where id=$1',[other.id])).rows[0];
 assert.equal((await call(1,{action:'me'})).rooms.find(r=>r.id===room.id).progress.correct,null);
 for(const n of [1,2]){const s=await call(n,{action:'snapshot',roomId:room.id});for(const q of s.exercise.mine)await call(n,{action:'answer',roomId:room.id,qid:q.id,expectedAttempt:0,choice:0});if(n===1)assert.equal((await call(2,{action:'me'})).rooms.find(r=>r.id===room.id).progress.correct,null);}
 let a=await call(1,{action:'review',roomId:room.id,text:''});assert.equal(a.exercise.finished,false);assert.equal(a.exercise.award,null);
 let list=(await call(2,{action:'me'})).rooms.find(r=>r.id===room.id);assert.equal(list.phase,'review');assert.equal(list.progress.reviewed,1);assert.equal(list.progress.meReviewed,false);assert.equal(list.progress.correct,10);assert.equal(list.members.filter(m=>m.reviewed).length,1);assert(!JSON.stringify(list).includes('choice'));
 const request={action:'review',roomId:room.id,text:'合成回顧',requestId:crypto.randomUUID()};a=await call(2,request);assert(a.exercise.finished);assert.equal(a.exercise.award.leaves,1);assert(a.exercise.award.earnedHere);
 await call(2,request);await call(1,{action:'review',roomId:room.id,text:'更新回顧'});await call(1,{action:'finish',roomId:room.id});
 assert.equal((await db.query('select count(*) n from partner_pilot.awards where room_id=$1',[room.id])).rows[0].n,1);
 assert.equal((await db.query('select count(*) n from partner_pilot.answers where room_id=$1',[room.id])).rows[0].n,10);
 assert.deepEqual((await db.query('select to_jsonb(r) data from partner_pilot.rooms r where id=$1',[other.id])).rows[0],old);
 assert(!(await call(4,{action:'me'})).rooms.some(r=>r.id===room.id));await assert.rejects(()=>call(4,{action:'review',roomId:room.id,text:''}),/NOT_MEMBER/);
 list=(await call(1,{action:'me'})).rooms.find(r=>r.id===room.id);assert.equal(list.phase,'completed');assert.equal(list.progress.award.leaves,1);assert.equal(pendingTeams([list]).length,0);
 }finally{await db.close();}
});
test('below threshold finishes without award and correction supplements once',async()=>{
 const {db,call,room}=await setupReviewDB();try{
 for(const n of [1,2]){const s=await call(n,{action:'snapshot',roomId:room.id});for(const q of s.exercise.mine)await call(n,{action:'answer',roomId:room.id,qid:q.id,expectedAttempt:0,choice:1});}
 await call(1,{action:'review',roomId:room.id,text:''});let a=await call(2,{action:'review',roomId:room.id,text:''});assert(a.exercise.finished);assert.equal(a.exercise.award,null);
 for(const n of [1,2]){const s=await call(n,{action:'snapshot',roomId:room.id});for(const q of s.exercise.mine.slice(0,3))a=await call(n,{action:'answer',roomId:room.id,qid:q.id,expectedAttempt:1,choice:0});}
 assert.equal(a.exercise.correct,6);assert.equal(a.exercise.award.leaves,1);
 assert.equal((await db.query('select count(*) n from partner_pilot.answers where room_id=$1',[room.id])).rows[0].n,16);
 }finally{await db.close();}
});
test('2/3/4-member packed papers auto-complete with one flower, same content and roster deduplicate',async()=>{
 const {db,call}=await setupReviewDB();try{
 for(const capacity of [2,3,4]){
 for(let repeat=0;repeat<2;repeat++){
 let r=await call(1,{action:'create',paper:'packed',team:'合成考古回顧',theme:'forest',capacity});
 for(let n=2;n<=capacity;n++)r=await call(n,{action:'join',roomId:r.id,code:r.code});r=await call(1,{action:'start',roomId:r.id,revision:r.revision});
 for(let n=1;n<=capacity;n++){const s=await call(n,{action:'snapshot',roomId:r.id});for(const q of s.exercise.mine)await call(n,{action:'answer',roomId:r.id,qid:q.id,expectedAttempt:0,choice:0});}
 for(let n=1;n<=capacity;n++){const s=await call(n,{action:'review',roomId:r.id,text:''});assert.equal(s.exercise.finished,n===capacity);if(n===capacity){assert.equal(s.exercise.award.flowers,1);assert.equal(s.exercise.award.earnedHere,!repeat);}}
 }
 }
 assert.equal((await db.query(`select count(*) n from partner_pilot.awards where flowers=1`)).rows[0].n,3);
 }finally{await db.close();}
});
test('zero-graded tasks finish without inventing an award',async()=>{
 const {db,call,room}=await setupReviewDB();try{
 for(const n of [1,2]){const s=await call(n,{action:'snapshot',roomId:room.id});for(const q of s.exercise.mine)await call(n,{action:'answer',roomId:room.id,qid:q.id,expectedAttempt:0,choice:0});}
 await db.query(`update partner_pilot.question_bank set past_meta='{"kind":"manual","selfCheck":true}' where id in(select qid from partner_pilot.paper_items where paper_id='ten')`);
 await call(1,{action:'review',roomId:room.id,text:''});let a=await call(2,{action:'review',roomId:room.id,text:''});assert(a.exercise.finished);assert.equal(a.exercise.gradedTotal,0);assert.equal(a.exercise.award,null);
 }finally{await db.close();}
});
test('historical all-reviewed unfinished rooms stay intact until explicit legacy finish',async()=>{
 const {db,call,room,uid}=await setupReviewDB();try{
 await db.query(`insert into partner_pilot.answers(room_id,user_id,qid,attempt,choice,correct,created_at) select $1,partner_pilot.owner_of($1,i.qid),i.qid,1,0,true,now() from partner_pilot.paper_items i where paper_id='ten'`,[room.id]);
 for(const n of [1,2])await db.query(`insert into partner_pilot.review_seen values($1,$2,'historical',now())`,[room.id,uid(n)]);
 const card=(await call(1,{action:'me'})).rooms.find(r=>r.id===room.id);assert.equal(card.finished,false);assert.equal(card.progress.reviewed,2);assert.match(taskCardState(card).label,/待結算/);
 assert.equal((await call(2,{action:'snapshot',roomId:room.id})).exercise.finished,false);
 const a=await call(1,{action:'finish',roomId:room.id});assert.equal(a.exercise.award.leaves,1);await call(2,{action:'finish',roomId:room.id});assert.equal((await db.query('select count(*) n from partner_pilot.awards where room_id=$1',[room.id])).rows[0].n,1);
 }finally{await db.close();}
});
