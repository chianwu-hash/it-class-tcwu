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
