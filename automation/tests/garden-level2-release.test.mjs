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
