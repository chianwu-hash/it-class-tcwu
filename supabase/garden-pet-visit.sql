-- Cosmetic visit cooldown only. Never writes rewards or companion preferences.
begin;
create table if not exists public.garden_pet_visits(
 user_id uuid primary key references auth.users(id) on delete cascade,
 next_roll_at timestamptz not null,
 refresh_window_at timestamptz not null,
 refresh_count integer not null default 1 check(refresh_count between 1 and 1000)
);
alter table public.garden_pet_visits enable row level security;
revoke all on public.garden_pet_visits from public,anon,authenticated;
grant all on public.garden_pet_visits to service_role;
create or replace function public.garden_pet_visit(p_course_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();t timestamptz;v public.garden_pet_visits;chosen public.garden_companion_choices;
 eligible boolean;won boolean:=false;rapid boolean:=false;
begin
 if uid is null then raise exception 'authentication_required';end if;
 if p_course_id is null or p_course_id not in('grade3-114-2','grade3-115-1','grade6-115-1') then raise exception 'invalid_request';end if;
 if coalesce(public.is_teacher(),false) or not exists(
  select 1 from auth.users u join public.student_enrollments e on e.email=lower(u.email)
  where u.id=uid and u.email_confirmed_at is not null and e.school_year=115
  and left(e.class_code,1)=substring(p_course_id from 6 for 1)
 ) then raise exception 'student_required';end if;
 -- Same lock as the preference RPC: simultaneous tabs cannot each draw.
 perform pg_advisory_xact_lock(hashtextextended('garden-choices:'||uid::text,0));
 select * into chosen from public.garden_companion_choices where user_id=uid;
 if coalesce(chosen.modes->>chosen.pet,'walk')<>'rest'
  or not exists(select 1 from public.garden_growth where user_id=uid and course_id=p_course_id)
  or not exists(select 1 from public.garden_item_unlocks where user_id=uid and item_key='pet:'||chosen.pet)
 then return jsonb_build_object('surprise',false,'refreshMessage',false);end if;
 t:=clock_timestamp();
 select * into v from public.garden_pet_visits where user_id=uid;
 eligible:=v.user_id is null or t>=v.next_roll_at;
 if eligible then
  won:=random()<0.2;
  insert into public.garden_pet_visits(user_id,next_roll_at,refresh_window_at,refresh_count)
   values(uid,t+interval '5 minutes',t,1)
   on conflict(user_id) do update set next_roll_at=excluded.next_roll_at,refresh_window_at=t,refresh_count=1
   returning * into v;
 else
  if t>=v.refresh_window_at+interval '1 minute' then v.refresh_window_at:=t;v.refresh_count:=1;
  else v.refresh_count:=least(1000,v.refresh_count+1);end if;
  rapid:=v.refresh_count>=3;
  update public.garden_pet_visits set refresh_window_at=v.refresh_window_at,refresh_count=v.refresh_count where user_id=uid;
 end if;
 return jsonb_build_object('surprise',won,'refreshMessage',rapid,'cooldownUntil',v.next_roll_at);
end$$;
revoke all on function public.garden_pet_visit(text) from public,anon;
grant execute on function public.garden_pet_visit(text) to authenticated;
notify pgrst,'reload schema';
commit;
