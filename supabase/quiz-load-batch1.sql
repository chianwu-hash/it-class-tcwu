-- First batch: read paths only. quiz_action/save/retry/reveal/leaf are unchanged.
begin;
create or replace function public.quiz_pool_catalog() returns jsonb
language plpgsql security definer set search_path='' as $$
declare identity jsonb; courses jsonb; result jsonb;
begin
 identity:=public.quiz_student_identity();
 if identity->>'role'<>'student' then return jsonb_build_object('available',false,'units','[]'::jsonb,'courses','[]'::jsonb);end if;
 with base as materialized (
  select coalesce(m.course_id,'115-1-hanlin-g3-math') course_id,p.unit_ids,coalesce(m.knowledge_reliable,true) reliable
  from public.quiz_question_pool p left join public.quiz_pool_membership m on m.question_id=p.question_id
  join public.quiz_courses c on c.id=coalesce(m.course_id,'115-1-hanlin-g3-math') and c.enabled and c.grade=(identity->>'grade')::integer
  where p.usable
 ), totals as (
  select course_id,count(*) total,bool_or(reliable) extension_available from base group by course_id
 ), unit_counts as (
  select course_id,u.n,count(*) num from base cross join lateral jsonb_array_elements_text(unit_ids) u(n) group by course_id,u.n
 ), units as (
  select u.course_id,jsonb_agg(jsonb_build_object('id',u.n::integer,'title',c.definition->'units'->>u.n,'count',u.num) order by u.n::integer) items
  from unit_counts u join public.quiz_courses c on c.id=u.course_id group by u.course_id
 )
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'subject',c.definition->>'subject','grade',c.grade,'volume',c.definition->>'volume',
 'units',coalesce(u.items,'[]'::jsonb),'total',t.total,'extension_available',t.extension_available) order by c.id),'[]'::jsonb)
 into courses from totals t join public.quiz_courses c on c.id=t.course_id left join units u on u.course_id=t.course_id;
 result:=coalesce((select value from jsonb_array_elements(courses) where value->>'id'='115-1-hanlin-g3-math'),courses->0,'{}');
 return result||jsonb_build_object('available',jsonb_array_length(courses)>0,'courses',courses,'units',coalesce(result->'units','[]'),
 'name_characters',coalesce((select jsonb_agg(jsonb_build_object('id',id,'work',work,'character',character) order by work,id) from public.quiz_name_characters where enabled),'[]'));
end $$;

create or replace function public.quiz_entry_context(p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare identity jsonb; sess public.quiz_sessions; subject text; vid uuid;
begin
 identity:=public.quiz_student_identity();
 select * into sess from public.quiz_sessions where id=(p_data->>'session_id')::uuid;
 if sess.id is not null and sess.access_mode<>'personal'
 and (sess.access_mode<>'self' or exists(select 1 from public.quiz_generated_papers where session_id=sess.id and user_id=auth.uid()))
 and exists(select 1 from public.student_enrollments e join auth.users u on lower(u.email)=e.email
  where u.id=auth.uid() and u.email_confirmed_at is not null and e.school_year=sess.school_year and sess.class_codes ? e.class_code) then
  select v.document->'catalog'->>'subject',v.id into subject,vid from public.quiz_versions v where v.id=sess.version_id;
 end if;
 return jsonb_build_object('role',identity->>'role','grade',identity->'grade','subject',subject,'version_id',vid);
end $$;
revoke all on function public.quiz_entry_context(jsonb) from public,anon;
grant execute on function public.quiz_entry_context(jsonb) to authenticated;

-- MVCC authorization projection; no attempt lock, student document or reward work.
create or replace function public.quiz_media_visible(p_url text,p_attempt uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); teacher boolean:=coalesce(public.is_teacher(),false); att public.quiz_attempts; sess public.quiz_sessions;
 d jsonb; b jsonb; q jsonb; done boolean; groupdone boolean; v_email text;
begin
 select * into att from public.quiz_attempts where id=p_attempt and user_id=uid;
 if att.id is null then raise exception 'media_unavailable';end if;
 select * into sess from public.quiz_sessions where id=att.session_id;
 if sess.id is null then raise exception 'session_unavailable';end if;
 if sess.access_mode='self' and not exists(select 1 from public.quiz_generated_papers where session_id=sess.id and user_id=uid) then raise exception 'session_unavailable';end if;
 -- quiz_action rejects teacher resume, including personal sessions.
 if teacher then raise exception 'student_required';end if;
 if sess.access_mode='personal' then raise exception 'session_unavailable';end if;
 select lower(u.email) into v_email from auth.users u where u.id=uid and u.email_confirmed_at is not null;
 if not exists(select 1 from public.student_enrollments e where e.email=v_email and e.school_year=sess.school_year and sess.class_codes ? e.class_code) then raise exception 'roster_required';end if;
 select document into d from public.quiz_versions where id=sess.version_id;
 -- Match the immutable attempt's question and option orders, including material.
 if exists(select 1 from jsonb_array_elements(d->'blocks') bx cross join lateral jsonb_array_elements(bx->'questions') qx
  where att.question_order ? (qx->>'id') and (
   exists(select 1 from jsonb_path_query(jsonb_build_array(bx->'material',qx->'prompt'),'$.**.media[*].url') u where u#>>'{}'=p_url)
   or exists(select 1 from jsonb_array_elements(coalesce(qx->'options','[]')) o
    where coalesce(att.option_orders->(qx->>'id'),'[]') ? (o->>'id')
    and exists(select 1 from jsonb_path_query(o->'content','$.**.media[*].url') u where u#>>'{}'=p_url)))) then return true;end if;
 select count(*)=jsonb_array_length(att.question_order) into done from public.quiz_answers where attempt_id=att.id;
 for b in select value from jsonb_array_elements(d->'blocks') loop
  select not exists(select 1 from jsonb_array_elements(b->'questions') x where not exists(select 1 from public.quiz_answers a where a.attempt_id=att.id and a.question_id=x->>'id')) into groupdone;
  if (sess.reveal='complete' and done) or (sess.reveal='immediate' and groupdone) then
   if exists(select 1 from jsonb_array_elements(b->'questions') x cross join lateral jsonb_path_query(x->'explanation','$.**.media[*].url') u where u#>>'{}'=p_url) then return true;end if;
  end if;
 end loop;
 return false;
end $$;
revoke all on function public.quiz_media_visible(text,uuid) from public,anon,authenticated;

create or replace function public.quiz_media_access(p_url text,p_attempt uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare asset public.quiz_media_assets;
begin
 if auth.uid() is null then raise exception 'login_required';end if;
 select * into asset from public.quiz_media_assets where url=p_url;
 if asset.url is null then raise exception 'media_unavailable';end if;
 if coalesce(public.is_teacher(),false) and asset.owner_id=auth.uid() then return to_jsonb(asset);end if;
 if not public.quiz_media_visible(p_url,p_attempt) then raise exception 'media_unavailable';end if;
 return to_jsonb(asset);
end $$;
commit;
