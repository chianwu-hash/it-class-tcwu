-- Helpers for new, atomic, complete source questions. No caller or table access.
create or replace function public.quiz_fields_value(f jsonb, p_value jsonb) returns jsonb
language plpgsql immutable set search_path='' as $fields_value$
declare x jsonb;ids text[]:='{}';result jsonb;
begin
 if f->>'input' in('math','text','single') then
  if jsonb_typeof(p_value) is distinct from 'string' or length(trim(p_value#>>'{}')) not between 1 and 250 then raise exception 'invalid_response';end if;
  if f->>'input'='math' then
   if (p_value#>>'{}')~'[0-9０-９][[:space:]　]+[0-9０-９]' then raise exception 'invalid_response';end if;
   return to_jsonb(public.quiz_math_answer_normalize(p_value#>>'{}'));
  elsif f->>'input'='single' then
   if not exists(select 1 from jsonb_array_elements(f->'options') o where o->>'id'=p_value#>>'{}') then raise exception 'invalid_response';end if;
   return p_value;
  end if;
  return to_jsonb(trim(p_value#>>'{}'));
 elsif f->>'input' in('set','sequence') then
  if jsonb_typeof(p_value) is distinct from 'array' or jsonb_array_length(p_value)>8 then raise exception 'invalid_response';end if;
  for x in select * from jsonb_array_elements(p_value) loop
   if jsonb_typeof(x) is distinct from 'string' or (x#>>'{}')=any(ids)
    or not exists(select 1 from jsonb_array_elements(f->'options') o where o->>'id'=x#>>'{}') then raise exception 'invalid_response';end if;
   ids:=array_append(ids,x#>>'{}');
  end loop;
  if f->>'input'='sequence' then
   if cardinality(ids)<>jsonb_array_length(f->'options') then raise exception 'invalid_response';end if;
   return p_value;
  end if;
  select coalesce(jsonb_agg(v order by v),'[]'::jsonb) into result from unnest(ids) v;
  return result;
 end if;
 raise exception 'invalid_response';
end $fields_value$;

create or replace function public.quiz_fields_validate(q jsonb) returns void
language plpgsql immutable set search_path='' as $fields_validate$
declare f jsonb;o jsonb;a jsonb;t jsonb;alt jsonb;key text;fid text;
 ids text[]:='{}';opts text[];coupled text[];n integer;
begin
 if q ? 'options' or jsonb_typeof(q->'fields') is distinct from 'array' then raise exception 'invalid_question';end if;
 if jsonb_array_length(q->'fields') not between 1 and 20 then raise exception 'invalid_question';end if;
 for f in select * from jsonb_array_elements(q->'fields') loop
  if jsonb_typeof(f) is distinct from 'object' or coalesce(f->>'id','')!~'^[A-Za-z][A-Za-z0-9_-]{0,39}$'
   or f->>'id'=any(ids) or f->>'id' in('constructor','prototype','__proto__')
   or jsonb_typeof(f->'label') is distinct from 'string' or length(trim(f->>'label')) not between 1 and 120
   or coalesce(f->>'input','') not in('math','text','single','set','sequence')
   or exists(select 1 from jsonb_object_keys(f) k where k not in('id','label','input','options')) then raise exception 'invalid_question';end if;
  ids:=array_append(ids,f->>'id');
  if f->>'input' in('math','text') then
   if f ? 'options' then raise exception 'invalid_options';end if;
  else
   if jsonb_typeof(f->'options') is distinct from 'array' then raise exception 'invalid_options';end if;
   if jsonb_array_length(f->'options') not between 2 and 8 then raise exception 'invalid_options';end if;
   opts:='{}';
   for o in select * from jsonb_array_elements(f->'options') loop
    if jsonb_typeof(o) is distinct from 'object' or coalesce(o->>'id','')!~'^[A-Za-z0-9_-]{1,40}$'
     or o->>'id'=any(opts) or not public.quiz_valid_content(o->'content')
     or exists(select 1 from jsonb_object_keys(o) k where k not in('id','content')) then raise exception 'invalid_options';end if;
    opts:=array_append(opts,o->>'id');
   end loop;
  end if;
 end loop;
 if q->'answer'->>'format' is distinct from 'fields-v1' or jsonb_typeof(q->'answer'->'fields') is distinct from 'object'
  or exists(select 1 from jsonb_object_keys(q->'answer') k where k not in('format','fields','tuples'))
  or (select count(*) from jsonb_object_keys(q->'answer'->'fields'))<>cardinality(ids)
  or exists(select 1 from jsonb_object_keys(q->'answer'->'fields') k where not(k=any(ids))) then raise exception 'invalid_answer';end if;
 for f in select * from jsonb_array_elements(q->'fields') loop
  a:=q->'answer'->'fields'->(f->>'id');
  if jsonb_typeof(a) is distinct from 'array' then raise exception 'invalid_answer';end if;
  if jsonb_array_length(a) not between 1 and 20 then raise exception 'invalid_answer';end if;
  for alt in select * from jsonb_array_elements(a) loop
   begin perform public.quiz_fields_value(f,alt);exception when others then raise exception 'invalid_answer';end;
  end loop;
 end loop;
 if q->'answer' ? 'tuples' then
  if jsonb_typeof(q->'answer'->'tuples') is distinct from 'array' then raise exception 'invalid_answer';end if;
  if jsonb_array_length(q->'answer'->'tuples') not between 1 and 20 then raise exception 'invalid_answer';end if;
  for t in select * from jsonb_array_elements(q->'answer'->'tuples') loop
   if jsonb_typeof(t) is distinct from 'object' or exists(select 1 from jsonb_object_keys(t) k where k not in('fields','accepted'))
    or jsonb_typeof(t->'fields') is distinct from 'array' or jsonb_typeof(t->'accepted') is distinct from 'array' then raise exception 'invalid_answer';end if;
   if jsonb_array_length(t->'fields') not between 2 and 20 or jsonb_array_length(t->'accepted') not between 1 and 20 then raise exception 'invalid_answer';end if;
   coupled:='{}';
   for a in select * from jsonb_array_elements(t->'fields') loop
    fid:=a#>>'{}';
    if jsonb_typeof(a) is distinct from 'string' or not(fid=any(ids)) or fid=any(coupled) then raise exception 'invalid_answer';end if;
    coupled:=array_append(coupled,fid);
   end loop;
   for alt in select * from jsonb_array_elements(t->'accepted') loop
    if jsonb_typeof(alt) is distinct from 'object' then raise exception 'invalid_answer';end if;
    if (select count(*) from jsonb_object_keys(alt))<>cardinality(coupled)
     or exists(select 1 from jsonb_object_keys(alt) k where not(k=any(coupled))) then raise exception 'invalid_answer';end if;
    foreach fid in array coupled loop
     select x into f from jsonb_array_elements(q->'fields') x where x->>'id'=fid;
     begin
      if not exists(select 1 from jsonb_array_elements(q->'answer'->'fields'->fid) v where public.quiz_fields_value(f,v)=public.quiz_fields_value(f,alt->fid)) then raise exception 'invalid_answer';end if;
     exception when others then raise exception 'invalid_answer';end;
    end loop;
   end loop;
  end loop;
 end if;
end $fields_validate$;

create or replace function public.quiz_fields_response(q jsonb, raw text) returns jsonb
language plpgsql immutable set search_path='' as $fields_response$
declare original json;v jsonb;f jsonb;result jsonb:='{}';
begin
 if length(raw) not between 1 and 2000 then raise exception 'invalid_response';end if;
 begin original:=raw::json;v:=original::jsonb;exception when others then raise exception 'invalid_response';end;
 if json_typeof(original) is distinct from 'object' then raise exception 'invalid_response';end if;
 -- Keep the original JSON for duplicate checks; jsonb discards duplicate keys.
 if (select count(*) from json_object_keys(original))<>2 or json_typeof(original->'f') is distinct from 'object' then raise exception 'invalid_response';end if;
 if (select count(*) from json_object_keys(original->'f'))<>(select count(distinct k) from json_object_keys(original->'f') k) then raise exception 'invalid_response';end if;
 if v->'v' is distinct from '1'::jsonb or not(v ? 'f') or exists(select 1 from jsonb_object_keys(v) k where k not in('v','f'))
  or (select count(*) from jsonb_object_keys(v->'f'))<>jsonb_array_length(q->'fields')
  or exists(select 1 from jsonb_object_keys(v->'f') k where not exists(select 1 from jsonb_array_elements(q->'fields') x where x->>'id'=k)) then raise exception 'invalid_response';end if;
 for f in select * from jsonb_array_elements(q->'fields') loop
  result:=result||jsonb_build_object(f->>'id',public.quiz_fields_value(f,v->'f'->(f->>'id')));
 end loop;
 return result;
end $fields_response$;

create or replace function public.quiz_fields_grade(q jsonb, raw text) returns boolean
language plpgsql immutable set search_path='' as $fields_grade$
declare canonical jsonb;f jsonb;t jsonb;a jsonb;fid text;matched boolean;
begin
 canonical:=public.quiz_fields_response(q,raw);
 for f in select * from jsonb_array_elements(q->'fields') loop
  if not exists(select 1 from jsonb_array_elements(q->'answer'->'fields'->(f->>'id')) candidates(candidate) where public.quiz_fields_value(f,candidate)=canonical->(f->>'id')) then return false;end if;
 end loop;
 for t in select * from jsonb_array_elements(coalesce(q->'answer'->'tuples','[]')) loop
  matched:=false;
  for a in select * from jsonb_array_elements(t->'accepted') loop
   matched:=true;
   for fid in select * from jsonb_array_elements_text(t->'fields') loop
    select x into f from jsonb_array_elements(q->'fields') x where x->>'id'=fid;
    if public.quiz_fields_value(f,a->fid) is distinct from canonical->fid then matched:=false;exit;end if;
   end loop;
   if matched then exit;end if;
  end loop;
  if not matched then return false;end if;
 end loop;
 return true;
end $fields_grade$;

revoke all on function public.quiz_fields_value(jsonb,jsonb),public.quiz_fields_validate(jsonb),public.quiz_fields_response(jsonb,text),public.quiz_fields_grade(jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.quiz_fields_value(jsonb,jsonb),public.quiz_fields_validate(jsonb),public.quiz_fields_response(jsonb,text),public.quiz_fields_grade(jsonb,text) to postgres,service_role;
