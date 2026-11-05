-- Teacher read-only activity expansion. No learner writes or grading changes.
begin;
do $guard$ begin
 if md5(pg_get_functiondef('public.admin_learning_paper_rows(uuid,integer,text)'::regprocedure))<>'bc6bf42f7c0fb441c34ada55470182ab' then raise exception 'production_function_changed: admin_learning_paper_rows(uuid,integer,text)';end if;
 if md5(pg_get_functiondef('public.admin_learning_action(text,text,jsonb)'::regprocedure))<>'fa7481e709115c757fa99a3f0b0f0a32' then raise exception 'production_function_changed: admin_learning_action(text,text,jsonb)';end if;
 if md5(pg_get_functiondef('public.admin_learning_media_access(text,jsonb,uuid,text)'::regprocedure))<>'2664a46ce6e5b3611794a0c20a76f4b3' then raise exception 'production_function_changed: admin_learning_media_access(text,jsonb,uuid,text)';end if;
 if md5(pg_get_functiondef('public.admin_learning_rewards(text,text,jsonb)'::regprocedure))<>'025bc31c7226254ce75c3071314dd1da' then raise exception 'production_function_changed: admin_learning_rewards(text,text,jsonb)';end if;
end $guard$;
-- Internal projection: caller must first bind the attempt to the selected roster user.
create or replace function public.admin_learning_past_detail(aid uuid,lim integer,offst integer,flt text)
returns jsonb language sql stable set search_path='' as $$
 with source as (
  select a.*,v.document,v.created_at as version_created from public.quiz_past_attempts a
  join public.quiz_past_versions v on v.id=a.version_id and v.paper_id=a.paper_id where a.id=aid
 ), fields as (
  select g,f,go,fo,row_number() over(order by go,fo) as number,s.document,s.version_id,s.paper_id
  from source s cross join lateral jsonb_array_elements(s.document->'groups') with ordinality groups(g,go)
  cross join lateral jsonb_array_elements(g->'fields') with ordinality fields(f,fo)
 ), rows as (
  select f.*,r.status as receipt_status,r.attempt_id is not null as answered,
   a.response,a.correct,saved.value as raw_response,coalesce(official.value,f.f->'answer',f.f->'reference') as official,
   f.g->>'kind' in ('manual','annotation') or r.status='self_checked' as manual,
   r.attempt_id is not null as receipt_saved
  from fields f left join public.quiz_past_receipts r on r.attempt_id=aid and r.group_id=f.g->>'id'
  left join public.quiz_past_answers a on a.attempt_id=aid and a.group_id=f.g->>'id' and a.question_id=f.f->>'id'
  left join lateral(select x->'value' as value from jsonb_array_elements(coalesce(r.responses,'[]')) x where x->>'questionId'=f.f->>'id') saved on true
  left join lateral(select x->'official' as value from jsonb_array_elements(coalesce(r.results,'[]')) x where x->>'questionId'=f.f->>'id') official on true
 ), filtered as(select * from rows where flt='all' or (answered and correct=false)),
 page as(select * from filtered order by number limit lim offset offst)
 select jsonb_build_object('activity_type','past_exam','title',(select document->>'title' from source),
  'version_id',(select version_id from source),
  'revision',(select count(*) from public.quiz_past_versions v,source s where v.paper_id=s.paper_id and (v.created_at,v.id)<=(s.version_created,s.version_id)),
  'session_id',aid,'started',true,'total',(select count(*) from rows),'filtered_total',(select count(*) from filtered),
  'answered',(select count(*) from rows where answered),'correct',(select count(*) from rows where correct=true),
  'manual',(select count(*) from rows where manual),'completed_at',(select completed_at from source),'hidden',false,
  'items',coalesce((select jsonb_agg(jsonb_build_object('number',p.number,'group',p.g,'field',p.f,
   'question',jsonb_build_object('id',p.f->>'id'),'group_id',p.g->>'id',
   'response',coalesce(p.raw_response,p.response),'official',p.official,'correct',p.correct,
   'answered',p.answered,'manual',p.manual,'receipt_status',p.receipt_status) order by p.number) from page p),'[]'::jsonb))
$$;
revoke all on function public.admin_learning_past_detail(uuid,integer,integer,text) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.admin_learning_paper_rows(p_user uuid, p_year integer, p_class text)
 RETURNS TABLE(session_id uuid, attempt_id uuid, title text, subject text, unit text, access_mode text, revision integer, created_at timestamp with time zone, started_at timestamp with time zone, last_answer_at timestamp with time zone, answered bigint, correct bigint, total integer, hidden boolean, source_attempt_id text, source_question_id text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 with own as (
  select a.session_id from public.quiz_attempts a where a.user_id=p_user
  union select g.session_id from public.quiz_generated_papers g where g.user_id=p_user
 )
 select s.id,a.id,coalesce(g.display_name,v.document->>'title','未命名試卷'),
  coalesce(v.document->'catalog'->>'subject',''),coalesce(v.document->'catalog'->>'unit',''),
  case when ls.session_id is not null then 'extension' else s.access_mode end,v.revision,s.created_at,a.created_at,x.last_at,x.answered,x.correct,
  case when a.id is not null then jsonb_array_length(a.question_order)
   else (select coalesce(sum(jsonb_array_length(b->'questions')),0)::integer from jsonb_array_elements(v.document->'blocks') b) end,
  g.deleted_at is not null,coalesce(ls.source_attempt::text,g.config->>'attempt_id'),coalesce(ls.question_id,g.config->>'question_id')
 from own o join public.quiz_sessions s on s.id=o.session_id
 left join public.quiz_learning_sessions ls on ls.session_id=s.id and ls.user_id=p_user
 join public.quiz_versions v on v.id=s.version_id
 left join public.quiz_attempts a on a.session_id=s.id and a.user_id=p_user
 left join public.quiz_generated_papers g on g.session_id=s.id and g.user_id=p_user
 cross join lateral (select count(*) as answered,count(*) filter(where z.correct) as correct,max(z.created_at) as last_at
  from public.quiz_answers z where z.attempt_id=a.id) x
 where s.school_year=p_year and s.class_codes ? p_class and s.access_mode in ('classroom','practice','self')
 union all
 select a.id,a.id,v.document->>'title',coalesce(v.document->'catalog'->>'subject',''),v.document->>'title','past_exam',
  (select count(*)::integer from public.quiz_past_versions prior where prior.paper_id=a.paper_id and (prior.created_at,prior.id)<=(v.created_at,v.id)),
  a.created_at,a.created_at,x.last_at,x.answered,x.correct,
  (select count(*)::integer from jsonb_array_elements(v.document->'groups') g cross join lateral jsonb_array_elements(g->'fields') f),
  false,null::text,null::text
 from public.quiz_past_attempts a join public.quiz_past_versions v on v.id=a.version_id and v.paper_id=a.paper_id
 join public.quiz_past_papers p on p.id=a.paper_id
 cross join lateral(select count(*) filter(where r.attempt_id is not null) as answered,count(*) filter(where z.correct) as correct,null::timestamptz as last_at
  from jsonb_array_elements(v.document->'groups') fg cross join lateral jsonb_array_elements(fg->'fields') ff
  left join public.quiz_past_receipts r on r.attempt_id=a.id and r.group_id=fg->>'id'
  left join public.quiz_past_answers z on z.attempt_id=a.id and z.group_id=fg->>'id' and z.question_id=ff->>'id') x
 where a.user_id=p_user and a.school_year=p_year and a.semester=1 and p.grade=left(p_class,1)::integer;
$function$;
CREATE OR REPLACE FUNCTION public.admin_learning_action(p_action text, p_course_id text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 yr integer; grade text; cls text; seat integer; uid uuid; mappings integer; label text;
 lim integer:=20; offst integer:=0; search text; result jsonb; identity jsonb;
 selected_subject text; selected_state text; selected_activity text;
 prog public.typing_foundation_progress%rowtype; sess public.quiz_sessions%rowtype;
 att public.quiz_attempts%rowtype; doc jsonb; version_no integer; paper_count integer;
begin
 if auth.uid() is null or not coalesce(public.is_teacher(),false) then raise exception 'teacher_required';end if;
 -- v1 contract intentionally limited to the two audited course identities.
 if p_course_id is null or p_course_id not in ('grade3-115-1','grade4-115-1','grade6-115-1','grade9-115-1') then raise exception 'invalid_course';end if;
 yr:=115;grade:=substring(p_course_id from 6 for 1);
 if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'invalid_request';end if;
 if exists(select 1 from jsonb_object_keys(p_payload) k where k not in
  ('class_code','seat_no','search','limit','offset','progress_id','session_id','revision','filter','subject','state','activity_type')) then raise exception 'invalid_request';end if;
 if coalesce(p_payload->>'filter','all') not in ('all','wrong') then raise exception 'invalid_request';end if;
 selected_activity:=coalesce(p_payload->>'activity_type','all');
 if selected_activity not in ('all','classroom','practice','self','past_exam','extension') then raise exception 'invalid_request';end if;
 selected_subject:=coalesce(p_payload->>'subject','');selected_state:=coalesce(p_payload->>'state','all');
 if length(selected_subject)>80 or selected_state not in ('all','unstarted','in_progress','completed','hidden') then raise exception 'invalid_request';end if;
 if coalesce(p_payload->>'limit','20') !~ '^[0-9]{1,2}$' or coalesce(p_payload->>'offset','0') !~ '^[0-9]{1,6}$' then raise exception 'invalid_page';end if;
 lim:=(coalesce(p_payload->>'limit','20'))::integer;offst:=(coalesce(p_payload->>'offset','0'))::integer;
 if lim not between 1 and 50 or offst>100000 then raise exception 'invalid_page';end if;
 cls:=nullif(p_payload->>'class_code','');search:=coalesce(p_payload->>'search','');
 if length(search)>80 or (cls is not null and (cls !~ '^[3469][0-9]{2}$' or left(cls,1)<>grade)) then raise exception 'invalid_class';end if;

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
  filtered as (select * from rows r where (selected_subject='' or r.subject=selected_subject) and (selected_activity='all' or r.access_mode=selected_activity)
   and (selected_state='all' or (selected_state='unstarted' and r.attempt_id is null)
    or (selected_state='in_progress' and r.attempt_id is not null and (r.answered<r.total or r.total=0))
    or (selected_state='completed' and r.answered=r.total and r.total>0)
    or (selected_state='hidden' and r.hidden))),
  page as(select * from filtered order by created_at desc,session_id limit lim offset offst)
  select jsonb_build_object('total',(select count(*) from filtered),'all_total',(select count(*) from rows),
   'subjects',(select coalesce(jsonb_agg(subject order by subject),'[]'::jsonb) from (select distinct subject from rows where subject<>'')s),
   'items',coalesce((select jsonb_agg(to_jsonb(p) order by created_at desc,session_id) from page p),'[]'::jsonb)) into result;
 elsif p_action='paper' then
  if exists(select 1 from public.admin_learning_paper_rows(uid,yr,cls) r where r.session_id=(p_payload->>'session_id')::uuid and r.access_mode='past_exam') then
   result:=public.admin_learning_past_detail((p_payload->>'session_id')::uuid,lim,offst,coalesce(p_payload->>'filter','all'));
   return result||jsonb_build_object('identity',identity,'offset',offst,'limit',lim,'as_of',statement_timestamp());
  end if;
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
end $function$;
CREATE OR REPLACE FUNCTION public.admin_learning_media_access(p_course_id text, p_student jsonb, p_session uuid, p_url text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare checked jsonb; doc jsonb; asset public.quiz_media_assets%rowtype;
begin
 if auth.uid() is null or not coalesce(public.is_teacher(),false) then raise exception 'teacher_required';end if;
 checked:=public.admin_learning_action('paper',p_course_id,p_student||jsonb_build_object('session_id',p_session,'limit',1,'offset',0));
 if checked->'identity'->>'mapping' is distinct from 'linked' then raise exception 'paper_unavailable';end if;
 select v.document into doc from public.quiz_sessions s join public.quiz_versions v on v.id=s.version_id where s.id=p_session;
 if checked->>'activity_type'='past_exam' then
  select v.document into doc from public.quiz_past_attempts a join public.quiz_past_versions v on v.id=a.version_id where a.id=p_session;
 end if;
 if not exists(select 1 from (select * from jsonb_path_query(doc,'$.**.url') union select * from jsonb_path_query(doc,'$.**.referenceUrl')) u(value) where u.value#>>'{}'=p_url) then raise exception 'media_unavailable';end if;
 select * into asset from public.quiz_media_assets where url=p_url;
 if not found then raise exception 'media_unavailable';end if;
 return to_jsonb(asset);
end $function$;
CREATE OR REPLACE FUNCTION public.admin_learning_rewards(p_action text, p_course_id text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare cls text;seat integer;result jsonb;
begin
 if auth.uid() is null or not coalesce(public.is_teacher(),false) then raise exception 'teacher_required';end if;
 if p_course_id is null or p_course_id not in ('grade3-115-1','grade4-115-1','grade6-115-1','grade9-115-1') then raise exception 'invalid_course';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('class_code','seat_no')) then raise exception 'invalid_request';end if;
 cls:=p_payload->>'class_code';
 if cls is null or cls !~ '^[3469][0-9]{2}$' or left(cls,1)<>substring(p_course_id from 6 for 1) then raise exception 'invalid_class';end if;
 if p_action='class_rewards' then
  if p_payload ? 'seat_no' then raise exception 'invalid_request';end if;
 else
  if coalesce(p_payload->>'seat_no','') !~ '^[0-9]{1,2}$' then raise exception 'student_required';end if;
  seat:=(p_payload->>'seat_no')::integer;if seat not between 1 and 99 then raise exception 'student_required';end if;
 end if;
 case p_action
 when 'rewards' then execute 'with input as (select $1::text as course,$2::text as class_code,$3::integer as seat_no,$4::jsonb as payload),
      binding as (select e.class_code,e.seat_no,e.display_name,count(u.id)::integer as mappings,min(u.id::text)::uuid as uid
       from public.student_enrollments e left join auth.users u on lower(u.email)=e.email and u.email_confirmed_at is not null
       where e.school_year=115 and e.class_code=$2 and e.seat_no=$3 group by e.class_code,e.seat_no,e.display_name),
      learner as (select uid,jsonb_build_object(''school_year'',115,''class_code'',class_code,''seat_no'',seat_no,''display_name'',display_name,
       ''mapping'',case when mappings=1 then ''linked'' when mappings=0 then ''unlinked'' else ''conflict'' end) as identity from binding),
      paper_rows(session_id,attempt_id,title,subject,unit,access_mode,revision,created_at,started_at,last_answer_at,answered,correct,total,hidden,source_attempt_id,source_question_id) as materialized (with own as (
  select a.session_id from public.quiz_attempts a where a.user_id=(select uid from learner)
  union select g.session_id from public.quiz_generated_papers g where g.user_id=(select uid from learner)
 )
 select s.id,a.id,coalesce(g.display_name,v.document->>''title'',''未命名試卷''),
  coalesce(v.document->''catalog''->>''subject'',''''),coalesce(v.document->''catalog''->>''unit'',''''),
  s.access_mode,v.revision,s.created_at,a.created_at,x.last_at,x.answered,x.correct,
  case when a.id is not null then jsonb_array_length(a.question_order)
   else (select coalesce(sum(jsonb_array_length(b->''questions'')),0)::integer from jsonb_array_elements(v.document->''blocks'') b) end,
  g.deleted_at is not null,g.config->>''attempt_id'',g.config->>''question_id''
 from own o join public.quiz_sessions s on s.id=o.session_id
 join public.quiz_versions v on v.id=s.version_id
 left join public.quiz_attempts a on a.session_id=s.id and a.user_id=(select uid from learner)
 left join public.quiz_generated_papers g on g.session_id=s.id and g.user_id=(select uid from learner)
 cross join lateral (select count(*) as answered,count(*) filter(where z.correct) as correct,max(z.created_at) as last_at
  from public.quiz_answers z where z.attempt_id=a.id) x
 where s.school_year=115 and s.class_codes ? (select class_code from input) and s.access_mode in (''classroom'',''practice'',''self'') and not exists(select 1 from public.quiz_learning_sessions learning_private where learning_private.session_id=s.id)),
      selected_progress as (select p.* from public.typing_foundation_progress p where p.course_id=$1
       and p.learner_key=''google:''||(select uid::text from learner) and p.id=nullif($4::jsonb->>''progress_id'','''')::uuid),
      selected_session as (select s.* from public.quiz_sessions s join paper_rows r on r.session_id=s.id where s.id=nullif($4::jsonb->>''session_id'','''')::uuid),
      selected_attempt as (select a.* from public.quiz_attempts a where a.session_id=(select id from selected_session) and a.user_id=(select uid from learner)),
      selected_version as (select v.document,v.revision from public.quiz_versions v where v.id=(select version_id from selected_session)) select (case
      when not exists(select 1 from learner) then jsonb_build_object(''__error'',''student_unavailable'')
      when (select identity->>''mapping'' from learner)<>''linked'' then jsonb_build_object(''identity'',(select identity from learner),''items'',''[]''::jsonb,''total'',0)
      
      
      else (select result from (select jsonb_build_object(
    ''weekly_rows'',coalesce((select jsonb_agg(to_jsonb(r)) from
      (select s.course_id,s.week_code,s.activity_key,s.current_level,s.completed,s.score,s.updated_at
       from public.student_progress s where s.user_id=(select uid from learner) and s.course_id=(select course from input)) r),''[]''::jsonb),
    ''foundation'',coalesce((select jsonb_agg(to_jsonb(r)) from
      (select p.lesson_key,p.completed,p.checkpoint,p.completed_at,p.updated_at
       from public.typing_foundation_progress p where p.course_id=(select course from input) and p.learner_key=''google:''||(select uid from learner)::text) r),''[]''::jsonb),
    ''awards'',coalesce((select jsonb_agg(to_jsonb(r) order by r.awarded_at,r.id) from
      (select w.id,a.session_id,coalesce(g.display_name,v.document->>''title'') as title,w."grade",w.total,w.correct,
       coalesce((to_jsonb(w)->>''half_units'')::integer,2) as half_units,w.awarded_at
       from public.quiz_leaf_awards w join public.quiz_attempts a on a.id=w.attempt_id
       join public.quiz_sessions s on s.id=a.session_id join public.quiz_versions v on v.id=s.version_id
       left join public.quiz_generated_papers g on g.session_id=s.id
       where w.user_id=(select uid from learner) and w."grade"=substring((select course from input) from 6 for 1)::integer and s.school_year=115) r),''[]''::jsonb),
    ''past_flowers'',coalesce((select jsonb_agg(to_jsonb(r) order by r.awarded_at,r.id) from
      (select ''past:''||l.id::text as id,p.title,l.awarded_at
       from public.quiz_past_leaves l join public.quiz_past_attempts a on a.id=l.attempt_id
       join public.quiz_past_papers p on p.id=l.paper_id
       where l.user_id=(select uid from learner) and l.school_year=115 and l.semester=1
       and p."grade"=substring((select course from input) from 6 for 1)::integer) r),''[]''::jsonb),
    ''assignments'',coalesce((select jsonb_agg(to_jsonb(r)) from
      (select a.id,a.course_id,a.week_code,a.title,
        (select jsonb_build_object(''status'',s.status,''submitted_at'',s.submitted_at,''reviewed_at'',s.reviewed_at)
         from public.homework_submissions s join public.homework_uploads u on u.id=s.upload_id
         where s.assignment_id=a.id and s.user_id=(select uid from learner)) as submission
       from public.homework_assignments a where (select course from input)=''grade6-115-1'' and a.course_id=(select course from input)
       and a.state<>''draft'' and a.class_code in (''*'',(select class_code from input))) r),''[]''::jsonb),
    ''periods'',coalesce((select jsonb_agg(to_jsonb(r)) from
      (select p.id,p.course_id,p.week_code,
        (select jsonb_build_object(''status'',v.status,''submitted_at'',v.submitted_at,''reviewed_at'',v.reviewed_at)
         from public.reading_submissions s join public.reading_versions v on v.id=s.version_id
         where s.period_id=p.id and s.user_id=(select uid from learner)) as submission
       from public.reading_periods p where (select course from input)=''grade6-115-1'' and p.course_id=(select course from input)
       and p.starts_on<=(statement_timestamp() at time zone ''Asia/Taipei'')::date
       and (p.enabled or exists(select 1 from public.reading_submissions s where s.period_id=p.id and s.user_id=(select uid from learner)))) r),''[]''::jsonb),
    ''rehearsal'',coalesce((select jsonb_build_object(''leaves'',t.leaves,''flowers'',t.flowers,''setup_id'',to_jsonb(t)->>''setup_id'')
      from public.garden_test_setup t join auth.users u on u.id=t.user_id
      where t.user_id=(select uid from learner) and t.course_id=(select course from input) and (select course from input)=''grade3-115-1''
      and lower(u.email)=''chianwu@apps.ntpc.edu.tw'' and u.email_confirmed_at is not null),''null''::jsonb))) selected_result(result)) end)||jsonb_build_object(''as_of'',statement_timestamp(),''read_source'',''production-rpc'',''offset'',coalesce(($4::jsonb->>''offset'')::integer,0),''limit'',coalesce(($4::jsonb->>''limit'')::integer,20),''identity'',(select identity from learner)) as result' into result using p_course_id,cls,seat,p_payload;
when 'garden_status' then execute 'with reward_snapshot as (with input as (select $1::text as course,$2::text as class_code,$3::integer as seat_no,$4::jsonb as payload),
      binding as (select e.class_code,e.seat_no,e.display_name,count(u.id)::integer as mappings,min(u.id::text)::uuid as uid
       from public.student_enrollments e left join auth.users u on lower(u.email)=e.email and u.email_confirmed_at is not null
       where e.school_year=115 and e.class_code=$2 and e.seat_no=$3 group by e.class_code,e.seat_no,e.display_name),
      learner as (select uid,jsonb_build_object(''school_year'',115,''class_code'',class_code,''seat_no'',seat_no,''display_name'',display_name,
       ''mapping'',case when mappings=1 then ''linked'' when mappings=0 then ''unlinked'' else ''conflict'' end) as identity from binding),
      paper_rows(session_id,attempt_id,title,subject,unit,access_mode,revision,created_at,started_at,last_answer_at,answered,correct,total,hidden,source_attempt_id,source_question_id) as materialized (with own as (
  select a.session_id from public.quiz_attempts a where a.user_id=(select uid from learner)
  union select g.session_id from public.quiz_generated_papers g where g.user_id=(select uid from learner)
 )
 select s.id,a.id,coalesce(g.display_name,v.document->>''title'',''未命名試卷''),
  coalesce(v.document->''catalog''->>''subject'',''''),coalesce(v.document->''catalog''->>''unit'',''''),
  s.access_mode,v.revision,s.created_at,a.created_at,x.last_at,x.answered,x.correct,
  case when a.id is not null then jsonb_array_length(a.question_order)
   else (select coalesce(sum(jsonb_array_length(b->''questions'')),0)::integer from jsonb_array_elements(v.document->''blocks'') b) end,
  g.deleted_at is not null,g.config->>''attempt_id'',g.config->>''question_id''
 from own o join public.quiz_sessions s on s.id=o.session_id
 join public.quiz_versions v on v.id=s.version_id
 left join public.quiz_attempts a on a.session_id=s.id and a.user_id=(select uid from learner)
 left join public.quiz_generated_papers g on g.session_id=s.id and g.user_id=(select uid from learner)
 cross join lateral (select count(*) as answered,count(*) filter(where z.correct) as correct,max(z.created_at) as last_at
  from public.quiz_answers z where z.attempt_id=a.id) x
 where s.school_year=115 and s.class_codes ? (select class_code from input) and s.access_mode in (''classroom'',''practice'',''self'') and not exists(select 1 from public.quiz_learning_sessions learning_private where learning_private.session_id=s.id)),
      selected_progress as (select p.* from public.typing_foundation_progress p where p.course_id=$1
       and p.learner_key=''google:''||(select uid::text from learner) and p.id=nullif($4::jsonb->>''progress_id'','''')::uuid),
      selected_session as (select s.* from public.quiz_sessions s join paper_rows r on r.session_id=s.id where s.id=nullif($4::jsonb->>''session_id'','''')::uuid),
      selected_attempt as (select a.* from public.quiz_attempts a where a.session_id=(select id from selected_session) and a.user_id=(select uid from learner)),
      selected_version as (select v.document,v.revision from public.quiz_versions v where v.id=(select version_id from selected_session)) select (case
      when not exists(select 1 from learner) then jsonb_build_object(''__error'',''student_unavailable'')
      when (select identity->>''mapping'' from learner)<>''linked'' then jsonb_build_object(''identity'',(select identity from learner),''items'',''[]''::jsonb,''total'',0)
      
      
      else (select result from (select jsonb_build_object(
    ''weekly_rows'',coalesce((select jsonb_agg(to_jsonb(r)) from
      (select s.course_id,s.week_code,s.activity_key,s.current_level,s.completed,s.score,s.updated_at
       from public.student_progress s where s.user_id=(select uid from learner) and s.course_id=(select course from input)) r),''[]''::jsonb),
    ''foundation'',coalesce((select jsonb_agg(to_jsonb(r)) from
      (select p.lesson_key,p.completed,p.checkpoint,p.completed_at,p.updated_at
       from public.typing_foundation_progress p where p.course_id=(select course from input) and p.learner_key=''google:''||(select uid from learner)::text) r),''[]''::jsonb),
    ''awards'',coalesce((select jsonb_agg(to_jsonb(r) order by r.awarded_at,r.id) from
      (select w.id,a.session_id,coalesce(g.display_name,v.document->>''title'') as title,w."grade",w.total,w.correct,
       coalesce((to_jsonb(w)->>''half_units'')::integer,2) as half_units,w.awarded_at
       from public.quiz_leaf_awards w join public.quiz_attempts a on a.id=w.attempt_id
       join public.quiz_sessions s on s.id=a.session_id join public.quiz_versions v on v.id=s.version_id
       left join public.quiz_generated_papers g on g.session_id=s.id
       where w.user_id=(select uid from learner) and w."grade"=substring((select course from input) from 6 for 1)::integer and s.school_year=115) r),''[]''::jsonb),
    ''past_flowers'',coalesce((select jsonb_agg(to_jsonb(r) order by r.awarded_at,r.id) from
      (select ''past:''||l.id::text as id,p.title,l.awarded_at
       from public.quiz_past_leaves l join public.quiz_past_attempts a on a.id=l.attempt_id
       join public.quiz_past_papers p on p.id=l.paper_id
       where l.user_id=(select uid from learner) and l.school_year=115 and l.semester=1
       and p."grade"=substring((select course from input) from 6 for 1)::integer) r),''[]''::jsonb),
    ''assignments'',coalesce((select jsonb_agg(to_jsonb(r)) from
      (select a.id,a.course_id,a.week_code,a.title,
        (select jsonb_build_object(''status'',s.status,''submitted_at'',s.submitted_at,''reviewed_at'',s.reviewed_at)
         from public.homework_submissions s join public.homework_uploads u on u.id=s.upload_id
         where s.assignment_id=a.id and s.user_id=(select uid from learner)) as submission
       from public.homework_assignments a where (select course from input)=''grade6-115-1'' and a.course_id=(select course from input)
       and a.state<>''draft'' and a.class_code in (''*'',(select class_code from input))) r),''[]''::jsonb),
    ''periods'',coalesce((select jsonb_agg(to_jsonb(r)) from
      (select p.id,p.course_id,p.week_code,
        (select jsonb_build_object(''status'',v.status,''submitted_at'',v.submitted_at,''reviewed_at'',v.reviewed_at)
         from public.reading_submissions s join public.reading_versions v on v.id=s.version_id
         where s.period_id=p.id and s.user_id=(select uid from learner)) as submission
       from public.reading_periods p where (select course from input)=''grade6-115-1'' and p.course_id=(select course from input)
       and p.starts_on<=(statement_timestamp() at time zone ''Asia/Taipei'')::date
       and (p.enabled or exists(select 1 from public.reading_submissions s where s.period_id=p.id and s.user_id=(select uid from learner)))) r),''[]''::jsonb),
    ''rehearsal'',coalesce((select jsonb_build_object(''leaves'',t.leaves,''flowers'',t.flowers,''setup_id'',to_jsonb(t)->>''setup_id'')
      from public.garden_test_setup t join auth.users u on u.id=t.user_id
      where t.user_id=(select uid from learner) and t.course_id=(select course from input) and (select course from input)=''grade3-115-1''
      and lower(u.email)=''chianwu@apps.ntpc.edu.tw'' and u.email_confirmed_at is not null),''null''::jsonb))) selected_result(result)) end)||jsonb_build_object(''as_of'',statement_timestamp(),''read_source'',''production-rpc'',''offset'',coalesce(($4::jsonb->>''offset'')::integer,0),''limit'',coalesce(($4::jsonb->>''limit'')::integer,20),''identity'',(select identity from learner)) as result), garden_catalog(item_key,label,pet,home,leaves,flowers,portrait) as (select * from public.garden_item_catalog()), principal as (
        select min(u.id::text)::uuid as uid from public.student_enrollments e join auth.users u
          on lower(u.email)=e.email and u.email_confirmed_at is not null
        where e.school_year=115 and e.class_code=$2 and e.seat_no=$3 having count(*)=1
      ) select result||case when result->''identity''->>''mapping''=''linked'' then jsonb_build_object(''garden'',jsonb_build_object(
        ''growth'',(select jsonb_build_object(''grown_at'',g.grown_at,''seen_at'',g.seen_at,''baseline'',g.baseline,
          ''reward_version'',coalesce((to_jsonb(g)->>''reward_version'')::integer,1),
          ''leaf_floor'',coalesce((to_jsonb(g)->>''leaf_floor'')::integer,44),
          ''flower_floor'',coalesce((to_jsonb(g)->>''flower_floor'')::integer,10))
          from public.garden_growth g where g.user_id=(select uid from principal) and g.course_id=$1),
        ''has_growth'',exists(select 1 from public.garden_growth g where g.user_id=(select uid from principal)),
        ''legacy_pet'',exists(select 1 from public.garden_growth g where g.user_id=(select uid from principal) and g.pet_unlocked_at is not null),
        ''catalog'',coalesce((select jsonb_agg(jsonb_build_object(''key'',c.item_key,''label'',c.label,''pet'',c.pet,''home'',c.home,
          ''leaves'',c.leaves,''flowers'',c.flowers) order by c.leaves,c.item_key) from garden_catalog c),''[]''::jsonb),
        ''unlocks'',coalesce((select jsonb_agg(jsonb_build_object(''key'',u.item_key,''course_id'',u.course_id,''unlocked_at'',u.unlocked_at))
          from public.garden_item_unlocks u where u.user_id=(select uid from principal)),''[]''::jsonb)))
        else ''{}''::jsonb end as result from reward_snapshot' into result using p_course_id,cls,seat,p_payload;
when 'class_rewards' then execute 'with roster_students as (
        select e.class_code,e.seat_no,e.display_name,e.class_code||lpad(e.seat_no::text,2,''0'') as student_code,
          (select count(*) from auth.users u where lower(u.email)=e.email and u.email_confirmed_at is not null) as mappings
        from public.student_enrollments e where e.school_year=115 and e.class_code=$2::text
          and left(e.class_code,1)=substring($1::text from 6 for 1) and $3::integer is null
      ) select jsonb_build_object(''class_code'',$2::text,''total'',count(*),''as_of'',statement_timestamp(),
        ''read_source'',''production-rpc'',''items'',coalesce(jsonb_agg(jsonb_build_object(
          ''class_code'',roster_students.class_code,''seat_no'',roster_students.seat_no,
          ''display_name'',roster_students.display_name,''student_code'',roster_students.student_code,
          ''mappings'',roster_students.mappings,''rewards'',reward_data.result) order by roster_students.seat_no),''[]''::jsonb)) as result
        from roster_students cross join lateral (with reward_snapshot as (with input as (select $1::text as course,$2::text as class_code,roster_students.seat_no::integer as seat_no,$4::jsonb as payload),
      binding as (select e.class_code,e.seat_no,e.display_name,count(u.id)::integer as mappings,min(u.id::text)::uuid as uid
       from public.student_enrollments e left join auth.users u on lower(u.email)=e.email and u.email_confirmed_at is not null
       where e.school_year=115 and e.class_code=$2 and e.seat_no=roster_students.seat_no group by e.class_code,e.seat_no,e.display_name),
      learner as (select uid,jsonb_build_object(''school_year'',115,''class_code'',class_code,''seat_no'',seat_no,''display_name'',display_name,
       ''mapping'',case when mappings=1 then ''linked'' when mappings=0 then ''unlinked'' else ''conflict'' end) as identity from binding),
      paper_rows(session_id,attempt_id,title,subject,unit,access_mode,revision,created_at,started_at,last_answer_at,answered,correct,total,hidden,source_attempt_id,source_question_id) as materialized (with own as (
  select a.session_id from public.quiz_attempts a where a.user_id=(select uid from learner)
  union select g.session_id from public.quiz_generated_papers g where g.user_id=(select uid from learner)
 )
 select s.id,a.id,coalesce(g.display_name,v.document->>''title'',''未命名試卷''),
  coalesce(v.document->''catalog''->>''subject'',''''),coalesce(v.document->''catalog''->>''unit'',''''),
  s.access_mode,v.revision,s.created_at,a.created_at,x.last_at,x.answered,x.correct,
  case when a.id is not null then jsonb_array_length(a.question_order)
   else (select coalesce(sum(jsonb_array_length(b->''questions'')),0)::integer from jsonb_array_elements(v.document->''blocks'') b) end,
  g.deleted_at is not null,g.config->>''attempt_id'',g.config->>''question_id''
 from own o join public.quiz_sessions s on s.id=o.session_id
 join public.quiz_versions v on v.id=s.version_id
 left join public.quiz_attempts a on a.session_id=s.id and a.user_id=(select uid from learner)
 left join public.quiz_generated_papers g on g.session_id=s.id and g.user_id=(select uid from learner)
 cross join lateral (select count(*) as answered,count(*) filter(where z.correct) as correct,max(z.created_at) as last_at
  from public.quiz_answers z where z.attempt_id=a.id) x
 where s.school_year=115 and s.class_codes ? (select class_code from input) and s.access_mode in (''classroom'',''practice'',''self'') and not exists(select 1 from public.quiz_learning_sessions learning_private where learning_private.session_id=s.id)),
      selected_progress as (select p.* from public.typing_foundation_progress p where p.course_id=$1
       and p.learner_key=''google:''||(select uid::text from learner) and p.id=nullif($4::jsonb->>''progress_id'','''')::uuid),
      selected_session as (select s.* from public.quiz_sessions s join paper_rows r on r.session_id=s.id where s.id=nullif($4::jsonb->>''session_id'','''')::uuid),
      selected_attempt as (select a.* from public.quiz_attempts a where a.session_id=(select id from selected_session) and a.user_id=(select uid from learner)),
      selected_version as (select v.document,v.revision from public.quiz_versions v where v.id=(select version_id from selected_session)) select (case
      when not exists(select 1 from learner) then jsonb_build_object(''__error'',''student_unavailable'')
      when (select identity->>''mapping'' from learner)<>''linked'' then jsonb_build_object(''identity'',(select identity from learner),''items'',''[]''::jsonb,''total'',0)
      
      
      else (select result from (select jsonb_build_object(
    ''weekly_rows'',coalesce((select jsonb_agg(to_jsonb(r)) from
      (select s.course_id,s.week_code,s.activity_key,s.current_level,s.completed,s.score,s.updated_at
       from public.student_progress s where s.user_id=(select uid from learner) and s.course_id=(select course from input)) r),''[]''::jsonb),
    ''foundation'',coalesce((select jsonb_agg(to_jsonb(r)) from
      (select p.lesson_key,p.completed,p.checkpoint,p.completed_at,p.updated_at
       from public.typing_foundation_progress p where p.course_id=(select course from input) and p.learner_key=''google:''||(select uid from learner)::text) r),''[]''::jsonb),
    ''awards'',coalesce((select jsonb_agg(to_jsonb(r) order by r.awarded_at,r.id) from
      (select w.id,a.session_id,coalesce(g.display_name,v.document->>''title'') as title,w."grade",w.total,w.correct,
       coalesce((to_jsonb(w)->>''half_units'')::integer,2) as half_units,w.awarded_at
       from public.quiz_leaf_awards w join public.quiz_attempts a on a.id=w.attempt_id
       join public.quiz_sessions s on s.id=a.session_id join public.quiz_versions v on v.id=s.version_id
       left join public.quiz_generated_papers g on g.session_id=s.id
       where w.user_id=(select uid from learner) and w."grade"=substring((select course from input) from 6 for 1)::integer and s.school_year=115) r),''[]''::jsonb),
    ''past_flowers'',coalesce((select jsonb_agg(to_jsonb(r) order by r.awarded_at,r.id) from
      (select ''past:''||l.id::text as id,p.title,l.awarded_at
       from public.quiz_past_leaves l join public.quiz_past_attempts a on a.id=l.attempt_id
       join public.quiz_past_papers p on p.id=l.paper_id
       where l.user_id=(select uid from learner) and l.school_year=115 and l.semester=1
       and p."grade"=substring((select course from input) from 6 for 1)::integer) r),''[]''::jsonb),
    ''assignments'',coalesce((select jsonb_agg(to_jsonb(r)) from
      (select a.id,a.course_id,a.week_code,a.title,
        (select jsonb_build_object(''status'',s.status,''submitted_at'',s.submitted_at,''reviewed_at'',s.reviewed_at)
         from public.homework_submissions s join public.homework_uploads u on u.id=s.upload_id
         where s.assignment_id=a.id and s.user_id=(select uid from learner)) as submission
       from public.homework_assignments a where (select course from input)=''grade6-115-1'' and a.course_id=(select course from input)
       and a.state<>''draft'' and a.class_code in (''*'',(select class_code from input))) r),''[]''::jsonb),
    ''periods'',coalesce((select jsonb_agg(to_jsonb(r)) from
      (select p.id,p.course_id,p.week_code,
        (select jsonb_build_object(''status'',v.status,''submitted_at'',v.submitted_at,''reviewed_at'',v.reviewed_at)
         from public.reading_submissions s join public.reading_versions v on v.id=s.version_id
         where s.period_id=p.id and s.user_id=(select uid from learner)) as submission
       from public.reading_periods p where (select course from input)=''grade6-115-1'' and p.course_id=(select course from input)
       and p.starts_on<=(statement_timestamp() at time zone ''Asia/Taipei'')::date
       and (p.enabled or exists(select 1 from public.reading_submissions s where s.period_id=p.id and s.user_id=(select uid from learner)))) r),''[]''::jsonb),
    ''rehearsal'',coalesce((select jsonb_build_object(''leaves'',t.leaves,''flowers'',t.flowers,''setup_id'',to_jsonb(t)->>''setup_id'')
      from public.garden_test_setup t join auth.users u on u.id=t.user_id
      where t.user_id=(select uid from learner) and t.course_id=(select course from input) and (select course from input)=''grade3-115-1''
      and lower(u.email)=''chianwu@apps.ntpc.edu.tw'' and u.email_confirmed_at is not null),''null''::jsonb))) selected_result(result)) end)||jsonb_build_object(''as_of'',statement_timestamp(),''read_source'',''production-rpc'',''offset'',coalesce(($4::jsonb->>''offset'')::integer,0),''limit'',coalesce(($4::jsonb->>''limit'')::integer,20),''identity'',(select identity from learner)) as result), garden_catalog(item_key,label,pet,home,leaves,flowers,portrait) as (select * from public.garden_item_catalog()), principal as (
        select min(u.id::text)::uuid as uid from public.student_enrollments e join auth.users u
          on lower(u.email)=e.email and u.email_confirmed_at is not null
        where e.school_year=115 and e.class_code=$2 and e.seat_no=roster_students.seat_no having count(*)=1
      ) select result||case when result->''identity''->>''mapping''=''linked'' then jsonb_build_object(''garden'',jsonb_build_object(
        ''growth'',(select jsonb_build_object(''grown_at'',g.grown_at,''seen_at'',g.seen_at,''baseline'',g.baseline,
          ''reward_version'',coalesce((to_jsonb(g)->>''reward_version'')::integer,1),
          ''leaf_floor'',coalesce((to_jsonb(g)->>''leaf_floor'')::integer,44),
          ''flower_floor'',coalesce((to_jsonb(g)->>''flower_floor'')::integer,10))
          from public.garden_growth g where g.user_id=(select uid from principal) and g.course_id=$1),
        ''has_growth'',exists(select 1 from public.garden_growth g where g.user_id=(select uid from principal)),
        ''legacy_pet'',exists(select 1 from public.garden_growth g where g.user_id=(select uid from principal) and g.pet_unlocked_at is not null),
        ''catalog'',coalesce((select jsonb_agg(jsonb_build_object(''key'',c.item_key,''label'',c.label,''pet'',c.pet,''home'',c.home,
          ''leaves'',c.leaves,''flowers'',c.flowers) order by c.leaves,c.item_key) from garden_catalog c),''[]''::jsonb),
        ''unlocks'',coalesce((select jsonb_agg(jsonb_build_object(''key'',u.item_key,''course_id'',u.course_id,''unlocked_at'',u.unlocked_at))
          from public.garden_item_unlocks u where u.user_id=(select uid from principal)),''[]''::jsonb)))
        else ''{}''::jsonb end as result from reward_snapshot) reward_data' into result using p_course_id,cls,seat,p_payload;
 else raise exception 'invalid_action';end case;
 if result ? '__error' then raise exception '%',result->>'__error';end if;
 return result;
end $function$;
commit;
