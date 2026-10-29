import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(new URL('../../tmp/quiz-runtime/package.json', import.meta.url));
export const { PGlite } = require('@electric-sql/pglite');
export const TEACHER = '00000000-0000-4000-8000-000000000001';
export const OTHER_TEACHER = '00000000-0000-4000-8000-000000000002';
export const studentId = n => `00000000-0000-4000-8001-${String(n).padStart(12, '0')}`;

// 純合成身分。本機 scaffold 不屬於 migration，不接正式 Supabase。
export async function createQuizDb(location,{batch2=process.env.QUIZ_TEST_READ_BATCH2==='1'}={}) {
  const db = new PGlite(location);
  await db.exec(`
    do $$begin
      if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
      if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
      if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
    end$$;
    create schema if not exists auth;
    create table if not exists auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create or replace function auth.uid() returns uuid language sql as $$select nullif(current_setting('quiz.test_uid',true),'')::uuid$$;
    create or replace function public.is_teacher() returns boolean language sql as $$select auth.uid() in ('${TEACHER}'::uuid,'${OTHER_TEACHER}'::uuid)$$;
    create table if not exists public.student_enrollments(school_year smallint,email text,class_code text,seat_no smallint,display_name text);
    grant usage on schema public,auth to anon,authenticated,service_role;
  `);
  for (const [id, email] of [[TEACHER, 'teacher@example.invalid'], [OTHER_TEACHER, 'other-teacher@example.invalid'],
    ...Array.from({ length: 31 }, (_, i) => [studentId(i + 1), `student${i + 1}@example.invalid`])]) {
    await db.query('insert into auth.users values($1,$2,now()) on conflict(id) do nothing', [id, email]);
  }
  await db.exec(`insert into public.student_enrollments
    select 115,email,'603',row_number() over(order by id),'合成測試學生 '||row_number() over(order by id)
    from auth.users u where email like 'student%@example.invalid'
    and not exists(select 1 from public.student_enrollments e where e.email=u.email);`);
  await db.exec(await readFile(new URL('../../supabase/quiz.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../../supabase/quiz-media.sql', import.meta.url), 'utf8'));
  if(batch2){
    for(const file of ['quiz-wrong-questions.sql','quiz-pool.sql','quiz-rewards.sql','quiz-load-batch1.sql','quiz-load-batch2.sql'])await db.exec(await readFile(new URL('../../supabase/'+file,import.meta.url),'utf8'));
    const exec=db.exec.bind(db),upgrade=await readFile(new URL('../../supabase/quiz-load-batch2.sql',import.meta.url),'utf8');
    // Older suites install their own legacy fixtures. Keep the candidate read paths active
    // after those installs so this opt-in release run actually exercises the new functions.
    db.exec=async source=>{const result=await exec(source);if(typeof source==='string'&&/create or replace function public\.quiz_(?:compose|wrong_questions)\(/i.test(source))await exec(upgrade);return result;};
  }
  return db;
}

export async function quizCall(db, userId, action, data = {}, role = 'authenticated') {
  if (!['authenticated', 'anon'].includes(role)) throw new Error('invalid_test_role');
  return db.transaction(async tx => {
    await tx.query("select set_config('quiz.test_uid',$1,true)", [userId || '']);
    await tx.exec(`set local role ${role}`);
    return (await tx.query('select public.quiz_action($1,$2) as result', [action, JSON.stringify(data)])).rows[0].result;
  });
}
