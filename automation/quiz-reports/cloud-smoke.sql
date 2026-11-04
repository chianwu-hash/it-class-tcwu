create temp table report_smoke_result(result jsonb) on commit drop;
do $smoke$
declare uid uuid;teacher uuid;att public.quiz_attempts;qid text;packet jsonb;r jsonb;retry jsonb;detail jsonb;m jsonb;asset jsonb;past public.quiz_past_attempts;pastq text;pid text;started jsonb;tested_past boolean:=false;tested_media boolean:=false;
begin
 select id into uid from auth.users where lower(email)='chianwu@apps.ntpc.edu.tw' and email_confirmed_at is not null;
 select id into teacher from auth.users where lower(email)='chianwu@gmail.com' and email_confirmed_at is not null;
 if uid is null or teacher is null then raise exception 'smoke_accounts_missing';end if;
 begin
  perform set_config('request.jwt.claim.sub',uid::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated','email','chianwu@apps.ntpc.edu.tw')::text,true);
  select a.* into att from public.quiz_attempts a join public.quiz_sessions s on s.id=a.session_id where a.user_id=uid and s.class_codes ? (public.quiz_student_identity()->>'class_code') order by a.created_at desc limit 1;
  if att.id is null then raise exception 'smoke_attempt_required';end if;qid:=att.question_order->>0;
  packet:=jsonb_build_object('action','submit','source','quiz','attempt_id',att.id,'question_id',qid,'request_id',gen_random_uuid(),'category','question','description','合成驗證：本交易稍後完整回滾，不是學生回報');
  r:=public.quiz_question_report(packet);retry:=public.quiz_question_report(packet);
  if r->>'id' is distinct from retry->>'id' or retry->>'reused'<>'true' or r ? 'snapshot' then raise exception 'retry_or_projection_failed';end if;
  begin perform public.quiz_question_report(jsonb_build_object('action','list'));raise exception 'student_read_allowed';exception when raise_exception then if sqlerrm<>'teacher_required' then raise;end if;end;
  perform set_config('request.jwt.claim.sub',teacher::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',teacher,'role','authenticated','email','chianwu@gmail.com')::text,true);
  detail:=public.quiz_question_report(jsonb_build_object('action','detail','id',r->>'id'));
  if detail->'identity'->>'class_code'<>'609' or detail->'snapshot'->'question'->>'id' is distinct from qid then raise exception 'identity_or_snapshot_failed';end if;
  detail:=public.quiz_question_report(jsonb_build_object('action','update','id',r->>'id','updated_at',detail->>'updated_at','status','processing','note','合成處理備註'));
  if detail->>'status'<>'processing' then raise exception 'teacher_update_failed';end if;
  for m in select value from jsonb_path_query(detail->'snapshot','$.**.url') value loop
   if exists(select 1 from public.quiz_media_assets where url=m#>>'{}') then asset:=public.quiz_media_access(m#>>'{}',(r->>'id')::uuid);tested_media:=true;exit;end if;
  end loop;
  perform set_config('request.jwt.claim.sub',uid::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated','email','chianwu@apps.ntpc.edu.tw')::text,true);
  select a.* into past from public.quiz_past_attempts a join public.quiz_past_papers p on p.id=a.paper_id where a.user_id=uid and p.grade=6 order by a.created_at desc limit 1;
  if past.id is null then
   select p.id into pid from public.quiz_past_papers p join public.quiz_past_versions v on v.id=p.active_version where p.grade=6 and p.enabled order by jsonb_path_exists(v.document,'$.**.url') desc,p.id limit 1;
   if pid is null then raise exception 'past_fixture_required';end if;
   started:=public.quiz_past_action('start',jsonb_build_object('paper_id',pid,'request_id',gen_random_uuid()));
   select * into past from public.quiz_past_attempts where id=(started->>'attemptId')::uuid;
  end if;
  if past.id is not null then
   select g->>'id' into pastq from public.quiz_past_versions v,lateral jsonb_array_elements(v.document->'groups') g where v.id=past.version_id order by jsonb_path_exists(g,'$.**.url') desc,g->>'id' limit 1;
   r:=public.quiz_question_report(packet||jsonb_build_object('source','past','attempt_id',past.id,'question_id',pastq,'request_id',gen_random_uuid()));
   perform set_config('request.jwt.claim.sub',teacher::text,true);
   perform set_config('request.jwt.claims',jsonb_build_object('sub',teacher,'role','authenticated','email','chianwu@gmail.com')::text,true);
   detail:=public.quiz_question_report(jsonb_build_object('action','detail','id',r->>'id'));
   if detail->'snapshot'->'group'->>'id' is distinct from pastq then raise exception 'past_snapshot_failed';end if;tested_past:=true;
   for m in select value from jsonb_path_query(detail->'snapshot','$.**.url') value loop
    if exists(select 1 from public.quiz_media_assets where url=m#>>'{}') then asset:=public.quiz_media_access(m#>>'{}',(r->>'id')::uuid);tested_media:=true;exit;end if;
   end loop;
  end if;
  if not tested_past then raise exception 'past_not_tested';end if;
  raise exception 'report_smoke_rollback';
 exception when raise_exception then if sqlerrm<>'report_smoke_rollback' then raise;end if;end;
 insert into report_smoke_result values(jsonb_build_object('passed',true,'studentSubmitAndRetry',true,'studentCannotRead',true,'teacherReadAndUpdate',true,'actualIdentity609',true,'pastExam',tested_past,'media',tested_media,'testRowsRolledBack',true));
end$smoke$;
