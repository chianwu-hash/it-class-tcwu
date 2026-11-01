-- Teacher-only SELECT projections. No learner, reward, or unlock writes.
create or replace function public.admin_learning_rewards(p_action text,p_course_id text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $learning$
declare cls text;seat integer;result jsonb;
begin
 if auth.uid() is null or not coalesce(public.is_teacher(),false) then raise exception 'teacher_required';end if;
 if p_course_id is null or p_course_id not in ('grade3-115-1','grade6-115-1') then raise exception 'invalid_course';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('class_code','seat_no')) then raise exception 'invalid_request';end if;
 cls:=p_payload->>'class_code';
 if cls is null or cls !~ '^[36][0-9]{2}$' or left(cls,1)<>substring(p_course_id from 6 for 1) then raise exception 'invalid_class';end if;
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
 where s.school_year=115 and s.class_codes ? (select class_code from input) and s.access_mode in (''classroom'',''practice'',''self'')),
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
 where s.school_year=115 and s.class_codes ? (select class_code from input) and s.access_mode in (''classroom'',''practice'',''self'')),
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
 where s.school_year=115 and s.class_codes ? (select class_code from input) and s.access_mode in (''classroom'',''practice'',''self'')),
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
end $learning$;
revoke all on function public.admin_learning_rewards(text,text,jsonb) from public,anon;
grant execute on function public.admin_learning_rewards(text,text,jsonb) to authenticated;
