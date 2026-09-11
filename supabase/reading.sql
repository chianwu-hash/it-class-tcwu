begin;
-- Reading periods are explicit semester weeks, not automatically generated calendar weeks.
create table if not exists public.reading_periods (
 id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references auth.users(id),
 course_id text not null default 'grade6-115-1' check(course_id='grade6-115-1'),
 week_code text not null check(week_code ~ '^(0[1-9]|1[0-9]|2[0-2])$'),
 starts_on date not null, ends_on date not null, enabled boolean not null default true,
 check(ends_on>=starts_on and ends_on-starts_on<=6), unique(course_id,week_code)
);
create table if not exists public.reading_versions (
 id uuid primary key, period_id uuid not null references public.reading_periods(id),
 user_id uuid not null references auth.users(id),
 source text not null check(source in ('school_library','parent_platform')),
 book text not null check(length(trim(book)) between 1 and 100),
 reflection text not null check(length(trim(reflection)) between 1 and 500),
 submitted_at timestamptz not null default now(),
 status text not null default 'submitted' check(status in ('submitted','passed','needs_revision')),
 feedback text not null default '' check(length(feedback)<=2000),
 review_seq integer not null default 0, reviewed_at timestamptz,
 unique(id,period_id,user_id)
);
create table if not exists public.reading_submissions (
 period_id uuid not null references public.reading_periods(id), user_id uuid not null references auth.users(id),
 version_id uuid not null, primary key(period_id,user_id),
 foreign key(version_id,period_id,user_id) references public.reading_versions(id,period_id,user_id)
);
create table if not exists public.reading_events (
 id bigint generated always as identity primary key, version_id uuid not null references public.reading_versions(id),
 actor_id uuid not null references auth.users(id), event text not null,
 feedback text not null default '', created_at timestamptz not null default now()
);
create index if not exists reading_versions_history on public.reading_versions(period_id,user_id,submitted_at);
alter table public.reading_periods enable row level security;
alter table public.reading_versions enable row level security;
alter table public.reading_submissions enable row level security;
alter table public.reading_events enable row level security;
revoke all on public.reading_periods,public.reading_versions,public.reading_submissions,public.reading_events from public,anon,authenticated;
grant all on public.reading_periods,public.reading_versions,public.reading_submissions,public.reading_events to service_role;
grant usage,select on sequence public.reading_events_id_seq to service_role;

create or replace function public.reading_action(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare
 uid uuid:=auth.uid(); teacher boolean:=coalesce(public.is_teacher(),false); v_email text; cls text;
 today date:=(now() at time zone 'Asia/Taipei')::date; p public.reading_periods;
 v public.reading_versions; s public.reading_submissions; target uuid; result jsonb;
 rid uuid; newstatus text; newfeedback text; firstdate date; lastdate date; wk text;
begin
 if uid is null then raise exception 'login_required'; end if;
 select lower(u.email) into v_email from auth.users u where u.id=uid and u.email_confirmed_at is not null;
 if v_email is null then raise exception 'login_required'; end if;
 select e.class_code into cls from public.student_enrollments e where e.school_year=115 and e.email=v_email and e.class_code like '6%';
 if not teacher and cls is null then raise exception 'roster_required'; end if;
 if p_action='list' then
   select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('current',today between r.starts_on and r.ends_on,
    'submission',(select to_jsonb(v) from public.reading_submissions s join public.reading_versions v on v.id=s.version_id where s.period_id=r.id and s.user_id=uid)) order by r.week_code),'[]') into result
   from public.reading_periods r where (teacher and r.owner_user_id=uid) or
    (not teacher and r.starts_on<=today and (r.enabled or exists(select 1 from public.reading_submissions s where s.period_id=r.id and s.user_id=uid)));
   return jsonb_build_object('periods',result,'teacher',teacher,'today',today);
 end if;
 if p_action='configure' then
   if not teacher then raise exception 'teacher_required'; end if;
   perform pg_advisory_xact_lock(1156001);
   wk:=p_data->>'week_code';firstdate:=(p_data->>'starts_on')::date;lastdate:=(p_data->>'ends_on')::date;
   if wk is null or wk !~ '^(0[1-9]|1[0-9]|2[0-2])$' or firstdate is null or lastdate is null or
    firstdate < date '2026-08-01' or lastdate > date '2027-02-28' or lastdate<firstdate or lastdate-firstdate>6 then raise exception 'invalid_period'; end if;
   select * into p from public.reading_periods where course_id='grade6-115-1' and week_code=wk for update;
   if p.id is not null then
    if p.owner_user_id<>uid then raise exception 'teacher_required'; end if;
    if exists(select 1 from public.reading_submissions where period_id=p.id) and (p.starts_on<>firstdate or p.ends_on<>lastdate) then raise exception 'period_has_submissions'; end if;
   end if;
   if exists(select 1 from public.reading_periods r where r.week_code<>wk and r.starts_on<=lastdate and r.ends_on>=firstdate) then raise exception 'period_overlap'; end if;
   insert into public.reading_periods(owner_user_id,week_code,starts_on,ends_on,enabled) values(uid,wk,firstdate,lastdate,coalesce((p_data->>'enabled')::boolean,true))
    on conflict(course_id,week_code) do update set starts_on=excluded.starts_on,ends_on=excluded.ends_on,enabled=excluded.enabled;
   return jsonb_build_object('ok',true);
 end if;
 select * into p from public.reading_periods where id=(p_data->>'period_id')::uuid for update;
 if p.id is null or (teacher and p.owner_user_id<>uid) or (not teacher and p.starts_on>today) then raise exception 'period_unavailable'; end if;
 if p_action='roster' then
   if not teacher then raise exception 'teacher_required'; end if;
   select coalesce(jsonb_agg(to_jsonb(v)||jsonb_build_object('display_name',e.display_name,'seat_no',e.seat_no,'class_code',e.class_code) order by e.class_code,e.seat_no),'[]') into result
    from public.reading_submissions s join public.reading_versions v on v.id=s.version_id join auth.users u on u.id=s.user_id
    join public.student_enrollments e on e.email=lower(u.email) and e.school_year=115 and e.class_code like '6%'
    where s.period_id=p.id;
   return jsonb_build_object('students',result);
 end if;
 target:=case when teacher then (p_data->>'user_id')::uuid else uid end;
 if target is null then raise exception 'invalid_request'; end if;
 select * into s from public.reading_submissions where period_id=p.id and user_id=target for update;
 if p_action='history' then
   if not teacher and not p.enabled and s.version_id is null then raise exception 'period_unavailable'; end if;
   select coalesce(jsonb_agg(to_jsonb(v)||jsonb_build_object('latest',v.id=s.version_id) order by v.submitted_at desc,v.id),'[]') into result from public.reading_versions v where v.period_id=p.id and v.user_id=target;
   return jsonb_build_object('versions',result);
 end if;
 if p_action='submit' then
   if teacher then raise exception 'student_required'; end if;
   if not p.enabled then raise exception 'period_unavailable'; end if;
   rid:=(p_data->>'id')::uuid;
   if rid is null then raise exception 'invalid_request'; end if;
   select * into v from public.reading_versions where id=rid;
   if v.id is not null then
    if v.user_id<>uid or v.period_id<>p.id or v.source is distinct from p_data->>'source' or v.book is distinct from trim(p_data->>'book') or v.reflection is distinct from trim(p_data->>'reflection') then raise exception 'submission_conflict'; end if;
    return jsonb_build_object('ok',true,'id',v.id);
   end if;
   if s.version_id is distinct from (p_data->>'expected_version')::uuid then raise exception 'version_changed'; end if;
   insert into public.reading_versions(id,period_id,user_id,source,book,reflection) values(rid,p.id,uid,p_data->>'source',trim(p_data->>'book'),trim(p_data->>'reflection'));
   insert into public.reading_submissions(period_id,user_id,version_id) values(p.id,uid,rid) on conflict(period_id,user_id) do update set version_id=excluded.version_id;
   insert into public.reading_events(version_id,actor_id,event) values(rid,uid,'submitted');
   return jsonb_build_object('ok',true,'id',rid);
 end if;
 if p_action='review' then
   if not teacher then raise exception 'teacher_required'; end if;
   if s.version_id is null or s.version_id is distinct from (p_data->>'version_id')::uuid then raise exception 'version_changed'; end if;
   select * into v from public.reading_versions where id=s.version_id for update;
   if v.review_seq is distinct from (p_data->>'review_seq')::integer then raise exception 'review_changed'; end if;
   newstatus:=coalesce(p_data->>'status',v.status);newfeedback:=coalesce(p_data->>'feedback',v.feedback);
   if newstatus not in ('submitted','passed','needs_revision') or length(newfeedback)>2000 then raise exception 'invalid_review'; end if;
   if newstatus<>v.status or newfeedback<>v.feedback then
    update public.reading_versions set status=newstatus,feedback=newfeedback,review_seq=review_seq+1,reviewed_at=case when newstatus='submitted' then null else now() end where id=v.id;
    insert into public.reading_events(version_id,actor_id,event,feedback) values(v.id,uid,newstatus,newfeedback);
   end if;
   return jsonb_build_object('ok',true);
 end if;
 raise exception 'invalid_action';
end $$;
revoke all on function public.reading_action(text,jsonb) from public,anon;
grant execute on function public.reading_action(text,jsonb) to authenticated;
commit;
