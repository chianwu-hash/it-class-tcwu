-- Opt-in past-exam adapter. Install after the current quiz/media/rewards and read optimizations.
begin;
create table if not exists public.quiz_past_papers(
 id text primary key,owner_id uuid not null references auth.users(id),grade integer not null check(grade in(3,6)),
 school_year integer not null,semester integer not null check(semester in(1,2)),title text not null,
 active_version uuid,enabled boolean not null default false);
create table if not exists public.quiz_past_versions(
 id uuid primary key default gen_random_uuid(),paper_id text not null references public.quiz_past_papers(id),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),document jsonb not null,provenance jsonb not null,
 created_at timestamptz not null default now(),unique(paper_id,sha256));
create table if not exists public.quiz_past_attempts(
 id uuid primary key default gen_random_uuid(),paper_id text not null references public.quiz_past_papers(id),
 version_id uuid not null references public.quiz_past_versions(id),user_id uuid not null references auth.users(id),
 school_year integer not null,semester integer not null,start_request uuid not null,created_at timestamptz not null default now(),
 completed_at timestamptz,score numeric,max_score numeric,unique(user_id,paper_id,start_request));
create index if not exists quiz_past_own on public.quiz_past_attempts(user_id,paper_id,school_year,semester,created_at);
create table if not exists public.quiz_past_receipts(
 attempt_id uuid not null references public.quiz_past_attempts(id),group_id text not null,request_id uuid not null,
 responses jsonb not null,results jsonb not null,score numeric,status text not null check(status in('graded','self_checked')),
 primary key(attempt_id,group_id),unique(attempt_id,request_id));
create table if not exists public.quiz_past_answers(
 attempt_id uuid not null,group_id text not null,question_id text not null,response jsonb not null,correct boolean,
 points numeric not null check(points>0),primary key(attempt_id,question_id),
 foreign key(attempt_id,group_id) references public.quiz_past_receipts(attempt_id,group_id));
create table if not exists public.quiz_past_views(
 attempt_id uuid not null references public.quiz_past_attempts(id),group_id text not null,started_at timestamptz not null default clock_timestamp(),
 accepted_seconds numeric,primary key(attempt_id,group_id));
create table if not exists public.quiz_past_leaves(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),paper_id text not null references public.quiz_past_papers(id),
 school_year integer not null,semester integer not null,attempt_id uuid not null unique references public.quiz_past_attempts(id),
 awarded_at timestamptz not null default now(),unique(user_id,paper_id,school_year,semester));
do $$declare t text;begin foreach t in array array['quiz_past_papers','quiz_past_versions','quiz_past_attempts','quiz_past_receipts','quiz_past_answers','quiz_past_views','quiz_past_leaves'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
end loop;end$$;

create or replace function public.quiz_past_immutable() returns trigger language plpgsql set search_path='' as $$begin raise exception 'immutable_version';end$$;
drop trigger if exists quiz_past_immutable on public.quiz_past_versions;
create trigger quiz_past_immutable before update or delete on public.quiz_past_versions for each row execute function public.quiz_past_immutable();

create or replace function public.quiz_past_has_media(d jsonb,u text) returns boolean language sql immutable set search_path='' as $$
 select exists(select 1 from (
  select jsonb_path_query(d,'$.groups[*].assets[*].url') value
  union all select jsonb_path_query(d,'$.groups[*].choices[*].content.media[*].url')
  union all select jsonb_path_query(d,'$.groups[*].promptContent.media[*].url')
  union all select jsonb_path_query(d,'$.groups[*].materialContent.media[*].url')
 ) media where media.value#>>'{}'=u)
$$;

create or replace function public.quiz_past_canonical(g jsonb,v jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare codes jsonb;result jsonb;n integer;distinct_n integer;p jsonb;stroke jsonb;
begin
 if g->>'kind'='mark' then if jsonb_typeof(v) is distinct from 'boolean' then raise exception 'invalid_response';end if;return v;end if;
 if g->>'kind'='manual' then
  if jsonb_typeof(v) is distinct from 'object' or (select array_agg(k order by k) from jsonb_object_keys(v) k) is distinct from array['confirmed','strokes','text']
   or v->'confirmed' is distinct from 'true'::jsonb or jsonb_typeof(v->'text') is distinct from 'string' or length(v->>'text')>5000
   or jsonb_typeof(v->'strokes') is distinct from 'array' or jsonb_array_length(v->'strokes')>80 or octet_length(v::text)>500000 then raise exception 'invalid_response';end if;
  for stroke in select value from jsonb_array_elements(v->'strokes') loop
   if jsonb_typeof(stroke) is distinct from 'array' or jsonb_array_length(stroke) not between 2 and 256 then raise exception 'invalid_response';end if;
   for p in select value from jsonb_array_elements(stroke) loop
    if jsonb_typeof(p) is distinct from 'array' or jsonb_array_length(p)<>2 or jsonb_typeof(p->0) is distinct from 'number' or jsonb_typeof(p->1) is distinct from 'number' then raise exception 'invalid_response';end if;
    if (p->>0)::numeric not between 0 and 1 or (p->>1)::numeric not between 0 and 1 then raise exception 'invalid_response';end if;
   end loop;
  end loop;
  if length(trim(v->>'text'))=0 and jsonb_array_length(v->'strokes')=0 then raise exception 'invalid_response';end if;
  return v;
 end if;
 if g->>'kind'='annotation' then
  if jsonb_typeof(v) is distinct from 'object' or (select array_agg(k order by k) from jsonb_object_keys(v) k) is distinct from array['arrow','mediaSha256','point']
   or v->>'mediaSha256' is distinct from g->'assets'->0->>'sha256' or jsonb_typeof(v->'arrow') is distinct from 'object'
   or (select array_agg(k order by k) from jsonb_object_keys(v->'arrow') k) is distinct from array['from','to'] then raise exception 'invalid_response';end if;
  for p in select v->'point' union all select v->'arrow'->'from' union all select v->'arrow'->'to' loop
   if jsonb_typeof(p) is distinct from 'object' or (select array_agg(k order by k) from jsonb_object_keys(p) k) is distinct from array['x','y']
    or jsonb_typeof(p->'x') is distinct from 'number' or jsonb_typeof(p->'y') is distinct from 'number' then raise exception 'invalid_response';end if;
   if (p->>'x')::numeric not between 0 and 1 or (p->>'y')::numeric not between 0 and 1 then raise exception 'invalid_response';end if;
  end loop;
  if power((v#>>'{arrow,to,x}')::numeric-(v#>>'{arrow,from,x}')::numeric,2)+power((v#>>'{arrow,to,y}')::numeric-(v#>>'{arrow,from,y}')::numeric,2)<0.0009 then raise exception 'invalid_response';end if;
  return v;
 end if;
 if g->>'kind'='short' then if jsonb_typeof(v) is distinct from 'string' or length(v#>>'{}') not between 1 and 2000 then raise exception 'invalid_response';end if;return v;end if;
 codes:=case when g->>'kind'='set' then g->'codes' else (select jsonb_agg(c->'id' order by ord) from jsonb_array_elements(g->'choices') with ordinality x(c,ord)) end;
 if g->>'kind' in('single','code') then if jsonb_typeof(v) is distinct from 'string' or not(codes @> jsonb_build_array(v)) then raise exception 'invalid_response';end if;return v;end if;
 if g->>'kind' not in('sequence','set') or jsonb_typeof(v) is distinct from 'array' then raise exception 'invalid_response';end if;
 select count(*),count(distinct value) into n,distinct_n from jsonb_array_elements(v);
 if n=0 or n<>distinct_n or exists(select 1 from jsonb_array_elements(v) x where jsonb_typeof(x) is distinct from 'string' or not(codes @> jsonb_build_array(x))) then raise exception 'invalid_response';end if;
 if g->>'kind'='sequence' then if n<>jsonb_array_length(codes) then raise exception 'invalid_response';end if;return v;end if;
 select jsonb_agg(c order by ord) into result from jsonb_array_elements(codes) with ordinality x(c,ord) where v @> jsonb_build_array(c);return result;
end $$;

create or replace function public.quiz_past_validate(d jsonb) returns void language plpgsql set search_path='' as $$
declare g jsonb;f jsonb;a jsonb;groups text[]:='{}';fields text[]:='{}';ids jsonb;v jsonb;
begin
 if d->>'schema' is distinct from '2' or jsonb_typeof(d->'groups') is distinct from 'array' or jsonb_array_length(d->'groups') not between 1 and 100 or jsonb_typeof(d->'title') is distinct from 'string' or length(d->>'title') not between 1 and 200 then raise exception 'invalid_document';end if;
 for g in select value from jsonb_array_elements(d->'groups') loop
  if coalesce(g->>'id','') !~ '^[a-zA-Z0-9_-]{1,80}$' or g->>'id'=any(groups) or coalesce(g->>'kind','') not in('single','short','mark','code','set','sequence','annotation','manual')
   or jsonb_typeof(g->'fields') is distinct from 'array' or jsonb_array_length(g->'fields') not between 1 and 30
   or jsonb_typeof(g->'assets') is distinct from 'array' or jsonb_typeof(g->'choices') is distinct from 'array' or jsonb_typeof(g->'material') is distinct from 'string' then raise exception 'invalid_document';end if;
  groups:=array_append(groups,g->>'id');
  if g ? 'optional' and (jsonb_typeof(g->'optional') is distinct from 'boolean' or (g->'optional'='true'::jsonb and g->>'kind'<>'manual')) then raise exception 'invalid_document';end if;
  if g->>'kind'='manual' and (jsonb_array_length(g->'fields')<>1 or jsonb_typeof(g->'fields'->0->'reference') is distinct from 'string' or length(g->'fields'->0->>'reference') not between 1 and 10000) then raise exception 'invalid_document';end if;
  if g ? 'referenceUrl' and coalesce(g->>'referenceUrl','') !~ '^https://quiz-media.invalid/[0-9a-f-]{36}/[a-f0-9]{64}$' then raise exception 'invalid_document';end if;
  if g->>'kind'='annotation' and (jsonb_array_length(g->'fields')<>1 or jsonb_array_length(g->'assets')<>1 or coalesce(g->>'referenceUrl','') !~ '^https://quiz-media.invalid/[0-9a-f-]{36}/[a-f0-9]{64}$') then raise exception 'invalid_document';end if;
  for a in select value from jsonb_array_elements(g->'assets') loop
   if coalesce(a->>'sha256','') !~ '^[a-f0-9]{64}$' or coalesce(a->>'url','') !~ '^https://quiz-media.invalid/[0-9a-f-]{36}/[a-f0-9]{64}$' or jsonb_typeof(a->'alt') is distinct from 'string' then raise exception 'invalid_document';end if;
  end loop;
  if g->>'kind' in('single','code','sequence','set') then
   ids:=case when g->>'kind'='set' then g->'codes' else (select jsonb_agg(x->'id') from jsonb_array_elements(g->'choices') x) end;
   if jsonb_typeof(ids) is distinct from 'array' or jsonb_array_length(ids) not between 2 and 12 or (select count(*)<>count(distinct x) from jsonb_array_elements(ids) x) or exists(select 1 from jsonb_array_elements(ids) x where jsonb_typeof(x) is distinct from 'string' or length(x#>>'{}') not between 1 and 40) then raise exception 'invalid_document';end if;
  end if;
  for f in select value from jsonb_array_elements(g->'fields') loop
   if coalesce(f->>'id','') !~ '^[a-zA-Z0-9_-]{1,80}$' or f->>'id'=any(fields) or jsonb_typeof(f->'text') is distinct from 'string' or length(f->>'text')=0 or jsonb_typeof(f->'points') is distinct from 'number' or (f->>'points')::numeric not between 0.01 and 100 then raise exception 'invalid_document';end if;
   fields:=array_append(fields,f->>'id');
   if g->>'kind'='short' then
    if jsonb_typeof(f->'answer') is distinct from 'array' or jsonb_array_length(f->'answer') not between 1 and 20 or exists(select 1 from jsonb_array_elements(f->'answer') accepted where jsonb_typeof(accepted) is distinct from 'string' or length(trim(accepted#>>'{}')) not between 1 and 2000) then raise exception 'invalid_document';end if;
   elsif g->>'kind' not in('annotation','manual') then v:=public.quiz_past_canonical(g,f->'answer');if v is distinct from f->'answer' then raise exception 'invalid_document';end if;end if;
  end loop;
 end loop;
 if cardinality(fields)>200 then raise exception 'invalid_document';end if;
end $$;

create or replace function public.quiz_past_snapshot(aid uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare att public.quiz_past_attempts;d jsonb;g jsonb;safe jsonb:='[]';fs jsonb;records jsonb;history jsonb;award uuid;score numeric;mx numeric;answered integer;total integer;drawing text:='not_submitted';
begin
 select * into att from public.quiz_past_attempts where id=aid and user_id=auth.uid();if att.id is null then raise exception 'attempt_unavailable';end if;
 select document into d from public.quiz_past_versions where id=att.version_id;
 for g in select value from jsonb_array_elements(d->'groups') loop
  select jsonb_agg(jsonb_build_object('id',f->'id','label',f->'label','text',f->'text','points',f->'points') order by ord) into fs from jsonb_array_elements(g->'fields') with ordinality x(f,ord);
  safe:=safe||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('id',g->'id','kind',g->'kind','optional',g->'optional','title',g->'title','sourceLabel',g->'sourceLabel','material',g->'material','choices',g->'choices','assets',g->'assets','codes',g->'codes','fields',fs,'notice',g->'notice','promptContent',g->'promptContent','materialContent',g->'materialContent')));
 end loop;
 select coalesce(jsonb_object_agg(r.group_id,jsonb_build_object('requestId',r.request_id,'responses',r.responses,'results',r.results,'score',r.score,'status',r.status,
  'referenceStatus',case when r.status='self_checked' then coalesce((select x->'fields'->0->>'referenceStatus' from jsonb_array_elements(d->'groups') x where x->>'id'=r.group_id),'provided') else null end,
  'reference',case when r.status='self_checked' then (select x->'fields'->0->'reference' from jsonb_array_elements(d->'groups') x where x->>'id'=r.group_id) else null end,
  'referenceUrl',case when r.status='self_checked' then (select x->'referenceUrl' from jsonb_array_elements(d->'groups') x where x->>'id'=r.group_id) else null end)),'{}') into records from public.quiz_past_receipts r where r.attempt_id=aid;
 select coalesce(sum(case when x.correct then x.points else 0 end),0),count(*) filter(where x.correct is not null) into score,answered from public.quiz_past_answers x where attempt_id=aid;
 select coalesce(sum((df->>'points')::numeric),0),count(*) into mx,total from jsonb_array_elements(d->'groups') dg cross join lateral jsonb_array_elements(dg->'fields') df where dg->>'kind' not in('annotation','manual');
 if exists(select 1 from public.quiz_past_receipts where attempt_id=aid and status='self_checked') then drawing:='self_checked';end if;
 select attempt_id into award from public.quiz_past_leaves where user_id=auth.uid() and paper_id=att.paper_id and school_year=att.school_year and semester=att.semester;
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'version_id',a.version_id,'created_at',a.created_at,'completed_at',a.completed_at,'complete',a.completed_at is not null,'score',coalesce(a.score,0),'max_score',a.max_score,'passed',case when a.completed_at is null then null else a.max_score>0 and a.score*100>=a.max_score*60 end,'earned_leaf',a.id=award) order by a.created_at,a.id),'[]') into history from public.quiz_past_attempts a where a.user_id=auth.uid() and a.paper_id=att.paper_id and a.school_year=att.school_year and a.semester=att.semester;
 return jsonb_build_object('version',att.version_id,'title',d->'title','policy',jsonb_build_object('automaticPoints',mx,'manualPoints',(select coalesce(sum((pf->>'points')::numeric),0) from jsonb_array_elements(d->'groups') pg cross join lateral jsonb_array_elements(pg->'fields') pf where pg->>'kind' in('annotation','manual')),'blockedPoints',(select coalesce(sum((b->>'points')::numeric),0) from jsonb_array_elements(coalesce(d->'blocked','[]')) b),'blockedFields',jsonb_array_length(coalesce(d->'blocked','[]'))),'groups',safe,'records',records,'attemptId',aid,'summary',jsonb_build_object('score',score,'max',mx,'answered',answered,'total',total,'drawingStatus',drawing),
  'practice',jsonb_build_object('localOnly',false,'eligible',mx>0,'thresholdPercent',60,'complete',att.completed_at is not null,'leafCount',case when award is null then 0 else 1 end,'earnedByThisAttempt',award=aid,'history',history));
end $$;

create or replace function public.quiz_past_action(p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare identity jsonb;paper public.quiz_past_papers;att public.quiz_past_attempts;prior public.quiz_past_receipts;d jsonb;g jsonb;f jsonb;r jsonb;v jsonb;correct boolean;canonical jsonb:='[]';results jsonb:='[]';n integer:=0;score numeric:=0;mx numeric;aid uuid;rid uuid;viewed public.quiz_past_views;elapsed numeric;min_seconds numeric;gid text;
begin
 if auth.uid() is null then raise exception 'login_required';end if;
 if p_action in('preview','preview_list') then
  if not coalesce(public.is_teacher(),false) then raise exception 'teacher_required';end if;
  if p_action='preview_list' then return jsonb_build_object('papers',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'title',p.title,'grade',p.grade,'enabled',p.enabled,'version',p.active_version) order by p.grade,p.id) from public.quiz_past_papers p where p.owner_id=auth.uid()),'[]'));end if;
  select * into paper from public.quiz_past_papers where id=p_data->>'paper_id' and owner_id=auth.uid();if paper.id is null then raise exception 'paper_unavailable';end if;
  return (select jsonb_build_object('paper',to_jsonb(paper),'document',document,'provenance',provenance) from public.quiz_past_versions where id=paper.active_version);
 end if;
 if coalesce(public.is_teacher(),false) then raise exception 'student_required';end if;
 identity:=public.quiz_student_identity();if identity->>'role' is distinct from 'student' then raise exception 'roster_required';end if;
 if p_action='list' then return jsonb_build_object('identity',identity,'papers',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'title',p.title,'version',p.active_version,'grade',p.grade,'enabled',p.enabled,'catalog',v.document->'catalog') order by p.id) from public.quiz_past_papers p join public.quiz_past_versions v on v.id=p.active_version and v.paper_id=p.id where p.grade=(identity->>'grade')::integer and p.school_year=115 and p.semester=1),'[]'));end if;
 select * into paper from public.quiz_past_papers where id=p_data->>'paper_id' for share;
 if paper.id is null or not paper.enabled or paper.grade<>(identity->>'grade')::integer or paper.school_year<>115 or paper.semester<>1 then raise exception 'paper_unavailable';end if;
 if p_action in('start','restart') then
  rid:=(p_data->>'request_id')::uuid;if rid is null then raise exception 'invalid_request';end if;
  -- Retry of a lost start response returns the exact existing attempt, even after a later revision.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||paper.id,0));
  select * into att from public.quiz_past_attempts where user_id=auth.uid() and paper_id=paper.id and start_request=rid;
  if att.id is null and p_action='start' then select * into att from public.quiz_past_attempts where user_id=auth.uid() and paper_id=paper.id and school_year=paper.school_year and semester=paper.semester and completed_at is null order by created_at desc limit 1;end if;
  if att.id is null then insert into public.quiz_past_attempts(paper_id,version_id,user_id,school_year,semester,start_request) values(paper.id,paper.active_version,auth.uid(),paper.school_year,paper.semester,rid) returning * into att;end if;
  return public.quiz_past_snapshot(att.id)||jsonb_build_object('identity',identity);
 end if;
 aid:=(p_data->>'attempt_id')::uuid;
 select * into att from public.quiz_past_attempts where id=aid and user_id=auth.uid() and paper_id=paper.id for update;
 if att.id is null then raise exception 'attempt_unavailable';end if;
 select document into d from public.quiz_past_versions where id=att.version_id;
 if p_action='resume' then return public.quiz_past_snapshot(aid)||jsonb_build_object('identity',identity);end if;
 gid:=p_data->>'group_id';select x into g from jsonb_array_elements(d->'groups') x where x->>'id'=gid;if g is null then raise exception 'group_unavailable';end if;
 if p_action='view' then
  insert into public.quiz_past_views(attempt_id,group_id) values(aid,gid) on conflict do nothing;return jsonb_build_object('ready',true);
 end if;
 if p_action<>'submit' or p_data->>'version' is distinct from att.version_id::text then raise exception 'version_changed';end if;
 rid:=(p_data->>'request_id')::uuid;if rid is null then raise exception 'invalid_request';end if;
 if jsonb_typeof(p_data->'responses') is distinct from 'array' or jsonb_array_length(p_data->'responses')<>jsonb_array_length(g->'fields') then raise exception 'incomplete_group';end if;
 if g->>'kind'='mark' and p_data->'confirmed' is distinct from 'true'::jsonb then raise exception 'confirmation_required';end if;
 for f in select value from jsonb_array_elements(g->'fields') loop
  r:=p_data->'responses'->n;n:=n+1;
  if jsonb_typeof(r) is distinct from 'object' or (select array_agg(k order by k) from jsonb_object_keys(r) k) is distinct from array['questionId','value'] or r->>'questionId' is distinct from f->>'id' then raise exception 'invalid_group_fields';end if;
  v:=public.quiz_past_canonical(g,r->'value');canonical:=canonical||jsonb_build_array(jsonb_build_object('questionId',f->'id','value',v));
  correct:=case when g->>'kind' in('annotation','manual') then null when g->>'kind'='short' then exists(select 1 from jsonb_array_elements_text(f->'answer') a where trim(a)=trim(v#>>'{}')) else v=f->'answer' end;
  if correct then score:=score+(f->>'points')::numeric;end if;
  results:=results||jsonb_build_array(jsonb_build_object('questionId',f->'id','correct',correct,'points',case when g->>'kind' in('annotation','manual') then null else f->'points' end,'official',case when g->>'kind' in('annotation','manual') then null else f->'answer' end));
 end loop;
 select * into prior from public.quiz_past_receipts where attempt_id=aid and group_id=gid;
 if prior.attempt_id is not null then
  if prior.request_id<>rid or prior.responses is distinct from canonical then raise exception 'submission_conflict';end if;return public.quiz_past_snapshot(aid);
 end if;
 if exists(select 1 from public.quiz_past_receipts where attempt_id=aid and request_id=rid) then raise exception 'submission_conflict';end if;
 select * into viewed from public.quiz_past_views where attempt_id=aid and group_id=gid;
 min_seconds:=greatest(2,jsonb_array_length(g->'fields')*2);elapsed:=extract(epoch from clock_timestamp()-viewed.started_at);
 if viewed.attempt_id is null or elapsed<min_seconds then raise exception 'answer_too_fast';end if;
 insert into public.quiz_past_receipts values(aid,gid,rid,canonical,results,case when g->>'kind' in('annotation','manual') then null else score end,case when g->>'kind' in('annotation','manual') then 'self_checked' else 'graded' end);
 n:=0;for f in select value from jsonb_array_elements(g->'fields') loop
  insert into public.quiz_past_answers values(aid,gid,f->>'id',canonical->n->'value',(results->n->>'correct')::boolean,(f->>'points')::numeric);n:=n+1;
 end loop;
 update public.quiz_past_views set accepted_seconds=elapsed where attempt_id=aid and group_id=gid;
 select coalesce(sum(case when x.correct then x.points else 0 end),0) into score from public.quiz_past_answers x where attempt_id=aid;
 select coalesce(sum((df->>'points')::numeric),0) into mx from jsonb_array_elements(d->'groups') dg cross join lateral jsonb_array_elements(dg->'fields') df where dg->>'kind' not in('annotation','manual');
 update public.quiz_past_attempts set score=score,max_score=mx where id=aid;
 if not exists(select 1 from jsonb_array_elements(d->'groups') required where required->'optional' is distinct from 'true'::jsonb and not exists(select 1 from public.quiz_past_receipts r where r.attempt_id=aid and r.group_id=required->>'id')) then
  update public.quiz_past_attempts set completed_at=coalesce(completed_at,clock_timestamp()) where id=aid;
  if mx>0 and score*100>=mx*60 then
   insert into public.quiz_past_leaves(user_id,paper_id,school_year,semester,attempt_id) values(auth.uid(),paper.id,att.school_year,att.semester,aid) on conflict(user_id,paper_id,school_year,semester) do nothing;
  end if;
 end if;
 return public.quiz_past_snapshot(aid);
end $$;

-- Preserve current production implementations; do not reinstall old quiz/media/reward SQL.
do $$begin
 if to_regprocedure('public.quiz_rewards_before_past(jsonb)') is null then alter function public.quiz_rewards(jsonb) rename to quiz_rewards_before_past;end if;
 if to_regprocedure('public.quiz_media_access_before_past(text,uuid)') is null then alter function public.quiz_media_access(text,uuid) rename to quiz_media_access_before_past;end if;
end$$;
revoke all on function public.quiz_rewards_before_past(jsonb),public.quiz_media_access_before_past(text,uuid) from public,anon,authenticated;
create or replace function public.quiz_rewards(p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare original jsonb;items jsonb;identity jsonb;begin
 original:=public.quiz_rewards_before_past(p_data);if coalesce(public.is_teacher(),false) then return original;end if;
 identity:=public.quiz_student_identity();if identity->>'role' is distinct from 'student' then return original;end if;
 select coalesce(jsonb_agg(jsonb_build_object('id','past:'||l.id,'source_type','past_exam','paper_id',p.id,'attempt_id',a.id,'title',p.title,'grade',p.grade,'total',a.max_score,'correct',a.score,'half_units',2,'awarded_at',l.awarded_at) order by l.awarded_at,l.id),'[]') into items
 from public.quiz_past_leaves l join public.quiz_past_attempts a on a.id=l.attempt_id join public.quiz_past_papers p on p.id=l.paper_id where l.user_id=auth.uid() and l.school_year=115 and l.semester=1 and p.grade=(identity->>'grade')::integer;
 return jsonb_set(original,'{awards}',coalesce(original->'awards','[]')||items);
end$$;
create or replace function public.quiz_media_access(p_url text,p_attempt uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare att public.quiz_past_attempts;paper public.quiz_past_papers;d jsonb;asset public.quiz_media_assets;identity jsonb;
begin
 if auth.uid() is null then raise exception 'login_required';end if;
 if coalesce(public.is_teacher(),false) then
  select * into asset from public.quiz_media_assets where url=p_url and owner_id=auth.uid();
  if asset.url is not null and exists(select 1 from public.quiz_past_versions v join public.quiz_past_papers p on p.id=v.paper_id where p.owner_id=auth.uid() and (public.quiz_past_has_media(v.document,p_url) or exists(select 1 from jsonb_array_elements(v.document->'groups') g where g->>'referenceUrl'=p_url))) then return to_jsonb(asset)||jsonb_build_object('backend','supabase');end if;
 end if;
 select * into att from public.quiz_past_attempts where id=p_attempt;
 if att.id is null then return public.quiz_media_access_before_past(p_url,p_attempt);end if;
 identity:=public.quiz_student_identity();select * into paper from public.quiz_past_papers where id=att.paper_id;
 if att.user_id<>auth.uid() or identity->>'role' is distinct from 'student' or not paper.enabled or paper.grade<>(identity->>'grade')::integer then raise exception 'media_unavailable';end if;
 select document into d from public.quiz_past_versions where id=att.version_id;
 if not public.quiz_past_has_media(d,p_url) and not exists(select 1 from jsonb_array_elements(d->'groups') g where g->>'referenceUrl'=p_url and exists(select 1 from public.quiz_past_receipts r where r.attempt_id=att.id and r.group_id=g->>'id' and r.status='self_checked')) then raise exception 'media_unavailable';end if;
 select * into asset from public.quiz_media_assets where url=p_url and owner_id=paper.owner_id;if asset.url is null then raise exception 'media_unavailable';end if;
 return to_jsonb(asset)||jsonb_build_object('backend','supabase');
end$$;
revoke all on function public.quiz_past_canonical(jsonb,jsonb),public.quiz_past_validate(jsonb),public.quiz_past_snapshot(uuid),public.quiz_past_immutable() from public,anon,authenticated;
revoke all on function public.quiz_past_has_media(jsonb,text) from public,anon,authenticated;
revoke all on function public.quiz_past_action(text,jsonb),public.quiz_rewards(jsonb),public.quiz_media_access(text,uuid) from public,anon;
grant execute on function public.quiz_past_action(text,jsonb),public.quiz_rewards(jsonb),public.quiz_media_access(text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
