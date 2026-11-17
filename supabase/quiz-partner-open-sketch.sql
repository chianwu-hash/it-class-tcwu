-- Candidate only. Apply after approved quiz-open-sketch.sql; requires separate explicit approval.
begin;
set local lock_timeout='3s';
do $guard$ begin
 if md5(pg_get_functiondef('partner_pilot.action_core(jsonb)'::regprocedure))<>'1eb8fb0c9925d775b631c050428665b4' or to_regprocedure('public.quiz_open_response(jsonb,text)') is null then raise exception 'partner_sketch_baseline_changed';end if;
end $guard$;
CREATE OR REPLACE FUNCTION partner_pilot.action_core(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'partner_pilot'
AS $function$
declare uid uuid:=auth.uid(); act text:=p->>'action'; rid uuid; r partner_pilot.rooms; req text:=p->>'requestId'; prior partner_pilot.requests; result jsonb; total int; qid int; choice int; count_attempt int; correct_choice int; option_count int; k text; body text; parent partner_pilot.notes; roster uuid[]; memberkey text; snap jsonb; qb partner_pilot.question_bank; response_value jsonb; is_correct boolean;
begin
 perform partner_pilot.register_self();
 if act='catalog' then return jsonb_build_object('papers',(select jsonb_agg(jsonb_build_object('id',id,'title',title,'grade',grade,'subject',subject,'kind',kind,'total',pp.total,'real',is_real,'past',past_meta is not null,'sourceSession',source_session,'sourceSessions',(select coalesce(jsonb_agg(s.id order by s.id),'[]') from public.quiz_sessions s where s.version_id=pp.source_version and (s.id=pp.source_session or s.access_mode='practice') and s.status='open' and s.library_visible and not exists(select 1 from public.quiz_generated_papers g where g.session_id=s.id)),'sourcePaper',past_meta->>'sourcePaper') order by is_real desc,grade,subject,title) from partner_pilot.papers pp where enabled and partner_pilot.source_allowed(pp.id,false))); end if;
 if act='snapshot' then return partner_pilot.learning_snapshot((p->>'roomId')::uuid); end if;
 if act not in ('answer','chat','ask','reply','mark','discuss','review','finish','settle','save_draft') then
  result:=partner_pilot.lobby_action(p);
  if result ? 'members' then return partner_pilot.learning_snapshot((result->>'id')::uuid); end if;
  return result;
 end if;
 if req is null or length(req) not between 8 and 100 then raise exception 'REQUEST_ID_REQUIRED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text||req,0));
 select * into prior from partner_pilot.requests where user_id=uid and request_id=req;
 if found then if prior.body<>p then raise exception 'REQUEST_REUSED'; end if; return partner_pilot.learning_snapshot((p->>'roomId')::uuid); end if;
 rid:=(p->>'roomId')::uuid;
 select * into r from partner_pilot.rooms where id=rid for update;
 if not found or not exists(select 1 from partner_pilot.members where room_id=rid and user_id=uid) then raise exception 'NOT_MEMBER'; end if;
 if not r.started then raise exception 'NOT_STARTED'; end if;
 total:=partner_pilot.paper_total(r.paper);
 if act in ('answer','ask','mark','discuss') then
  qid:=(p->>'qid')::int;
  if qid is null or not exists(select 1 from partner_pilot.paper_items i where i.paper_id=r.paper and i.qid=(p->>'qid')::int) then raise exception 'INVALID_QUESTION'; end if;
 end if;
 if act='save_draft' then
  if jsonb_typeof(p->'state') is distinct from 'object' or octet_length((p->'state')::text)>1500000 or jsonb_typeof(p#>'{state,drafts}') is distinct from 'object' or jsonb_typeof(p#>'{state,attempts}') is distinct from 'object' or jsonb_typeof(p#>'{state,editing}') is distinct from 'array' or jsonb_typeof(p#>'{state,open}') is distinct from 'array' or coalesce(p#>>'{state,view}','') not in ('practice','review','book') then raise exception 'INVALID_DRAFT'; end if;
  if coalesce((select d.revision from partner_pilot.drafts d where d.room_id=rid and d.user_id=uid),0) is distinct from (p->>'draftRevision')::int then raise exception 'DRAFT_CHANGED'; end if;
  insert into partner_pilot.drafts(room_id,user_id,state) values(rid,uid,p->'state') on conflict(room_id,user_id) do update set state=excluded.state,revision=partner_pilot.drafts.revision+1,saved_at=clock_timestamp();
 elsif act='answer' then
  if partner_pilot.owner_of(rid,qid) is distinct from uid then raise exception 'OWN_QUESTION_ONLY'; end if;
  select count(*) into count_attempt from partner_pilot.answers a where a.room_id=rid and a.qid=(p->>'qid')::int;
  if count_attempt is distinct from (p->>'expectedAttempt')::int then raise exception 'ANSWER_CHANGED'; end if;
  select * into strict qb from partner_pilot.question_bank where id=qid;
  if qb.normal_question is not null then
   if jsonb_typeof(p->'response') is distinct from 'string' or (case when qb.normal_question->>'type'='open' and exists(select 1 from jsonb_array_elements(qb.normal_question->'fields') fs where fs->>'input'='sketch') then octet_length(p->>'response') not between 1 and 300000 else length(p->>'response') not between 1 and 2000 end) then raise exception 'invalid_response';end if;
   response_value:=p->'response';
   if qb.normal_question->>'type' in ('fields','open') then
    perform case when qb.normal_question->>'type'='open' then public.quiz_open_response(qb.normal_question,p->>'response') else public.quiz_fields_response(qb.normal_question,p->>'response') end;
    is_correct:=case when qb.normal_question->>'type'='open' then null else public.quiz_fields_grade(qb.normal_question,p->>'response') end;
   elsif qb.normal_question->>'type'='short' then
    if qb.normal_question#>>'{answer,normalizer}'='math-v1' and (p->>'response')~'[0-9０-９][[:space:]　]+[0-9０-９]' then raise exception 'invalid_response';end if;
    is_correct:=case when qb.normal_question#>>'{answer,normalizer}'='math-v1' then exists(select 1 from jsonb_array_elements_text(qb.normal_question#>'{answer,accepted}') a where public.quiz_math_answer_normalize(a)=public.quiz_math_answer_normalize(p->>'response')) else exists(select 1 from jsonb_array_elements_text(qb.normal_question#>'{answer,accepted}') a where trim(a)=trim(p->>'response')) end;
   else raise exception 'invalid_question_type';end if;
   insert into partner_pilot.answers(room_id,user_id,qid,attempt,choice,correct,created_at,response) values(rid,uid,qid,count_attempt+1,-1,is_correct,clock_timestamp(),response_value);
  elsif qb.past_meta is not null then
   response_value:=partner_pilot.quiz_past_canonical(qb.past_config,p->'value');
   is_correct:=case when qb.past_meta->>'selfCheck'='true' then null when qb.past_meta->>'kind'='short' then exists(select 1 from jsonb_array_elements_text(qb.past_answer) a where case when qb.past_meta->>'answerFormat'='math-v1' then partner_pilot.quiz_math_answer_normalize(a)=response_value->>'answer' else trim(a)=trim(response_value#>>'{}') end) else response_value=qb.past_answer end;
   insert into partner_pilot.answers(room_id,user_id,qid,attempt,choice,correct,created_at,response) values(rid,uid,qid,count_attempt+1,-1,is_correct,clock_timestamp(),response_value);
  else
   choice:=(p->>'choice')::int;correct_choice:=qb.correct;option_count:=jsonb_array_length(qb.options);
   if choice is null or choice<0 or choice>=option_count then raise exception 'INVALID_CHOICE'; end if;
   insert into partner_pilot.answers(room_id,user_id,qid,attempt,choice,correct,created_at) values(rid,uid,qid,count_attempt+1,choice,choice=correct_choice,clock_timestamp());
  end if;
 elsif act in ('chat','ask','reply','mark','discuss') then
  body:=trim(coalesce(p->>'text',''));
  if length(body)>600 or (length(body)=0 and act<>'mark') then raise exception 'INVALID_TEXT'; end if;
  if act in ('ask','mark') and partner_pilot.owner_of(rid,qid) is distinct from uid then raise exception 'OWN_QUESTION_ONLY'; end if;
  if act='mark' and coalesce(p->>'tag','') not in ('hard','interesting','careful','method') then raise exception 'INVALID_TAG'; end if;
  if act='reply' then
   select * into parent from partner_pilot.notes where id=(p->>'thread')::bigint and room_id=rid and kind='ask';
   if not found then raise exception 'THREAD_NOT_FOUND'; end if;
   qid:=parent.qid;
  end if;
  if act='discuss' and (select count(distinct a.qid) from partner_pilot.answers a where a.room_id=rid)<>total then raise exception 'REVIEW_NOT_READY'; end if;
  insert into partner_pilot.notes(room_id,user_id,kind,qid,thread_id,tag,text) values(rid,uid,act,qid,case when act='reply' then parent.id else null end,case when act='mark' then p->>'tag' else null end,body);
 elsif act='review' then
  if (select count(distinct a.qid) from partner_pilot.answers a where a.room_id=rid)<>total then raise exception 'REVIEW_NOT_READY'; end if;
  body:=trim(coalesce(p->>'text',''));if length(body)>240 then raise exception 'INVALID_TEXT'; end if;
  insert into partner_pilot.review_seen values(rid,uid,body,clock_timestamp()) on conflict(room_id,user_id) do update set reflection=excluded.reflection;
  -- The room row is already locked: the last explicit review completes atomically.
  if (select count(*) from partner_pilot.review_seen where room_id=rid)=r.capacity then update partner_pilot.rooms set finished=true where id=rid;end if;
 elsif act='finish' then
  if (select count(distinct a.qid) from partner_pilot.answers a where a.room_id=rid)<>total or (select count(*) from partner_pilot.review_seen where room_id=rid)<>r.capacity then raise exception 'WAIT_FOR_REVIEW'; end if;
  update partner_pilot.rooms set finished=true where id=rid;
 elsif act='settle' then
  perform partner_pilot.claim_award(rid);
 end if;
 if act in ('answer','chat','ask','reply','mark','discuss','review') then
  k:=(case act when 'review' then 'reflection' else act end)||'-'||case when act='reply' then p->>'thread' when act in ('answer','ask','mark','discuss') then p->>'qid' else '' end;
  update partner_pilot.drafts d set state=d.state#-array['drafts',k],revision=d.revision+1,saved_at=clock_timestamp() where d.room_id=rid and d.user_id=uid and d.state#>>array['drafts',k]=case when act='answer' then coalesce(p->>'response',p->>'choice') else coalesce(p->>'text','') end;
 end if;
 update partner_pilot.rooms set revision=revision+1 where id=rid returning * into r;
 result:=partner_pilot.learning_snapshot(rid);
 insert into partner_pilot.requests values(uid,req,p,jsonb_build_object('room',rid,'revision',r.revision));
 perform realtime.send(jsonb_build_object('room_id',rid,'revision',r.revision),'revision','partner-pilot:'||rid||':'||r.epoch,true);
 return result;
end $function$;
commit;
