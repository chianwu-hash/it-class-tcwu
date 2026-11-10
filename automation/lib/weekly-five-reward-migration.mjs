import {createHash} from 'node:crypto';
export function buildWeeklyFiveRewardMigration(source) {
 source=source.replaceAll('\r\n','\n');
 const old="   n:=greatest(0,least(r.total_levels-1,case when r.completed then r.total_levels-1 else coalesce(r.current_level,0)-1 end));";
 if(source.split(old).length!==2)throw Error('garden_growth leaf calculation changed');
 const next=source.includes("if r.reward_mode='five-then-flower'") ? source : source.replace(old,`   if r.reward_mode='five-then-flower' and r.total_levels=6 then
    n:=case when r.completed or coalesce(r.current_level,0)>=6 then 1 else 0 end;
   else
${old}
   end if;`);
 const md5=s=>createHash('md5').update(s).digest('hex');
 return `-- Week11 opt-in rewards. No existing progress, rewards or growth state is rewritten.
begin;
set local lock_timeout='3s';
do $guard$ begin
 if md5(replace(pg_get_functiondef('public.garden_growth(text,text)'::regprocedure),E'\\r\\n',E'\\n')) not in ('${md5(source)}','${md5(next)}') then
  raise exception 'garden_growth changed; rebuild from current production definition';
 end if;
end $guard$;
insert into public.grade3_google_activities(week_code,activity_key,total) values('11','typing_task_6',6) on conflict do nothing;
do $activity$ begin
 if not exists(select 1 from public.grade3_google_activities where week_code='11' and activity_key='typing_task_6' and total=6) then raise exception 'Week11 registration conflict';end if;
 if exists(select 1 from public.garden_reward_catalog where course_id='grade3-115-1' and week_code='11' and activity_key='typing_task_6'
  and (kind is distinct from 'typing' or total_levels is distinct from 6 or reward_mode is distinct from 'five-then-flower')) then raise exception 'Week11 catalog conflict';end if;
end $activity$;
insert into public.garden_reward_catalog(course_id,week_code,activity_key,kind,total_levels,reward_mode)
 values('grade3-115-1','11','typing_task_6','typing',6,'five-then-flower') on conflict do nothing;
${next.trimEnd()};
commit;
`;
}
