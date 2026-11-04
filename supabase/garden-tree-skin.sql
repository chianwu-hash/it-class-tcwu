-- Additive cosmetic preference only; does not alter progress or growth RPCs.
begin;
create table if not exists public.garden_tree_skins(
 user_id uuid primary key references auth.users(id) on delete cascade,
 skin text not null default 'a' check(skin in('a','b')),
 updated_at timestamptz not null default now()
);
alter table public.garden_tree_skins enable row level security;
revoke all on public.garden_tree_skins from public,anon,authenticated;
grant all on public.garden_tree_skins to service_role;
create or replace function public.garden_tree_skin(p_skin text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); chosen text;
begin
 if uid is null then raise exception 'authentication_required';end if;
 if coalesce(public.is_teacher(),false) or not exists(
  select 1 from auth.users u join public.student_enrollments e on e.email=lower(u.email)
  where u.id=uid and u.email_confirmed_at is not null and e.school_year=115 and left(e.class_code,1) in('3','6')
 ) then raise exception 'student_required';end if;
 if not exists(select 1 from public.garden_growth where user_id=uid) then raise exception 'level_two_required';end if;
 if p_skin is not null then
  if p_skin not in('a','b') then raise exception 'invalid_skin';end if;
  insert into public.garden_tree_skins(user_id,skin) values(uid,p_skin)
   on conflict(user_id) do update set skin=excluded.skin,updated_at=now()
   where garden_tree_skins.skin is distinct from excluded.skin;
 end if;
 select skin into chosen from public.garden_tree_skins where user_id=uid;
 return jsonb_build_object('skin',coalesce(chosen,'a'));
end$$;
revoke all on function public.garden_tree_skin(text) from public,anon;
grant execute on function public.garden_tree_skin(text) to authenticated;
notify pgrst,'reload schema';
commit;
