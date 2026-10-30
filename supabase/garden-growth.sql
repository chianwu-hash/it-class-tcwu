-- Additive cosmetic state only. Existing progress, awards and integrity stay intact.
begin;
create table if not exists public.garden_reward_catalog(
 course_id text not null,week_code text not null,activity_key text not null,
 kind text not null,total_levels integer not null,reward_mode text,
 primary key(course_id,week_code,activity_key)
);
create table if not exists public.garden_growth(
 user_id uuid not null references auth.users(id) on delete cascade,course_id text not null,
 grown_at timestamptz not null default now(),baseline jsonb not null,
 reward_order jsonb not null,seen_at timestamptz,pet_unlocked_at timestamptz,
 primary key(user_id,course_id)
);
alter table public.garden_reward_catalog enable row level security;
alter table public.garden_growth enable row level security;
revoke all on public.garden_reward_catalog,public.garden_growth from public,anon,authenticated;
grant all on public.garden_reward_catalog,public.garden_growth to service_role;

create or replace function public.garden_growth(p_course_id text,p_action text default 'get') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); r record; j jsonb; a jsonb; result jsonb:='[]';
 prefix text; reward_id text; k text; n integer; i integer; units integer;
 pending_id text; pending_i integer; awid text;
 leaves integer; flowers integer; new_leaves integer; new_flowers integer;
 g public.garden_growth; pet boolean:=false; ord jsonb;
begin
 if uid is null then raise exception 'authentication_required';end if;
 if p_course_id not in ('grade3-114-2','grade3-115-1','grade6-115-1') or p_action not in ('get','seen') then raise exception 'invalid_request';end if;
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
 if p_course_id in ('grade3-115-1','grade6-115-1') then
  j:=public.typing_foundation_action('list',p_course_id,'{"include_zhuyin":true}');
  for a in select value from jsonb_array_elements(j) loop
   if (a->>'completed')::boolean and exists(select 1 from public.garden_reward_catalog c where c.course_id=p_course_id and c.week_code='foundation' and c.activity_key=a->>'lesson_key' and c.kind='foundation') then result:=result||jsonb_build_array(jsonb_build_object('id',p_course_id||':foundation:'||(a->>'lesson_key')||':foundation-leaf:1','kind','foundation-leaf'));end if;
  end loop;
  j:=public.quiz_rewards(jsonb_build_object('course_id',p_course_id));
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
 if leaves>=44 and flowers>=10 then
  if g.user_id is null then
   insert into public.garden_growth(user_id,course_id,baseline,reward_order) values(uid,p_course_id,result,result) returning * into g;
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
  return jsonb_build_object('level',2,'petUnlocked',pet,'seen',g.seen_at is not null,'baseline',g.baseline,'order',ord,'newLeaves',new_leaves,'newFlowers',new_flowers);
 end if;
 return jsonb_build_object('level',1);
end$$;
revoke all on function public.garden_growth(text,text) from public,anon;
grant execute on function public.garden_growth(text,text) to authenticated;
notify pgrst,'reload schema';
commit;
