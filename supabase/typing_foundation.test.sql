-- Synthetic fixtures only; all fixture/progress/events/reset writes are rolled back.
begin;
insert into public.class_card_students(course_id,class_code,seat_no,display_name,birthday_code)
values('grade3-115-1','999',99,'Synthetic Foundation Test','0000');
insert into auth.users(id,email) values('cbb41c53-97a1-483c-897b-8337a0e10227','foundation-synthetic-20261001@example.invalid');
insert into public.student_enrollments(school_year,email,class_code,seat_no,display_name)
values(115,'foundation-synthetic-20261001@example.invalid','699',99,'Synthetic Foundation Test');
do $$ begin
 if has_table_privilege('anon','public.typing_foundation_progress','SELECT') or has_table_privilege('authenticated','public.typing_foundation_events','INSERT') then raise exception 'direct_table_access';end if;
end $$;
set local role anon;
do $$
declare p jsonb; r jsonb; s integer; course text := 'grade6-115-1'; starter_mode boolean; revision_no integer; id_value text;
begin
 for starter_mode in select unnest(array[false,true]) loop
  perform set_config('request.jwt.claims',case when course='grade6-115-1' then '{"sub":"cbb41c53-97a1-483c-897b-8337a0e10227","email":"foundation-synthetic-20261001@example.invalid","role":"authenticated"}' else '{}' end,true);
  p:=jsonb_build_object('starter',starter_mode,'session_id','382bd0b8-7d0c-47e7-b51a-a50fe5cac33d');
  if not starter_mode and public.typing_foundation_action('load',course,p)<>'null'::jsonb then raise exception 'fixture_collision';end if;
  r:=public.typing_foundation_action('start',course,p);id_value:=r->>'id';revision_no:=(r->>'revision')::integer;
  p:=p||jsonb_build_object('revision',revision_no,'stage',2,'correct',67,'errors',0,'elapsed_ms',60000,'interrupted',false,'fingerprint',repeat('a',64),'event_id',gen_random_uuid());
  begin perform public.typing_foundation_action('save',course,p);raise exception 'skip_was_allowed'; exception when others then if sqlerrm<>'invalid_attempt' then raise;end if;end;
  for s in 1..5 loop
   p:=p||jsonb_build_object('stage',s,'event_id',gen_random_uuid());
   r:=public.typing_foundation_action('save',course,p);
   if (r->>'checkpoint')::integer<>s or (r->>'completed')::boolean then raise exception 'checkpoint_failure';end if;
  end loop;
  p:=p||jsonb_build_object('stage',6,'correct',117,'elapsed_ms',175500,'event_id',gen_random_uuid());
  r:=public.typing_foundation_action('save',course,p);
  if (r->>'pending_count')::integer<>(case when starter_mode then 1 else 0 end) then raise exception 'grade_speed_boundary_failure';end if;
  p:=p||jsonb_build_object('errors',7,'elapsed_ms',1000,'event_id',gen_random_uuid());r:=public.typing_foundation_action('save',course,p);
  if (r->>'pending_count')::integer<>0 then raise exception 'accuracy_boundary_failure';end if;
  -- First final pass; identical request is idempotent and cannot earn a second pass.
  p:=p||jsonb_build_object('stage',6,'correct',117,'errors',0,'elapsed_ms',117000,'event_id',gen_random_uuid());
  r:=public.typing_foundation_action('save',course,p);r:=public.typing_foundation_action('save',course,p);
  if (r->>'pending_count')::integer<>1 or (r->>'completed')::boolean then raise exception 'idempotence_failure';end if;
  p:=p||jsonb_build_object('event_id',gen_random_uuid());r:=public.typing_foundation_action('save',course,p);
  if (r->>'completed')::boolean then raise exception 'same_exercise_completed';end if;
  -- Pause invalidates this confirmation and resets streak.
  p:=p||jsonb_build_object('interrupted',true,'event_id',gen_random_uuid());
  r:=public.typing_foundation_action('save',course,p);
  if (r->>'pending_count')::integer<>0 then raise exception 'pause_failure';end if;
  -- New browser session cannot carry the previous session confirmation.
  p:=p||jsonb_build_object('interrupted',false,'event_id',gen_random_uuid());r:=public.typing_foundation_action('save',course,p);
  p:=p||jsonb_build_object('session_id','2674260e-80a8-45b3-aa36-b32cddfd31f2');r:=public.typing_foundation_action('start',course,p);
  if (r->>'pending_count')::integer<>0 or (r->>'checkpoint')::integer<>5 then raise exception 'resume_failure';end if;
  -- Two different valid final exercises earn exactly one completion.
  p:=p||jsonb_build_object('event_id',gen_random_uuid());r:=public.typing_foundation_action('save',course,p);
  p:=p||jsonb_build_object('fingerprint',repeat('b',64),'event_id',gen_random_uuid());r:=public.typing_foundation_action('save',course,p);
  if not (r->>'completed')::boolean or r->>'completed_at' is null then raise exception 'completion_failure';end if;
  -- A student cannot reset any progress, including their own.
  begin perform public.typing_foundation_action('admin_reset',course,jsonb_build_object('id',id_value,'revision',revision_no));raise exception 'student_reset_allowed';
   exception when others then if sqlerrm<>'teacher_required' then raise;end if;end;
  perform set_config('request.jwt.claims','{"sub":"cbb41c53-97a1-483c-897b-8337a0e10227","email":"chianwu@gmail.com","role":"authenticated"}',true);
  r:=public.typing_foundation_action('admin_reset',course,jsonb_build_object('id',id_value,'revision',revision_no));
  if (r->>'checkpoint')::integer<>0 or (r->>'completed')::boolean or (r->>'revision')::integer<>revision_no+1 then raise exception 'reset_failure';end if;
  perform set_config('request.jwt.claims',case when course='grade6-115-1' then '{"sub":"cbb41c53-97a1-483c-897b-8337a0e10227","email":"foundation-synthetic-20261001@example.invalid","role":"authenticated"}' else '{}' end,true);
  begin perform public.typing_foundation_action('save',course,p);raise exception 'stale_save_allowed';exception when others then if sqlerrm<>'stale_revision' then raise;end if;end;
 end loop;
 -- Even valid classroom credentials cannot open the reserved Grade 3 course.
 for course in select unnest(array['load','start','save']) loop
 begin perform public.typing_foundation_action(course,'grade3-115-1','{"class_code":"999","seat_no":99,"birthday_code":"0000"}');raise exception 'reserved_course_allowed';exception when others then if sqlerrm<>'course_not_open' then raise;end if;end;
 end loop;
end $$;
-- All twelve lessons: server-enforced unlocks and exact per-stage counts.
do $$
declare keys text[]:=array['english-home-row-v1','english-top-row-v1','english-bottom-row-v1','english-alphabet-v1','english-shift-v1','english-punctuation-v1','english-numbers-v1','english-number-symbols-v1','english-symbols-v1','english-words-v1','english-sentences-v1','english-finale-v1'];
 i integer;s integer;n integer;p jsonb;r jsonb;first_record jsonb;
begin
 perform set_config('request.jwt.claims','{"sub":"cbb41c53-97a1-483c-897b-8337a0e10227","email":"foundation-synthetic-20261001@example.invalid","role":"authenticated"}',true);
 begin perform public.typing_foundation_action('start','grade6-115-1',jsonb_build_object('lesson_key',keys[2],'session_id',gen_random_uuid()));raise exception 'locked_lesson_allowed';exception when others then if sqlerrm<>'lesson_locked' then raise;end if;end;
 for i in 1..12 loop
  p:=jsonb_build_object('lesson_key',keys[i],'session_id',gen_random_uuid());
  r:=public.typing_foundation_action('start','grade6-115-1',p);
  p:=p||jsonb_build_object('revision',r->'revision','errors',0,'elapsed_ms',1000,'interrupted',false);
  for s in 1..7 loop
   n:=case when i=11 or (i=12 and s=3) then 83 when i=12 and s>=6 then 86 when s>=6 then 117 else 67 end;
   p:=p||jsonb_build_object('stage',least(s,6),'correct',n,'event_id',gen_random_uuid(),'fingerprint',repeat(s::text,64));
   r:=public.typing_foundation_action('save','grade6-115-1',p);
  end loop;
  if not (r->>'completed')::boolean then raise exception 'lesson_completion_failed: %',i;end if;
  if i=1 then first_record:=r;end if;
 end loop;
 if jsonb_array_length(public.typing_foundation_action('list','grade6-115-1'))<>12 then raise exception 'list_count_failed';end if;
 -- Reset only the first record; preserve later results but revoke access until repaired.
 perform set_config('request.jwt.claims','{"sub":"cbb41c53-97a1-483c-897b-8337a0e10227","email":"chianwu@gmail.com","role":"authenticated"}',true);
 perform public.typing_foundation_action('admin_reset','grade6-115-1',first_record);
 perform set_config('request.jwt.claims','{"sub":"cbb41c53-97a1-483c-897b-8337a0e10227","email":"foundation-synthetic-20261001@example.invalid","role":"authenticated"}',true);
 begin perform public.typing_foundation_action('save','grade6-115-1',p);raise exception 'reset_unlock_failed';exception when others then if sqlerrm<>'lesson_locked' then raise;end if;end;
end $$;
rollback;
