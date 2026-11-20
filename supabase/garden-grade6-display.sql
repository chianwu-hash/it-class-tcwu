-- Add a teacher-only Grade 6 display alongside the existing Grade 3 rehearsal.
-- This migration grants no display credits by itself.
begin;

do $migration$
declare
  definition text := pg_get_functiondef('public.garden_test_rewards(text)'::regprocedure);
  old_predicate constant text := 'and e.class_code=''307'' and e.seat_no=30';
  new_predicate constant text := 'and e.seat_no=30 and (
    (t.course_id=''grade3-115-1'' and e.class_code=''307'')
    or (t.course_id=''grade6-115-1'' and e.class_code=''609'')
  )';
begin
  if length(definition) - length(replace(definition, old_predicate, '')) <> length(old_predicate)
     or position('lower(u.email)=''chianwu@apps.ntpc.edu.tw''' in definition) = 0
     or position('t.user_id=auth.uid()' in definition) = 0
     or position('u.email_confirmed_at is not null' in definition) = 0
     or position('t.course_id=p_course_id' in definition) = 0
     or position('e.school_year=115' in definition) = 0 then
    raise exception 'unexpected_garden_test_rewards_definition';
  end if;
  execute replace(definition, old_predicate, new_predicate);
end
$migration$;

alter table public.garden_test_setup
  drop constraint garden_test_setup_course_id_check,
  drop constraint garden_test_setup_leaves_check,
  drop constraint garden_test_setup_flowers_check,
  add constraint garden_test_setup_course_id_check
    check (course_id in ('grade3-115-1','grade6-115-1')),
  add constraint garden_test_setup_leaves_check check (
    leaves between 0 and case course_id when 'grade3-115-1' then 43 else 92 end
  ),
  add constraint garden_test_setup_flowers_check check (
    flowers between 0 and case course_id when 'grade3-115-1' then 10 else 22 end
  );

notify pgrst,'reload schema';
commit;
