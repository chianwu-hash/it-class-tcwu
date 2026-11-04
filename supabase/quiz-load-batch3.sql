-- Batch 3: fixed candidate metadata, one-pass student projection, grouped monitoring.
begin;
do $$begin
 if not exists(select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='quiz_draw_candidate') then
  create type public.quiz_draw_candidate as (question_id text,group_key text,unit_ids jsonb,knowledge_code text,difficulty integer,seen bigint,rank text,unit_bucket bigint);
 end if;
end$$;
revoke all on type public.quiz_draw_candidate from public,anon,authenticated;

-- Expand the frozen source once; preserve first-match legacy behavior and explicit whitelist.
create or replace function public.quiz_student_document(d jsonb,qo jsonb,oo jsonb) returns jsonb
language sql immutable set search_path='' as $$
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
    join jsonb_array_elements_text(coalesce(oo->(q->>'id'),'[]')) with ordinality opt(id,ord) on o->>'id'=opt.id)) item
  from jsonb_array_elements(qo) with ordinality r(qid,n)
  left join source on source.id=r.qid#>>'{}'
 ) select jsonb_build_object('title',d->>'title','questions',coalesce(jsonb_agg(item order by n),'[]'::jsonb)) from items;
$$;

create or replace function public.quiz_monitor(p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();sess public.quiz_sessions;result jsonb;
begin
 if uid is null then raise exception 'login_required';end if;
 if not coalesce(public.is_teacher(),false) then raise exception 'teacher_required';end if;
 select * into sess from public.quiz_sessions where id=(p_data->>'session_id')::uuid;
 if sess.id is null or sess.owner_id<>uid then raise exception 'session_unavailable';end if;
 if sess.access_mode='self' and not exists(select 1 from public.quiz_generated_papers g where g.session_id=sess.id and g.user_id=uid) then raise exception 'session_unavailable';end if;
 with attempts as materialized (select * from public.quiz_attempts where session_id=sess.id),
 progress as materialized (
  select x.attempt_id,count(*) answered,max(x.created_at) last_submitted_at
  from public.quiz_answers x join attempts a on a.id=x.attempt_id group by x.attempt_id
 )
 select coalesce(jsonb_agg(jsonb_build_object('user_id',a.user_id,'answered',coalesce(p.answered,0),
  'total',jsonb_array_length(a.question_order),'class_code',e.class_code,'seat_no',e.seat_no,'display_name',e.display_name,
  'last_submitted_at',p.last_submitted_at) order by a.created_at),'[]'::jsonb) into result
 from attempts a join auth.users u on u.id=a.user_id
 left join public.student_enrollments e on e.email=lower(u.email) and e.school_year=sess.school_year
 left join progress p on p.attempt_id=a.id;
 return jsonb_build_object('status',sess.status,'students',result);
end$$;
revoke all on function public.quiz_monitor(jsonb) from public,anon;
grant execute on function public.quiz_monitor(jsonb) to authenticated;

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
 return jsonb_build_object('session_id',s_id,'display_name',paper_name,'distribution',distribution,'reused',false);
end $function$;
commit;
