import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {buildLevel2Migration,GARDEN_LEVEL2_FILES} from '../lib/garden-level2-release.mjs';
import {setup,growth} from '../lib/garden-level2-local-db.mjs';
test('atomic release preserves existing sources, reruns safely and rolls back an injected source mutation',async()=>{
 const db=await setup();try{
  await db.exec(`create table quiz_past_leaves(id uuid,user_id uuid);create function quiz_rewards_before_past_flowers(jsonb) returns jsonb language sql as $$select '{"awards":[]}'::jsonb$$;create function quiz_past_snapshot(uuid) returns jsonb language sql as $$select '{}'::jsonb$$;create table garden_unlock_notices(user_id uuid,event_key text,course_id text,created_at timestamptz,seen_at timestamptz,claim_id uuid,claim_until timestamptz,primary key(user_id,event_key));`);
  const files=Object.fromEntries(await Promise.all(GARDEN_LEVEL2_FILES.map(async f=>[f,await fs.readFile('supabase/'+f,'utf8')]))),sql=buildLevel2Migration(files);
  const before=await growth(db);await db.exec(sql);await db.exec(sql);assert.equal((await growth(db)).level,before.level);
  const count=(await db.query('select count(*)::int n from student_progress')).rows[0].n;
  await assert.rejects(db.exec(sql.replace('do $$begin\n if (select value',()=> 'delete from public.student_progress;\ndo $$begin\n if (select value')),/protected_learning_data_or_functions_changed/);
  await db.exec('rollback');assert.equal((await db.query('select count(*)::int n from student_progress')).rows[0].n,count);
 }finally{await db.close()}
});

test('Grade 6 display is separate from real progress and restricted to the designated teacher', async () => {
 const db = await setup();
 try {
  const teacher = '00000000-0000-4000-8000-000000000003';
  const student = '00000000-0000-4000-8000-000000000001';
  await db.exec(`alter table student_enrollments add column seat_no int;
   insert into auth.users values('${teacher}', 'chianwu@apps.ntpc.edu.tw', now());
   insert into student_enrollments values(115,'chianwu@apps.ntpc.edu.tw','609',30);
   update student_enrollments set class_code='609',seat_no=30 where email='student@example.invalid';`);
  await db.exec(await fs.readFile('supabase/garden-test-setup.sql', 'utf8'));
  await db.exec(await fs.readFile('supabase/garden-grade6-display.sql', 'utf8'));
  const count = async () => (await db.query('select count(*)::int n from student_progress')).rows[0].n;
  const before = await count();
  await db.query("insert into garden_test_setup(user_id,course_id,leaves,flowers) values($1,'grade6-115-1',44,10),($1,'grade3-115-1',43,10)", [teacher]);
  await db.query("insert into garden_test_setup(user_id,course_id,leaves,flowers) values($1,'grade6-115-1',44,10)", [student]);
  const owner = async uid => db.query("select set_config('test.uid',$1,false)", [uid]);
  const rewards = async course => (await db.query('select garden_test_rewards($1) r', [course])).rows[0].r;
  await owner(student);
  assert.deepEqual(await rewards('grade6-115-1'), []);
  assert.deepEqual((await db.query("select garden_growth('grade6-115-1') r")).rows[0].r, {level:1});
  await owner(teacher);
  const display = await rewards('grade6-115-1');
  assert.equal(display.filter(item => item.kind === 'flower').length, 10);
  assert.equal(display.filter(item => item.kind === 'typing-leaf').length, 44);
  assert.equal((await db.query("select garden_growth('grade6-115-1') r")).rows[0].r.level, 2);
  await db.query("update garden_test_setup set leaves=92,flowers=22 where user_id=$1 and course_id='grade6-115-1'", [teacher]);
  const upgraded = (await db.query("select garden_growth('grade6-115-1') r")).rows[0].r;
  assert.equal(upgraded.newLeaves, 48);
  assert.equal(upgraded.newFlowers, 12);
  assert.equal(upgraded.unlockedItems.length, 9);
  for (const pet of ['cat', 'dog', 'rabbit']) {
   const choices = (await db.query("select garden_companions('grade6-115-1','get',jsonb_build_object('pet',$1::text)) r", [pet])).rows[0].r;
   assert.deepEqual(choices.pets.map(item => item.id), ['cat', 'dog', 'rabbit']);
   assert.deepEqual(choices.homes.map(item => item.home).sort(), ['a', 'b', 'c']);
  }
  assert.deepEqual(await rewards('grade3-115-1'), []);
  await db.exec("update student_enrollments set class_code='307' where email='chianwu@apps.ntpc.edu.tw'");
  assert.equal((await rewards('grade3-115-1')).length, 53);
  assert.deepEqual(await rewards('grade6-115-1'), []);
  assert.equal(await count(), before);
  const grants = (await db.query(`select
   has_function_privilege('anon','garden_test_rewards(text)','execute') anonymous_grant,
   has_table_privilege('authenticated','garden_test_setup','insert') user_write`)).rows[0];
  assert.deepEqual(grants, {anonymous_grant:false, user_write:false});
 } finally { await db.close(); }
});
