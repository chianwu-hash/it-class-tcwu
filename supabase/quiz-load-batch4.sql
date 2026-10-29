-- Fourth batch: cache the per-grade compose catalog, return the saved paper card from
-- compose, and return the roster label with library/entry so quiz pages skip the navbar RPC.
-- Saving, retry, reveal, anti-cheat, leaf and drawing logic are unchanged.
begin;
create table if not exists public.quiz_catalog_cache(grade integer primary key,payload jsonb not null,built_at timestamptz not null default now());
alter table public.quiz_catalog_cache enable row level security;
revoke all on public.quiz_catalog_cache from public,anon,authenticated;

-- Same JSON as batch1 quiz_pool_catalog for one grade; no student data.
create or replace function public.quiz_catalog_build(p_grade integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare courses jsonb; result jsonb;
begin
 with base as materialized (
  select coalesce(m.course_id,'115-1-hanlin-g3-math') course_id,p.unit_ids,coalesce(m.knowledge_reliable,true) reliable
  from public.quiz_question_pool p left join public.quiz_pool_membership m on m.question_id=p.question_id
  join public.quiz_courses c on c.id=coalesce(m.course_id,'115-1-hanlin-g3-math') and c.enabled and c.grade=p_grade
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
revoke all on function public.quiz_catalog_build(integer) from public,anon,authenticated;

-- Writers and cache builders share one transaction lock, so a build never stores a
-- snapshot older than a committed pool/course/character change.
create or replace function public.quiz_catalog_invalidate() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('quiz_catalog_cache',0));
 delete from public.quiz_catalog_cache;
 return null;
end $$;
revoke all on function public.quiz_catalog_invalidate() from public,anon,authenticated;
do $$declare t text;begin
 foreach t in array array['quiz_question_pool','quiz_pool_membership','quiz_courses','quiz_name_characters'] loop
  execute format('drop trigger if exists quiz_catalog_invalidate on public.%I',t);
  execute format('create trigger quiz_catalog_invalidate after insert or update or delete or truncate on public.%I for each statement execute function public.quiz_catalog_invalidate()',t);
 end loop;
end $$;

create or replace function public.quiz_pool_catalog() returns jsonb
language plpgsql security definer set search_path='' as $$
declare identity jsonb; g integer; result jsonb;
begin
 identity:=public.quiz_student_identity();
 if identity->>'role'<>'student' then return jsonb_build_object('available',false,'units','[]'::jsonb,'courses','[]'::jsonb);end if;
 g:=(identity->>'grade')::integer;
 select payload into result from public.quiz_catalog_cache where grade=g;
 if result is null then
  perform pg_advisory_xact_lock(hashtextextended('quiz_catalog_cache',0));
  select payload into result from public.quiz_catalog_cache where grade=g;
  if result is null then
   result:=public.quiz_catalog_build(g);
   insert into public.quiz_catalog_cache(grade,payload) values(g,result) on conflict(grade) do update set payload=excluded.payload,built_at=now();
  end if;
 end if;
 return result;
end $$;

-- Display-only roster label for the quiz navbar; the caller's own enrollment row.
create or replace function public.quiz_nav_identity(p_email text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('email',e.email,'class_code',e.class_code,'seat_no',e.seat_no,'display_name',e.display_name,
  'student_code',e.class_code||lpad(e.seat_no::text,2,'0'))
 from public.student_enrollments e where e.school_year=115 and e.email=p_email limit 1
$$;
revoke all on function public.quiz_nav_identity(text) from public,anon,authenticated;

-- One self/extension paper in the exact library_sessions item shape.
create or replace function public.quiz_paper_card(p_session uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',s.id,'version_id',s.version_id,'title',v.title,'catalog',v.catalog,'status',s.status,
 'generated',s.access_mode='self','display_name',g.display_name,'saved_at',g.created_at,'generated_kind',g.config->>'kind',
 'unit_ids',g.config->'units','distribution',g.actual_distribution,
 'learning_point',case when g.config->>'kind'='extension' then regexp_replace(v.catalog->>'unit','^同重點再練習[：:]\s*','') else null end,
 'total',v.total,
 'answered',coalesce((select count(x.question_id) from public.quiz_attempts a join public.quiz_answers x on x.attempt_id=a.id where a.session_id=s.id and a.user_id=auth.uid()),0),
 'correct',coalesce((select count(*) filter(where x.correct) from public.quiz_attempts a join public.quiz_answers x on x.attempt_id=a.id where a.session_id=s.id and a.user_id=auth.uid()),0))
 from public.quiz_sessions s join public.quiz_generated_papers g on g.session_id=s.id and g.user_id=auth.uid() and g.deleted_at is null
 join public.quiz_version_meta v on v.version_id=s.version_id
 where s.id=p_session and s.access_mode='self'
$$;
revoke all on function public.quiz_paper_card(uuid) from public,anon,authenticated;

create or replace function public.quiz_library_sessions(p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare identity jsonb; papers jsonb;
begin
 identity:=public.quiz_student_identity();
 with visible as materialized (
  select s.id,s.version_id,s.status,s.access_mode,g.display_name,g.created_at saved_at,g.config,g.actual_distribution
  from public.quiz_sessions s left join public.quiz_generated_papers g on g.session_id=s.id and g.user_id=auth.uid()
  where s.access_mode in ('practice','self') and (s.access_mode<>'self' or (g.session_id is not null and g.deleted_at is null))
  and exists(select 1 from public.student_enrollments e where e.email=identity->>'email' and e.school_year=s.school_year and s.class_codes ? e.class_code)
 ), progress as (
  select a.session_id,count(x.question_id) answered,count(*) filter(where x.correct) correct
  from visible s join public.quiz_attempts a on a.session_id=s.id and a.user_id=auth.uid()
  left join public.quiz_answers x on x.attempt_id=a.id group by a.session_id
 )
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'version_id',s.version_id,'title',v.title,'catalog',v.catalog,'status',s.status,
 'generated',s.access_mode='self','display_name',s.display_name,'saved_at',s.saved_at,'generated_kind',s.config->>'kind',
 'unit_ids',s.config->'units','distribution',s.actual_distribution,
 'learning_point',case when s.config->>'kind'='extension' then regexp_replace(v.catalog->>'unit','^同重點再練習[：:]\s*','') else null end,
 'total',v.total,'answered',coalesce(p.answered,0),'correct',coalesce(p.correct,0))
 order by v.catalog->>'volume',v.catalog->>'subject',v.catalog->>'unit'),'[]') into papers
 from visible s join public.quiz_version_meta v on v.version_id=s.version_id left join progress p on p.session_id=s.id;
 return jsonb_build_object('sessions',papers,'role',identity->>'role','grade',identity->'grade','identity',public.quiz_nav_identity(identity->>'email'));
end $$;
revoke all on function public.quiz_library_sessions(jsonb) from public,anon;
grant execute on function public.quiz_library_sessions(jsonb) to authenticated;

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
  -- Small per-version summary instead of detoasting the whole document; same subject.
  select coalesce(m.catalog->>'subject',v.document->'catalog'->>'subject'),v.id into subject,vid
  from public.quiz_versions v left join public.quiz_version_meta m on m.version_id=v.id where v.id=sess.version_id;
 end if;
 return jsonb_build_object('role',identity->>'role','grade',identity->'grade','subject',subject,'version_id',vid,'identity',public.quiz_nav_identity(identity->>'email'));
end $$;
revoke all on function public.quiz_entry_context(jsonb) from public,anon;
grant execute on function public.quiz_entry_context(jsonb) to authenticated;

-- quiz_compose: batch3 definition verbatim except both returns add the saved paper card.
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
 select e.class_code into cls from public.student_enrollments e where e.email=v_email and e.school_year=115 and e.class_code ~ '^[36][0-9]{2}$';
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
  select a.question_id,count(*) n from public.quiz_answers a join public.quiz_attempts at on at.id=a.attempt_id
  where at.user_id=uid and a.question_id is not null group by a.question_id) history;
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
end $function$;
commit;
