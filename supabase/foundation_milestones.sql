-- Generated from typing-foundation-milestones.mjs and a verified live garden_growth definition.
-- Run only after local QA and explicit release approval. No student progress is rewritten.
begin;
set local lock_timeout='3s';
do $guard$ declare d text; begin
 select pg_get_functiondef('public.garden_growth(text,text)'::regprocedure) into d;
 if md5(replace(d,E'\r\n',E'\n')) not in ('b98ad726b7d0313059527245cc6e3306','f701643dcfae7f3731222390f6af95f2') then
  raise exception 'garden_growth changed; rebase migration on the latest definition';
 end if;
end $guard$;
create table if not exists public.foundation_milestone_policy(id boolean primary key default true check(id),activated_at timestamptz not null default clock_timestamp());
insert into public.foundation_milestone_policy(id) values(true) on conflict do nothing;
create table if not exists public.foundation_milestone_definitions(milestone_key text primary key,track text not null check(track in ('english','zhuyin')),ordinal integer not null,lesson_keys text[] not null);
insert into public.foundation_milestone_definitions select * from jsonb_to_recordset('[{"milestone_key":"foundation-english-m04-v1","track":"english","ordinal":4,"lesson_keys":["english-home-row-v1","english-top-row-v1","english-bottom-row-v1","english-alphabet-v1"]},{"milestone_key":"foundation-english-m09-v1","track":"english","ordinal":9,"lesson_keys":["english-home-row-v1","english-top-row-v1","english-bottom-row-v1","english-alphabet-v1","english-shift-v1","english-punctuation-v1","english-numbers-v1","english-number-symbols-v1","english-symbols-v1"]},{"milestone_key":"foundation-english-m12-v1","track":"english","ordinal":12,"lesson_keys":["english-home-row-v1","english-top-row-v1","english-bottom-row-v1","english-alphabet-v1","english-shift-v1","english-punctuation-v1","english-numbers-v1","english-number-symbols-v1","english-symbols-v1","english-words-v1","english-sentences-v1","english-finale-v1"]},{"milestone_key":"foundation-zhuyin-m05-v1","track":"zhuyin","ordinal":5,"lesson_keys":["zhuyin-home-v1","zhuyin-top-v1","zhuyin-bottom-v1","zhuyin-number-v1","zhuyin-all-v1"]},{"milestone_key":"foundation-zhuyin-m08-v1","track":"zhuyin","ordinal":8,"lesson_keys":["zhuyin-home-v1","zhuyin-top-v1","zhuyin-bottom-v1","zhuyin-number-v1","zhuyin-all-v1","zhuyin-sounds-v1","zhuyin-words-v1","zhuyin-choose-v1"]},{"milestone_key":"foundation-zhuyin-m12-v1","track":"zhuyin","ordinal":12,"lesson_keys":["zhuyin-home-v1","zhuyin-top-v1","zhuyin-bottom-v1","zhuyin-number-v1","zhuyin-all-v1","zhuyin-sounds-v1","zhuyin-words-v1","zhuyin-choose-v1","zhuyin-sentences-v1","zhuyin-punctuation-v1","zhuyin-edit-v1","zhuyin-finale-v1"]}]'::jsonb) as d(milestone_key text,track text,ordinal integer,lesson_keys text[]) on conflict do nothing;
do $definitions$ begin
 if exists(select 1 from jsonb_to_recordset('[{"milestone_key":"foundation-english-m04-v1","track":"english","ordinal":4,"lesson_keys":["english-home-row-v1","english-top-row-v1","english-bottom-row-v1","english-alphabet-v1"]},{"milestone_key":"foundation-english-m09-v1","track":"english","ordinal":9,"lesson_keys":["english-home-row-v1","english-top-row-v1","english-bottom-row-v1","english-alphabet-v1","english-shift-v1","english-punctuation-v1","english-numbers-v1","english-number-symbols-v1","english-symbols-v1"]},{"milestone_key":"foundation-english-m12-v1","track":"english","ordinal":12,"lesson_keys":["english-home-row-v1","english-top-row-v1","english-bottom-row-v1","english-alphabet-v1","english-shift-v1","english-punctuation-v1","english-numbers-v1","english-number-symbols-v1","english-symbols-v1","english-words-v1","english-sentences-v1","english-finale-v1"]},{"milestone_key":"foundation-zhuyin-m05-v1","track":"zhuyin","ordinal":5,"lesson_keys":["zhuyin-home-v1","zhuyin-top-v1","zhuyin-bottom-v1","zhuyin-number-v1","zhuyin-all-v1"]},{"milestone_key":"foundation-zhuyin-m08-v1","track":"zhuyin","ordinal":8,"lesson_keys":["zhuyin-home-v1","zhuyin-top-v1","zhuyin-bottom-v1","zhuyin-number-v1","zhuyin-all-v1","zhuyin-sounds-v1","zhuyin-words-v1","zhuyin-choose-v1"]},{"milestone_key":"foundation-zhuyin-m12-v1","track":"zhuyin","ordinal":12,"lesson_keys":["zhuyin-home-v1","zhuyin-top-v1","zhuyin-bottom-v1","zhuyin-number-v1","zhuyin-all-v1","zhuyin-sounds-v1","zhuyin-words-v1","zhuyin-choose-v1","zhuyin-sentences-v1","zhuyin-punctuation-v1","zhuyin-edit-v1","zhuyin-finale-v1"]}]'::jsonb) as d(milestone_key text,track text,ordinal integer,lesson_keys text[])
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
CREATE OR REPLACE FUNCTION public.garden_growth(p_course_id text, p_action text DEFAULT 'get'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 uid uuid:=auth.uid(); r record; j jsonb; a jsonb; result jsonb:='[]';
 prefix text; reward_id text; k text; n integer; i integer; units integer;
 pending_id text; pending_i integer; awid text;
 leaves integer; flowers integer; new_leaves integer; new_flowers integer;
 g public.garden_growth; pet boolean:=false; ord jsonb; old_awards jsonb; converted_base jsonb; converted_order jsonb; item_keys jsonb;
begin
 if uid is null then raise exception 'authentication_required';end if;
 if p_course_id not in ('grade3-114-2','grade3-115-1','grade4-115-1','grade6-115-1','grade9-115-1') or p_action not in ('get','seen') then raise exception 'invalid_request';end if;
 if coalesce(public.is_teacher(),false) or not exists(
  select 1 from auth.users u join public.student_enrollments e on e.email=lower(u.email)
  where u.id=uid and u.email_confirmed_at is not null and e.school_year=115
  and left(e.class_code,1)=substring(p_course_id from 6 for 1)
 ) then raise exception 'student_required';end if;
 perform pg_advisory_xact_lock(hashtextextended('garden-growth:'||uid::text,0));
 for r in select c.*,s.completed,s.current_level from public.garden_reward_catalog c
  join public.student_progress s on s.user_id=uid and s.course_id=c.course_id
   and s.week_code=c.week_code and s.activity_key=c.activity_key
  where c.course_id=p_course_id order by c.week_code,c.activity_key
 loop
  prefix:=r.course_id||':'||r.week_code||':'||r.activity_key||':';
  if r.kind='typing' and not (coalesce(r.reward_mode,'')='boss' and r.total_levels=1) then
   n:=greatest(0,least(r.total_levels-1,case when r.completed then r.total_levels-1 else coalesce(r.current_level,0)-1 end));
   for i in 1..n loop result:=result||jsonb_build_array(jsonb_build_object('id',prefix||'typing-leaf:'||i,'kind','typing-leaf'));end loop;
   if r.completed then result:=result||jsonb_build_array(jsonb_build_object('id',prefix||'flower:'||r.total_levels,'kind','flower'));end if;
  elsif r.completed then
   k:=case r.kind when 'typing' then 'flower' when 'quiz' then 'quiz-leaf' when 'practical' then 'practical-leaf' end;
   if k is not null then result:=result||jsonb_build_array(jsonb_build_object('id',prefix||k||':1','kind',k));end if;
  end if;
 end loop;
 if p_course_id in ('grade3-115-1','grade4-115-1','grade6-115-1','grade9-115-1') then
  if p_course_id not in ('grade4-115-1','grade9-115-1') then
  j:=public.typing_foundation_action('list',p_course_id,'{"include_zhuyin":true}');
  for a in select value from jsonb_array_elements(j) loop
   if (a->>'completed')::boolean and exists(select 1 from public.garden_reward_catalog c where c.course_id=p_course_id and c.week_code='foundation' and c.activity_key=a->>'lesson_key' and c.kind='foundation') then result:=result||jsonb_build_array(jsonb_build_object('id',p_course_id||':foundation:'||(a->>'lesson_key')||':foundation-leaf:1','kind','foundation-leaf'));end if;
  end loop;
  result:=result||public.foundation_milestone_rewards(p_course_id,j);
  end if;
  j:=public.quiz_rewards(jsonb_build_object('course_id',p_course_id));
  for a in select value from jsonb_array_elements(coalesce(j->'flowers','[]')) loop
   result:=result||jsonb_build_array(jsonb_build_object('id',p_course_id||':00:practice_'||(a->>'id')||':flower:1','kind','flower','sourceType','past_exam'));
  end loop;
  for a in select value from jsonb_array_elements(j->'awards') loop
   awid:=a->>'id';units:=coalesce((a->>'half_units')::integer,2);
   if units not between 1 and 2000 then raise exception 'invalid_reward';end if;
   for i in 0..units-1 loop
    if pending_id is null then pending_id:=awid;pending_i:=i;
    else
     reward_id:=case when pending_id=awid and units=2 then awid else 'pair:'||pending_id||':'||pending_i||':'||awid||':'||i end;
     result:=result||jsonb_build_array(jsonb_build_object('id',p_course_id||':00:practice_'||reward_id||':quiz-leaf:1','kind','quiz-leaf'));
     pending_id:=null;
    end if;
   end loop;
  end loop;
 end if;
 if p_course_id='grade6-115-1' then
  j:=public.homework_action('list','{}');
  for a in select value from jsonb_array_elements(j->'assignments') loop
   if a->>'course_id'=p_course_id and jsonb_typeof(a->'submission')='object' then
    prefix:=p_course_id||':'||(a->>'week_code')||':homework_'||(a->>'id')||':homework-leaf:';
    result:=result||jsonb_build_array(jsonb_build_object('id',prefix||'1','kind','homework-leaf'));
    if a->'submission'->>'status'='passed' then result:=result||jsonb_build_array(jsonb_build_object('id',prefix||'2','kind','homework-leaf'));end if;
   end if;
  end loop;
  j:=public.reading_action('list','{}');
  for a in select value from jsonb_array_elements(j->'periods') loop
   if a->>'course_id'=p_course_id and jsonb_typeof(a->'submission')='object' then
    prefix:=p_course_id||':'||(a->>'week_code')||':reading_'||(a->>'id')||':homework-leaf:';
    result:=result||jsonb_build_array(jsonb_build_object('id',prefix||'1','kind','homework-leaf'));
    if a->'submission'->>'status'='passed' then result:=result||jsonb_build_array(jsonb_build_object('id',prefix||'2','kind','homework-leaf'));end if;
   end if;
  end loop;
 end if;
 if to_regprocedure('public.garden_test_rewards(text)') is not null then
  result := result || public.garden_test_rewards(p_course_id);
 end if;
 select count(*) filter(where value->>'kind'<>'flower'),count(*) filter(where value->>'kind'='flower') into leaves,flowers from jsonb_array_elements(result);
 select * into g from public.garden_growth where user_id=uid and course_id=p_course_id;
 if g.user_id is not null and g.reward_version<2 then
  if to_regprocedure('public.quiz_rewards_before_past_flowers(jsonb)') is not null then
   old_awards:=public.quiz_rewards_before_past_flowers(jsonb_build_object('course_id',p_course_id))->'awards';
   converted_base:=public.garden_convert_quiz_snapshot(g.baseline,old_awards,p_course_id);
   converted_order:=public.garden_convert_quiz_snapshot(g.reward_order,old_awards,p_course_id);
   update public.garden_growth set baseline=converted_base,reward_order=converted_order,reward_version=2,
    leaf_floor=least(44,(select count(*) from jsonb_array_elements(converted_base) b where b->>'kind'<>'flower')),
    -- A converted past-exam flower replaces an old leaf; it must not also
    -- substitute for a subsequently revoked, previously required boss flower.
    flower_floor=g.flower_floor+
      (select count(*) from jsonb_array_elements(converted_base) b where b->>'kind'='flower')-
      (select count(*) from jsonb_array_elements(g.baseline) b where b->>'kind'='flower')
    where user_id=uid and course_id=p_course_id returning * into g;
  else update public.garden_growth set reward_version=2 where user_id=uid and course_id=p_course_id returning * into g;
  end if;
 end if;
 -- Mark historical milestone flowers as part of an already-grown tree's baseline.
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
 if (leaves>=44 and flowers>=10) or (g.user_id is not null and leaves>=g.leaf_floor and flowers>=g.flower_floor) then
  if g.user_id is null then
   insert into public.garden_growth(user_id,course_id,baseline,reward_order,reward_version) values(uid,p_course_id,result,result,2) returning * into g;
  end if;
  select count(*) filter(where v->>'kind'<>'flower'),count(*) filter(where v->>'kind'='flower') into new_leaves,new_flowers
   from jsonb_array_elements(result) v where not exists(select 1 from jsonb_array_elements(g.baseline) b where b->>'id'=v->>'id');
  ord:=g.reward_order;
  for a in select value from jsonb_array_elements(result) loop
   if not exists(select 1 from jsonb_array_elements(ord) b where b->>'id'=a->>'id') then ord:=ord||jsonb_build_array(a);end if;
  end loop;
  if (new_leaves>=12 or new_flowers>=3) and g.pet_unlocked_at is null then g.pet_unlocked_at:=now();end if;
  if p_action='seen' and g.seen_at is null then g.seen_at:=now();end if;
  update public.garden_growth set reward_order=ord,pet_unlocked_at=g.pet_unlocked_at,seen_at=g.seen_at
   where user_id=uid and course_id=p_course_id and (reward_order is distinct from ord or pet_unlocked_at is distinct from g.pet_unlocked_at or seen_at is distinct from g.seen_at);
  select exists(select 1 from public.garden_growth where user_id=uid and pet_unlocked_at is not null) into pet;
  item_keys:=public.garden_unlock_items(p_course_id,new_leaves,new_flowers);
  return jsonb_build_object('unlockedItems',item_keys,'level',2,'petUnlocked',pet,'seen',g.seen_at is not null,'baseline',g.baseline,'order',ord,'newLeaves',new_leaves,'newFlowers',new_flowers);
 end if;
 return jsonb_build_object('level',1);
end$function$;
commit;
