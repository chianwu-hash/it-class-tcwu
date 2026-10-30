import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {createQuizDb,studentId,TEACHER} from '../lib/quiz-local-db.mjs';
test('第二級樹型限本人、白名單、唯讀不增列；不改既有成長資料',async()=>{
 const db=await createQuizDb();try{
  await db.exec('create table public.garden_growth(user_id uuid primary key,baseline jsonb);');
  await db.query("insert into public.garden_growth values($1,'[{\"id\":\"earned-original\"}]')",[studentId(1)]);
  await db.exec(await fs.readFile('supabase/garden-tree-skin.sql','utf8'));
  const call=(uid,skin=null)=>db.transaction(async tx=>{await tx.query("select set_config('quiz.test_uid',$1,true)",[uid]);await tx.exec('set local role authenticated');return (await tx.query('select public.garden_tree_skin($1) result',[skin])).rows[0].result});
  assert.deepEqual(await call(studentId(1)),{skin:'a'});assert.equal((await db.query('select count(*)::int n from public.garden_tree_skins')).rows[0].n,0);
  assert.deepEqual(await call(studentId(1),'b'),{skin:'b'});assert.deepEqual(await call(studentId(1)),{skin:'b'});
  await assert.rejects(call(studentId(2),'b'),/level_two_required/);await assert.rejects(call(TEACHER,'b'),/student_required/);await assert.rejects(call(studentId(1),'c'),/invalid_skin/);await assert.rejects(call('', 'b'),/authentication_required/);
  await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role authenticated');await tx.query('select * from public.garden_tree_skins')}),/permission denied/);
  assert.deepEqual((await db.query('select baseline from public.garden_growth')).rows[0].baseline,[{id:'earned-original'}]);
  assert.deepEqual(await call(studentId(1),'a'),{skin:'a'});
 }finally{await db.close()}
});
