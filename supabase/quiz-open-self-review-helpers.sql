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
