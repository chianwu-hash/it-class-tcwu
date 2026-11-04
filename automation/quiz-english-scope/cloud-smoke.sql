-- Run inside the candidate transaction; roll back every student fixture before returning.
create temp table english_smoke_results(result jsonb) on commit drop;
do $smoke$
declare uid uuid; config jsonb; library jsonb; catalog jsonb; request jsonb; paper jsonb; retry jsonb; doc jsonb;
 units jsonb; mode_value text; amount int; c jsonb; q jsonb; normal int:=0; teacher jsonb; media_count int:=0; m jsonb; asset jsonb; old_attempt uuid; old_resume jsonb;
begin
 select ec.config into config from english_scope_config ec;
 select u.id into uid from auth.users u join public.student_enrollments e on e.email=lower(u.email)
 where e.school_year=115 and e.class_code='603' and u.email_confirmed_at is not null order by e.seat_no limit 1;
 if uid is null then raise exception 'grade6_fixture_account_required';end if;
 begin
  perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);perform set_config('request.jwt.claim.sub',uid::text,true);
  library:=public.quiz_library_sessions('{}');
  if exists(select 1 from jsonb_array_elements(library->'sessions') s where s->>'id'=config->>'old_session') or not exists(select 1 from jsonb_array_elements(library->'sessions') s where s->>'id'=config->>'new_session') then raise exception 'incorrect_teacher_library';end if;
  catalog:=public.quiz_pool_catalog();select x into c from jsonb_array_elements(catalog->'courses') x where x->>'id'=config->>'course_id';
  if (select jsonb_agg(x->'id' order by (x->>'id')::int) from jsonb_array_elements(c->'units') x)<>'[1,3]'::jsonb then raise exception 'incorrect_composer_catalog';end if;
  begin
   perform public.quiz_compose(jsonb_build_object('kind','self','course_id',config->>'course_id','units','[2]'::jsonb,'count',10,'difficulty','medium','request_id',gen_random_uuid()));
   raise exception 'unit2_not_rejected';
  exception when raise_exception then if sqlerrm<>'invalid_request' then raise;end if;end;
  for units in select value from jsonb_array_elements('[[1],[3],[1,3]]') loop
   foreach mode_value in array array['easy','medium','hard'] loop
    foreach amount in array array[5,10,15,20] loop
     request:=jsonb_build_object('kind','self','course_id',config->>'course_id','units',units,'count',amount,'difficulty',mode_value,'request_id',gen_random_uuid());
     paper:=public.quiz_compose(request);retry:=public.quiz_compose(request);
     if paper->>'session_id' is null or paper->>'session_id' is distinct from retry->>'session_id' then raise exception 'compose_or_retry_failed';end if;
     select v.document into doc from public.quiz_sessions s join public.quiz_versions v on v.id=s.version_id where s.id=(paper->>'session_id')::uuid;
     for q in select qq from jsonb_array_elements(doc->'blocks') b cross join lateral jsonb_array_elements(b->'questions') qq loop
      if not exists(select 1 from public.quiz_question_pool p join public.quiz_pool_membership pm using(question_id)
       where p.question_id=q->>'id' and pm.course_id=config->>'course_id' and p.usable and not(p.unit_ids @> '[2]'::jsonb)
        and exists(select 1 from jsonb_array_elements(units) u where p.unit_ids @> jsonb_build_array(u))
        and not(mode_value='easy' and p.difficulty=3) and not(mode_value='hard' and p.difficulty=-3)) then raise exception 'outside_requested_scope';end if;
     end loop;
     normal:=normal+1;
    end loop;
   end loop;
  end loop;
  teacher:=public.quiz_action('join',jsonb_build_object('session_id',config->>'new_session'));
  if jsonb_array_length(teacher->'document'->'questions')<>10 then raise exception 'teacher_paper_invalid';end if;
  for q in select value from jsonb_array_elements(teacher->'document'->'questions') loop
   for m in select mm from jsonb_array_elements(coalesce(q->'prompt'->'media','[]')) mm union all
    select mm from jsonb_array_elements(q->'options') o cross join lateral jsonb_array_elements(coalesce(o->'content'->'media','[]')) mm loop
    asset:=public.quiz_media_access(m->>'url',(teacher->>'attempt_id')::uuid);if asset->>'mime' is null then raise exception 'media_not_authorized';end if;media_count:=media_count+1;
   end loop;
  end loop;
  -- Old direct links keep working; select an existing eligible attempt without creating one.
  select a.id,a.user_id into old_attempt,uid from public.quiz_attempts a join auth.users u on u.id=a.user_id
   join public.student_enrollments e on e.email=lower(u.email) join public.quiz_sessions s on s.id=a.session_id
   where a.session_id=(config->>'old_session')::uuid and e.school_year=s.school_year and s.class_codes ? e.class_code limit 1;
  if old_attempt is not null then
   perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);perform set_config('request.jwt.claim.sub',uid::text,true);
   old_resume:=public.quiz_action('resume',jsonb_build_object('session_id',config->>'old_session'));
   if old_resume->>'attempt_id' is distinct from old_attempt::text or old_resume ? 'error' then raise exception 'old_attempt_resume_failed';end if;
  end if;
  raise exception using errcode='ZX003',message='rollback_student_fixtures';
 exception when sqlstate 'ZX003' then null;
 end;
 if normal<>36 or pg_temp.english_guard() is distinct from (select state from english_before) then raise exception 'student_fixture_or_protected_data_changed';end if;
 insert into english_smoke_results values(jsonb_build_object('passed',true,'self_compose_scenarios',normal,'composer_units','[1,3]'::jsonb,'unit2_rejected',true,'teacher_questions',10,'teacher_media_authorizations',media_count,'old_attempt_resumed',old_attempt is not null,'existing_records_preserved',true));
end $smoke$;
