begin;

create table if not exists public.homework_settings (
 id boolean primary key default true check(id),
 max_file_bytes integer not null default 104857600 check(max_file_bytes between 1048576 and 524288000)
);
insert into public.homework_settings(id) values(true) on conflict do nothing;
alter table public.homework_settings enable row level security;
revoke all on public.homework_settings from public,anon,authenticated;
grant all on public.homework_settings to service_role;

create table if not exists public.homework_assignments (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references auth.users(id),
 course_id text not null default 'grade6-115-1' check(course_id='grade6-115-1'),
 week_code text not null check(week_code ~ '^(0[1-9]|1[0-9]|2[0-2])$'),
 title text not null check(length(trim(title)) between 1 and 100),
 instructions text not null default '' check(length(instructions)<=3000),
 class_code text not null check(class_code='*' or class_code ~ '^6[0-9]{2}$'),
 state text not null default 'draft' check(state in ('draft','open','closed')),
 drive_folder_id text unique,
 created_at timestamptz not null default now()
);
create table if not exists public.homework_uploads (
 id uuid primary key,
 assignment_id uuid not null references public.homework_assignments(id),
 user_id uuid not null references auth.users(id),
 drive_file_id text not null unique,
 file_name text not null check(length(file_name) between 1 and 160),
 file_size integer not null check(file_size between 1 and 524288000),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '24 hours',
 resume_uri text,
 submitted_at timestamptz
);
create index if not exists homework_upload_owner on public.homework_uploads(assignment_id,user_id);
create table if not exists public.homework_submissions (
 assignment_id uuid not null references public.homework_assignments(id),
 user_id uuid not null references auth.users(id),
 upload_id uuid not null references public.homework_uploads(id),
 status text not null check(status in ('submitted','passed','needs_revision')),
 feedback text not null default '' check(length(feedback)<=2000),
 submitted_at timestamptz not null,
 reviewed_at timestamptz,
 primary key(assignment_id,user_id)
);
create table if not exists public.homework_events (
 id bigint generated always as identity primary key,
 assignment_id uuid not null references public.homework_assignments(id),
 user_id uuid not null references auth.users(id),
 upload_id uuid not null references public.homework_uploads(id),
 actor_id uuid not null references auth.users(id),
 event text not null check(event in ('submitted','passed','needs_revision')),
 feedback text not null default '',
 created_at timestamptz not null default now()
);
alter table public.homework_assignments enable row level security;
alter table public.homework_uploads enable row level security;
alter table public.homework_submissions enable row level security;
alter table public.homework_events enable row level security;
revoke all on public.homework_assignments,public.homework_uploads,public.homework_submissions,public.homework_events from public,anon,authenticated;
grant all on public.homework_assignments,public.homework_uploads,public.homework_submissions,public.homework_events to service_role;
grant usage,select on sequence public.homework_events_id_seq to service_role;

-- RPC is the only browser entry point. Never accept a caller-provided user id.
create or replace function public.homework_action(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare
 uid uuid:=auth.uid(); teacher boolean:=public.is_teacher();
 v_email text; cls text; a public.homework_assignments; s public.homework_submissions; result jsonb;
begin
 if uid is null then raise exception 'login_required'; end if;
 select lower(u.email) into v_email from auth.users u where u.id=uid and u.email_confirmed_at is not null;
 if v_email is null then raise exception 'login_required'; end if;
 select e.class_code into cls from public.student_enrollments e where e.school_year=115 and e.email=v_email and e.class_code like '6%';
 if p_action='list' then
   if not teacher and cls is null then raise exception 'roster_required'; end if;
   select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'instructions',a.instructions,
     'week_code',a.week_code,'class_code',a.class_code,'state',a.state,'course_id',a.course_id,
     'submission',(select jsonb_build_object('upload_id',s.upload_id,'status',s.status,'feedback',s.feedback,
       'submitted_at',s.submitted_at,'reviewed_at',s.reviewed_at,'file_name',u.file_name)
       from public.homework_submissions s join public.homework_uploads u on u.id=s.upload_id where s.assignment_id=a.id and s.user_id=uid)
     ) order by a.week_code,a.created_at),'[]') into result
   from public.homework_assignments a where (teacher and a.owner_user_id=uid) or
     (not teacher and a.state<>'draft' and a.class_code in ('*',cls));
   return jsonb_build_object('assignments',result,'teacher',teacher,'class_code',cls,'max_file_bytes',(select max_file_bytes from public.homework_settings where id));
 end if;
 if p_action='create' then
   if not teacher then raise exception 'teacher_required'; end if;
   if not exists(select 1 from public.drive_connections where owner_user_id=uid) then raise exception 'drive_required'; end if;
   insert into public.homework_assignments(owner_user_id,week_code,title,instructions,class_code)
     values(uid,p_data->>'week_code',trim(p_data->>'title'),coalesce(p_data->>'instructions',''),p_data->>'class_code') returning * into a;
   return to_jsonb(a);
 end if;
 select * into a from public.homework_assignments where id=(p_data->>'assignment_id')::uuid for update;
 if a.id is null then raise exception 'assignment_unavailable'; end if;
 if p_action='upload_context' then
   if cls is null or a.class_code not in ('*',cls) or a.state<>'open' or a.drive_folder_id is null then raise exception 'assignment_unavailable'; end if;
   return to_jsonb(a) || jsonb_build_object('max_file_bytes',(select max_file_bytes from public.homework_settings where id));
 end if;
 if not teacher or a.owner_user_id<>uid then raise exception 'teacher_required'; end if;
 if p_action='context' then return to_jsonb(a); end if;
 if p_action='set_state' then
   if p_data->>'state' not in ('open','closed') or (p_data->>'state'='open' and a.drive_folder_id is null) then raise exception 'invalid_state'; end if;
   update public.homework_assignments set state=p_data->>'state' where id=a.id;
   return jsonb_build_object('ok',true);
 end if;
 if p_action='roster' then
   select coalesce(jsonb_agg(jsonb_build_object('email',e.email,'class_code',e.class_code,'seat_no',e.seat_no,'display_name',e.display_name,
     'user_id',u.id,'status',coalesce(s.status,'missing'),'upload_id',s.upload_id,'feedback',s.feedback,
     'submitted_at',s.submitted_at,'file_name',f.file_name,'drive_file_id',f.drive_file_id)
     order by e.class_code,e.seat_no),'[]') into result
   from public.student_enrollments e left join auth.users u on lower(u.email)=e.email
   left join public.homework_submissions s on s.user_id=u.id and s.assignment_id=a.id
   left join public.homework_uploads f on f.id=s.upload_id
   where e.school_year=115 and e.class_code like '6%' and a.class_code in ('*',e.class_code);
   return jsonb_build_object('assignment',to_jsonb(a),'students',result);
 end if;
 if p_action='review' then
   if p_data->>'status' not in ('passed','needs_revision') or length(coalesce(p_data->>'feedback',''))>2000 then raise exception 'invalid_review'; end if;
   select * into s from public.homework_submissions where assignment_id=a.id and user_id=(p_data->>'user_id')::uuid for update;
   if s.upload_id is null or s.upload_id is distinct from (p_data->>'upload_id')::uuid then raise exception 'version_changed'; end if;
   if s.status=p_data->>'status' and s.feedback=coalesce(p_data->>'feedback','') then return jsonb_build_object('ok',true); end if;
   update public.homework_submissions set status=p_data->>'status',feedback=coalesce(p_data->>'feedback',''),reviewed_at=now()
     where assignment_id=a.id and user_id=s.user_id;
   insert into public.homework_events(assignment_id,user_id,upload_id,actor_id,event,feedback)
     values(a.id,s.user_id,s.upload_id,uid,p_data->>'status',coalesce(p_data->>'feedback',''));
   return jsonb_build_object('ok',true);
 end if;
 raise exception 'invalid_action';
end $$;
revoke all on function public.homework_action(text,jsonb) from public,anon;
grant execute on function public.homework_action(text,jsonb) to authenticated;

-- Only the authenticated Edge Function may reserve/finalize. Locks serialize
-- publication, upload finalization and review for the same assignment.
create or replace function public.homework_reserve(p_user uuid,p_assignment uuid,p_id uuid,p_drive_id text,p_name text,p_size integer,p_sha256 text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.homework_assignments; u public.homework_uploads; cls text;
begin
 if p_size>(select max_file_bytes from public.homework_settings where id) then raise exception 'file_size'; end if;
 select * into a from public.homework_assignments where id=p_assignment for update;
 select e.class_code into cls from public.student_enrollments e join auth.users x on lower(x.email)=e.email
   where x.id=p_user and x.email_confirmed_at is not null and e.school_year=115 and e.class_code like '6%';
 if cls is null or a.id is null or a.state<>'open' or a.drive_folder_id is null or a.class_code not in ('*',cls) then raise exception 'assignment_unavailable'; end if;
 select * into u from public.homework_uploads where id=p_id;
 if u.id is not null then
   if u.user_id<>p_user or u.assignment_id<>p_assignment or u.sha256<>p_sha256 or u.file_name<>p_name or u.file_size<>p_size then raise exception 'upload_conflict'; end if;
   return to_jsonb(u);
 end if;
 -- A new attempt explicitly replaces any unfinished attempt for this assignment.
 update public.homework_uploads set expires_at=now() where assignment_id=p_assignment and user_id=p_user and submitted_at is null and expires_at>now();
 if (select count(*) from public.homework_uploads where assignment_id=p_assignment and user_id=p_user and created_at>now()-interval '1 hour')>=10 then raise exception 'upload_limit'; end if;
 insert into public.homework_uploads(id,assignment_id,user_id,drive_file_id,file_name,file_size,sha256)
   values(p_id,p_assignment,p_user,p_drive_id,p_name,p_size,p_sha256) returning * into u;
 return to_jsonb(u);
end $$;
create or replace function public.homework_finalize(p_user uuid,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u public.homework_uploads; a public.homework_assignments; cls text;
begin
 select * into u from public.homework_uploads where id=p_id and user_id=p_user;
 if u.id is null then raise exception 'upload_unavailable'; end if;
 select * into a from public.homework_assignments where id=u.assignment_id for update;
 select * into u from public.homework_uploads where id=p_id for update;
 if u.submitted_at is not null then return jsonb_build_object('ok',true); end if;
 select e.class_code into cls from public.student_enrollments e join auth.users x on lower(x.email)=e.email
   where x.id=p_user and e.school_year=115 and e.class_code like '6%';
 if cls is null or a.class_code not in ('*',cls) or a.state<>'open' or u.expires_at<=now() then raise exception 'upload_expired'; end if;
 update public.homework_uploads set submitted_at=now() where id=p_id;
 insert into public.homework_submissions(assignment_id,user_id,upload_id,status,submitted_at)
   values(u.assignment_id,p_user,p_id,'submitted',now()) on conflict(assignment_id,user_id)
   do update set upload_id=excluded.upload_id,status='submitted',feedback='',submitted_at=excluded.submitted_at,reviewed_at=null;
 insert into public.homework_events(assignment_id,user_id,upload_id,actor_id,event) values(u.assignment_id,p_user,p_id,p_user,'submitted');
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.homework_reserve(uuid,uuid,uuid,text,text,integer,text),public.homework_finalize(uuid,uuid) from public,anon,authenticated;
grant execute on function public.homework_reserve(uuid,uuid,uuid,text,text,integer,text),public.homework_finalize(uuid,uuid) to service_role;
commit;
