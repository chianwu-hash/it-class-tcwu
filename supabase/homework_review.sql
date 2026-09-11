begin;
create table if not exists public.homework_annotations (
 upload_id uuid primary key references public.homework_uploads(id),
 strokes jsonb not null default '[]',
 feedback text not null default '' check(length(feedback)<=2000),
 updated_at timestamptz not null default now()
);
alter table public.homework_annotations enable row level security;
revoke all on public.homework_annotations from public,anon,authenticated;
grant all on public.homework_annotations to service_role;

create or replace function public.homework_review(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); teacher boolean:=coalesce(public.is_teacher(),false);
 a public.homework_assignments; u public.homework_uploads; s public.homework_submissions;
 target uuid; cls text; result jsonb; lines jsonb; line jsonb; pt jsonb;
 v_feedback text; newstatus text;
begin
 if uid is null or not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null) then raise exception 'login_required'; end if;
 select * into a from public.homework_assignments where id=(p_data->>'assignment_id')::uuid for update;
 if a.id is null then raise exception 'assignment_unavailable'; end if;
 if teacher then
  if a.owner_user_id<>uid then raise exception 'teacher_required'; end if;
  target:=(p_data->>'user_id')::uuid;
 else
  target:=uid;
  if p_data ? 'user_id' and (p_data->>'user_id')::uuid<>uid then raise exception 'teacher_required'; end if;
  select e.class_code into cls from public.student_enrollments e join auth.users x on lower(x.email)=e.email where x.id=uid and e.school_year=115;
  if cls is null or cls not like '6%' or a.class_code not in ('*',cls) or a.state='draft' then raise exception 'assignment_unavailable'; end if;
 end if;
 if p_action='history' then
  select coalesce(jsonb_agg(v order by v->>'submitted_at',v->>'id'),'[]') into result from (
   select jsonb_build_object('id',f.id,'file_name',f.file_name,'file_size',f.file_size,'submitted_at',f.submitted_at,
    'latest',f.id=sub.upload_id,'status',case when f.id=sub.upload_id then sub.status else coalesce(ev.event,'submitted') end,
    'feedback',coalesce(an.feedback,case when f.id=sub.upload_id then sub.feedback else ev.feedback end,''),
    'strokes',coalesce(an.strokes,'[]'::jsonb),'annotation_updated_at',an.updated_at) v
   from public.homework_uploads f
   left join public.homework_submissions sub on sub.assignment_id=f.assignment_id and sub.user_id=f.user_id
   left join public.homework_annotations an on an.upload_id=f.id
   left join lateral (select event,feedback from public.homework_events e where e.upload_id=f.id order by e.id desc limit 1) ev on true
   where f.assignment_id=a.id and f.user_id=target and f.submitted_at is not null
  ) rows;
  return jsonb_build_object('versions',result,'teacher',teacher);
 end if;
 select * into u from public.homework_uploads where id=(p_data->>'upload_id')::uuid and assignment_id=a.id and submitted_at is not null;
 if u.id is null or (not teacher and u.user_id<>uid) then raise exception 'assignment_unavailable'; end if;
 if p_action='media_context' then
  return jsonb_build_object('owner_user_id',a.owner_user_id,'drive_file_id',u.drive_file_id,'file_name',u.file_name,'file_size',u.file_size);
 end if;
 if p_action<>'save' or not teacher then raise exception 'teacher_required'; end if;
 select * into s from public.homework_submissions where assignment_id=a.id and user_id=u.user_id for update;
 if s.upload_id is distinct from u.id then raise exception 'version_changed'; end if;
 if p_data ? 'feedback' or p_data ? 'strokes' then
  -- Optimistic lock prevents another tab from silently overwriting a saved annotation.
  if (select updated_at from public.homework_annotations where upload_id=u.id) is distinct from (p_data->>'annotation_updated_at')::timestamptz then raise exception 'version_changed'; end if;
  v_feedback:=coalesce(p_data->>'feedback',s.feedback);lines:=coalesce(p_data->'strokes','[]'::jsonb);
  if length(v_feedback)>2000 or jsonb_typeof(lines)<>'array' or octet_length(lines::text)>250000 then raise exception 'invalid_review'; end if;
  if jsonb_array_length(lines)>300 then raise exception 'invalid_review'; end if;
  for line in select value from jsonb_array_elements(lines) loop
   if coalesce(line->>'color','') !~ '^#[0-9a-fA-F]{6}$' or jsonb_typeof(line->'width') is distinct from 'number' or (line->>'width')::numeric not between 0.001 and 0.03 or jsonb_typeof(line->'points') is distinct from 'array' then raise exception 'invalid_review'; end if;
   if jsonb_array_length(line->'points') not between 1 and 4000 then raise exception 'invalid_review'; end if;
   for pt in select value from jsonb_array_elements(line->'points') loop
    if jsonb_typeof(pt)<>'array' then raise exception 'invalid_review'; end if;
    if jsonb_array_length(pt)<>2 or jsonb_typeof(pt->0)<>'number' or jsonb_typeof(pt->1)<>'number' or (pt->>0)::numeric not between 0 and 1 or (pt->>1)::numeric not between 0 and 1 then raise exception 'invalid_review'; end if;
   end loop;
  end loop;
  insert into public.homework_annotations(upload_id,strokes,feedback) values(u.id,lines,v_feedback)
   on conflict(upload_id) do update set strokes=excluded.strokes,feedback=excluded.feedback,updated_at=clock_timestamp();
  update public.homework_submissions set feedback=v_feedback where assignment_id=a.id and user_id=u.user_id;
 end if;
 if p_data ? 'status' then
  newstatus:=p_data->>'status';
  if newstatus not in ('submitted','passed','needs_revision') then raise exception 'invalid_review'; end if;
  if s.status<>newstatus then
   update public.homework_submissions set status=newstatus,reviewed_at=case when newstatus='submitted' then null else now() end where assignment_id=a.id and user_id=u.user_id;
   insert into public.homework_events(assignment_id,user_id,upload_id,actor_id,event,feedback)
    select a.id,u.user_id,u.id,uid,newstatus,x.feedback from public.homework_submissions x where x.assignment_id=a.id and x.user_id=u.user_id;
  end if;
 end if;
 return jsonb_build_object('ok',true,'annotation_updated_at',(select updated_at from public.homework_annotations where upload_id=u.id));
end $$;
revoke all on function public.homework_review(text,jsonb) from public,anon;
grant execute on function public.homework_review(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
