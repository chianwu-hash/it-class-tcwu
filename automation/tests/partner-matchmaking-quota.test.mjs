import test from 'node:test';import assert from 'node:assert/strict';import {setupMatchDB} from '../fixtures/partner-match-db.mjs';
test('十間舊集合室不擋候配原子出發，手動建立仍守配額且不能偽造例外',async()=>{
 const f=await setupMatchDB(),{db,call,uid}=f;try{
 for(const n of[2,3,4,5]){
  await call(n,{action:'me'},true);
  for(let i=0;i<10;i++){const id=crypto.randomUUID();await db.query("insert into partner_pilot.rooms(id,code,team,theme,paper,capacity,host) values($1,$2,'原有集合室','forest',$3,2,$4)",[id,String(800000+n*10+i),f.ten.paper,uid(n)]);await db.query('insert into partner_pilot.members(room_id,user_id,ready) values($1,$2,false)',[id,uid(n)]);}
 }
 const before=(await db.query('select jsonb_agg(to_jsonb(r) order by id) x from partner_pilot.rooms r')).rows[0].x;
 await assert.rejects(call(2,{action:'create',paper:f.ten.paper,capacity:2,team:'不應建立',theme:'forest',matchedTeam:crypto.randomUUID()},true),/TOO_MANY_ROOMS/);
 await f.form([2,3,4,5]);const s=await call(2,{action:'status'}),host=Number(s.team.host.slice(-12));let leader=await call(host,{action:'status'}),args=s=>({teamId:s.team.id,ticket:s.ticket,revision:s.team.revision});
 leader=await call(host,{action:'select',paper:f.twenty.paper,...args(leader)});const started=await call(host,{action:'start',...args(leader)});assert.equal(started.phase,'active');assert.equal((await db.query('select count(*)::int n from partner_pilot.rooms where not started')).rows[0].n,40);
 const after=(await db.query('select jsonb_agg(to_jsonb(r) order by id) x from partner_pilot.rooms r where not started')).rows[0].x;assert.deepEqual(after,before);
 await db.query('update public.quiz_sessions set library_visible=false where id=$1',[f.twenty.session]);assert.equal((await call(host,{action:'snapshot',roomId:started.roomId},true)).paused,true);
 }finally{await db.close();}
});
