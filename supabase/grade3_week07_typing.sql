-- Register Week07 only; retain existing progress, RPCs and permissions.
begin;
insert into public.grade3_google_activities (week_code, activity_key, total)
values ('07', 'typing_task_5', 5)
on conflict (week_code, activity_key) do nothing;
do $$ begin
 if not exists (select 1 from public.grade3_google_activities
   where week_code='07' and activity_key='typing_task_5' and total=5) then
   raise exception 'Week07 total conflicts with the existing registration';
 end if;
end $$;
commit;
