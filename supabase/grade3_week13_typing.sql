-- Registration only. No function, RLS, student progress or historical reward changes.
begin;
set local lock_timeout='3s';
do $guard$ begin
 if exists(select 1 from public.grade3_google_activities where week_code='13' and activity_key='typing_task_6' and total is distinct from 6) then raise exception 'Week13 activity conflict';end if;
 if exists(select 1 from public.garden_reward_catalog where course_id='grade3-115-1' and week_code='13' and activity_key='typing_task_6' and (kind is distinct from 'typing' or total_levels is distinct from 6 or reward_mode is distinct from 'five-then-flower')) then raise exception 'Week13 reward catalog conflict';end if;
end $guard$;
insert into public.grade3_google_activities(week_code,activity_key,total) values('13','typing_task_6',6) on conflict do nothing;
insert into public.garden_reward_catalog(course_id,week_code,activity_key,kind,total_levels,reward_mode)
 values('grade3-115-1','13','typing_task_6','typing',6,'five-then-flower') on conflict do nothing;
commit;
