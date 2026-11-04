begin;
-- Pure helpers; callers supply server-owned awards, never client counts.
create or replace function public.garden_quiz_leaf_map(awards jsonb,course text) returns jsonb
language plpgsql immutable set search_path='' as $$
declare a jsonb;pending text;awid text;units int;i int;key text;rid text;result jsonb:='[]';
begin
 for a in select value from jsonb_array_elements(coalesce(awards,'[]')) loop
  awid:=a->>'id';units:=coalesce((a->>'half_units')::int,2);
  if awid is null or units not between 1 and 2000 then raise exception 'invalid_reward';end if;
  for i in 0..units-1 loop
   key:=awid||':'||i;
   if pending is null then pending:=key;
   else
    rid:=case when pending=awid||':0' and i=1 and units=2 then awid else 'pair:'||pending||':'||key end;
    result:=result||jsonb_build_array(jsonb_build_object('id',course||':00:practice_'||rid||':quiz-leaf:1','kind','quiz-leaf','halves',jsonb_build_array(pending,key)));
    pending:=null;
   end if;
  end loop;
 end loop;
 return result;
end$$;

-- Rebuild only quiz identities. Every retained half contribution must already
-- belong to the old snapshot; removing past-exam halves cannot create new effort.
create or replace function public.garden_convert_quiz_snapshot(snapshot jsonb,old_awards jsonb,course text) returns jsonb
language plpgsql immutable set search_path='' as $$
declare oldmap jsonb;newmap jsonb;owned jsonb;normal jsonb;a jsonb;r jsonb;result jsonb;
begin
 oldmap:=public.garden_quiz_leaf_map(old_awards,course);
 select coalesce(jsonb_agg(x.a order by x.n),'[]') into normal from jsonb_array_elements(old_awards) with ordinality x(a,n) where x.a->>'source_type' is distinct from 'past_exam';
 newmap:=public.garden_quiz_leaf_map(normal,course);
 select coalesce(jsonb_agg(distinct h),'[]') into owned from jsonb_array_elements(oldmap) m cross join lateral jsonb_array_elements(m->'halves') h
 where exists(select 1 from jsonb_array_elements(snapshot) s where s->>'id'=m->>'id');
 select coalesce(jsonb_agg(s order by n),'[]') into result from jsonb_array_elements(snapshot) with ordinality x(s,n) where s->>'kind'<>'quiz-leaf' or not exists(select 1 from jsonb_array_elements(oldmap) m where m->>'id'=s->>'id');
 for r in select value from jsonb_array_elements(newmap) loop
  if owned @> (r->'halves') then result:=result||jsonb_build_array(r-'halves');end if;
 end loop;
 for a in select value from jsonb_array_elements(old_awards) where value->>'source_type'='past_exam' loop
  if owned @> jsonb_build_array((a->>'id')||':0') or owned @> jsonb_build_array((a->>'id')||':1') then
   result:=result||jsonb_build_array(jsonb_build_object('id',course||':00:practice_'||(a->>'id')||':flower:1','kind','flower','sourceType','past_exam'));
  end if;
 end loop;
 return result;
end$$;
revoke all on function public.garden_quiz_leaf_map(jsonb,text),public.garden_convert_quiz_snapshot(jsonb,jsonb,text) from public,anon,authenticated;
alter table public.garden_growth add column if not exists reward_version integer not null default 1;
alter table public.garden_growth add column if not exists leaf_floor integer not null default 44;
alter table public.garden_growth add column if not exists flower_floor integer not null default 10;
commit;
