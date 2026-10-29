-- Apply after quiz-load-batch1.sql. Private immutable-version read indexes only.
begin;
create table if not exists public.quiz_version_meta (
 version_id uuid primary key references public.quiz_versions(id) on delete cascade,
 title text, catalog jsonb, total bigint not null,
 question_index jsonb not null, block_questions jsonb not null
);
alter table public.quiz_version_meta enable row level security;
revoke all on public.quiz_version_meta from public,anon,authenticated;

create or replace function public.quiz_cache_version(p_id uuid,p_doc jsonb) returns void
language plpgsql security definer set search_path='' as $$
begin
 with questions as materialized (
  select b->>'id' block_id,q->>'id' question_id,left(q->'prompt'->>'text',160) preview
  from jsonb_array_elements(p_doc->'blocks') b cross join lateral jsonb_array_elements(b->'questions') q
 ), blocks as (select block_id,jsonb_object_agg(question_id,true) ids from questions group by block_id)
 insert into public.quiz_version_meta
 select p_id,p_doc->>'title',p_doc->'catalog',(select count(*) from questions),
  coalesce((select jsonb_object_agg(question_id,jsonb_build_object('block_id',block_id,'preview',preview)) from questions),'{}'),
  coalesce((select jsonb_object_agg(block_id,ids) from blocks),'{}')
 on conflict(version_id) do update set title=excluded.title,catalog=excluded.catalog,total=excluded.total,
  question_index=excluded.question_index,block_questions=excluded.block_questions;
end $$;
revoke all on function public.quiz_cache_version(uuid,jsonb) from public,anon,authenticated;
create or replace function public.quiz_version_meta_trigger() returns trigger
language plpgsql security definer set search_path='' as $$
begin perform public.quiz_cache_version(new.id,new.document);return new;end $$;
revoke all on function public.quiz_version_meta_trigger() from public,anon,authenticated;
drop trigger if exists quiz_version_meta on public.quiz_versions;
create trigger quiz_version_meta after insert or update of document on public.quiz_versions
 for each row execute function public.quiz_version_meta_trigger();
-- Idempotent backfill; original documents, responses, timing and awards are untouched.
do $$declare v record;begin for v in select id,document from public.quiz_versions loop
 perform public.quiz_cache_version(v.id,v.document);end loop;end $$;

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
 return jsonb_build_object('sessions',papers,'role',identity->>'role','grade',identity->'grade');
end $$;
revoke all on function public.quiz_library_sessions(jsonb) from public,anon;
grant execute on function public.quiz_library_sessions(jsonb) to authenticated;

-- Only ids, small catalog data and order arrays: never full document/reviews/leaf.
create or replace function public.quiz_wrong_refs(p_grade integer,p_attempt text default null,p_question text default null)
returns table(attempt_id uuid,session_id uuid,version_id uuid,question_id text,answered_at timestamptz,title text,catalog jsonb,ordered_ids text[])
language sql stable security definer set search_path='' as $$
 with owned as materialized (
  select a.id,a.session_id,s.version_id,s.reveal,v.title,v.catalog,v.question_index,v.block_questions,
   array(select jsonb_array_elements_text(a.question_order)) ordered_ids
  from public.quiz_attempts a join public.quiz_sessions s on s.id=a.session_id
  join public.quiz_version_meta v on v.version_id=s.version_id
  where a.user_id=auth.uid() and (p_attempt is null or a.id=case when p_attempt ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then p_attempt::uuid end) and s.access_mode<>'personal'
  and coalesce(nullif(left(v.catalog->>'volume',1),''),p_grade::text)=p_grade::text
  and exists(select 1 from public.student_enrollments e join auth.users u on lower(u.email)=e.email
   where u.id=auth.uid() and u.email_confirmed_at is not null and e.school_year=s.school_year and s.class_codes ? e.class_code)
 ), progress as materialized (
  select x.attempt_id,jsonb_object_agg(x.question_id,true) answered from public.quiz_answers x join owned a on a.id=x.attempt_id group by x.attempt_id
 )
 select a.id,a.session_id,a.version_id,x.question_id,x.created_at,a.title,a.catalog,a.ordered_ids
 from owned a join progress p on p.attempt_id=a.id join public.quiz_answers x on x.attempt_id=a.id and not x.correct
 where (p_question is null or x.question_id=p_question)
 and a.question_index ? x.question_id
 and ((a.reveal='complete' and p.answered ?& a.ordered_ids)
  or (a.reveal='immediate' and p.answered @> (a.block_questions->(a.question_index->x.question_id->>'block_id'))))
$$;
revoke all on function public.quiz_wrong_refs(integer,text,text) from public,anon,authenticated;

-- Same reliable source/course resolution used by detail availability and composition.
create or replace function public.quiz_extension_source(p_version uuid,p_question text,p_catalog jsonb,p_grade integer)
returns public.quiz_question_pool language plpgsql stable security definer set search_path='' as $$
declare source public.quiz_question_pool;v_course text;
begin
 select p.* into source from public.quiz_question_pool p where p.question_id=p_question;
 if source.question_id is null then select p.* into source from public.quiz_pool_aliases a join public.quiz_question_pool p on p.question_id=a.question_id where a.version_id=p_version and a.legacy_question_id=p_question;end if;
 if source.question_id is null and p_catalog->>'subject'='數學' and left(p_catalog->>'volume',1)='3' then
  select p.* into source from public.quiz_question_pool p where 'midterm_'||p.source_item_id=p_question and not exists(select 1 from public.quiz_pool_membership m where m.question_id=p.question_id);
 end if;
 select coalesce(m.course_id,'115-1-hanlin-g3-math') into v_course from public.quiz_question_pool p left join public.quiz_pool_membership m on m.question_id=p.question_id where p.question_id=source.question_id and coalesce(m.knowledge_reliable,true);
 if not exists(select 1 from public.quiz_courses c where c.id=v_course and c.enabled and c.grade=p_grade) then return null;end if;
 return source;
end $$;
revoke all on function public.quiz_extension_source(uuid,text,jsonb,integer) from public,anon,authenticated;

create or replace function public.quiz_wrong_questions(p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare identity jsonb; grade integer; page integer; subject text:=coalesce(p_data->>'subject','');unit text:=coalesce(p_data->>'unit','');
 r record; att public.quiz_attempts;sess public.quiz_sessions;b jsonb;q jsonb;options jsonb;response jsonb;source public.quiz_question_pool;v_course text;can_extend boolean:=false;result jsonb;
begin
 identity:=public.quiz_student_identity();grade:=(identity->>'grade')::integer;
 if coalesce(p_data->>'grade','') not in ('','3','6') or coalesce(p_data->>'page','0') !~ '^[0-9]{1,5}$' or length(subject)>30 or length(unit)>200 then raise exception 'invalid_request';end if;
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
  if sess.reveal='complete' and (select count(*) from public.quiz_answers where attempt_id=att.id)<>jsonb_array_length(att.question_order) then raise exception 'wrong_question_unavailable';end if;
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
   'question',jsonb_build_object('id',q->>'id','type',q->>'type','prompt',q->'prompt','block_id',b->>'id','material',b->'material','options',options),
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
end $$;
revoke all on function public.quiz_wrong_questions(jsonb) from public,anon;
grant execute on function public.quiz_wrong_questions(jsonb) to authenticated;

create or replace function public.quiz_version_browser(p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare bank uuid:=(p_data->>'bank_id')::uuid; result jsonb;
begin
 if auth.uid() is null then raise exception 'login_required';end if;
 if not coalesce(public.is_teacher(),false) then raise exception 'teacher_required';end if;
 if not exists(select 1 from public.quiz_banks where id=bank and owner_id=auth.uid()) then raise exception 'bank_unavailable';end if;
 if coalesce(p_data->>'action','list')='get' then
  select to_jsonb(v) into result from public.quiz_versions v where v.bank_id=bank and v.id=(p_data->>'version_id')::uuid;
  if result is null then raise exception 'version_unavailable';end if;return result;
 elsif coalesce(p_data->>'action','list')<>'list' then raise exception 'invalid_request';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'bank_id',v.bank_id,'revision',v.revision,'created_at',v.created_at,'title',m.title,'catalog',m.catalog,'total',m.total) order by v.revision desc),'[]') into result
 from public.quiz_versions v join public.quiz_version_meta m on m.version_id=v.id where v.bank_id=bank;
 return jsonb_build_object('versions',result);
end $$;
revoke all on function public.quiz_version_browser(jsonb) from public,anon;
grant execute on function public.quiz_version_browser(jsonb) to authenticated;

-- Only the reliable extension source lookup changes; save/retry/selection are identical.
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
  return jsonb_build_object('session_id',old.session_id,'display_name',old.display_name,'distribution',old.actual_distribution,'reused',true);
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
   select p.* into chosen from public.quiz_question_pool p where p.usable and not(p.question_id=any(selected))
    and coalesce((select m.course_id from public.quiz_pool_membership m where m.question_id=p.question_id),'115-1-hanlin-g3-math')=selected_course
    and (kind='extension' or p.difficulty=d)
    and not exists(select 1 from public.quiz_question_pool x where x.question_id=any(selected) and x.group_key=p.group_key)
    and ((kind='self' and exists(select 1 from jsonb_array_elements(units) u where p.unit_ids @> jsonb_build_array(u)))
     or (kind='extension' and p.publisher_explanation and coalesce((select m.knowledge_reliable from public.quiz_pool_membership m where m.question_id=p.question_id),true) and p.knowledge_code=source.knowledge_code and p.group_key<>source.group_key and p.difficulty<=source.difficulty))
    order by
     case when kind='extension' and p.publisher_explanation then 0 when kind='extension' then 1 else 0 end,
     coalesce((seen_counts->>p.question_id)::bigint,0),
     (select count(*) from public.quiz_question_pool x where x.question_id=any(selected) and x.knowledge_code=p.knowledge_code),
     (select count(*) from public.quiz_question_pool x where x.question_id=any(selected) and x.unit_ids=p.unit_ids),
     case when kind='extension' then abs(p.difficulty-source.difficulty) else 0 end,md5(p.question_id||seed) limit 1;
   if chosen.question_id is null then exit; end if;
   selected:=array_append(selected,chosen.question_id);
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
 return jsonb_build_object('session_id',s_id,'display_name',paper_name,'distribution',distribution,'reused',false);
end $function$;
commit;
