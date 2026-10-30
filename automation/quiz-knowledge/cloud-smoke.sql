-- Append inside the reviewed rollback migration, before its final result SELECT.
-- All fixture writes are rolled back by the inner exception subtransaction.
create temp table knowledge_smoke_results(result jsonb) on commit drop;
do $smoke$
declare uid uuid; cls text; c record; src public.quiz_question_pool; old_id text; q jsonb; doc jsonb;
 bid uuid; vid uuid; sid uuid; aid uuid; rid uuid; joined jsonb; saved jsonb; detail jsonb; paper jsonb; retry jsonb;
 generated jsonb; is_alias boolean; wrong text; log jsonb:='[]'; g jsonb; source_group text;
begin
 select u.id,e.class_code into uid,cls from auth.users u join public.student_enrollments e on e.email=lower(u.email)
 where e.school_year=115 and e.class_code='603' and u.email_confirmed_at is not null order by e.seat_no limit 1;
 if uid is null then raise exception 'confirmed_grade6_fixture_account_required';end if;
 begin
  perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
  perform set_config('request.jwt.claim.sub',uid::text,true);
  for c in select * from public.quiz_courses where id in ('115-1-kang-g6-ch','115-1-kang-g6-en','115-1-nani-g6-science','115-1-nani-g6-social') order by id loop
   select p.* into src from public.quiz_question_pool p join public.quiz_pool_membership m using(question_id)
   where p.usable and m.course_id=c.id and m.knowledge_reliable and exists(
    select 1 from public.quiz_question_pool x join public.quiz_pool_membership xm using(question_id)
    where x.usable and xm.course_id=c.id and xm.knowledge_reliable and x.publisher_explanation
     and x.knowledge_code=p.knowledge_code and x.group_key<>p.group_key and x.difficulty<=p.difficulty)
   order by jsonb_array_length(coalesce(p.question->'prompt'->'media','[]')),p.question_id limit 1;
   if src.question_id is null then raise exception 'no_extendable_source %',c.id;end if;
   foreach is_alias in array array[false,true] loop
    bid:=gen_random_uuid();vid:=gen_random_uuid();sid:=gen_random_uuid();rid:=gen_random_uuid();q:=src.question;
    if is_alias then q:=jsonb_set(q,'{id}',to_jsonb('fixture_legacy_'||src.source_item_id));end if;
    old_id:=q->>'id';
    doc:=jsonb_build_object('schema',1,'title','分類驗證回復用卷','catalog',c.definition,'blocks',jsonb_build_array(jsonb_build_object('id','fixture_block','material',jsonb_build_object('text','','media','[]'::jsonb),'questions',jsonb_build_array(q))));
    insert into public.quiz_banks(id,owner_id,draft) values(bid,uid,doc);
    insert into public.quiz_versions(id,bank_id,revision,document) values(vid,bid,1,doc);
    if is_alias then insert into public.quiz_pool_aliases values(vid,old_id,src.question_id);end if;
    insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options,access_mode)
     values(sid,uid,vid,115,jsonb_build_array(cls),'immediate',false,false,'practice');
    joined:=public.quiz_action('join',jsonb_build_object('session_id',sid));aid:=(joined->>'attempt_id')::uuid;
    if aid is null then raise exception 'join_failed %',joined;end if;
    insert into public.quiz_question_timing(attempt_id,question_id,first_seen) values(aid,old_id,clock_timestamp()-interval '20 seconds')
     on conflict(attempt_id,question_id) do update set first_seen=excluded.first_seen;
    select o->>'id' into wrong from jsonb_array_elements(q->'options') o where o->>'id'<>q->'answer'->>'option_id' limit 1;
    saved:=public.quiz_action('submit',jsonb_build_object('session_id',sid,'question_id',old_id,'response',wrong,'request_id',gen_random_uuid()));
    if saved ? 'error' then raise exception 'submit_failed %',saved->>'error';end if;
    detail:=public.quiz_wrong_questions(jsonb_build_object('action','detail','attempt_id',aid,'question_id',old_id));
    if detail->'can_extend' is distinct from 'true'::jsonb then raise exception 'detail_not_extendable';end if;
    paper:=public.quiz_compose(jsonb_build_object('kind','extension','count',3,'attempt_id',aid,'question_id',old_id,'request_id',rid));
    retry:=public.quiz_compose(jsonb_build_object('kind','extension','count',3,'attempt_id',aid,'question_id',old_id,'request_id',rid));
    if paper->>'session_id' is null or paper->>'session_id' is distinct from retry->>'session_id' then raise exception 'compose_or_retry_failed';end if;
    select v.document into generated from public.quiz_sessions s join public.quiz_versions v on v.id=s.version_id where s.id=(paper->>'session_id')::uuid;
    for g in select qq from jsonb_array_elements(generated->'blocks') b cross join lateral jsonb_array_elements(b->'questions') qq loop
     if not exists(select 1 from public.quiz_question_pool x join public.quiz_pool_membership xm using(question_id)
      where x.question_id=g->>'id' and xm.course_id=c.id and xm.knowledge_reliable and x.publisher_explanation
       and x.knowledge_code=src.knowledge_code and x.group_key<>src.group_key and x.difficulty<=src.difficulty)
      then raise exception 'extension_crossed_reviewed_boundary';end if;
    end loop;
    log:=log||jsonb_build_array(jsonb_build_object('course_id',c.id,'legacy_alias',is_alias,'can_extend',true,'actual',paper->'distribution'->'actual','retry_same_paper',true));
   end loop;
  end loop;
  raise exception using errcode='ZX001',message='rollback_only_the_smoke_fixtures';
 exception when sqlstate 'ZX001' then null;
 end;
 if jsonb_array_length(log)<>8 then raise exception 'smoke_incomplete';end if;
 if pg_temp.knowledge_guard() is distinct from (select state from knowledge_before) then raise exception 'smoke_did_not_restore_protected_data';end if;
 insert into knowledge_smoke_results values(log);
end $smoke$;
