-- Local-tested candidate. USER APPROVAL REQUIRED before production application.
begin;
set local lock_timeout='3s';
do $guard$ begin
 if not(md5(pg_get_functiondef('public.quiz_open_validate(jsonb)'::regprocedure))='30186743eceb8403887d6bb202e72b32' and md5(pg_get_functiondef('public.quiz_open_submit(uuid,jsonb,jsonb,boolean)'::regprocedure))='70d3f94dfd94712fe917eaa43d4ef28b') then raise exception 'sketch_baseline_changed';end if;
 if not exists(select 1 from pg_constraint where conrelid='public.quiz_open_responses'::regclass and conname='quiz_open_responses_response_check' and md5(pg_get_constraintdef(oid))='7d197a7fac6f6f16888881c6ec47e46e') then raise exception 'sketch_response_constraint_changed';end if;
 if to_regprocedure('public.quiz_open_response(jsonb,text)') is not null or to_regprocedure('public.quiz_sketch_valid(jsonb)') is not null then raise exception 'sketch_already_installed';end if;
end $guard$;
-- Opt-in handwritten open response. Never automatically grades pen strokes.
create or replace function public.quiz_sketch_valid(v jsonb) returns boolean
language plpgsql immutable set search_path='' as $sketch$
declare s jsonb;p jsonb;c jsonb;
begin
 if jsonb_typeof(v) is distinct from 'object' then return false;end if;
 if v->'version' is distinct from '1'::jsonb or jsonb_typeof(v->'strokes') is distinct from 'array'
  or exists(select 1 from jsonb_object_keys(v) k where k not in('version','strokes','colors'))
  or octet_length(v::text)>262144 then return false;end if;
 if jsonb_array_length(v->'strokes') not between 1 and 80 then return false;end if;
 if v ? 'colors' then
  if jsonb_typeof(v->'colors') is distinct from 'array' then return false;end if;
  if jsonb_array_length(v->'colors')<>jsonb_array_length(v->'strokes') then return false;end if;
  for c in select * from jsonb_array_elements(v->'colors') loop
   if jsonb_typeof(c) is distinct from 'string' or c#>>'{}' not in('#185e60','#2459b3','#b83246','#7643a8','#a94b0b','#263238') then return false;end if;
  end loop;
 end if;
 for s in select * from jsonb_array_elements(v->'strokes') loop
  if jsonb_typeof(s) is distinct from 'array' then return false;end if;
  if jsonb_array_length(s) not between 1 and 128 then return false;end if;
  for p in select * from jsonb_array_elements(s) loop
   if jsonb_typeof(p) is distinct from 'array' then return false;end if;
   if jsonb_array_length(p)<>2 then return false;end if;
   for c in select * from jsonb_array_elements(p) loop
    if jsonb_typeof(c) is distinct from 'number' then return false;end if;
    if (c#>>'{}')::numeric not between 0 and 1 then return false;end if;
   end loop;
  end loop;
 end loop;
 return true;
end $sketch$;
revoke all on function public.quiz_sketch_valid(jsonb) from public,anon,authenticated;
grant execute on function public.quiz_sketch_valid(jsonb) to postgres,service_role;

create or replace function public.quiz_open_response(q jsonb,raw text) returns jsonb
language plpgsql immutable set search_path='' as $response$
declare original json;v jsonb;f jsonb;value jsonb;result jsonb:='{}';
begin
 if not exists(select 1 from jsonb_array_elements(q->'fields') fs where fs->>'input'='sketch') then
  return public.quiz_fields_response(q,raw);
 end if;
 if q->>'type' is distinct from 'open' or raw is null or octet_length(raw) not between 1 and 300000 then raise exception 'invalid_response';end if;
 begin original:=raw::json;v:=original::jsonb;exception when others then raise exception 'invalid_response';end;
 if json_typeof(original) is distinct from 'object' then raise exception 'invalid_response';end if;
 if (select count(*) from json_object_keys(original))<>2 or json_typeof(original->'f') is distinct from 'object' then raise exception 'invalid_response';end if;
 if (select count(*) from json_object_keys(original->'f'))<>(select count(distinct k) from json_object_keys(original->'f') k) then raise exception 'invalid_response';end if;
 if v->'v' is distinct from '1'::jsonb or exists(select 1 from jsonb_object_keys(v) k where k not in('v','f'))
  or (select count(*) from jsonb_object_keys(v->'f'))<>jsonb_array_length(q->'fields')
  or exists(select 1 from jsonb_object_keys(v->'f') k where not exists(select 1 from jsonb_array_elements(q->'fields') x where x->>'id'=k)) then raise exception 'invalid_response';end if;
 for f in select * from jsonb_array_elements(q->'fields') loop
  value:=v->'f'->(f->>'id');
  if f->>'input'='sketch' then
   if not public.quiz_sketch_valid(value) then raise exception 'invalid_response';end if;
   if (select count(*) from json_object_keys(original->'f'->(f->>'id')))<>(select count(distinct k) from json_object_keys(original->'f'->(f->>'id')) k) then raise exception 'invalid_response';end if;
  elsif f->>'input'='text' then
   if jsonb_typeof(value) is distinct from 'string' or length(trim(value#>>'{}')) not between 1 and 250 then raise exception 'invalid_response';end if;
  else raise exception 'invalid_response';end if;
  result:=result||jsonb_build_object(f->>'id',value);
 end loop;
 return result;
end $response$;
revoke all on function public.quiz_open_response(jsonb,text) from public,anon,authenticated;
grant execute on function public.quiz_open_response(jsonb,text) to postgres,service_role;

alter table public.quiz_open_responses drop constraint quiz_open_responses_response_check;
alter table public.quiz_open_responses add constraint quiz_open_responses_response_check check(jsonb_typeof(response)='string' and octet_length(response#>>'{}') between 1 and 300000);
CREATE OR REPLACE FUNCTION public.quiz_open_validate(q jsonb)
 RETURNS void
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare f jsonb;r jsonb;v jsonb;k text;fake jsonb;projected jsonb;
begin
 if q->>'type' is distinct from 'open' or jsonb_typeof(q->'fields') is distinct from 'array'
  or q->'answer'->>'format' is distinct from 'self-review-v1' or jsonb_typeof(q->'answer'->'fields') is distinct from 'object'
  or exists(select 1 from jsonb_object_keys(q->'answer') x where x not in('format','fields')) then raise exception 'invalid_open_question';end if;
 select jsonb_object_agg(x->>'id',jsonb_build_array('validation-only')) into fake from jsonb_array_elements(q->'fields') x;
 select jsonb_agg(case when fs.item->>'input'='sketch' then jsonb_set(fs.item,'{input}','"text"') else fs.item end order by fs.n) into projected from jsonb_array_elements(q->'fields')with ordinality fs(item,n);
 perform public.quiz_fields_validate(jsonb_set(jsonb_set(q,'{fields}',projected),'{answer}',jsonb_build_object('format','fields-v1','fields',fake)));
 if (select count(*) from jsonb_object_keys(q->'answer'->'fields'))<>jsonb_array_length(q->'fields') then raise exception 'invalid_open_question';end if;
 for f in select * from jsonb_array_elements(q->'fields') loop
  if f->>'input' is null or f->>'input' not in('text','sketch') then raise exception 'invalid_open_question';end if;
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
end $function$;
CREATE OR REPLACE FUNCTION public.quiz_open_submit(p_attempt uuid, p_question jsonb, p_data jsonb, p_self_check boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 raw:=p_data->>'response';canonical:=public.quiz_open_response(p_question,raw);
 if row.attempt_id is not null then
  if row.request_id is distinct from rid or row.response is distinct from p_data->'response' then raise exception 'submission_conflict';end if;
  return false;
 end if;
 if exists(select 1 from public.quiz_open_responses where attempt_id=p_attempt and(request_id=rid or self_check_request_id=rid)) then raise exception 'submission_conflict';end if;
 insert into public.quiz_open_responses(attempt_id,question_id,request_id,response) values(p_attempt,p_question->>'id',rid,p_data->'response');
 return true;
end $function$;
commit;
