-- Generated from the reviewed production baseline; never replace another migration's wrappers.
begin;
set local lock_timeout='5s';
lock table public.quiz_versions,public.quiz_banks,public.quiz_question_pool in share row exclusive mode;
do $open_guard$
begin
 if not((md5(pg_get_functiondef('public.quiz_validate(jsonb)'::regprocedure))='56ca473db561001ddf2a6f3dbd80d5b0' and
 md5(pg_get_functiondef('public.quiz_student_document(jsonb,jsonb,jsonb)'::regprocedure))='62628fda0f3c142afc25b43ccd3d3bc6' and
 md5(pg_get_functiondef('public.quiz_action_before_learning(text,jsonb)'::regprocedure))='c4436149a4941457c698759d8ab2dbf2' and
 md5(pg_get_functiondef('public.quiz_leaf_result_before_learning(uuid,boolean)'::regprocedure))='703060d59ca758c80cfa1e401fe66f07' and
 md5(pg_get_functiondef('public.quiz_library_sessions(jsonb)'::regprocedure))='d58d0d37f03a186e6fb640b306860150' and
 md5(pg_get_functiondef('public.quiz_monitor_before_learning(jsonb)'::regprocedure))='9c751fe61df616bb2e5b8478f2231fd2' and
 md5(pg_get_functiondef('public.quiz_paper_card(uuid)'::regprocedure))='b6b7c7d445245c36873bf13233d71e68' and
 md5(pg_get_functiondef('public.quiz_media_visible(text,uuid)'::regprocedure))='71bb4be8d16988c6182d67f9edcab29a' and
 md5(pg_get_functiondef('public.quiz_wrong_questions_before_learning(jsonb)'::regprocedure))='dc1396432dd3d359dd70b428146f70a4' and
 md5(pg_get_functiondef('public.quiz_wrong_refs(integer,text,text)'::regprocedure))='12c8cfd9c238bec82c27ee365839c0d9' and
 md5(pg_get_functiondef('public.quiz_compose(jsonb)'::regprocedure))='77fbf95d263e50b92b57e3297f0dfc87')or(md5(pg_get_functiondef('public.quiz_validate(jsonb)'::regprocedure))='944e211b9d4532043d40b17bf255db52' and
 md5(pg_get_functiondef('public.quiz_student_document(jsonb,jsonb,jsonb)'::regprocedure))='535c6fddb398bb38ea052dd81a3e0bb7' and
 md5(pg_get_functiondef('public.quiz_action_before_learning(text,jsonb)'::regprocedure))='fc7ef9980e3bdaa81b84ed7ee224e433' and
 md5(pg_get_functiondef('public.quiz_leaf_result_before_learning(uuid,boolean)'::regprocedure))='b53b508012201038e7ff86270adca227' and
 md5(pg_get_functiondef('public.quiz_library_sessions(jsonb)'::regprocedure))='bd331323acd8c39996913a1f59fd4b86' and
 md5(pg_get_functiondef('public.quiz_monitor_before_learning(jsonb)'::regprocedure))='c40b5046e8e348b8c0059e099fbf1844' and
 md5(pg_get_functiondef('public.quiz_paper_card(uuid)'::regprocedure))='dc5f76f7f4aac640b3194bd06989bfae' and
 md5(pg_get_functiondef('public.quiz_media_visible(text,uuid)'::regprocedure))='93188b517085556ea174e1dc63ce33aa' and
 md5(pg_get_functiondef('public.quiz_wrong_questions_before_learning(jsonb)'::regprocedure))='b85e2d3c80ab6e9b54109f05a6dc9475' and
 md5(pg_get_functiondef('public.quiz_wrong_refs(integer,text,text)'::regprocedure))='764514d212bcebbfc3bc3b6659a99d85' and
 md5(pg_get_functiondef('public.quiz_compose(jsonb)'::regprocedure))='86de418fb370205254077d7a1983d7db'))then raise exception 'open_review_baseline_changed';end if;
 if to_regclass('public.quiz_open_responses')is not null and not(md5(pg_get_functiondef('public.quiz_validate(jsonb)'::regprocedure))='944e211b9d4532043d40b17bf255db52' and
 md5(pg_get_functiondef('public.quiz_student_document(jsonb,jsonb,jsonb)'::regprocedure))='535c6fddb398bb38ea052dd81a3e0bb7' and
 md5(pg_get_functiondef('public.quiz_action_before_learning(text,jsonb)'::regprocedure))='fc7ef9980e3bdaa81b84ed7ee224e433' and
 md5(pg_get_functiondef('public.quiz_leaf_result_before_learning(uuid,boolean)'::regprocedure))='b53b508012201038e7ff86270adca227' and
 md5(pg_get_functiondef('public.quiz_library_sessions(jsonb)'::regprocedure))='bd331323acd8c39996913a1f59fd4b86' and
 md5(pg_get_functiondef('public.quiz_monitor_before_learning(jsonb)'::regprocedure))='c40b5046e8e348b8c0059e099fbf1844' and
 md5(pg_get_functiondef('public.quiz_paper_card(uuid)'::regprocedure))='dc5f76f7f4aac640b3194bd06989bfae' and
 md5(pg_get_functiondef('public.quiz_media_visible(text,uuid)'::regprocedure))='93188b517085556ea174e1dc63ce33aa' and
 md5(pg_get_functiondef('public.quiz_wrong_questions_before_learning(jsonb)'::regprocedure))='b85e2d3c80ab6e9b54109f05a6dc9475' and
 md5(pg_get_functiondef('public.quiz_wrong_refs(integer,text,text)'::regprocedure))='764514d212bcebbfc3bc3b6659a99d85' and
 md5(pg_get_functiondef('public.quiz_compose(jsonb)'::regprocedure))='86de418fb370205254077d7a1983d7db')then raise exception 'open_review_partial_install';end if;
 if (md5(pg_get_functiondef('public.quiz_validate(jsonb)'::regprocedure))='944e211b9d4532043d40b17bf255db52' and
 md5(pg_get_functiondef('public.quiz_student_document(jsonb,jsonb,jsonb)'::regprocedure))='535c6fddb398bb38ea052dd81a3e0bb7' and
 md5(pg_get_functiondef('public.quiz_action_before_learning(text,jsonb)'::regprocedure))='fc7ef9980e3bdaa81b84ed7ee224e433' and
 md5(pg_get_functiondef('public.quiz_leaf_result_before_learning(uuid,boolean)'::regprocedure))='b53b508012201038e7ff86270adca227' and
 md5(pg_get_functiondef('public.quiz_library_sessions(jsonb)'::regprocedure))='bd331323acd8c39996913a1f59fd4b86' and
 md5(pg_get_functiondef('public.quiz_monitor_before_learning(jsonb)'::regprocedure))='c40b5046e8e348b8c0059e099fbf1844' and
 md5(pg_get_functiondef('public.quiz_paper_card(uuid)'::regprocedure))='dc5f76f7f4aac640b3194bd06989bfae' and
 md5(pg_get_functiondef('public.quiz_media_visible(text,uuid)'::regprocedure))='93188b517085556ea174e1dc63ce33aa' and
 md5(pg_get_functiondef('public.quiz_wrong_questions_before_learning(jsonb)'::regprocedure))='b85e2d3c80ab6e9b54109f05a6dc9475' and
 md5(pg_get_functiondef('public.quiz_wrong_refs(integer,text,text)'::regprocedure))='764514d212bcebbfc3bc3b6659a99d85' and
 md5(pg_get_functiondef('public.quiz_compose(jsonb)'::regprocedure))='86de418fb370205254077d7a1983d7db')and to_regclass('public.quiz_open_responses')is null then raise exception 'open_review_table_missing';end if;
 if (md5(pg_get_functiondef('public.quiz_validate(jsonb)'::regprocedure))='56ca473db561001ddf2a6f3dbd80d5b0' and
 md5(pg_get_functiondef('public.quiz_student_document(jsonb,jsonb,jsonb)'::regprocedure))='62628fda0f3c142afc25b43ccd3d3bc6' and
 md5(pg_get_functiondef('public.quiz_action_before_learning(text,jsonb)'::regprocedure))='c4436149a4941457c698759d8ab2dbf2' and
 md5(pg_get_functiondef('public.quiz_leaf_result_before_learning(uuid,boolean)'::regprocedure))='703060d59ca758c80cfa1e401fe66f07' and
 md5(pg_get_functiondef('public.quiz_library_sessions(jsonb)'::regprocedure))='d58d0d37f03a186e6fb640b306860150' and
 md5(pg_get_functiondef('public.quiz_monitor_before_learning(jsonb)'::regprocedure))='9c751fe61df616bb2e5b8478f2231fd2' and
 md5(pg_get_functiondef('public.quiz_paper_card(uuid)'::regprocedure))='b6b7c7d445245c36873bf13233d71e68' and
 md5(pg_get_functiondef('public.quiz_media_visible(text,uuid)'::regprocedure))='71bb4be8d16988c6182d67f9edcab29a' and
 md5(pg_get_functiondef('public.quiz_wrong_questions_before_learning(jsonb)'::regprocedure))='dc1396432dd3d359dd70b428146f70a4' and
 md5(pg_get_functiondef('public.quiz_wrong_refs(integer,text,text)'::regprocedure))='12c8cfd9c238bec82c27ee365839c0d9' and
 md5(pg_get_functiondef('public.quiz_compose(jsonb)'::regprocedure))='77fbf95d263e50b92b57e3297f0dfc87')and(
  exists(select 1 from public.quiz_versions v where jsonb_path_exists(v.document,'$.blocks[*].questions[*] ? (@.type == "open")'))or
  exists(select 1 from public.quiz_banks b where jsonb_path_exists(b.draft,'$.blocks[*].questions[*] ? (@.type == "open")'))or
  exists(select 1 from public.quiz_question_pool p where p.question->>'type'='open')
 )then raise exception 'open_review_historical_type_present';end if;
 if to_regprocedure('public.quiz_open_validate(jsonb)')is not null then
  if(select md5(prosrc)from pg_proc where oid='public.quiz_open_validate(jsonb)'::regprocedure)<>'b40c80f19fd4effe963444e4f5ce280f'then raise exception 'open_review_helper_changed';end if;
 elsif (md5(pg_get_functiondef('public.quiz_validate(jsonb)'::regprocedure))='944e211b9d4532043d40b17bf255db52' and
 md5(pg_get_functiondef('public.quiz_student_document(jsonb,jsonb,jsonb)'::regprocedure))='535c6fddb398bb38ea052dd81a3e0bb7' and
 md5(pg_get_functiondef('public.quiz_action_before_learning(text,jsonb)'::regprocedure))='fc7ef9980e3bdaa81b84ed7ee224e433' and
 md5(pg_get_functiondef('public.quiz_leaf_result_before_learning(uuid,boolean)'::regprocedure))='b53b508012201038e7ff86270adca227' and
 md5(pg_get_functiondef('public.quiz_library_sessions(jsonb)'::regprocedure))='bd331323acd8c39996913a1f59fd4b86' and
 md5(pg_get_functiondef('public.quiz_monitor_before_learning(jsonb)'::regprocedure))='c40b5046e8e348b8c0059e099fbf1844' and
 md5(pg_get_functiondef('public.quiz_paper_card(uuid)'::regprocedure))='dc5f76f7f4aac640b3194bd06989bfae' and
 md5(pg_get_functiondef('public.quiz_media_visible(text,uuid)'::regprocedure))='93188b517085556ea174e1dc63ce33aa' and
 md5(pg_get_functiondef('public.quiz_wrong_questions_before_learning(jsonb)'::regprocedure))='b85e2d3c80ab6e9b54109f05a6dc9475' and
 md5(pg_get_functiondef('public.quiz_wrong_refs(integer,text,text)'::regprocedure))='764514d212bcebbfc3bc3b6659a99d85' and
 md5(pg_get_functiondef('public.quiz_compose(jsonb)'::regprocedure))='86de418fb370205254077d7a1983d7db')then raise exception 'open_review_helper_missing';end if;
 if to_regprocedure('public.quiz_response_rows(uuid)')is not null then
  if(select md5(prosrc)from pg_proc where oid='public.quiz_response_rows(uuid)'::regprocedure)<>'e86557b6fb48a037736c598226dab23f'then raise exception 'open_review_helper_changed';end if;
 elsif (md5(pg_get_functiondef('public.quiz_validate(jsonb)'::regprocedure))='944e211b9d4532043d40b17bf255db52' and
 md5(pg_get_functiondef('public.quiz_student_document(jsonb,jsonb,jsonb)'::regprocedure))='535c6fddb398bb38ea052dd81a3e0bb7' and
 md5(pg_get_functiondef('public.quiz_action_before_learning(text,jsonb)'::regprocedure))='fc7ef9980e3bdaa81b84ed7ee224e433' and
 md5(pg_get_functiondef('public.quiz_leaf_result_before_learning(uuid,boolean)'::regprocedure))='b53b508012201038e7ff86270adca227' and
 md5(pg_get_functiondef('public.quiz_library_sessions(jsonb)'::regprocedure))='bd331323acd8c39996913a1f59fd4b86' and
 md5(pg_get_functiondef('public.quiz_monitor_before_learning(jsonb)'::regprocedure))='c40b5046e8e348b8c0059e099fbf1844' and
 md5(pg_get_functiondef('public.quiz_paper_card(uuid)'::regprocedure))='dc5f76f7f4aac640b3194bd06989bfae' and
 md5(pg_get_functiondef('public.quiz_media_visible(text,uuid)'::regprocedure))='93188b517085556ea174e1dc63ce33aa' and
 md5(pg_get_functiondef('public.quiz_wrong_questions_before_learning(jsonb)'::regprocedure))='b85e2d3c80ab6e9b54109f05a6dc9475' and
 md5(pg_get_functiondef('public.quiz_wrong_refs(integer,text,text)'::regprocedure))='764514d212bcebbfc3bc3b6659a99d85' and
 md5(pg_get_functiondef('public.quiz_compose(jsonb)'::regprocedure))='86de418fb370205254077d7a1983d7db')then raise exception 'open_review_helper_missing';end if;
 if to_regprocedure('public.quiz_open_submit(uuid,jsonb,jsonb,boolean)')is not null then
  if(select md5(prosrc)from pg_proc where oid='public.quiz_open_submit(uuid,jsonb,jsonb,boolean)'::regprocedure)<>'0aabb277eb34ed9bf27046077b5c7a3a'then raise exception 'open_review_helper_changed';end if;
 elsif (md5(pg_get_functiondef('public.quiz_validate(jsonb)'::regprocedure))='944e211b9d4532043d40b17bf255db52' and
 md5(pg_get_functiondef('public.quiz_student_document(jsonb,jsonb,jsonb)'::regprocedure))='535c6fddb398bb38ea052dd81a3e0bb7' and
 md5(pg_get_functiondef('public.quiz_action_before_learning(text,jsonb)'::regprocedure))='fc7ef9980e3bdaa81b84ed7ee224e433' and
 md5(pg_get_functiondef('public.quiz_leaf_result_before_learning(uuid,boolean)'::regprocedure))='b53b508012201038e7ff86270adca227' and
 md5(pg_get_functiondef('public.quiz_library_sessions(jsonb)'::regprocedure))='bd331323acd8c39996913a1f59fd4b86' and
 md5(pg_get_functiondef('public.quiz_monitor_before_learning(jsonb)'::regprocedure))='c40b5046e8e348b8c0059e099fbf1844' and
 md5(pg_get_functiondef('public.quiz_paper_card(uuid)'::regprocedure))='dc5f76f7f4aac640b3194bd06989bfae' and
 md5(pg_get_functiondef('public.quiz_media_visible(text,uuid)'::regprocedure))='93188b517085556ea174e1dc63ce33aa' and
 md5(pg_get_functiondef('public.quiz_wrong_questions_before_learning(jsonb)'::regprocedure))='b85e2d3c80ab6e9b54109f05a6dc9475' and
 md5(pg_get_functiondef('public.quiz_wrong_refs(integer,text,text)'::regprocedure))='764514d212bcebbfc3bc3b6659a99d85' and
 md5(pg_get_functiondef('public.quiz_compose(jsonb)'::regprocedure))='86de418fb370205254077d7a1983d7db')then raise exception 'open_review_helper_missing';end if;
end $open_guard$;
-- Opt-in open responses are never inserted into the automatic correct/incorrect table.
create table if not exists public.quiz_open_responses (
 attempt_id uuid not null references public.quiz_attempts(id),
 question_id text not null,
 request_id uuid not null,
 response jsonb not null check(jsonb_typeof(response)='string' and length(response#>>'{}') between 1 and 2000),
 status text not null default 'saved' check(status in('saved','self_checked')),
 self_check_request_id uuid,
 self_rating text check(self_rating in('understood','practice')),
 self_note text check(length(self_note)<=250),
 created_at timestamptz not null default now(),
 self_checked_at timestamptz,
 primary key(attempt_id,question_id),
 unique(attempt_id,request_id),
 unique(attempt_id,self_check_request_id),
 check((status='saved' and self_check_request_id is null and self_rating is null and self_note is null and self_checked_at is null)
  or(status='self_checked' and self_check_request_id is not null and self_rating is not null and self_note is not null and self_checked_at is not null))
);
alter table public.quiz_open_responses enable row level security;
revoke all on public.quiz_open_responses from public,anon,authenticated;
grant all on public.quiz_open_responses to postgres,service_role;

create or replace function public.quiz_open_validate(q jsonb) returns void
language plpgsql immutable set search_path='' as $open_validate$
declare f jsonb;r jsonb;v jsonb;k text;fake jsonb;
begin
 if q->>'type' is distinct from 'open' or jsonb_typeof(q->'fields') is distinct from 'array'
  or q->'answer'->>'format' is distinct from 'self-review-v1' or jsonb_typeof(q->'answer'->'fields') is distinct from 'object'
  or exists(select 1 from jsonb_object_keys(q->'answer') x where x not in('format','fields')) then raise exception 'invalid_open_question';end if;
 select jsonb_object_agg(x->>'id',jsonb_build_array('validation-only')) into fake from jsonb_array_elements(q->'fields') x;
 perform public.quiz_fields_validate(jsonb_set(q,'{answer}',jsonb_build_object('format','fields-v1','fields',fake)));
 if (select count(*) from jsonb_object_keys(q->'answer'->'fields'))<>jsonb_array_length(q->'fields') then raise exception 'invalid_open_question';end if;
 for f in select * from jsonb_array_elements(q->'fields') loop
  if f->>'input' is distinct from 'text' then raise exception 'invalid_open_question';end if;
  r:=q->'answer'->'fields'->(f->>'id');
  if jsonb_typeof(r) is distinct from 'object' or exists(select 1 from jsonb_object_keys(r) x where x not in('examples','criteria')) then raise exception 'invalid_open_reference';end if;
  foreach k in array array['examples','criteria'] loop
   if jsonb_typeof(r->k) is distinct from 'array' then raise exception 'invalid_open_reference';end if;
   if jsonb_array_length(r->k) not between 1 and (case when k='examples' then 3 else 4 end) then raise exception 'invalid_open_reference';end if;
   for v in select * from jsonb_array_elements(r->k) loop
    if jsonb_typeof(v) is distinct from 'string' or length(trim(v#>>'{}')) not between 1 and (case when k='examples' then 500 else 150 end) then raise exception 'invalid_open_reference';end if;
   end loop;
  end loop;
 end loop;
end $open_validate$;
revoke all on function public.quiz_open_validate(jsonb) from public,anon,authenticated;
grant execute on function public.quiz_open_validate(jsonb) to postgres,service_role;

-- Callers choose whether a saved response or only a completed self-review is needed.
create or replace function public.quiz_response_rows(p_attempt uuid)
returns table(question_id text,response jsonb,correct boolean,completed boolean,created_at timestamptz)
language sql stable set search_path='' as $open_rows$
 select a.question_id,a.response,a.correct,true,a.created_at from public.quiz_answers a where a.attempt_id=p_attempt
 union all
 select a.question_id,a.response,null::boolean,a.status='self_checked',coalesce(a.self_checked_at,a.created_at)
 from public.quiz_open_responses a where a.attempt_id=p_attempt
$open_rows$;
revoke all on function public.quiz_response_rows(uuid) from public,anon,authenticated;
grant execute on function public.quiz_response_rows(uuid) to postgres,service_role;

create or replace function public.quiz_open_submit(p_attempt uuid,p_question jsonb,p_data jsonb,p_self_check boolean)
returns boolean language plpgsql security definer set search_path='' as $open_submit$
declare row public.quiz_open_responses;rid uuid;raw text;rating text;note text;canonical jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.quiz_attempts where id=p_attempt and user_id=auth.uid()) then raise exception 'attempt_unavailable';end if;
 if p_question->>'type' is distinct from 'open' then raise exception 'invalid_question_type';end if;
 rid:=(p_data->>'request_id')::uuid;if rid is null then raise exception 'invalid_request';end if;
 if exists(select 1 from public.quiz_answers where attempt_id=p_attempt and request_id=rid) then raise exception 'submission_conflict';end if;
 select * into row from public.quiz_open_responses where attempt_id=p_attempt and question_id=p_question->>'id' for update;
 if p_self_check then
  if row.attempt_id is null then raise exception 'open_answer_required';end if;
  if jsonb_typeof(p_data->'self_rating') is distinct from 'string' or coalesce(p_data->>'self_rating','') not in('understood','practice')
   or jsonb_typeof(p_data->'self_note') is distinct from 'string' or length(p_data->>'self_note')>250 then raise exception 'invalid_self_check';end if;
  rating:=p_data->>'self_rating';note:=p_data->>'self_note';
  if row.status='self_checked' then
   if row.self_check_request_id is distinct from rid or row.self_rating is distinct from rating or row.self_note is distinct from note then raise exception 'submission_conflict';end if;
   return false;
  end if;
  if exists(select 1 from public.quiz_open_responses where attempt_id=p_attempt and(request_id=rid or self_check_request_id=rid)) then raise exception 'submission_conflict';end if;
  update public.quiz_open_responses set status='self_checked',self_check_request_id=rid,self_rating=rating,self_note=note,self_checked_at=now() where attempt_id=p_attempt and question_id=p_question->>'id';
  return true;
 end if;
 if jsonb_typeof(p_data->'response') is distinct from 'string' then raise exception 'invalid_response';end if;
 raw:=p_data->>'response';canonical:=public.quiz_fields_response(p_question,raw);
 if row.attempt_id is not null then
  if row.request_id is distinct from rid or row.response is distinct from p_data->'response' then raise exception 'submission_conflict';end if;
  return false;
 end if;
 if exists(select 1 from public.quiz_open_responses where attempt_id=p_attempt and(request_id=rid or self_check_request_id=rid)) then raise exception 'submission_conflict';end if;
 insert into public.quiz_open_responses(attempt_id,question_id,request_id,response) values(p_attempt,p_question->>'id',rid,p_data->'response');
 return true;
end $open_submit$;
revoke all on function public.quiz_open_submit(uuid,jsonb,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.quiz_open_submit(uuid,jsonb,jsonb,boolean) to postgres,service_role;

CREATE OR REPLACE FUNCTION public.quiz_validate(d jsonb)
 RETURNS void
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare b jsonb; q jsonb; o jsonb; a jsonb; ids text[]:='{}'; bids text[]:='{}'; opts text[]; n integer:=0; k text;
begin
 if jsonb_typeof(d) is distinct from 'object' or d->>'schema' is distinct from '1'
  or jsonb_typeof(d->'title') is distinct from 'string' or length(trim(d->>'title')) not between 1 and 200
  or jsonb_typeof(d->'catalog') is distinct from 'object' or length((d->'catalog')::text)>4000
  or jsonb_typeof(d->'blocks') is distinct from 'array' then raise exception 'invalid_document'; end if;
 if jsonb_array_length(d->'blocks') not between 1 and 100 then raise exception 'invalid_document'; end if;
 for b in select value from jsonb_array_elements(d->'blocks') loop
  if coalesce(b->>'id','') !~ '^[a-zA-Z0-9_-]{1,80}$' or b->>'id'=any(bids)
   or not public.quiz_valid_content(b->'material') or jsonb_typeof(b->'questions') is distinct from 'array' then raise exception 'invalid_block'; end if;
  bids:=array_append(bids,b->>'id');
  if jsonb_array_length(b->'questions') not between 1 and 30 then raise exception 'invalid_block'; end if;
  for q in select value from jsonb_array_elements(b->'questions') loop
   n:=n+1;
   if coalesce(q->>'id','') !~ '^[a-zA-Z0-9_-]{1,80}$' or q->>'id'=any(ids)
    or not public.quiz_valid_content(q->'prompt') or not public.quiz_valid_content(q->'explanation')
    or length(trim(q->'prompt'->>'text'))=0 or jsonb_typeof(q->'answer') is distinct from 'object' then raise exception 'invalid_question'; end if;
   ids:=array_append(ids,q->>'id');
   -- Opt-in normal math answers v1
   if q->'answer' ? 'normalizer' then
    if q->>'type' is distinct from 'short' or jsonb_typeof(q->'answer'->'normalizer') is distinct from 'string'
     or q->'answer'->>'normalizer' is distinct from 'math-v1' then raise exception 'invalid_answer';end if;
   end if;
   if q->>'type'='single' then
    if jsonb_typeof(q->'options') is distinct from 'array' then raise exception 'invalid_options'; end if;
    if jsonb_array_length(q->'options') not between 2 and 8 then raise exception 'invalid_options'; end if;
    opts:='{}';
    for o in select value from jsonb_array_elements(q->'options') loop
     if coalesce(o->>'id','') !~ '^[a-zA-Z0-9_-]{1,80}$' or o->>'id'=any(opts)
      or not public.quiz_valid_content(o->'content') then raise exception 'invalid_options'; end if;
     opts:=array_append(opts,o->>'id');
    end loop;
    if not coalesce(q->'answer'->>'option_id'=any(opts),false) then raise exception 'invalid_answer'; end if;
   elsif q->>'type'='short' then
    if q ? 'options' then raise exception 'invalid_options'; end if;
    if jsonb_typeof(q->'answer'->'accepted') is distinct from 'array' then raise exception 'invalid_answer'; end if;
    if jsonb_array_length(q->'answer'->'accepted') not between 1 and 20 then raise exception 'invalid_answer'; end if;
    for a in select value from jsonb_array_elements(q->'answer'->'accepted') loop
     if jsonb_typeof(a) is distinct from 'string' or length(trim(a#>>'{}')) not between 1 and 2000 then raise exception 'invalid_answer'; end if;
     if q->'answer'->>'normalizer'='math-v1' then
      if (a#>>'{}')~'[0-9０-９][[:space:]　]+[0-9０-９]' then raise exception 'invalid_answer';end if;
      perform public.quiz_math_answer_normalize(a#>>'{}');
     end if;
    end loop;
   elsif q->>'type'='fields' then perform public.quiz_fields_validate(q);
   elsif q->>'type'='open' then perform public.quiz_open_validate(q);
   else raise exception 'invalid_question_type'; end if;
   -- 白名單投影仍是學生回傳的唯一來源，不信任教師輸入的額外欄位。
   for k in select jsonb_object_keys(q) loop
    if k not in ('id','type','prompt','explanation','options','answer') and not(k='fields' and q->>'type' in('fields','open')) then raise exception 'invalid_question_field'; end if;
   end loop;
  end loop;
 end loop;
 if n>200 or octet_length(d::text)>1000000 then raise exception 'document_too_large'; end if;
end $function$
;
CREATE OR REPLACE FUNCTION public.quiz_student_document(d jsonb, qo jsonb, oo jsonb)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 with source as materialized (
  select distinct on(q->>'id') q->>'id' id,b,q
  from jsonb_array_elements(d->'blocks') with ordinality bx(b,bn),
   lateral jsonb_array_elements(b->'questions') with ordinality qx(q,qn)
  order by q->>'id',bn,qn
 ), items as (
  select r.n,jsonb_build_object('id',q->>'id','type',q->>'type','prompt',q->'prompt',
   'block_id',b->>'id','material',b->'material','options',
   (select coalesce(jsonb_agg(jsonb_build_object('id',o->>'id','content',o->'content') order by ord),'[]'::jsonb)
    from jsonb_array_elements(coalesce(q->'options','[]')) o
    join jsonb_array_elements_text(coalesce(oo->(q->>'id'),'[]')) with ordinality opt(id,ord) on o->>'id'=opt.id))||case when q->>'type' in('fields','open') then jsonb_build_object('fields',(select coalesce(jsonb_agg(jsonb_build_object('id',f->>'id','label',f->>'label','input',f->>'input')
 ||case when f ? 'options' then jsonb_build_object('options',(select jsonb_agg(jsonb_build_object('id',o->>'id','content',o->'content')order by ord)from jsonb_array_elements(f->'options')with ordinality opts(o,ord)))else '{}'::jsonb end order by n),'[]'::jsonb)
 from jsonb_array_elements(q->'fields')with ordinality fields(f,n)))else '{}'::jsonb end item
  from jsonb_array_elements(qo) with ordinality r(qid,n)
  left join source on source.id=r.qid#>>'{}'
 ) select jsonb_build_object('title',d->>'title','questions',coalesce(jsonb_agg(item order by n),'[]'::jsonb)) from items;
$function$
;
CREATE OR REPLACE FUNCTION public.quiz_action_before_learning(p_action text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
declare
 uid uuid:=auth.uid(); teacher boolean:=coalesce(public.is_teacher(),false); v_email text;
 bank public.quiz_banks; ver public.quiz_versions; sess public.quiz_sessions; att public.quiz_attempts; ans public.quiz_answers;
 d jsonb; b jsonb; q jsonb; o jsonb; qo jsonb; oo jsonb:='{}'; result jsonb; reviews jsonb:='[]'; responses jsonb;
 target uuid; qid text; response jsonb; correct boolean; done boolean; groupdone boolean; n integer; cls text; mode text; student_grade integer;
 new_answer boolean:=false; leaf jsonb:='{}'; identity jsonb; correct_map jsonb; completed_map jsonb; open_state jsonb; open_row public.quiz_open_responses; prior_lock_timeout text; compact boolean:=p_action in('submit','self_check') and coalesce(p_data->'compact'='true'::jsonb,false);
begin
 if uid is null then raise exception 'login_required'; end if;
 -- Practice pages and answer APIs are student-only; teacher authoring/monitoring remains separate.
 if teacher and p_action in ('library_sessions','join','resume','submit','self_check','view_question') then raise exception 'student_required';end if;
 if p_action in ('list','get','save','publish','versions','open','monitor','close','sessions','personal_sessions') and not teacher then raise exception 'teacher_required'; end if;
 if p_action='library_sessions' then return public.quiz_library_sessions(p_data);end if;
 if p_action in ('personal_sessions','library_sessions') then
  if not teacher then
   identity:=public.quiz_student_identity();v_email:=identity->>'email';student_grade:=(identity->>'grade')::integer;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'version_id',s.version_id,'title',v.document->>'title',
   'catalog',v.document->'catalog','status',s.status,
   'generated',s.access_mode='self','display_name',g.display_name,'saved_at',g.created_at,
   'generated_kind',g.config->>'kind','unit_ids',g.config->'units','distribution',g.actual_distribution,
   'learning_point',case when g.config->>'kind'='extension' then regexp_replace(v.document->'catalog'->>'unit','^同重點再練習[：:]\s*','') else null end,
   'total',(select count(*) from jsonb_array_elements(v.document->'blocks') b,lateral jsonb_array_elements(b->'questions') q),
   'answered',coalesce(progress.answered,0),'correct',coalesce(progress.correct,0)
   ) order by v.document->'catalog'->>'volume',v.document->'catalog'->>'subject',v.document->'catalog'->>'unit'),'[]') into result
   from public.quiz_sessions s join public.quiz_versions v on v.id=s.version_id
   left join public.quiz_generated_papers g on g.session_id=s.id and g.user_id=uid
   left join (select a.session_id,count(x.question_id) answered,count(*) filter(where x.correct) correct
    from public.quiz_attempts a left join lateral public.quiz_response_rows(a.id) x on x.completed where a.user_id=uid group by a.session_id) progress on progress.session_id=s.id
   where (teacher and s.owner_id=uid and s.access_mode='personal')
    or (not teacher and s.access_mode in ('practice','self') and (s.access_mode<>'self' or exists(select 1 from public.quiz_generated_papers g where g.session_id=s.id and g.user_id=uid and g.deleted_at is null)) and exists(select 1 from public.student_enrollments e
     where e.email=v_email and e.school_year=s.school_year and public.quiz_session_class_allowed(s.id,e.class_code)));
  return jsonb_build_object('sessions',result,'role',case when teacher then 'teacher' else 'student' end,'grade',student_grade);
 end if;
 if p_action='sessions' then
  select coalesce(jsonb_agg(to_jsonb(s)||jsonb_build_object('title',v.document->>'title','revision',v.revision) order by s.created_at desc),'[]') into result
   from public.quiz_sessions s join public.quiz_versions v on v.id=s.version_id where s.owner_id=uid;
  return jsonb_build_object('sessions',result);
 end if;
 if p_action='list' then
  select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'revision',r.revision,'title',r.draft->>'title','catalog',r.draft->'catalog','updated_at',r.updated_at) order by r.updated_at desc),'[]') into result
   from public.quiz_banks r where r.owner_id=uid and (coalesce(p_data->>'search','')='' or strpos(lower(r.draft::text),lower(p_data->>'search'))>0);
  return jsonb_build_object('banks',result);
 end if;
 if p_action in ('get','save','publish','versions') then
  target:=(p_data->>'bank_id')::uuid;
  -- 同一份題庫的首次建立、修改與版本固定共用交易鎖。
  perform pg_advisory_xact_lock(hashtextextended(target::text,0));
  select * into bank from public.quiz_banks where id=target for update;
  if bank.id is not null and bank.owner_id<>uid then raise exception 'bank_unavailable'; end if;
  if p_action='save' then
   d:=p_data->'document';perform public.quiz_validate(d);
   if bank.id is null then
    if (p_data->>'expected_revision')::integer is distinct from 0 then raise exception 'revision_changed'; end if;
    insert into public.quiz_banks(id,owner_id,draft) values(target,uid,d) returning * into bank;
   elsif bank.draft=d then null; -- 遺失回應後重試，不重複增加 revision。
   else
    if bank.revision is distinct from (p_data->>'expected_revision')::integer then raise exception 'revision_changed'; end if;
    update public.quiz_banks set draft=d,revision=revision+1,updated_at=now() where id=target returning * into bank;
   end if;
  end if;
  if bank.id is null then raise exception 'bank_unavailable'; end if;
  if p_action='publish' then
   if bank.revision is distinct from (p_data->>'expected_revision')::integer then raise exception 'revision_changed'; end if;
   select * into ver from public.quiz_versions where bank_id=bank.id and revision=bank.revision;
   if ver.id is not null then return to_jsonb(ver); end if;
   if jsonb_path_exists(bank.draft,'$.blocks[*].**.media[*]') then raise exception 'media_freeze_required'; end if;
   perform public.quiz_validate(bank.draft);
   insert into public.quiz_versions(bank_id,revision,document) values(bank.id,bank.revision,bank.draft)
    on conflict(bank_id,revision) do nothing;
   select * into ver from public.quiz_versions where bank_id=bank.id and revision=bank.revision;
   return to_jsonb(ver);
  elsif p_action='versions' then
   select coalesce(jsonb_agg(to_jsonb(v) order by revision desc),'[]') into result from public.quiz_versions v where bank_id=bank.id;
   return jsonb_build_object('versions',result);
  end if;
  return to_jsonb(bank);
 end if;
 if p_action='open' then
  select v.* into ver from public.quiz_versions v join public.quiz_banks k on k.id=v.bank_id where v.id=(p_data->>'version_id')::uuid and k.owner_id=uid;
  if ver.id is null then raise exception 'version_unavailable'; end if;
  mode:=coalesce(p_data->>'access_mode','classroom');
  if mode not in ('classroom','personal','practice') or jsonb_typeof(p_data->'class_codes') is distinct from 'array' then raise exception 'invalid_session'; end if;
  if (mode in ('classroom','practice') and jsonb_array_length(p_data->'class_codes') not between 1 and 20)
   or (mode='personal' and jsonb_array_length(p_data->'class_codes')<>0) or (p_data->>'school_year')::integer not between 100 and 200
   or exists(select 1 from jsonb_array_elements_text(p_data->'class_codes') c where c !~ '^[3469][0-9]{2}$')
   or coalesce(p_data->>'reveal','') not in ('immediate','complete') then raise exception 'invalid_session'; end if;
  insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options,access_mode)
   values((p_data->>'session_id')::uuid,uid,ver.id,(p_data->>'school_year')::integer,p_data->'class_codes',p_data->>'reveal',
    coalesce((p_data->>'shuffle_questions')::boolean,false),coalesce((p_data->>'shuffle_options')::boolean,false),mode) on conflict(id) do nothing;
  select * into sess from public.quiz_sessions where id=(p_data->>'session_id')::uuid;
  if sess.owner_id<>uid or sess.version_id<>ver.id or sess.class_codes<>p_data->'class_codes' or sess.school_year<>(p_data->>'school_year')::integer
   or sess.reveal<>p_data->>'reveal' or sess.shuffle_questions<>coalesce((p_data->>'shuffle_questions')::boolean,false)
   or sess.shuffle_options<>coalesce((p_data->>'shuffle_options')::boolean,false) or sess.access_mode<>mode then raise exception 'session_conflict'; end if;
  return to_jsonb(sess);
 end if;
 select * into sess from public.quiz_sessions where id=(p_data->>'session_id')::uuid;
 if sess.id is null then raise exception 'session_unavailable'; end if;
 if sess.access_mode='self' and not exists(select 1 from public.quiz_generated_papers g where g.session_id=sess.id and g.user_id=uid) then raise exception 'session_unavailable'; end if;
 if p_action in ('monitor','close') then
  if sess.owner_id<>uid then raise exception 'session_unavailable'; end if;
  if p_action='close' then
   begin
    prior_lock_timeout:=current_setting('lock_timeout');perform set_config('lock_timeout','1000ms',true);
    perform pg_advisory_xact_lock(1364542026,hashtext(sess.id::text));
    perform set_config('lock_timeout',prior_lock_timeout,true);
   exception when lock_not_available then raise exception 'session_busy';end;
   update public.quiz_sessions set status='closed' where id=sess.id;return jsonb_build_object('ok',true);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('user_id',a.user_id,'answered',(select count(*) from public.quiz_response_rows(a.id) x where x.completed),
   'total',jsonb_array_length(a.question_order),'class_code',e.class_code,'seat_no',e.seat_no,'display_name',e.display_name,
   'last_submitted_at',(select max(x.created_at) from public.quiz_response_rows(a.id) x where x.completed)) order by a.created_at),'[]') into result
   from public.quiz_attempts a join auth.users u on u.id=a.user_id
    left join public.student_enrollments e on e.email=lower(u.email) and e.school_year=sess.school_year
   where a.session_id=sess.id;
  return jsonb_build_object('status',sess.status,'students',result);
 end if;
 if p_action not in ('join','resume','submit','self_check','view_question') then raise exception 'invalid_action'; end if;
 if sess.access_mode='personal' then
  if not teacher or sess.owner_id<>uid then raise exception 'session_unavailable'; end if;
 else
  if teacher then raise exception 'student_required'; end if;
  select lower(u.email) into v_email from auth.users u where u.id=uid and u.email_confirmed_at is not null;
  select e.class_code into cls from public.student_enrollments e where e.email=v_email and e.school_year=sess.school_year and public.quiz_session_class_allowed(sess.id,e.class_code);
  if cls is null then raise exception 'roster_required'; end if;
 end if;
 -- Shared admission protects close; per-attempt locks isolate different students.
 if p_action='join' and sess.access_mode='classroom' then
  perform pg_advisory_xact_lock(1364542026,hashtext(sess.id::text));
 elsif p_action in ('join','submit','self_check') then
  perform pg_advisory_xact_lock_shared(1364542026,hashtext(sess.id::text));
 end if;
 if p_action in ('join','submit','self_check') then select * into sess from public.quiz_sessions where id=sess.id;end if;
 if p_action='resume' then
  select * into att from public.quiz_attempts where session_id=sess.id and user_id=uid for share;
 else
  select * into att from public.quiz_attempts where session_id=sess.id and user_id=uid for update;
 end if;
 if att.id is null then
  if p_action<>'join' or sess.status<>'open' then raise exception 'attempt_unavailable'; end if;
  select * into ver from public.quiz_versions where id=sess.version_id;d:=ver.document;
  select count(*) into n from public.quiz_attempts where session_id=sess.id;
  if sess.access_mode='classroom' and n>=29 then raise exception 'session_full'; end if;
  -- 暫定：題組位置固定，只在單題區塊的既有位置間亂序。
  with blocks as (select value b, ordinality pos from jsonb_array_elements(d->'blocks') with ordinality),
   singles as (select b,row_number() over(order by case when sess.shuffle_questions then random() else pos::float end) rn from blocks where jsonb_array_length(b->'questions')=1),
   slots as (select pos,row_number() over(order by pos) rn from blocks where jsonb_array_length(b->'questions')=1),
   arranged as (select s.b,t.pos from singles s join slots t using(rn) union all select b,pos from blocks where jsonb_array_length(b->'questions')>1)
   select jsonb_agg(q->>'id' order by pos,ord) into qo from arranged,lateral jsonb_array_elements(b->'questions') with ordinality x(q,ord);
  for b in select value from jsonb_array_elements(d->'blocks') loop
   for q in select value from jsonb_array_elements(b->'questions') loop
    select coalesce(jsonb_agg(o->>'id' order by case when sess.shuffle_options then random() else ord::float end),'[]') into result
     from jsonb_array_elements(coalesce(q->'options','[]')) with ordinality x(o,ord);
    oo:=oo||jsonb_build_object(q->>'id',result);
   end loop;
  end loop;
  insert into public.quiz_attempts(session_id,user_id,question_order,option_orders) values(sess.id,uid,qo,oo) on conflict(session_id,user_id) do nothing;
  select * into att from public.quiz_attempts where session_id=sess.id and user_id=uid for update;
 end if;
 if p_action='view_question' then
  qid:=p_data->>'question_id';
  select value#>>'{}' into cls from jsonb_array_elements(att.question_order) with ordinality x(value,ord) where not exists(select 1 from public.quiz_response_rows(att.id) a where a.completed and a.question_id=x.value#>>'{}') order by ord limit 1;
  if cls is distinct from qid then raise exception 'question_order';end if;
  if to_regprocedure('public.quiz_answer_guard(uuid,text,boolean)') is not null then perform public.quiz_answer_guard(att.id,qid,false);end if;
  return jsonb_build_object('viewed',true);
 end if;
 if ver.id is null then select * into ver from public.quiz_versions where id=sess.version_id;d:=ver.document;end if;
 if p_action in('submit','self_check') then
  qid:=p_data->>'question_id';response:=p_data->'response';
  select bx,qx into b,q from jsonb_array_elements(d->'blocks') bx,lateral jsonb_array_elements(bx->'questions') qx where qx->>'id'=qid;
  if q is null then raise exception 'question_unavailable'; end if;
  if q->>'type'='open' then
   select * into open_row from public.quiz_open_responses where attempt_id=att.id and question_id=qid;
   if open_row.attempt_id is null or(p_action='self_check' and open_row.status<>'self_checked') then
    if sess.status<>'open' then raise exception 'session_closed';end if;
    select value#>>'{}' into cls from jsonb_array_elements(att.question_order) with ordinality x(value,ord) where not exists(select 1 from public.quiz_response_rows(att.id) a where a.completed and a.question_id=x.value#>>'{}') order by ord limit 1;
    if cls is distinct from qid then raise exception 'question_order';end if;
    if p_action='submit' and to_regprocedure('public.quiz_answer_guard(uuid,text,boolean)') is not null then
     result:=public.quiz_answer_guard(att.id,qid,true);if result ? 'warning' then return result;end if;
    end if;
   end if;
   new_answer:=public.quiz_open_submit(att.id,q,p_data,p_action='self_check');
  elsif p_action='self_check' then raise exception 'invalid_question_type';
  else
   if exists(select 1 from public.quiz_open_responses where attempt_id=att.id and(request_id=(p_data->>'request_id')::uuid or self_check_request_id=(p_data->>'request_id')::uuid)) then raise exception 'submission_conflict';end if;
  select * into ans from public.quiz_answers where attempt_id=att.id and (question_id=qid or request_id=(p_data->>'request_id')::uuid) limit 1;
  if ans.attempt_id is not null then
   if ans.question_id<>qid or ans.request_id is distinct from (p_data->>'request_id')::uuid or ans.response is distinct from response then raise exception 'submission_conflict'; end if;
  else
   if sess.status<>'open' then raise exception 'session_closed'; end if;
   select value#>>'{}' into cls from jsonb_array_elements(att.question_order) with ordinality x(value,ord) where not exists(select 1 from public.quiz_response_rows(att.id) a where a.completed and a.question_id=x.value#>>'{}') order by ord limit 1;
   if cls is distinct from qid then raise exception 'question_order'; end if;
   if to_regprocedure('public.quiz_answer_guard(uuid,text,boolean)') is not null then
    result:=public.quiz_answer_guard(att.id,qid,true);if result ? 'warning' then return result;end if;
   end if;
   if jsonb_typeof(response) is distinct from 'string' or length(response#>>'{}') not between 1 and 2000 or (p_data->>'request_id')::uuid is null then raise exception 'invalid_response'; end if;
   if q->>'type'='single' then
    if not exists(select 1 from jsonb_array_elements(q->'options') opt where opt->>'id'=response#>>'{}') then raise exception 'invalid_response'; end if;
    correct:=(response#>>'{}')=q->'answer'->>'option_id';
   elsif q->>'type'='fields' then
    correct:=public.quiz_fields_grade(q,response#>>'{}');
   elsif q->>'type'='short' then
    -- 暫定僅去頭尾空白，比對教師列出的可接受答案，保留原始 response。
    -- Opt-in normal math answers v1
    if q->'answer'->>'normalizer'='math-v1' and (response#>>'{}')~'[0-9０-９][[:space:]　]+[0-9０-９]' then raise exception 'invalid_response';end if;
    correct:=case when q->'answer'->>'normalizer'='math-v1' then
     exists(select 1 from jsonb_array_elements_text(q->'answer'->'accepted') a
      where public.quiz_math_answer_normalize(a)=public.quiz_math_answer_normalize(response#>>'{}'))
     else exists(select 1 from jsonb_array_elements_text(q->'answer'->'accepted') a where trim(a)=trim(response#>>'{}')) end;
   else raise exception 'invalid_question_type';end if;
   insert into public.quiz_answers(attempt_id,question_id,request_id,response,correct) values(att.id,qid,(p_data->>'request_id')::uuid,response,correct);
   new_answer:=true;
  end if;
  end if;
 end if;
 select count(*)filter(where a.completed)=jsonb_array_length(att.question_order),coalesce(jsonb_object_agg(a.question_id,a.response),'{}'),coalesce(jsonb_object_agg(a.question_id,a.correct),'{}'),coalesce(jsonb_object_agg(a.question_id,a.completed),'{}') into done,responses,correct_map,completed_map from public.quiz_response_rows(att.id) a;
 select coalesce(jsonb_object_agg(question_id,jsonb_build_object('status',status,'rating',self_rating,'note',self_note)),'{}') into open_state from public.quiz_open_responses where attempt_id=att.id;
 for b in select value from jsonb_array_elements(d->'blocks') loop
  select not exists(select 1 from jsonb_array_elements(b->'questions') x where not coalesce((completed_map->>(x->>'id'))::boolean,false)) into groupdone;
  for q in select value from jsonb_array_elements(b->'questions') loop
   if q->>'type'='open' and responses ? (q->>'id') then
    reviews:=reviews||jsonb_build_array(jsonb_build_object('question_id',q->>'id','answer',q->'answer','explanation',q->'explanation','correct',null,'assessment',open_state->(q->>'id')));
   elsif q->>'type'<>'open' and((sess.reveal='complete' and done) or(sess.reveal='immediate' and groupdone)) then
    reviews:=reviews||jsonb_build_array(jsonb_build_object('question_id',q->>'id','answer',q->'answer','explanation',q->'explanation','correct',correct_map->(q->>'id')));
   end if;
  end loop;
 end loop;
 if sess.access_mode='self' then
  select display_name into cls from public.quiz_generated_papers where session_id=sess.id and user_id=uid;
  if cls is not null then d:=jsonb_set(d,'{title}',to_jsonb(cls));end if;
 end if;
 if to_regprocedure('public.quiz_leaf_result(uuid,boolean)') is not null then leaf:=public.quiz_leaf_result(att.id,new_answer);end if;
 result:=jsonb_build_object('attempt_id',att.id,'session_id',sess.id,'version_id',sess.version_id,'status',sess.status,'complete',done,'leaf',leaf,'responses',responses,'reviews',reviews);
 if exists(select 1 from jsonb_array_elements(d->'blocks') bx,lateral jsonb_array_elements(bx->'questions') qx where qx->>'type'='open') then result:=result||jsonb_build_object('open_responses',open_state);end if;
 if compact then return result||jsonb_build_object('compact',true);end if;
 return result||jsonb_build_object('document',public.quiz_student_document(d,att.question_order,att.option_orders));
end $function$
;
CREATE OR REPLACE FUNCTION public.quiz_leaf_result_before_learning(aid uuid, new_answer boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a public.quiz_attempts;s public.quiz_sessions;v public.quiz_versions;settings public.quiz_integrity_settings;
 n integer;c integer;timed integer;fp text;award_id uuid;existing public.quiz_leaf_awards;g integer;
begin
 select * into a from public.quiz_attempts where id=aid and user_id=auth.uid();if a.id is null then raise exception 'attempt_unavailable';end if;
 select * into s from public.quiz_sessions where id=a.session_id;
 select * into v from public.quiz_versions where id=s.version_id;
 select * into settings from public.quiz_integrity_settings where id;
 select count(*) into n from jsonb_array_elements(v.document->'blocks') bx,lateral jsonb_array_elements(bx->'questions') qx where qx->>'type'<>'open';
 select count(*) filter(where correct) into c from public.quiz_answers where attempt_id=aid;
 select * into existing from public.quiz_leaf_awards where attempt_id=aid;
 if existing.id is not null then return jsonb_build_object('earned',true,'earned_now',false,'id',existing.id);end if;
 if n<10 then return jsonb_build_object('earned',false,'reason','short_paper');end if;
 if not settings.enabled or coalesce(public.is_teacher(),false) or s.access_mode not in ('practice','self') then return jsonb_build_object('earned',false,'reason','not_eligible');end if;
 if (select count(*) from public.quiz_response_rows(aid) where completed)<>jsonb_array_length(a.question_order) then return jsonb_build_object('earned',false,'reason','incomplete');end if;
 if c*100<n*60 then return jsonb_build_object('earned',false,'reason','accuracy');end if;
 select count(*) into timed from public.quiz_question_timing t where t.attempt_id=aid and t.accepted_seconds>=settings.min_seconds and exists(select 1 from jsonb_array_elements(v.document->'blocks') bx,lateral jsonb_array_elements(bx->'questions') qx where qx->>'id'=t.question_id and qx->>'type'<>'open');
 if timed<>n then return jsonb_build_object('earned',false,'reason','timing_unverified');end if;
 select md5(string_agg(x.fingerprint,'' order by x.fingerprint)) into fp from (
  select md5((q->'prompt')::text||coalesce((select string_agg((o->'content')::text,'' order by (o->'content')::text) from jsonb_array_elements(q->'options') o),'')) fingerprint
  from jsonb_array_elements(v.document->'blocks') b,lateral jsonb_array_elements(b->'questions') q where q->>'type'<>'open') x;
 g:=substring(v.document->'catalog'->>'volume' from '^([3469])')::integer;
 if g is null or not exists(select 1 from public.student_enrollments e join auth.users u on lower(u.email)=e.email where u.id=auth.uid() and u.email_confirmed_at is not null and e.school_year=s.school_year and public.quiz_session_class_allowed(s.id,e.class_code) and left(e.class_code,1)::integer=g) then return jsonb_build_object('earned',false,'reason','not_eligible');end if;
 if new_answer then
  insert into public.quiz_leaf_awards(user_id,attempt_id,fingerprint,grade,total,correct) values(a.user_id,aid,fp,g,n,c) on conflict do nothing returning id into award_id;
 end if;
 return jsonb_build_object('earned',award_id is not null,'earned_now',award_id is not null,'id',award_id,'reason',case when award_id is null then 'same_content_already_earned' else 'earned' end);
end $function$
;
CREATE OR REPLACE FUNCTION public.quiz_library_sessions(p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare identity jsonb; papers jsonb;
begin
 identity:=public.quiz_student_identity();
 with visible as materialized (
  select s.id,s.version_id,s.status,s.access_mode,g.display_name,g.created_at saved_at,g.config,g.actual_distribution
  from public.quiz_sessions s left join public.quiz_generated_papers g on g.session_id=s.id and g.user_id=auth.uid()
  where (s.access_mode<>'practice' or s.library_visible) and s.access_mode in ('practice','self') and (s.access_mode<>'self' or (g.session_id is not null and g.deleted_at is null))
  and exists(select 1 from public.student_enrollments e where e.email=identity->>'email' and e.school_year=s.school_year and public.quiz_session_class_allowed(s.id,e.class_code))
 ), progress as (
  select a.session_id,count(x.question_id) answered,count(*) filter(where x.correct) correct
  from visible s join public.quiz_attempts a on a.session_id=s.id and a.user_id=auth.uid()
  left join lateral public.quiz_response_rows(a.id) x on x.completed group by a.session_id
 )
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'version_id',s.version_id,'title',v.title,'catalog',v.catalog,'status',s.status,
 'generated',s.access_mode='self','display_name',s.display_name,'saved_at',s.saved_at,'generated_kind',s.config->>'kind',
 'unit_ids',s.config->'units','distribution',s.actual_distribution,
 'learning_point',case when s.config->>'kind'='extension' then regexp_replace(v.catalog->>'unit','^同重點再練習[：:]\s*','') else null end,
 'total',v.total,'answered',coalesce(p.answered,0),'correct',coalesce(p.correct,0))
 order by v.catalog->>'volume',v.catalog->>'subject',v.catalog->>'unit'),'[]') into papers
 from visible s join public.quiz_version_meta v on v.version_id=s.version_id left join progress p on p.session_id=s.id;
 return jsonb_build_object('sessions',papers,'role',identity->>'role','grade',identity->'grade','identity',public.quiz_nav_identity(identity->>'email'));
end $function$
;
CREATE OR REPLACE FUNCTION public.quiz_monitor_before_learning(p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid:=auth.uid();sess public.quiz_sessions;result jsonb;
begin
 if uid is null then raise exception 'login_required';end if;
 if not coalesce(public.is_teacher(),false) then raise exception 'teacher_required';end if;
 select * into sess from public.quiz_sessions where id=(p_data->>'session_id')::uuid;
 if sess.id is null or sess.owner_id<>uid then raise exception 'session_unavailable';end if;
 if sess.access_mode='self' and not exists(select 1 from public.quiz_generated_papers g where g.session_id=sess.id and g.user_id=uid) then raise exception 'session_unavailable';end if;
 with attempts as materialized (select * from public.quiz_attempts where session_id=sess.id),
 progress as materialized (
  select a.id attempt_id,count(*) answered,max(x.created_at) last_submitted_at
  from attempts a cross join lateral public.quiz_response_rows(a.id) x where x.completed group by a.id
 )
 select coalesce(jsonb_agg(jsonb_build_object('user_id',a.user_id,'answered',coalesce(p.answered,0),
  'total',jsonb_array_length(a.question_order),'class_code',e.class_code,'seat_no',e.seat_no,'display_name',e.display_name,
  'last_submitted_at',p.last_submitted_at) order by a.created_at),'[]'::jsonb) into result
 from attempts a join auth.users u on u.id=a.user_id
 left join public.student_enrollments e on e.email=lower(u.email) and e.school_year=sess.school_year
 left join progress p on p.attempt_id=a.id;
 return jsonb_build_object('status',sess.status,'students',result);
end$function$
;
CREATE OR REPLACE FUNCTION public.quiz_paper_card(p_session uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select jsonb_build_object('id',s.id,'version_id',s.version_id,'title',v.title,'catalog',v.catalog,'status',s.status,
 'generated',s.access_mode='self','display_name',g.display_name,'saved_at',g.created_at,'generated_kind',g.config->>'kind',
 'unit_ids',g.config->'units','distribution',g.actual_distribution,
 'learning_point',case when g.config->>'kind'='extension' then regexp_replace(v.catalog->>'unit','^同重點再練習[：:]\s*','') else null end,
 'total',v.total,
 'answered',coalesce((select count(x.question_id) from public.quiz_attempts a join lateral public.quiz_response_rows(a.id) x on x.completed where a.session_id=s.id and a.user_id=auth.uid()),0),
 'correct',coalesce((select count(*) filter(where x.correct) from public.quiz_attempts a join lateral public.quiz_response_rows(a.id) x on x.completed where a.session_id=s.id and a.user_id=auth.uid()),0))
 from public.quiz_sessions s join public.quiz_generated_papers g on g.session_id=s.id and g.user_id=auth.uid() and g.deleted_at is null
 join public.quiz_version_meta v on v.version_id=s.version_id
 where s.id=p_session and s.access_mode='self'
$function$
;
CREATE OR REPLACE FUNCTION public.quiz_media_visible(p_url text, p_attempt uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 if not exists(select 1 from public.student_enrollments e where e.email=v_email and e.school_year=sess.school_year and public.quiz_session_class_allowed(sess.id,e.class_code)) then raise exception 'roster_required';end if;
 select document into d from public.quiz_versions where id=sess.version_id;
 -- Match the immutable attempt's question and option orders, including material.
 if exists(select 1 from jsonb_array_elements(d->'blocks') bx cross join lateral jsonb_array_elements(bx->'questions') qx
  where att.question_order ? (qx->>'id') and (
   exists(select 1 from jsonb_path_query(jsonb_build_array(bx->'material',qx->'prompt'),'$.**.media[*].url') u where u#>>'{}'=p_url)
   or exists(select 1 from jsonb_array_elements(coalesce(qx->'options','[]')) o
    where coalesce(att.option_orders->(qx->>'id'),'[]') ? (o->>'id')
    and exists(select 1 from jsonb_path_query(o->'content','$.**.media[*].url') u where u#>>'{}'=p_url)))) then return true;end if;
 select count(*)=jsonb_array_length(att.question_order) into done from public.quiz_response_rows(att.id) where completed;
 if exists(select 1 from jsonb_array_elements(d->'blocks') bx,lateral jsonb_array_elements(bx->'questions') qx
  where qx->>'type'='open' and exists(select 1 from public.quiz_open_responses r where r.attempt_id=att.id and r.question_id=qx->>'id')
  and exists(select 1 from jsonb_path_query(qx->'explanation','$.**.media[*].url') u where u#>>'{}'=p_url)) then return true;end if;
 for b in select value from jsonb_array_elements(d->'blocks') loop
  select not exists(select 1 from jsonb_array_elements(b->'questions') x where not exists(select 1 from public.quiz_response_rows(att.id) a where a.completed and a.question_id=x->>'id')) into groupdone;
  if (sess.reveal='complete' and done) or (sess.reveal='immediate' and groupdone) then
   if exists(select 1 from jsonb_array_elements(b->'questions') x cross join lateral jsonb_path_query(x->'explanation','$.**.media[*].url') u where u#>>'{}'=p_url) then return true;end if;
  end if;
 end loop;
 return false;
end $function$
;
CREATE OR REPLACE FUNCTION public.quiz_wrong_questions_before_learning(p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare identity jsonb; grade integer; page integer; subject text:=coalesce(p_data->>'subject','');unit text:=coalesce(p_data->>'unit','');
 r record; att public.quiz_attempts;sess public.quiz_sessions;b jsonb;q jsonb;options jsonb;response jsonb;source public.quiz_question_pool;v_course text;can_extend boolean:=false;result jsonb;
begin
 identity:=public.quiz_student_identity();grade:=(identity->>'grade')::integer;
 if coalesce(p_data->>'grade','') not in ('','3','4','6','9') or coalesce(p_data->>'page','0') !~ '^[0-9]{1,5}$' or length(subject)>30 or length(unit)>200 then raise exception 'invalid_request';end if;
 page:=coalesce((p_data->>'page')::integer,0);
 if coalesce(p_data->>'action','list')='detail' then
  if p_data->>'attempt_id' is null or p_data->>'question_id' is null then raise exception 'wrong_question_unavailable';end if;
  select * into r from public.quiz_wrong_refs(grade,p_data->>'attempt_id',p_data->>'question_id');
  if r.attempt_id is null then raise exception 'wrong_question_unavailable';end if;
  select * into sess from public.quiz_sessions where id=r.session_id;
  if sess.access_mode='self' and not exists(select 1 from public.quiz_generated_papers where session_id=sess.id and user_id=auth.uid()) then raise exception 'session_unavailable';end if;
  select * into att from public.quiz_attempts where id=r.attempt_id and user_id=auth.uid();
  -- List eligibility historically checks missing ids; resume disclosure additionally
  -- requires the exact answer count. Retain that distinction for malformed records.
  if sess.reveal='complete' and (select count(*) from public.quiz_response_rows(att.id) where completed)<>jsonb_array_length(att.question_order) then raise exception 'wrong_question_unavailable';end if;
  select bx,qx into b,q from public.quiz_versions v cross join lateral jsonb_array_elements(v.document->'blocks') bx
   cross join lateral jsonb_array_elements(bx->'questions') qx where v.id=r.version_id and qx->>'id'=r.question_id;
  if q is null or not(att.question_order ? r.question_id) then raise exception 'wrong_question_unavailable';end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',o->>'id','content',o->'content') order by ord),'[]') into options
   from jsonb_array_elements(coalesce(q->'options','[]')) o join jsonb_array_elements_text(coalesce(att.option_orders->r.question_id,'[]')) with ordinality x(id,ord) on o->>'id'=x.id;
  select x.response into response from public.quiz_answers x where x.attempt_id=att.id and x.question_id=r.question_id;
  source:=public.quiz_extension_source(r.version_id,r.question_id,r.catalog,grade);
  if source.question_id is not null then
   select coalesce(m.course_id,'115-1-hanlin-g3-math') into v_course from public.quiz_question_pool p left join public.quiz_pool_membership m on m.question_id=p.question_id where p.question_id=source.question_id;
   select exists(select 1 from public.quiz_question_pool p left join public.quiz_pool_membership m on m.question_id=p.question_id
    where p.usable and p.publisher_explanation and coalesce(m.knowledge_reliable,true) and coalesce(m.course_id,'115-1-hanlin-g3-math')=v_course
    and p.knowledge_code=source.knowledge_code and p.group_key<>source.group_key and p.difficulty<=source.difficulty) into can_extend;
  end if;
  return jsonb_build_object('attempt_id',r.attempt_id,'session_id',r.session_id,'version_id',r.version_id,'question_id',r.question_id,'answered_at',r.answered_at,
   'title',r.title,'catalog',r.catalog,'number',array_position(r.ordered_ids,r.question_id),'preview',left(q->'prompt'->>'text',160),'can_extend',can_extend,
   'question',jsonb_build_object('id',q->>'id','type',q->>'type','prompt',q->'prompt','block_id',b->>'id','material',b->'material','options',options)||case when q->>'type'='fields' then jsonb_build_object('fields',(select coalesce(jsonb_agg(jsonb_build_object('id',f->>'id','label',f->>'label','input',f->>'input')
 ||case when f ? 'options' then jsonb_build_object('options',(select jsonb_agg(jsonb_build_object('id',o->>'id','content',o->'content')order by ord)from jsonb_array_elements(f->'options')with ordinality opts(o,ord)))else '{}'::jsonb end order by n),'[]'::jsonb)
 from jsonb_array_elements(q->'fields')with ordinality fields(f,n)))else '{}'::jsonb end,
   'review',jsonb_build_object('question_id',r.question_id,'answer',q->'answer','explanation',q->'explanation','correct',false),'response',response);
 end if;
 if coalesce(p_data->>'action','list')<>'list' then raise exception 'invalid_request';end if;
 with refs as materialized (select * from public.quiz_wrong_refs(grade)), filtered as materialized (
  select * from refs where (subject='' or coalesce(catalog->>'subject','未分類')=subject) and (unit='' or coalesce(catalog->>'unit',title)=unit)
 ), paged as (select * from filtered order by answered_at desc,attempt_id,question_id limit 20 offset page*20)
 select jsonb_build_object('role',identity->>'role','grade',grade,
  'facets',(select coalesce(jsonb_agg(f order by f->>'subject',f->>'unit'),'[]') from (select distinct jsonb_build_object('subject',coalesce(catalog->>'subject','未分類'),'unit',coalesce(catalog->>'unit',title)) f from refs) t),
  'total',(select count(*) from filtered),
  'items',(select coalesce(jsonb_agg(jsonb_build_object('attempt_id',p.attempt_id,'session_id',p.session_id,'question_id',p.question_id,'answered_at',p.answered_at,
   'title',p.title,'catalog',p.catalog,'number',array_position(p.ordered_ids,p.question_id),'preview',m.question_index->p.question_id->>'preview') order by p.answered_at desc,p.attempt_id,p.question_id),'[]')
   from paged p join public.quiz_version_meta m on m.version_id=p.version_id)) into result;
 return result;
end $function$
;
CREATE OR REPLACE FUNCTION public.quiz_wrong_refs(p_grade integer, p_attempt text DEFAULT NULL::text, p_question text DEFAULT NULL::text)
 RETURNS TABLE(attempt_id uuid, session_id uuid, version_id uuid, question_id text, answered_at timestamp with time zone, title text, catalog jsonb, ordered_ids text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 with owned as materialized (
  select a.id,a.session_id,s.version_id,s.reveal,v.title,v.catalog,v.question_index,v.block_questions,
   array(select jsonb_array_elements_text(a.question_order)) ordered_ids
  from public.quiz_attempts a join public.quiz_sessions s on s.id=a.session_id
  join public.quiz_version_meta v on v.version_id=s.version_id
  where a.user_id=auth.uid() and (p_attempt is null or a.id=case when p_attempt ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then p_attempt::uuid end) and s.access_mode<>'personal'
  and coalesce(nullif(left(v.catalog->>'volume',1),''),p_grade::text)=p_grade::text
  and exists(select 1 from public.student_enrollments e join auth.users u on lower(u.email)=e.email
   where u.id=auth.uid() and u.email_confirmed_at is not null and e.school_year=s.school_year and public.quiz_session_class_allowed(s.id,e.class_code))
 ), progress as materialized (
  select a.id attempt_id,jsonb_object_agg(x.question_id,true) answered from owned a cross join lateral public.quiz_response_rows(a.id) x where x.completed group by a.id
 )
 select a.id,a.session_id,a.version_id,x.question_id,x.created_at,a.title,a.catalog,a.ordered_ids
 from owned a join progress p on p.attempt_id=a.id join public.quiz_answers x on x.attempt_id=a.id and not x.correct
 where (p_question is null or x.question_id=p_question)
 and a.question_index ? x.question_id
 and ((a.reveal='complete' and p.answered ?& a.ordered_ids)
  or (a.reveal='immediate' and p.answered @> (a.block_questions->(a.question_index->x.question_id->>'block_id'))))
$function$
;
CREATE OR REPLACE FUNCTION public.quiz_compose(p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 uid uuid:=auth.uid(); cls text; v_email text; kind text:=coalesce(p_data->>'kind','self');
 amount integer; units jsonb; seed text; conf jsonb; old public.quiz_generated_papers;
 selected text[]:='{}'; chosen public.quiz_question_pool; source public.quiz_question_pool;
 reviewed jsonb; blocks jsonb:='[]'; distribution jsonb; doc jsonb; b_id uuid; v_id uuid; s_id uuid;
 request uuid; d integer; quota integer; count_now integer; result jsonb; paper_name text;
 mode text:=coalesce(p_data->>'difficulty','medium'); passes integer[]; pass integer;
 target_easy integer; target_medium integer; target_hard integer; shortages jsonb;
 selected_course text:=coalesce(p_data->>'course_id','115-1-hanlin-g3-math'); course public.quiz_courses; source_version_id uuid; seen_counts jsonb;
 candidates public.quiz_draw_candidate[]; candidate public.quiz_draw_candidate;
 selected_groups text[]:='{}'; knowledge_counts jsonb:='{}'; unit_counts jsonb:='{}';
begin
 if uid is null then raise exception 'login_required'; end if;
 if coalesce(public.is_teacher(),false) then raise exception 'student_required'; end if;
 select lower(u.email) into v_email from auth.users u where u.id=uid and u.email_confirmed_at is not null;
 select e.class_code into cls from public.student_enrollments e where e.email=v_email and e.school_year=115 and e.class_code ~ '^[3469][0-9]{2}$';
 if cls is null then raise exception 'roster_required'; end if;
 if kind='self' then
  select * into course from public.quiz_courses c where c.id=selected_course and c.enabled and c.grade=left(cls,1)::integer;
  if course.id is null then raise exception '%',case when not(p_data ? 'course_id') then 'roster_required' else 'course_unavailable' end;end if;
 end if;
 if jsonb_typeof(p_data) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_data) k where k not in ('kind','count','units','request_id','attempt_id','question_id','name','difficulty','course_id','name_work','name_character')) then raise exception 'invalid_request'; end if;
 if exists(select 1 from jsonb_each(p_data) e where e.key in ('name_work','name_character') and (kind<>'self' or jsonb_typeof(e.value)<>'string' or length(e.value#>>'{}')>80)) then raise exception 'invalid_request';end if;
 if coalesce(p_data->>'name_character','')<>'' and coalesce(p_data->>'name_work','')='' then raise exception 'paper_name_choice_invalid';end if;
 if p_data ? 'course_id' and (kind<>'self' or jsonb_typeof(p_data->'course_id') is distinct from 'string') then raise exception 'invalid_request';end if;
 if p_data ? 'difficulty' and (kind<>'self' or jsonb_typeof(p_data->'difficulty') is distinct from 'string' or mode not in ('easy','medium','hard')) then raise exception 'invalid_request';end if;
 -- Ignore legacy client names; the insert trigger is the sole naming authority.
 if kind not in ('self','extension') or coalesce(p_data->>'count','') !~ '^[0-9]{1,2}$' then raise exception 'invalid_request'; end if;
 amount:=(p_data->>'count')::integer;
 if (kind='self' and amount not in (5,10,15,20)) or (kind='extension' and amount not in (3,5)) then raise exception 'invalid_request'; end if;
 request:=(p_data->>'request_id')::uuid;if request is null then raise exception 'invalid_request'; end if;
 units:=coalesce(p_data->'units','[]');
 if jsonb_typeof(units) is distinct from 'array' or jsonb_array_length(units)>30 or exists(select 1 from jsonb_array_elements(units) u where u::text !~ '^[1-9][0-9]?$' or (kind='self' and not(course.definition->'units' ? (u#>>'{}')))) then raise exception 'invalid_request'; end if;
 select coalesce(jsonb_agg(n order by n),'[]') into units from (select distinct value n from jsonb_array_elements(units)) t;
 if kind='self' and (jsonb_array_length(units)=0 or p_data ? 'question_id' or p_data ? 'attempt_id') then raise exception 'invalid_request'; end if;
 conf:=jsonb_build_object('kind',kind,'count',amount,'units',units,'attempt_id',p_data->>'attempt_id','question_id',p_data->>'question_id');
 -- Keep omitted difficulty compatible with already-saved legacy request IDs.
 if p_data ? 'difficulty' then conf:=conf||jsonb_build_object('difficulty',mode);end if;
 if p_data ? 'course_id' then conf:=conf||jsonb_build_object('course_id',selected_course);end if;
 if coalesce(p_data->>'name_work','')<>'' then conf:=conf||jsonb_build_object('name_work',p_data->>'name_work');end if;
 if coalesce(p_data->>'name_character','')<>'' then conf:=conf||jsonb_build_object('name_character',p_data->>'name_character');end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text||request::text,0));
 select * into old from public.quiz_generated_papers g where g.user_id=uid and g.request_id=request;
 if old.session_id is not null then
  if old.deleted_at is not null then raise exception 'paper_removed';end if;
  if (old.config-'name')<>(conf-'name') then raise exception 'submission_conflict'; end if;
  return jsonb_build_object('session_id',old.session_id,'display_name',old.display_name,'distribution',old.actual_distribution,'reused',true,'paper',public.quiz_paper_card(old.session_id));
 end if;
 if kind='self' and (conf ? 'name_work' or conf ? 'name_character') and not exists(select 1 from public.quiz_name_characters where enabled and work=conf->>'name_work' and (not(conf ? 'name_character') or id=conf->>'name_character')) then raise exception 'paper_name_choice_invalid';end if;
 if kind='extension' then
  reviewed:=public.quiz_wrong_questions(jsonb_build_object('action','detail','attempt_id',p_data->>'attempt_id','question_id',p_data->>'question_id'));
  select s.version_id into source_version_id from public.quiz_sessions s where s.id=(reviewed->>'session_id')::uuid;
  source:=public.quiz_extension_source(source_version_id,reviewed->'question'->>'id',reviewed->'catalog',left(cls,1)::integer);
  if source.question_id is null then raise exception 'extension_unavailable'; end if;
  select coalesce(m.course_id,'115-1-hanlin-g3-math') into selected_course from public.quiz_question_pool p left join public.quiz_pool_membership m on m.question_id=p.question_id where p.question_id=source.question_id and coalesce(m.knowledge_reliable,true);
  select * into course from public.quiz_courses c where c.id=selected_course and c.enabled and c.grade=left(cls,1)::integer;
  if course.id is null then raise exception 'extension_unavailable';end if;
 end if;
 -- Freeze this caller's exposure counts once; do not rescan answers for every candidate.
 select coalesce(jsonb_object_agg(history.question_id,history.n),'{}'::jsonb) into seen_counts from (
  select a.question_id,count(*) n from public.quiz_attempts at cross join lateral public.quiz_response_rows(at.id) a
  where at.user_id=uid and a.completed and a.question_id is not null group by a.question_id) history;
 seed:=request::text;
 -- Eligibility and static ordering are evaluated once, without question/check payloads.
 select array_agg(row(p.question_id,p.group_key,p.unit_ids,p.knowledge_code,p.difficulty,
  coalesce((seen_counts->>p.question_id)::bigint,0),md5(p.question_id||seed),p.unit_bucket)::public.quiz_draw_candidate)
 into candidates from (
 select p.question_id,p.group_key,p.unit_ids,p.knowledge_code,p.difficulty,dense_rank() over(order by p.unit_ids) unit_bucket
 from public.quiz_question_pool p
 left join public.quiz_pool_membership m on m.question_id=p.question_id
 where p.usable and coalesce(m.course_id,'115-1-hanlin-g3-math')=selected_course
 and ((kind='self' and exists(select 1 from jsonb_array_elements(units) u where p.unit_ids @> jsonb_build_array(u)))
 or (kind='extension' and p.publisher_explanation and coalesce(m.knowledge_reliable,true)
  and p.knowledge_code=source.knowledge_code and p.group_key<>source.group_key and p.difficulty<=source.difficulty))) p;
 -- Reserve all target buckets before filling shortages in the agreed order.
 target_easy:=case mode when 'easy' then amount*3/5 when 'medium' then amount/5 else 0 end;
 target_medium:=case mode when 'medium' then amount*3/5 else amount*2/5 end;
 target_hard:=case mode when 'hard' then amount*3/5 when 'medium' then amount/5 else 0 end;
 passes:=case when kind='extension' then array[99] when mode='easy' then array[-3,0,3,0,-3] when mode='hard' then array[-3,0,3,0,3] else array[-3,0,3,0,-3,3] end;
 for pass in 1..cardinality(passes) loop
  d:=passes[pass];
  quota:=case when kind='extension' then amount when pass>3 then amount-cardinality(selected) when d=-3 then target_easy when d=0 then target_medium else target_hard end;
  for count_now in 1..greatest(quota,0) loop
   exit when cardinality(selected)>=amount;
   select p.* into candidate from unnest(candidates) p
    where not(p.question_id=any(selected)) and (kind='extension' or p.difficulty=d)
     and not coalesce(p.group_key=any(selected_groups),false)
    order by p.seen,
     coalesce((knowledge_counts->>p.knowledge_code)::integer,0),
     coalesce((unit_counts->>(p.unit_bucket::text))::integer,0),
     case when kind='extension' then abs(p.difficulty-source.difficulty) else 0 end,p.rank limit 1;
   if candidate.question_id is null then exit; end if;
   selected:=array_append(selected,candidate.question_id);
   selected_groups:=array_append(selected_groups,candidate.group_key);
   if candidate.knowledge_code is not null then knowledge_counts:=jsonb_set(knowledge_counts,array[candidate.knowledge_code],to_jsonb(coalesce((knowledge_counts->>candidate.knowledge_code)::integer,0)+1));end if;
   if candidate.unit_ids is not null then unit_counts:=jsonb_set(unit_counts,array[candidate.unit_bucket::text],to_jsonb(coalesce((unit_counts->>(candidate.unit_bucket::text))::integer,0)+1));end if;
  end loop;
  if kind='self' and pass=3 then
   select jsonb_build_object('easy',greatest(0,target_easy-count(*) filter(where p.difficulty=-3)),
    'medium',greatest(0,target_medium-count(*) filter(where p.difficulty=0)),
    'hard',greatest(0,target_hard-count(*) filter(where p.difficulty=3))) into shortages
   from public.quiz_question_pool p where p.question_id=any(selected);
  end if;
 end loop;
 if cardinality(selected)=0 then raise exception '%',case when kind='self' then 'self_pool_empty' else 'pool_empty' end; end if;
 for chosen in select p.* from unnest(selected) with ordinality r(id,n) join public.quiz_question_pool p on p.question_id=r.id order by n loop
  blocks:=blocks||jsonb_build_array(jsonb_build_object('id','b_'||chosen.source_item_id,'material',jsonb_build_object('text','','media','[]'::jsonb),'questions',jsonb_build_array(chosen.question)));
 end loop;
 select jsonb_build_object('requested',amount,'actual',cardinality(selected),'easy',count(*) filter(where p.difficulty=-3),'medium',count(*) filter(where p.difficulty=0),'hard',count(*) filter(where p.difficulty=3)) into distribution from public.quiz_question_pool p where p.question_id=any(selected);
 if kind='self' then distribution:=distribution||jsonb_build_object('difficulty',mode,'target',jsonb_build_object('easy',target_easy,'medium',target_medium,'hard',target_hard),'shortages',shortages);end if;
 doc:=jsonb_build_object('schema',1,'title',case when kind='extension' then (course.definition->>'subject')||'同重點延伸練習' else '我的'||(course.definition->>'subject')||'自組卷' end,
  'catalog',jsonb_build_object('school_year','115','volume',course.definition->>'volume','subject',course.definition->>'subject','publisher',course.definition->>'publisher','course_id',selected_course,
   'unit',case when kind='extension' then '同重點再練習：'||source.knowledge_name else (select string_agg((case when course.definition->>'subject' in ('國語','英語') then '' else '第'||(u#>>'{}')||'單元：' end)||(course.definition->'units'->>(u#>>'{}')),'、' order by (u#>>'{}')::integer) from jsonb_array_elements(units) u) end),'blocks',blocks);
 perform public.quiz_validate(doc);
 b_id:=gen_random_uuid();v_id:=gen_random_uuid();s_id:=gen_random_uuid();
 insert into public.quiz_banks(id,owner_id,draft) values(b_id,uid,doc);
 insert into public.quiz_versions(id,bank_id,revision,document) values(v_id,b_id,1,doc);
 insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options,access_mode) values(s_id,uid,v_id,115,jsonb_build_array(cls),'immediate',false,true,'self');
 insert into public.quiz_generated_papers(session_id,user_id,request_id,config,actual_distribution) values(s_id,uid,request,conf,distribution) returning display_name into paper_name;
 return jsonb_build_object('session_id',s_id,'display_name',paper_name,'distribution',distribution,'reused',false,'paper',public.quiz_paper_card(s_id));
end $function$
;
notify pgrst,'reload schema';
commit;
