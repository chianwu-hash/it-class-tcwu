-- Register Week09 only; preserve existing student data, RPCs and permissions.
begin;
insert into public.grade3_google_activities (week_code, activity_key, total)
values ('09', 'typing_task_6', 6)
on conflict (week_code, activity_key) do nothing;
do $$ begin
 if not exists (select 1 from public.grade3_google_activities
   where week_code='09' and activity_key='typing_task_6' and total=6) then
   raise exception 'Week09 total conflicts with the existing registration';
 end if;
end $$;
commit;
