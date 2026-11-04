import {createHash} from 'node:crypto';
import {FOUNDATION_MILESTONES} from '../../shared/typing-foundation-milestones.mjs';
const lit=s=>"'"+String(s).replaceAll("'","''")+"'";
export function buildFoundationMilestoneMigration(source){
  if(!source.includes('FUNCTION public.garden_growth(')||!source.includes("':foundation-leaf:1'"))throw Error('Unexpected garden growth definition');
  const lines=source.replaceAll('\r\n','\n');
  const marker="  end loop;\n  end if;\n  j:=public.quiz_rewards";
  if(lines.split(marker).length!==2)throw Error('Foundation insertion anchor changed');
  let next=lines.replace(marker,"  end loop;\n  result:=result||public.foundation_milestone_rewards(p_course_id,j);\n  end if;\n  j:=public.quiz_rewards");
  const threshold=" if (leaves>=44 and flowers>=10)";
  if(!next.includes(threshold))throw Error('Growth threshold changed');
  const backfill=` -- Mark historical milestone flowers as part of an already-grown tree's baseline.
 -- This does not replay growth or change earned pet/unlock timestamps.
 if g.user_id is not null and g.foundation_reward_version<1 then
  select coalesce(jsonb_agg(v),'[]'::jsonb) into converted_base
  from jsonb_array_elements(result) v
  where v->>'sourceType'='foundation' and v->>'kind'='flower'
   and (v->>'earnedAt' is null or (v->>'earnedAt')::timestamptz <= (select activated_at from public.foundation_milestone_policy where id))
   and not exists(select 1 from jsonb_array_elements(g.baseline) b where b->>'id'=v->>'id');
  g.baseline:=g.baseline||converted_base;
  for a in select value from jsonb_array_elements(converted_base) loop
   if not exists(select 1 from jsonb_array_elements(g.reward_order) b where b->>'id'=a->>'id') then g.reward_order:=g.reward_order||jsonb_build_array(a);end if;
  end loop;
  update public.garden_growth set baseline=g.baseline,reward_order=g.reward_order,foundation_reward_version=1
   where user_id=uid and course_id=p_course_id returning * into g;
 end if;
`;
  next=next.replace(threshold,backfill+threshold);
  const definitions=FOUNDATION_MILESTONES.map(m=>({milestone_key:m.key,track:m.track,ordinal:m.end,lesson_keys:m.lessonKeys}));
  const definitionJson=JSON.stringify(definitions),digest=createHash('md5').update(lines).digest('hex'),nextDigest=createHash('md5').update(next).digest('hex');
  return `-- Generated from typing-foundation-milestones.mjs and a verified live garden_growth definition.
-- Run only after local QA and explicit release approval. No student progress is rewritten.
begin;
set local lock_timeout='3s';
do $guard$ declare d text; begin
 select pg_get_functiondef('public.garden_growth(text,text)'::regprocedure) into d;
 if md5(replace(d,E'\\r\\n',E'\\n')) not in (${lit(digest)},${lit(nextDigest)}) then
  raise exception 'garden_growth changed; rebase migration on the latest definition';
 end if;
end $guard$;
create table if not exists public.foundation_milestone_policy(id boolean primary key default true check(id),activated_at timestamptz not null default clock_timestamp());
insert into public.foundation_milestone_policy(id) values(true) on conflict do nothing;
create table if not exists public.foundation_milestone_definitions(milestone_key text primary key,track text not null check(track in ('english','zhuyin')),ordinal integer not null,lesson_keys text[] not null);
insert into public.foundation_milestone_definitions select * from jsonb_to_recordset(${lit(definitionJson)}::jsonb) as d(milestone_key text,track text,ordinal integer,lesson_keys text[]) on conflict do nothing;
do $definitions$ begin
 if exists(select 1 from jsonb_to_recordset(${lit(definitionJson)}::jsonb) as d(milestone_key text,track text,ordinal integer,lesson_keys text[])
  left join public.foundation_milestone_definitions c using(milestone_key) where to_jsonb(c) is distinct from to_jsonb(d)) then raise exception 'milestone version conflicts with existing rules';end if;
end $definitions$;
alter table public.foundation_milestone_policy enable row level security;
alter table public.foundation_milestone_definitions enable row level security;
revoke all on public.foundation_milestone_policy,public.foundation_milestone_definitions from public,anon,authenticated;
alter table public.garden_growth add column if not exists foundation_reward_version smallint not null default 0;
alter table public.garden_growth alter column foundation_reward_version set default 1;
create or replace function public.foundation_milestone_rewards(p_course_id text,p_rows jsonb) returns jsonb
language sql stable security definer set search_path='' as $milestones$
 with records as (
  select distinct on (value->>'lesson_key') value r from jsonb_array_elements(coalesce(p_rows,'[]')) with ordinality order by value->>'lesson_key',ordinality desc
 ), earned as (
  select d.*,case when count(coalesce(nullif(r.r->>'completed_at',''),nullif(r.r->>'updated_at','')))=cardinality(d.lesson_keys)
   then max(coalesce(nullif(r.r->>'completed_at',''),nullif(r.r->>'updated_at',''))::timestamptz) end earned_at
  from public.foundation_milestone_definitions d cross join lateral unnest(d.lesson_keys) k(key)
  left join records r on r.r->>'lesson_key'=k.key
  where p_course_id in ('grade3-115-1','grade6-115-1')
  group by d.milestone_key
  having bool_and(coalesce(r.r->'completed'='true'::jsonb,false)) and bool_and(exists(select 1 from public.garden_reward_catalog c where c.course_id=p_course_id and c.week_code='foundation' and c.kind='foundation' and c.activity_key=k.key))
 ) select coalesce(jsonb_agg(jsonb_build_object('id',p_course_id||':foundation:'||milestone_key||':flower:1','kind','flower','sourceType','foundation','track',track,'earnedAt',earned_at) order by track,ordinal),'[]'::jsonb) from earned;
$milestones$;
revoke all on function public.foundation_milestone_rewards(text,jsonb) from public,anon,authenticated;
${next.trimEnd()};
commit;
`;
}
