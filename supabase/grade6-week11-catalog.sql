-- Register only Grade 6 Week 11. No function, policy, student progress or growth state changes.
begin;
set local lock_timeout = '3s';
do $guard$
begin
  if exists (
    select 1 from public.garden_reward_catalog
    where course_id = 'grade6-115-1' and week_code = '11'
      and activity_key in ('typing_task_6', 'typing_boss_zh_1', 'typing_boss_en_1')
      and (kind is distinct from 'typing'
        or total_levels is distinct from case when activity_key = 'typing_task_6' then 6 else 1 end
        or reward_mode is distinct from case when activity_key = 'typing_task_6' then 'five-then-flower' else 'boss' end)
  ) then raise exception 'Grade 6 Week 11 catalogue conflict; inspect before applying'; end if;
end $guard$;
insert into public.garden_reward_catalog(course_id, week_code, activity_key, kind, total_levels, reward_mode)
values
  ('grade6-115-1', '11', 'typing_task_6', 'typing', 6, 'five-then-flower'),
  ('grade6-115-1', '11', 'typing_boss_zh_1', 'typing', 1, 'boss'),
  ('grade6-115-1', '11', 'typing_boss_en_1', 'typing', 1, 'boss')
on conflict(course_id, week_code, activity_key) do nothing;
commit;
