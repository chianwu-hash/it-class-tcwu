-- Apply after current quiz-past-exams.sql. Keeps original award UUID, owner,
-- first qualifying attempt and unique paper/semester constraint. The legacy
-- table name is retained for backwards-compatible server implementation only.
begin;
alter table public.quiz_past_leaves add column if not exists reward_kind text not null default 'past-exam-flower';
do $$begin
 if not exists(select 1 from pg_constraint where conname='quiz_past_flower_kind') then
  alter table public.quiz_past_leaves add constraint quiz_past_flower_kind check(reward_kind='past-exam-flower');
 end if;
 if to_regprocedure('public.quiz_rewards_before_past_flowers(jsonb)') is null then
  alter function public.quiz_rewards(jsonb) rename to quiz_rewards_before_past_flowers;
 end if;
 if to_regprocedure('public.quiz_past_snapshot_before_flowers(uuid)') is null then
  alter function public.quiz_past_snapshot(uuid) rename to quiz_past_snapshot_before_flowers;
 end if;
end$$;
revoke all on function public.quiz_rewards_before_past_flowers(jsonb),public.quiz_past_snapshot_before_flowers(uuid) from public,anon,authenticated;

create or replace function public.quiz_rewards(p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare old jsonb;normal jsonb;flowers jsonb;cid text:=p_data->>'course_id';
begin
 old:=public.quiz_rewards_before_past_flowers(p_data);
 select coalesce(jsonb_agg(a order by n),'[]') into normal
 from jsonb_array_elements(coalesce(old->'awards','[]')) with ordinality x(a,n)
 where a->>'source_type' is distinct from 'past_exam';
 select coalesce(jsonb_agg((a-'half_units')||jsonb_build_object('reward_kind','past-exam-flower','flower_style','forest') order by n),'[]') into flowers
 from jsonb_array_elements(coalesce(old->'awards','[]')) with ordinality x(a,n)
 where a->>'source_type'='past_exam' and (cid is null or cid='grade'||(a->>'grade')||'-115-1');
 return old||jsonb_build_object('awards',normal,'flowers',flowers);
end$$;

create or replace function public.quiz_past_snapshot(p_attempt uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare data jsonb;practice jsonb;history jsonb;
begin
 data:=public.quiz_past_snapshot_before_flowers(p_attempt);practice:=data->'practice';
 if practice is null then return data;end if;
 select coalesce(jsonb_agg((h-'earned_leaf')||jsonb_build_object('earned_flower',coalesce(h->'earned_leaf','false'::jsonb)) order by n),'[]') into history
 from jsonb_array_elements(coalesce(practice->'history','[]')) with ordinality x(h,n);
 practice:=(practice-'leafCount')||jsonb_build_object('flowerCount',coalesce(practice->'leafCount','0'::jsonb),'rewardKind','past-exam-flower','history',history);
 return jsonb_set(data,'{practice}',practice);
end$$;
revoke all on function public.quiz_past_snapshot(uuid) from public,anon,authenticated;
revoke all on function public.quiz_rewards(jsonb) from public,anon;
grant execute on function public.quiz_rewards(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
