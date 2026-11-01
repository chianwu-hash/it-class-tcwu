-- Additive teacher-only reading API. Apply locally first; no changes to grading/writes.
begin;

create index if not exists admin_learning_attempt_user_idx on public.quiz_attempts(user_id,session_id);
create index if not exists admin_learning_event_progress_idx on public.typing_foundation_events(progress_id,revision,created_at desc,id);
create index if not exists admin_learning_reset_progress_idx on public.typing_foundation_resets(progress_id,reset_at desc,id);

-- Internal projection; deliberately not callable by browser roles.
create or replace function public.admin_learning_paper_rows(p_user uuid,p_year integer,p_class text)
returns table(session_id uuid,attempt_id uuid,title text,subject text,unit text,access_mode text,
 revision integer,created_at timestamptz,started_at timestamptz,last_answer_at timestamptz,
 answered bigint,correct bigint,total integer,hidden boolean,source_attempt_id text,source_question_id text)
language sql stable set search_path='' as $$
 with own as (
  select a.session_id from public.quiz_attempts a where a.user_id=p_user
  union select g.session_id from public.quiz_generated_papers g where g.user_id=p_user
 )
 select s.id,a.id,coalesce(g.display_name,v.document->>'title','未命名試卷'),
  coalesce(v.document->'catalog'->>'subject',''),coalesce(v.document->'catalog'->>'unit',''),
  s.access_mode,v.revision,s.created_at,a.created_at,x.last_at,x.answered,x.correct,
  case when a.id is not null then jsonb_array_length(a.question_order)
   else (select coalesce(sum(jsonb_array_length(b->'questions')),0)::integer from jsonb_array_elements(v.document->'blocks') b) end,
  g.deleted_at is not null,g.config->>'attempt_id',g.config->>'question_id'
 from own o join public.quiz_sessions s on s.id=o.session_id
 join public.quiz_versions v on v.id=s.version_id
 left join public.quiz_attempts a on a.session_id=s.id and a.user_id=p_user
 left join public.quiz_generated_papers g on g.session_id=s.id and g.user_id=p_user
 cross join lateral (select count(*) as answered,count(*) filter(where z.correct) as correct,max(z.created_at) as last_at
  from public.quiz_answers z where z.attempt_id=a.id) x
 where s.school_year=p_year and s.class_codes ? p_class and s.access_mode in ('classroom','practice','self');
$$;
revoke all on function public.admin_learning_paper_rows(uuid,integer,text) from public,anon,authenticated;

create or replace function public.admin_learning_action(p_action text,p_course_id text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 yr integer; grade text; cls text; seat integer; uid uuid; mappings integer; label text;
 lim integer:=20; offst integer:=0; search text; result jsonb; identity jsonb;
 selected_subject text; selected_state text;
 prog public.typing_foundation_progress%rowtype; sess public.quiz_sessions%rowtype;
 att public.quiz_attempts%rowtype; doc jsonb; version_no integer; paper_count integer;
begin
 if auth.uid() is null or not coalesce(public.is_teacher(),false) then raise exception 'teacher_required';end if;
 -- v1 contract intentionally limited to the two audited course identities.
 if p_course_id is null or p_course_id not in ('grade3-115-1','grade6-115-1') then raise exception 'invalid_course';end if;
 yr:=115;grade:=substring(p_course_id from 6 for 1);
 if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'invalid_request';end if;
 if exists(select 1 from jsonb_object_keys(p_payload) k where k not in
  ('class_code','seat_no','search','limit','offset','progress_id','session_id','revision','filter','subject','state')) then raise exception 'invalid_request';end if;
 if coalesce(p_payload->>'filter','all') not in ('all','wrong') then raise exception 'invalid_request';end if;
 selected_subject:=coalesce(p_payload->>'subject','');selected_state:=coalesce(p_payload->>'state','all');
 if length(selected_subject)>80 or selected_state not in ('all','unstarted','in_progress','completed','hidden') then raise exception 'invalid_request';end if;
 if coalesce(p_payload->>'limit','20') !~ '^[0-9]{1,2}$' or coalesce(p_payload->>'offset','0') !~ '^[0-9]{1,6}$' then raise exception 'invalid_page';end if;
 lim:=(coalesce(p_payload->>'limit','20'))::integer;offst:=(coalesce(p_payload->>'offset','0'))::integer;
 if lim not between 1 and 50 or offst>100000 then raise exception 'invalid_page';end if;
 cls:=nullif(p_payload->>'class_code','');search:=coalesce(p_payload->>'search','');
 if length(search)>80 or (cls is not null and (cls !~ '^[36][0-9]{2}$' or left(cls,1)<>grade)) then raise exception 'invalid_class';end if;

 if p_action='roster' then
  with rows as (
   select e.class_code,e.seat_no,e.display_name,e.class_code||lpad(e.seat_no::text,2,'0') as student_code,
    (select count(*) from auth.users u where lower(u.email)=e.email and u.email_confirmed_at is not null) as mappings
   from public.student_enrollments e where e.school_year=yr and left(e.class_code,1)=grade
    and (cls is null or e.class_code=cls)
    and (search='' or strpos(e.display_name,search)>0 or strpos(e.class_code||lpad(e.seat_no::text,2,'0'),search)>0)
  ), page as (select * from rows order by class_code,seat_no,student_code limit lim offset offst)
  select jsonb_build_object('total',(select count(*) from rows),'offset',offst,'limit',lim,
   'items',coalesce((select jsonb_agg(to_jsonb(p) order by class_code,seat_no,student_code) from page p),'[]'::jsonb),
   'classes',(select coalesce(jsonb_agg(c.class_code order by c.class_code),'[]'::jsonb) from
    (select distinct e.class_code from public.student_enrollments e where e.school_year=yr and left(e.class_code,1)=grade)c),
   'as_of',statement_timestamp()) into result;
  return result;
 end if;
 if p_action is null or p_action not in ('profile','weekly','typing','typing_events','papers','paper') then raise exception 'invalid_action';end if;
 if cls is null or coalesce(p_payload->>'seat_no','') !~ '^[0-9]{1,2}$' then raise exception 'student_required';end if;
 seat:=(p_payload->>'seat_no')::integer;
 select e.display_name into label from public.student_enrollments e where e.school_year=yr and e.class_code=cls and e.seat_no=seat;
 if not found then raise exception 'student_unavailable';end if;
 select count(*),min(u.id::text)::uuid into mappings,uid from auth.users u
 join public.student_enrollments e on lower(u.email)=e.email
 where e.school_year=yr and e.class_code=cls and e.seat_no=seat and u.email_confirmed_at is not null;
 identity:=jsonb_build_object('school_year',yr,'class_code',cls,'seat_no',seat,'display_name',label,
  'mapping',case when mappings=1 then 'linked' when mappings=0 then 'unlinked' else 'conflict' end);
 if mappings<>1 then return jsonb_build_object('identity',identity,'items','[]'::jsonb,'total',0,'as_of',statement_timestamp());end if;

 if p_action='profile' then
  return jsonb_build_object('identity',identity,'as_of',statement_timestamp(),
   'weekly',(select jsonb_build_object('recorded',count(*),'completed',count(*) filter(where s.completed),'last_at',max(s.updated_at))
    from public.student_progress s where s.user_id=uid and s.course_id=p_course_id),
   'typing',(select jsonb_build_object('recorded',count(*),'english',count(*) filter(where l.track='english' and p.completed),
    'zhuyin',count(*) filter(where l.track='zhuyin' and p.completed),'last_at',max(p.updated_at))
    from public.typing_foundation_progress p join public.typing_foundation_lessons l using(lesson_key)
    where p.course_id=p_course_id and p.learner_key='google:'||uid::text),
   'papers',(select jsonb_build_object('created',count(*),'started',count(attempt_id),
    'completed',count(*) filter(where answered=total and total>0),'last_at',max(last_answer_at))
    from public.admin_learning_paper_rows(uid,yr,cls)));
 end if;
 if p_action='weekly' then
  with rows as (select s.week_code,s.activity_key,s.current_level,s.score,s.completed,s.updated_at
   from public.student_progress s where s.user_id=uid and s.course_id=p_course_id),
  page as(select * from rows order by week_code,activity_key limit lim offset offst)
  select jsonb_build_object('total',(select count(*) from rows),'items',coalesce((select jsonb_agg(to_jsonb(p) order by week_code,activity_key) from page p),'[]'::jsonb)) into result;
 elsif p_action='typing' then
  with rows as (
   select l.lesson_key,l.ordinal,l.track,l.rate_unit,l.speed,l.starter_speed,
    p.id as progress_id,coalesce(p.checkpoint,0) as checkpoint,coalesce(p.completed,false) as completed,
    p.completed_at,p.updated_at,p.revision,coalesce(p.starter,false) as starter,
    x.best_rate,x.events,x.last_at,
    exists(select 1 from public.typing_foundation_lessons prev where prev.track=l.track and prev.ordinal<l.ordinal
     and not exists(select 1 from public.typing_foundation_progress pp where pp.course_id=p_course_id
      and pp.learner_key='google:'||uid::text and pp.lesson_key=prev.lesson_key and pp.completed)) as blocked,
    (select count(*) from public.typing_foundation_resets r where r.progress_id=p.id) as resets
   from public.typing_foundation_lessons l left join public.typing_foundation_progress p
    on p.lesson_key=l.lesson_key and p.course_id=p_course_id and p.learner_key='google:'||uid::text
   cross join lateral (select count(*) as events,max(e.created_at) as last_at,
    max(coalesce(e.cpm,e.wpm)) filter(where e.revision=p.revision and e.stage=6 and e.passed) as best_rate
    from public.typing_foundation_events e where e.progress_id=p.id) x
  ),page as(select * from rows order by ordinal,lesson_key limit lim offset offst)
  select jsonb_build_object('total',(select count(*) from rows),'items',coalesce((select jsonb_agg(to_jsonb(p) order by ordinal,lesson_key) from page p),'[]'::jsonb)) into result;
 elsif p_action='typing_events' then
  select * into prog from public.typing_foundation_progress p where p.id=(p_payload->>'progress_id')::uuid
   and p.course_id=p_course_id and p.learner_key='google:'||uid::text;
  if not found then raise exception 'progress_unavailable';end if;
  if p_payload ? 'revision' and coalesce(p_payload->>'revision','') !~ '^[0-9]{1,6}$' then raise exception 'invalid_revision';end if;
  with rows as (select e.id,e.revision,e.stage,e.correct,e.errors,e.elapsed_ms,e.interrupted,e.accuracy,
   coalesce(e.cpm,e.wpm) as rate,e.rate_unit,e.passed,e.created_at from public.typing_foundation_events e
   where e.progress_id=prog.id and (not(p_payload ? 'revision') or e.revision=(p_payload->>'revision')::integer)),
  page as(select * from rows order by created_at desc,id limit lim offset offst)
  select jsonb_build_object('revision',prog.revision,'total',(select count(*) from rows),
   'items',coalesce((select jsonb_agg(to_jsonb(p) order by created_at desc,id) from page p),'[]'::jsonb),
   'reset_total',(select count(*) from public.typing_foundation_resets r where r.progress_id=prog.id),
   'resets',coalesce((select jsonb_agg(to_jsonb(r) order by reset_at desc,id) from
    (select id,previous_revision,previous_checkpoint,previous_completed,reset_at from public.typing_foundation_resets
     where progress_id=prog.id order by reset_at desc,id limit 20)r),'[]'::jsonb)) into result;
 elsif p_action='papers' then
  with rows as materialized(select * from public.admin_learning_paper_rows(uid,yr,cls)),
  filtered as (select * from rows r where (selected_subject='' or r.subject=selected_subject)
   and (selected_state='all' or (selected_state='unstarted' and r.attempt_id is null)
    or (selected_state='in_progress' and r.attempt_id is not null and (r.answered<r.total or r.total=0))
    or (selected_state='completed' and r.answered=r.total and r.total>0)
    or (selected_state='hidden' and r.hidden))),
  page as(select * from filtered order by created_at desc,session_id limit lim offset offst)
  select jsonb_build_object('total',(select count(*) from filtered),'all_total',(select count(*) from rows),
   'subjects',(select coalesce(jsonb_agg(subject order by subject),'[]'::jsonb) from (select distinct subject from rows where subject<>'')s),
   'items',coalesce((select jsonb_agg(to_jsonb(p) order by created_at desc,session_id) from page p),'[]'::jsonb)) into result;
 elsif p_action='paper' then
  select * into sess from public.quiz_sessions s where s.id=(p_payload->>'session_id')::uuid and s.school_year=yr
   and s.class_codes ? cls and s.access_mode in ('classroom','practice','self')
   and (exists(select 1 from public.quiz_attempts a where a.session_id=s.id and a.user_id=uid)
    or exists(select 1 from public.quiz_generated_papers g where g.session_id=s.id and g.user_id=uid));
  if not found then raise exception 'paper_unavailable';end if;
  select * into att from public.quiz_attempts a where a.session_id=sess.id and a.user_id=uid;
  select v.document,v.revision into doc,version_no from public.quiz_versions v where v.id=sess.version_id;
  if coalesce((doc->>'schema')::integer,0)<>1 then raise exception 'unsupported_document';end if;
  with definitions as (
   select q as question,b->'material' as material,b->>'id' as block_id,
    row_number() over(order by bo,qo) as original_no
   from jsonb_array_elements(doc->'blocks') with ordinality blocks(b,bo),
    lateral jsonb_array_elements(b->'questions') with ordinality questions(q,qo)
  ), rows as (
   select d.question,d.material,d.block_id,coalesce(o.no,d.original_no) as number,
    x.response,x.correct,x.created_at as answered_at,x.attempt_id is not null as answered,
    att.option_orders->(d.question->>'id') as option_order
   from definitions d left join lateral
    (select no from jsonb_array_elements_text(coalesce(att.question_order,'[]'::jsonb)) with ordinality r(id,no) where r.id=d.question->>'id')o on true
   left join public.quiz_answers x on x.attempt_id=att.id and x.question_id=d.question->>'id'
   where att.id is null or o.no is not null
  ), filtered as(select * from rows where coalesce(p_payload->>'filter','all')='all' or (answered and not correct)),
  page as(select * from filtered order by number limit lim offset offst)
  select jsonb_build_object('title',coalesce((select g.display_name from public.quiz_generated_papers g where g.session_id=sess.id),doc->>'title'),
   'revision',version_no,'session_id',sess.id,'started',att.id is not null,'total',(select count(*) from rows),'filtered_total',(select count(*) from filtered),
   'answered',(select count(*) from rows where answered),'correct',(select count(*) from rows where correct),
   'hidden',exists(select 1 from public.quiz_generated_papers g where g.session_id=sess.id and g.user_id=uid and g.deleted_at is not null),
   'items',coalesce((select jsonb_agg(to_jsonb(p) order by number) from page p),'[]'::jsonb)) into result;
 end if;
 return result||jsonb_build_object('identity',identity,'offset',offst,'limit',lim,'as_of',statement_timestamp());
end $$;
revoke all on function public.admin_learning_action(text,text,jsonb) from public,anon;
grant execute on function public.admin_learning_action(text,text,jsonb) to authenticated;

-- Asset metadata for the separate read-only signing endpoint. The asset must belong
-- to the exact fixed version of an authorized student's paper, not just any teacher.
create or replace function public.admin_learning_media_access(p_course_id text,p_student jsonb,p_session uuid,p_url text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare checked jsonb; doc jsonb; asset public.quiz_media_assets%rowtype;
begin
 if auth.uid() is null or not coalesce(public.is_teacher(),false) then raise exception 'teacher_required';end if;
 checked:=public.admin_learning_action('paper',p_course_id,p_student||jsonb_build_object('session_id',p_session,'limit',1,'offset',0));
 if checked->'identity'->>'mapping' is distinct from 'linked' then raise exception 'paper_unavailable';end if;
 select v.document into doc from public.quiz_sessions s join public.quiz_versions v on v.id=s.version_id where s.id=p_session;
 if not exists(select 1 from jsonb_path_query(doc,'$.**.media[*].url') u where u#>>'{}'=p_url) then raise exception 'media_unavailable';end if;
 select * into asset from public.quiz_media_assets where url=p_url;
 if not found then raise exception 'media_unavailable';end if;
 return to_jsonb(asset);
end $$;
revoke all on function public.admin_learning_media_access(text,jsonb,uuid,text) from public,anon;
grant execute on function public.admin_learning_media_access(text,jsonb,uuid,text) to authenticated;
commit;
