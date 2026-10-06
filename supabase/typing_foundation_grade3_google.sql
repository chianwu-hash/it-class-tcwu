-- Enable existing Grade 3 foundation through verified Google course bindings.
-- Requires grade3_google_transition.sql and the existing 24-lesson foundation schema.
begin;
do $$begin
 if to_regprocedure('public.grade3_google_ready()') is null then raise exception 'grade3_google_transition.sql required';end if;
 if (select count(*) from public.typing_foundation_lessons)<>24 then raise exception '24 lesson foundation schema required';end if;
end $$;
-- No caller-supplied Google user ID; Grade 3 also requires its trusted course binding.
create or replace function public.typing_foundation_action(p_action text,p_course_id text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare
  learner text; label text; r public.typing_foundation_progress%rowtype;
  stage_no integer; correct_no integer; error_no integer; ms numeric;
  acc numeric; speed numeric; target numeric; passed boolean; interrupted boolean;
  session_id uuid; event_id uuid; fingerprint text; out_rows jsonb;
  lesson text := coalesce(p_payload->>'lesson_key','english-home-row-v1');
  curriculum public.typing_foundation_lessons%rowtype;
begin
  if p_course_id is null or p_course_id not in ('grade3-115-1','grade6-115-1') then raise exception 'invalid_course'; end if;
  if p_action in ('admin_list','admin_reset') then
    if not public.is_teacher() then raise exception 'teacher_required'; end if;
    if p_action='admin_list' then
      select coalesce(jsonb_agg(to_jsonb(x) order by x.learner_key),'[]'::jsonb) into out_rows
      from (select p.*,
        l.rate_unit,
        (select max(coalesce(e.cpm,e.wpm)) from public.typing_foundation_events e where e.progress_id=p.id and e.revision=p.revision and e.stage=6 and e.passed) as best_rate,
        (select max(e.wpm) from public.typing_foundation_events e where e.progress_id=p.id and e.revision=p.revision and e.stage=6 and e.passed) as best_wpm,
        (select max(e.accuracy) from public.typing_foundation_events e where e.progress_id=p.id and e.revision=p.revision and e.stage=6 and e.passed) as best_accuracy
        from public.typing_foundation_progress p join public.typing_foundation_lessons l on l.lesson_key=p.lesson_key
        where p.course_id=p_course_id and (l.track='english' or coalesce((p_payload->>'include_zhuyin')::boolean,false))) x;
      return out_rows;
    end if;
    select * into r from public.typing_foundation_progress p where p.id=(p_payload->>'id')::uuid and p.course_id=p_course_id;
    if not found then raise exception 'progress_not_found'; end if;
    perform pg_advisory_xact_lock(hashtextextended(p_course_id||r.learner_key,0));
    select * into r from public.typing_foundation_progress p where p.id=r.id for update;
    if r.revision is distinct from (p_payload->>'revision')::integer then raise exception 'stale_revision'; end if;
    insert into public.typing_foundation_resets(progress_id,teacher_id,previous_revision,previous_checkpoint,previous_completed)
      values(r.id,auth.uid(),r.revision,r.checkpoint,r.completed);
    update public.typing_foundation_progress set checkpoint=0,completed=false,completed_at=null,starter=false,
      revision=revision+1,pending_count=0,pending_fingerprint=null,practice_session=null,updated_at=now() where id=r.id returning * into r;
    return to_jsonb(r);
  end if;
  if p_action is null or p_action not in ('list','load','start','save') then raise exception 'invalid_action'; end if;
    if auth.uid() is null or public.is_teacher() then raise exception 'student_required'; end if;
    if p_course_id='grade3-115-1' and not public.grade3_google_ready() then raise exception 'course_identity_required'; end if;
    select 'google:'||u.id::text,e.display_name into learner,label from auth.users u
      join public.student_enrollments e on e.email=lower(u.email) and e.school_year=115
        and ((p_course_id='grade3-115-1' and e.class_code in ('301','302','303','304','305','306'))
          or (p_course_id='grade6-115-1' and e.class_code like '6%'))
      where u.id=auth.uid();
    if learner is null then raise exception 'roster_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_course_id||learner,0));
  if p_action='list' then
   select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) into out_rows from public.typing_foundation_progress p where p.course_id=p_course_id and p.learner_key=learner
    and (coalesce((p_payload->>'include_zhuyin')::boolean,false) or (p.lesson_key like 'zhuyin-%')=(lesson like 'zhuyin-%'));
   return out_rows;
  end if;
  select * into curriculum from public.typing_foundation_lessons where lesson_key=lesson;
  if not found then raise exception 'invalid_lesson'; end if;
  if exists(select 1 from public.typing_foundation_lessons l where l.track=curriculum.track and l.ordinal<curriculum.ordinal and not exists(
   select 1 from public.typing_foundation_progress p where p.course_id=p_course_id and p.learner_key=learner and p.lesson_key=l.lesson_key and p.completed)) then raise exception 'lesson_locked'; end if;
  select * into r from public.typing_foundation_progress p where p.course_id=p_course_id and p.learner_key=learner and p.lesson_key=lesson for update;
  if p_action='load' then return case when r.id is null then 'null'::jsonb else to_jsonb(r) end; end if;
  session_id := (p_payload->>'session_id')::uuid;
  if session_id is null then raise exception 'session_required'; end if;
  if p_action='start' then
    insert into public.typing_foundation_progress(course_id,learner_key,display_name,lesson_key,starter,practice_session)
      values(p_course_id,learner,label,lesson,p_course_id='grade6-115-1' and coalesce((p_payload->>'starter')::boolean,false),session_id)
      on conflict(course_id,learner_key,lesson_key) do nothing;
    select * into r from public.typing_foundation_progress p where p.course_id=p_course_id and p.learner_key=learner and p.lesson_key=lesson for update;
    if r.checkpoint=0 and not r.completed then
      update public.typing_foundation_progress set starter=p_course_id='grade6-115-1' and coalesce((p_payload->>'starter')::boolean,false) where id=r.id;
    end if;
    update public.typing_foundation_progress set practice_session=session_id,pending_count=0,pending_fingerprint=null where id=r.id returning * into r;
    return to_jsonb(r);
  end if;
  if r.id is null then raise exception 'start_required'; end if;
  if (p_payload->>'revision')::integer is distinct from r.revision then raise exception 'stale_revision'; end if;
  if session_id is distinct from r.practice_session then raise exception 'session_changed'; end if;
  event_id := (p_payload->>'event_id')::uuid;
  if event_id is null then raise exception 'event_required'; end if;
  if exists(select 1 from public.typing_foundation_events e where e.id=event_id and e.progress_id=r.id and e.revision=r.revision) then return to_jsonb(r); end if;
  stage_no := (p_payload->>'stage')::integer; correct_no := (p_payload->>'correct')::integer;
  error_no := (p_payload->>'errors')::integer; ms := (p_payload->>'elapsed_ms')::numeric;
  interrupted := (p_payload->>'interrupted')::boolean; fingerprint := p_payload->>'fingerprint';
  if stage_no is null or stage_no not between 1 and 6 or stage_no>r.checkpoint+1
    or correct_no is distinct from curriculum.counts[stage_no]
    or error_no is null or error_no not between 0 and 100000 or ms is null or ms::text in ('NaN','Infinity','-Infinity') or ms<=0 or ms>86400000
    or interrupted is null or fingerprint is null or length(fingerprint) not between 16 and 128 then raise exception 'invalid_attempt'; end if;
  acc := correct_no::numeric/(correct_no+error_no)*100;
  speed := correct_no::numeric*12000/ms;
  target := case when p_course_id='grade6-115-1' and not r.starter then curriculum.speed else curriculum.starter_speed end;
  passed := case when stage_no=6 then acc>=95 and (curriculum.track='zhuyin' or (speed>=target and not interrupted)) else acc>=90 end;
  insert into public.typing_foundation_events(id,progress_id,revision,stage,correct,errors,elapsed_ms,interrupted,accuracy,wpm,passed)
    values(event_id,r.id,r.revision,stage_no,correct_no,error_no,ms,interrupted,acc,case when curriculum.track='english' then speed else 0 end,passed);
  if curriculum.track='zhuyin' then update public.typing_foundation_events set cpm=correct_no::numeric*60000/ms,rate_unit=curriculum.rate_unit where id=event_id;end if;
  if stage_no<6 and passed then
    update public.typing_foundation_progress set checkpoint=greatest(checkpoint,stage_no),updated_at=now() where id=r.id;
  elsif stage_no=6 then
    if passed and r.pending_count=1 and r.pending_fingerprint<>fingerprint then
      update public.typing_foundation_progress set completed=true,completed_at=coalesce(completed_at,now()),pending_count=0,pending_fingerprint=null,updated_at=now() where id=r.id;
    else
      update public.typing_foundation_progress set pending_count=case when passed then 1 else 0 end,
        pending_fingerprint=case when passed then fingerprint else null end,updated_at=now() where id=r.id;
    end if;
  end if;
  select * into r from public.typing_foundation_progress p where p.id=r.id;
  return to_jsonb(r);
end; $$;
revoke all on function public.typing_foundation_action(text,text,jsonb) from public;
grant execute on function public.typing_foundation_action(text,text,jsonb) to anon,authenticated;
commit;
