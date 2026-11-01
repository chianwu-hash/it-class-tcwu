-- Incremental extension only. Keep all current past-exam functions and rewards.
begin;
lock table public.quiz_past_papers in share row exclusive mode;
do $$
declare definition text;
begin
 select pg_get_constraintdef(oid) into definition from pg_constraint
 where conrelid='public.quiz_past_papers'::regclass and conname='quiz_past_papers_grade_check';
 if definition is null or definition not in ('CHECK ((grade = ANY (ARRAY[3, 6])))','CHECK ((grade = ANY (ARRAY[3, 4, 6])))') then
  raise exception 'unexpected_past_grade_constraint';
 end if;
 if definition='CHECK ((grade = ANY (ARRAY[3, 6])))' then
  alter table public.quiz_past_papers drop constraint quiz_past_papers_grade_check;
  alter table public.quiz_past_papers add constraint quiz_past_papers_grade_check check(grade in (3,4,6));
 end if;
end $$;
notify pgrst,'reload schema';
commit;
