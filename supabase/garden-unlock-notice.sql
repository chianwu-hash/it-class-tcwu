begin;
create table if not exists public.garden_unlock_notices(
 user_id uuid not null references auth.users(id) on delete cascade,
 event_key text not null check(event_key='pet-home'),course_id text not null,
 created_at timestamptz not null default now(),seen_at timestamptz,
 claim_id uuid,claim_until timestamptz,primary key(user_id,event_key)
);
alter table public.garden_unlock_notices enable row level security;
revoke all on public.garden_unlock_notices from public,anon,authenticated;
grant all on public.garden_unlock_notices to service_role;
-- Existing unlocks are not new surprises. Reapplying never consumes pending notices.
insert into public.garden_unlock_notices(user_id,event_key,course_id,seen_at)
 select distinct on(user_id) user_id,'pet-home',course_id,now() from public.garden_growth
 where pet_unlocked_at is not null order by user_id,pet_unlocked_at
 on conflict(user_id,event_key) do nothing;
create or replace function public.garden_unlock_notice(p_course_id text default null,p_action text default 'pending',p_claim uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();n public.garden_unlock_notices;g jsonb;
begin
 if uid is null then raise exception 'authentication_required';end if;
 if coalesce(public.is_teacher(),false) or not exists(select 1 from auth.users u join public.student_enrollments e on e.email=lower(u.email)
  where u.id=uid and u.email_confirmed_at is not null and e.school_year=115 and left(e.class_code,1) in('3','6')) then raise exception 'student_required';end if;
 if p_action not in('check','pending','claim','ack') then raise exception 'invalid_action';end if;
 if p_action='check' then
  if p_course_id not in('grade3-114-2','grade3-115-1','grade6-115-1') or p_course_id is null then raise exception 'invalid_course';end if;
  if exists(select 1 from public.garden_growth where user_id=uid and course_id=p_course_id) then
   g:=public.garden_growth(p_course_id,'get');
   if coalesce((g->>'petUnlocked')::boolean,false) then
    insert into public.garden_unlock_notices(user_id,event_key,course_id) values(uid,'pet-home',p_course_id) on conflict(user_id,event_key) do nothing;
   end if;
  end if;
 elsif p_action='claim' then
  update public.garden_unlock_notices set claim_id=gen_random_uuid(),claim_until=now()+interval '2 minutes'
   where user_id=uid and seen_at is null and (claim_until is null or claim_until<now()) returning * into n;
  if n.user_id is null then return null;end if;
 elsif p_action='ack' then
  update public.garden_unlock_notices set seen_at=now(),claim_until=null where user_id=uid and seen_at is null and claim_id=p_claim;
  return null;
 end if;
 if p_action<>'claim' then select * into n from public.garden_unlock_notices where user_id=uid and seen_at is null;end if;
 if n.user_id is null then return null;end if;
 return jsonb_build_object('key',n.event_key,'courseId',n.course_id,'claim',n.claim_id);
end$$;
revoke all on function public.garden_unlock_notice(text,text,uuid) from public,anon;
grant execute on function public.garden_unlock_notice(text,text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
