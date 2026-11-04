-- Verified against the deployed activity config and week10.js (five levels).
-- Add the missing source definition; never create progress, awards or growth.
begin;
set local lock_timeout='3s';
set local statement_timeout='15s';
insert into public.garden_reward_catalog
 (course_id,week_code,activity_key,kind,total_levels,reward_mode)
values ('grade3-115-1','10','typing_task_5','typing',5,null)
on conflict(course_id,week_code,activity_key) do nothing;
do $$begin
 if not exists(select 1 from public.garden_reward_catalog
  where course_id='grade3-115-1' and week_code='10' and activity_key='typing_task_5'
   and kind='typing' and total_levels=5 and reward_mode is null)
 then raise exception 'garden_catalog_conflict';end if;
end$$;
commit;
