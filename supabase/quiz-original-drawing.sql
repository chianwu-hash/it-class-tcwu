-- Version 2 drawing marks. Version 1 acceptance and all response envelopes stay intact.
-- Apply only after the reviewed SQL is explicitly approved. No rows or ACL changes.
begin;
set local statement_timeout='30s';
do $guard$
begin
 if md5(pg_get_functiondef('public.quiz_sketch_valid(jsonb)'::regprocedure))
   is distinct from '464532f210068f0ed630354c1cbe28e7' then
  raise exception 'drawing_validator_source_changed';
 end if;
end $guard$;

create or replace function public.quiz_sketch_valid(v jsonb) returns boolean
language plpgsql immutable set search_path='' as $function$
declare s jsonb;p jsonb;c jsonb;m jsonb;points jsonb;modern boolean;kind text;
begin
 if jsonb_typeof(v) is distinct from 'object' then return false;end if;
 modern:=v->'version'='2'::jsonb;
 if v->'version' is distinct from '1'::jsonb and not coalesce(modern,false) then return false;end if;
 if jsonb_typeof(v->'strokes') is distinct from 'array' or octet_length(v::text)>262144 then return false;end if;
 if modern then
  if exists(select 1 from jsonb_object_keys(v)k where k not in('version','strokes','colors','marks'))
   or jsonb_typeof(v->'marks') is distinct from 'array' then return false;end if;
  if jsonb_array_length(v->'strokes')+jsonb_array_length(v->'marks') not between 1 and 80 then return false;end if;
 else
  if exists(select 1 from jsonb_object_keys(v)k where k not in('version','strokes','colors'))
   or jsonb_array_length(v->'strokes') not between 1 and 80 then return false;end if;
 end if;
 if v?'colors' then
  if jsonb_typeof(v->'colors') is distinct from 'array' then return false;end if;
  if jsonb_array_length(v->'colors')<>jsonb_array_length(v->'strokes') then return false;end if;
  for c in select * from jsonb_array_elements(v->'colors')loop
   if jsonb_typeof(c) is distinct from 'string' then return false;end if;
   if modern then
    if c#>>'{}' !~ '^#[0-9a-f]{6}$' then return false;end if;
   elsif c#>>'{}' not in('#185e60','#2459b3','#b83246','#7643a8','#a94b0b','#263238')then return false;
   end if;
  end loop;
 end if;
 for s in select * from jsonb_array_elements(v->'strokes')loop
  if jsonb_typeof(s) is distinct from 'array' then return false;end if;
  if jsonb_array_length(s)not between 1 and 128 then return false;end if;
  for p in select * from jsonb_array_elements(s)loop
   if jsonb_typeof(p) is distinct from 'array' then return false;end if;
   if jsonb_array_length(p)<>2 then return false;end if;
   for c in select * from jsonb_array_elements(p)loop
    if jsonb_typeof(c) is distinct from 'number' then return false;end if;
    if(c#>>'{}')::numeric not between 0 and 1 then return false;end if;
    if modern and(c#>>'{}')::numeric<>round((c#>>'{}')::numeric,6)then return false;end if;
   end loop;
  end loop;
 end loop;
 if modern then
  for m in select * from jsonb_array_elements(v->'marks')loop
   if jsonb_typeof(m) is distinct from 'object' then return false;end if;
   kind:=m->>'kind';
   if jsonb_typeof(m->'color') is distinct from 'string' or m->>'color' !~ '^#[0-9a-f]{6}$' then return false;end if;
   if kind='text' then
    if(select count(*)from jsonb_object_keys(m))<>5
     or exists(select 1 from jsonb_object_keys(m)k where k not in('kind','at','text','color','size'))
     or jsonb_typeof(m->'text') is distinct from 'string' then return false;end if;
    if length(m->>'text')not between 1 and 40 or m->>'text' ~ '[[:cntrl:]]'then return false;end if;
    if jsonb_typeof(m->'size') is distinct from 'number' then return false;end if;
    if(m->>'size')::numeric not between .015 and .12 or(m->>'size')::numeric<>round((m->>'size')::numeric,6)then return false;end if;
    points:=jsonb_build_array(m->'at');
   elsif kind='sector'then
    if(select count(*)from jsonb_object_keys(m))<>8
     or exists(select 1 from jsonb_object_keys(m)k where k not in('kind','center','radius','angle','rotation','color','width','fill'))
     or jsonb_typeof(m->'fill')is distinct from 'boolean'then return false;end if;
    foreach kind in array array['radius','angle','rotation','width']loop
     if jsonb_typeof(m->kind)is distinct from 'number'then return false;end if;
     if(m->>kind)::numeric<>round((m->>kind)::numeric,6)then return false;end if;
    end loop;
    if(m->>'radius')::numeric not between .000001 and 1 or(m->>'angle')::numeric not between .001 and 360
     or(m->>'rotation')::numeric not between 0 and 360 or(m->>'width')::numeric not between .001 and .04 then return false;end if;
    points:=jsonb_build_array(m->'center');
   elsif kind in('line','polygon','ellipse')then
    if(select count(*)from jsonb_object_keys(m))<>(case when kind='line'then 4 else 5 end)
     or exists(select 1 from jsonb_object_keys(m)k where k not in('kind','points','color','width','fill'))
     or(kind='line'and m?'fill')or(kind<>'line'and jsonb_typeof(m->'fill')is distinct from 'boolean')
     or jsonb_typeof(m->'width') is distinct from 'number' or jsonb_typeof(m->'points') is distinct from 'array'then return false;end if;
    if(m->>'width')::numeric not between .001 and .04 or(m->>'width')::numeric<>round((m->>'width')::numeric,6)then return false;end if;
    points:=m->'points';
    if kind='polygon'then
     if jsonb_array_length(points)not between 3 and 128 then return false;end if;
    elsif jsonb_array_length(points)<>2 then return false;end if;
   else return false;
   end if;
   for p in select * from jsonb_array_elements(points)loop
    if jsonb_typeof(p) is distinct from 'array' then return false;end if;
    if jsonb_array_length(p)<>2 then return false;end if;
    for c in select * from jsonb_array_elements(p)loop
     if jsonb_typeof(c) is distinct from 'number' then return false;end if;
     if(c#>>'{}')::numeric not between 0 and 1 or(c#>>'{}')::numeric<>round((c#>>'{}')::numeric,6)then return false;end if;
    end loop;
   end loop;
  end loop;
 end if;
 return true;
end $function$;
commit;
