-- Frozen pre-review-completion function baseline; definitions only, no student data.
CREATE OR REPLACE FUNCTION partner_pilot.team_rooms()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',r.id,'team',r.team,'started',r.started,'finished',r.finished,'capacity',r.capacity,'host',r.host,
  'title',p.title,'subject',p.subject,'total',p.total,'kind',p.kind,
  'paused',not partner_pilot.source_allowed(r.paper,r.started),
  'inviteExpired',not r.started and r.expires_at<=now(),
  'count',(select count(*) from partner_pilot.members m where m.room_id=r.id),
  'members',(select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'name',u.display_name) order by m.joined_at,m.user_id),'[]') from partner_pilot.members m join partner_pilot.allowed_users u on u.user_id=m.user_id where m.room_id=r.id),
  'phase',case when r.finished then 'completed' when not r.started then 'waiting'
   when not exists(select 1 from partner_pilot.paper_items pi where pi.paper_id=r.paper and not exists(select 1 from partner_pilot.answers a where a.room_id=r.id and a.qid=pi.qid)) then 'review' else 'practice' end
 ) order by r.created_at desc,r.id),'[]'::jsonb)
 from partner_pilot.rooms r join partner_pilot.members mine on mine.room_id=r.id and mine.user_id=auth.uid() join partner_pilot.papers p on p.id=r.paper
$function$;
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
  if qb.past_meta is not null then
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
 elsif act='finish' then
  if (select count(distinct a.qid) from partner_pilot.answers a where a.room_id=rid)<>total or (select count(*) from partner_pilot.review_seen where room_id=rid)<>r.capacity then raise exception 'WAIT_FOR_REVIEW'; end if;
  update partner_pilot.rooms set finished=true where id=rid;
 elsif act='settle' then
  perform partner_pilot.claim_award(rid);
 end if;
 if act in ('answer','chat','ask','reply','mark','discuss','review') then
  k:=(case act when 'review' then 'reflection' else act end)||'-'||case when act='reply' then p->>'thread' when act in ('answer','ask','mark','discuss') then p->>'qid' else '' end;
  update partner_pilot.drafts d set state=d.state#-array['drafts',k],revision=d.revision+1,saved_at=clock_timestamp() where d.room_id=rid and d.user_id=uid and d.state#>>array['drafts',k]=case when act='answer' then p->>'choice' else coalesce(p->>'text','') end;
 end if;
 update partner_pilot.rooms set revision=revision+1 where id=rid returning * into r;
 result:=partner_pilot.learning_snapshot(rid);
 insert into partner_pilot.requests values(uid,req,p,jsonb_build_object('room',rid,'revision',r.revision));
 perform realtime.send(jsonb_build_object('room_id',rid,'revision',r.revision),'revision','partner-pilot:'||rid||':'||r.epoch,true);
 return result;
end $function$;
CREATE OR REPLACE FUNCTION public.quiz_partner_pilot_action(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare act text:=p->>'action';rid uuid;r partner_pilot.rooms;result jsonb;pid text;aid uuid;req text;prior partner_pilot.requests;original jsonb:=p;sid uuid;
begin
 perform partner_pilot.register_self();
 if act in ('catalog','create','join','lookup') then perform partner_pilot.sync_source_links();end if;
 if act='catalog' then result:=jsonb_build_object('papers',(select jsonb_agg(jsonb_build_object('id',id,'title',title,'grade',grade,'subject',subject,'kind',kind,'total',pp.total,'real',is_real,'past',past_meta is not null,'sourceSession',source_session,'sourceSessions',(select coalesce(jsonb_agg(s.id order by s.id),'[]') from public.quiz_sessions s where s.version_id=pp.source_version and (s.id=pp.source_session or s.access_mode='practice') and s.status='open' and s.library_visible and not exists(select 1 from public.quiz_generated_papers g where g.session_id=s.id)),'sourcePaper',past_meta->>'sourcePaper') order by is_real desc,grade,subject,title) from partner_pilot.papers pp where enabled and pp.origin is null and partner_pilot.source_allowed(pp.id,false))); return jsonb_build_object('papers',coalesce(nullif(result->'papers','null'::jsonb),'[]'::jsonb)||partner_pilot.self_catalog()); end if;
 -- Self create stores the ORIGINAL request body for exact idempotency, never trusting client metadata.
 if act='create' and left(coalesce(p->>'paper',''),5)='self:' then
  req:=p->>'requestId';
  if req is null or length(req) not between 8 and 100 then raise exception 'REQUEST_ID_REQUIRED';end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||req,0));
  select * into prior from partner_pilot.requests where user_id=auth.uid() and request_id=req;
  if found then
   if prior.body<>original then raise exception 'REQUEST_REUSED';end if;
   return partner_pilot.learning_snapshot((prior.result->>'id')::uuid);
  end if;
  -- Bound burst writes even when a client repeatedly creates and leaves rooms.
  perform pg_advisory_xact_lock(hashtextextended('partner-self-create:'||auth.uid()::text,0));
  if (select count(*) from partner_pilot.rooms room_row join partner_pilot.papers q on q.id=room_row.paper where q.origin='self' and q.owner_id=auth.uid() and room_row.created_at>now()-interval '1 minute')>=6 then raise exception 'ROOM_RATE_LIMIT';end if;
  if substring(p->>'paper' from 6)!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then raise exception 'SELF_UNAVAILABLE';end if;
  sid:=substring(p->>'paper' from 6)::uuid;
  pid:='custom:'||encode(sha256(convert_to(auth.uid()::text||':'||req,'UTF8')),'hex');
  perform partner_pilot.copy_self(sid,pid);
  p:=jsonb_set(p,'{paper}',to_jsonb(pid));
  result:=partner_pilot.action_core(p);
  update partner_pilot.requests set body=original where user_id=auth.uid() and request_id=req;
  return result;
 end if;
 if act='create' and exists(select 1 from partner_pilot.papers where id=p->>'paper' and origin='self') then raise exception 'SELF_UNAVAILABLE';end if;

 -- Remember newly published class sessions before a room starts; their normal version updates do not orphan it.

 if act='me' then return jsonb_build_object('id',auth.uid(),'name',(select display_name from partner_pilot.allowed_users where user_id=auth.uid()),'rooms',partner_pilot.team_rooms());end if;
 if act='record' then
  aid:=(p->>'awardId')::uuid;select room_id into rid from partner_pilot.awards where id=aid and auth.uid()=any(members);if rid is null then raise exception 'NOT_MEMBER';end if;
  select * into r from partner_pilot.rooms where id=rid;
  if partner_pilot.source_allowed(r.paper,true) then return partner_pilot.learning_snapshot(rid);end if;
  return partner_pilot.paused_snapshot(rid)||jsonb_build_object('recordOnly',true);
 end if;
 if act='create' and not partner_pilot.source_allowed(p->>'paper',false) then raise exception 'SOURCE_CHANGED';end if;
 if act='lookup' then select * into r from partner_pilot.rooms where code=p->>'code' and expires_at>now();pid:=r.paper;if not(partner_pilot.source_allowed(pid,false) or partner_pilot.custom_invite_ok(r.id,p->>'code')) then raise exception 'ROOM_NOT_FOUND';end if;end if;
 if p ? 'roomId' then
  rid:=(p->>'roomId')::uuid;
  if act='start' then select * into r from partner_pilot.rooms where id=rid for update;else select * into r from partner_pilot.rooms where id=rid;end if;
  if act='join' then if not(partner_pilot.source_allowed(r.paper,false) or partner_pilot.custom_invite_ok(r.id,p->>'code')) then raise exception 'SOURCE_CHANGED';end if;
  else
   if not exists(select 1 from partner_pilot.members where room_id=rid and user_id=auth.uid()) then raise exception 'NOT_MEMBER';end if;
   if not partner_pilot.source_allowed(r.paper,r.started) then
    if act='snapshot' then return partner_pilot.paused_snapshot(rid);end if;
    if act<>'save_draft' and not(act='leave' and not r.started) then raise exception 'SOURCE_CHANGED';end if;
   end if;
  end if;
 end if;
 if act='start' and r.started then return partner_pilot.learning_snapshot(rid);end if;
 if act='settle' then perform partner_pilot.claim_award(rid);return partner_pilot.learning_snapshot(rid);end if;
 result:=partner_pilot.action_core(p);
 if rid is not null and not partner_pilot.source_allowed(r.paper,r.started) and act='save_draft' then return partner_pilot.paused_snapshot(rid);end if;
 -- claim_award returns without writing while the room is unfinished; action_core already returned that snapshot.
 if act in ('finish','answer') and exists(select 1 from partner_pilot.rooms where id=rid and finished) then perform partner_pilot.claim_award(rid);result:=partner_pilot.learning_snapshot(rid);end if;
 return result;
end $function$;