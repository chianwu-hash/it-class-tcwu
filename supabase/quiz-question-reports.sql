-- Additive issue inbox. Does not change questions, grading, answers or rewards.
begin;
create table if not exists public.quiz_question_reports(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),request_id uuid not null,
 source text not null check(source in('quiz','past')),attempt_id uuid not null,version_id uuid not null,
 question_id text not null,category text not null check(category in('question','options','answer','explanation','media','other')),
 option_id text not null default '',description text not null check(length(description) between 1 and 1000),
 identity jsonb not null,snapshot jsonb not null,
 status text not null default 'pending' check(status in('pending','processing','resolved','dismissed')),
 note text not null default '' check(length(note)<=1000),handled_by uuid references auth.users(id),
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 unique(user_id,request_id));
create index if not exists quiz_reports_inbox on public.quiz_question_reports(status,created_at desc,id);
create index if not exists quiz_reports_user on public.quiz_question_reports(user_id,created_at desc);
alter table public.quiz_question_reports enable row level security;
revoke all on public.quiz_question_reports from public,anon,authenticated;
grant all on public.quiz_question_reports to service_role;

create or replace function public.quiz_question_report(p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid();act text:=coalesce(p_data->>'action','submit');r public.quiz_question_reports;
 a public.quiz_attempts;s public.quiz_sessions;pa public.quiz_past_attempts;pp public.quiz_past_papers;
 identity jsonb;d jsonb;q jsonb;b jsonb;projected jsonb;snap jsonb;vid uuid;aid uuid;rid uuid;
 src text:=coalesce(p_data->>'source','quiz');qid text:=p_data->>'question_id';
 cat text:=p_data->>'category';opt text:=coalesce(p_data->>'option_id','');descr text:=trim(p_data->>'description');
 page integer;filter text:=coalesce(p_data->>'status','');
begin
 if uid is null then raise exception 'login_required';end if;
 if jsonb_typeof(p_data)<>'object' then raise exception 'invalid_request';end if;
 if act='submit' then
  identity:=public.quiz_student_identity();
  if identity->>'role' is distinct from 'student' then raise exception 'student_required';end if;
  if src not in('quiz','past') or cat is null or cat not in('question','options','answer','explanation','media','other')
   or descr is null or length(descr) not between 1 and 1000 or qid is null or length(qid) not between 1 and 200 or length(opt)>200
   or coalesce(p_data->>'attempt_id','') !~ '^[0-9a-fA-F-]{36}$' or coalesce(p_data->>'request_id','') !~ '^[0-9a-fA-F-]{36}$'
   then raise exception 'invalid_request';end if;
  aid:=(p_data->>'attempt_id')::uuid;rid:=(p_data->>'request_id')::uuid;
  perform pg_advisory_xact_lock(hashtextextended('quiz_report:'||uid::text,0));
  select * into r from public.quiz_question_reports where user_id=uid and request_id=rid;
  if r.id is not null then
   if (r.source,r.attempt_id,r.question_id,r.category,r.option_id,r.description) is distinct from (src,aid,qid,cat,opt,descr) then raise exception 'report_conflict';end if;
   return jsonb_build_object('id',r.id,'status',r.status,'reused',true);
  end if;
  if (select count(*) from public.quiz_question_reports where user_id=uid and created_at>clock_timestamp()-interval '1 hour')>=20 then raise exception 'report_rate_limit';end if;
  if src='quiz' then
   select * into a from public.quiz_attempts where id=aid and user_id=uid;
   select * into s from public.quiz_sessions where id=a.session_id;
   if a.id is null or s.access_mode='personal' or not (s.class_codes ? (identity->>'class_code')) or not(a.question_order ? qid) then raise exception 'report_unavailable';end if;
   vid:=s.version_id;select document into d from public.quiz_versions where id=vid;
   select block,question into b,q from jsonb_array_elements(d->'blocks') block,lateral jsonb_array_elements(block->'questions') question where question->>'id'=qid;
   if q is null then raise exception 'report_unavailable';end if;
   projected:=public.quiz_student_document(d,a.question_order,a.option_orders);
   select value into projected from jsonb_array_elements(projected->'questions') where value->>'id'=qid;
   if opt<>'' and not exists(select 1 from jsonb_array_elements(projected->'options') o where o->>'id'=opt) then raise exception 'invalid_request';end if;
   snap:=jsonb_build_object('title',d->>'title','catalog',d->'catalog','session_id',s.id,
    'number',(select ord from jsonb_array_elements_text(a.question_order) with ordinality x(id,ord) where x.id=qid),
    'question',projected||jsonb_build_object('answer',q->'answer','explanation',q->'explanation'));
  else
   select * into pa from public.quiz_past_attempts where id=aid and user_id=uid;
   select * into pp from public.quiz_past_papers where id=pa.paper_id;
   if pa.id is null or pp.grade<>(identity->>'grade')::integer then raise exception 'report_unavailable';end if;
   vid:=pa.version_id;select document into d from public.quiz_past_versions where id=vid;
   select value into q from jsonb_array_elements(d->'groups') where value->>'id'=qid;
   if q is null then raise exception 'report_unavailable';end if;
   if opt<>'' and not exists(select 1 from jsonb_array_elements(q->'choices') o where o->>'id'=opt) then raise exception 'invalid_request';end if;
   snap:=jsonb_build_object('title',pp.title,'paper_id',pp.id,'number',q->>'sourceLabel','group',q);
  end if;
  identity:=identity||coalesce(public.quiz_nav_identity(identity->>'email'),'{}');
  insert into public.quiz_question_reports(user_id,request_id,source,attempt_id,version_id,question_id,category,option_id,description,identity,snapshot)
   values(uid,rid,src,aid,vid,qid,cat,opt,descr,identity,snap) returning * into r;
  return jsonb_build_object('id',r.id,'status',r.status,'reused',false);
 end if;
 if not coalesce(public.is_teacher(),false) then raise exception 'teacher_required';end if;
 if act='list' then
  if coalesce(p_data->>'page','0') !~ '^[0-9]{1,5}$' or filter not in('','pending','processing','resolved','dismissed') then raise exception 'invalid_request';end if;
  page:=coalesce((p_data->>'page')::integer,0);
  return jsonb_build_object('total',(select count(*) from public.quiz_question_reports where filter='' or status=filter),
   'items',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc),'[]') from
    (select t.id,t.source,t.category,t.option_id,t.description,t.identity,t.status,t.note,t.created_at,t.updated_at,t.snapshot->>'title' title,t.snapshot->>'number' number
     from public.quiz_question_reports t where filter='' or t.status=filter order by t.created_at desc,t.id desc limit 20 offset page*20) x));
 end if;
 if act not in('detail','update') then raise exception 'invalid_request';end if;
 select * into r from public.quiz_question_reports where id=(p_data->>'id')::uuid for update;
 if r.id is null then raise exception 'report_unavailable';end if;
 if act='update' then
  if coalesce(p_data->>'status','') not in('pending','processing','resolved','dismissed') or length(coalesce(p_data->>'note',''))>1000 then raise exception 'invalid_request';end if;
  if r.updated_at is distinct from (p_data->>'updated_at')::timestamptz then raise exception 'report_changed';end if;
  update public.quiz_question_reports set status=p_data->>'status',note=coalesce(p_data->>'note',''),handled_by=uid,updated_at=clock_timestamp() where id=r.id returning * into r;
 end if;
 return to_jsonb(r)-'request_id'-'user_id';
end$$;
revoke all on function public.quiz_question_report(jsonb) from public,anon;
grant execute on function public.quiz_question_report(jsonb) to authenticated;

-- Reuse the existing Edge signer. A teacher's report ID scopes access to ONLY that
-- reported question's media, including student-owned self-composed versions.
do $$begin
 if to_regprocedure('public.quiz_media_access_before_reports(text,uuid)') is null then
  alter function public.quiz_media_access(text,uuid) rename to quiz_media_access_before_reports;
 end if;
end$$;
revoke all on function public.quiz_media_access_before_reports(text,uuid) from public,anon,authenticated;
create or replace function public.quiz_media_access(p_url text,p_attempt uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.quiz_question_reports;asset public.quiz_media_assets;
begin
 if auth.uid() is null then raise exception 'login_required';end if;
 if coalesce(public.is_teacher(),false) then
  select * into r from public.quiz_question_reports where id=p_attempt;
  if r.id is not null then
   if not exists(select 1 from jsonb_path_query(r.snapshot,'$.**.url') u where u#>>'{}'=p_url)
    and not exists(select 1 from jsonb_path_query(r.snapshot,'$.**.referenceUrl') u where u#>>'{}'=p_url) then raise exception 'media_unavailable';end if;
   select * into asset from public.quiz_media_assets where url=p_url;
   if asset.url is null then raise exception 'media_unavailable';end if;
   return to_jsonb(asset)||case when r.source='past' then jsonb_build_object('backend','supabase') else '{}'::jsonb end;
  end if;
 end if;
 return public.quiz_media_access_before_reports(p_url,p_attempt);
end$$;
revoke all on function public.quiz_media_access(text,uuid) from public,anon;
grant execute on function public.quiz_media_access(text,uuid) to authenticated;
commit;
