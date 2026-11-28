-- Optional, ungraded past-exam fields remain allocated and answerable.
BEGIN;
DO $guard$
BEGIN
 IF md5(pg_get_functiondef('partner_pilot.action_core(jsonb)'::regprocedure)) IS DISTINCT FROM '28657e37a327992c1c178f45f1f05e3e' THEN
  RAISE EXCEPTION 'Unexpected partner_pilot.action_core(jsonb) version';
 END IF;
 IF md5(pg_get_functiondef('partner_pilot.learning_snapshot_pre_message_media(uuid)'::regprocedure)) IS DISTINCT FROM '1064d2e6dece7ae4d027182dc2b42530' THEN
  RAISE EXCEPTION 'Unexpected partner_pilot.learning_snapshot_pre_message_media(uuid) version';
 END IF;
 IF md5(pg_get_functiondef('partner_pilot.team_rooms()'::regprocedure)) IS DISTINCT FROM 'fb026928de1052c2b8d76f4785f9cf54' THEN
  RAISE EXCEPTION 'Unexpected partner_pilot.team_rooms() version';
 END IF;
END $guard$;

CREATE FUNCTION partner_pilot.required_progress(pid text, rid uuid, member_id uuid DEFAULT NULL)
 RETURNS TABLE(total integer, submitted integer)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 SELECT count(*)::integer,
        count(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM partner_pilot.answers a WHERE a.room_id=rid AND a.qid=i.qid
        ))::integer
 FROM partner_pilot.paper_items i
 JOIN partner_pilot.question_bank q ON q.id=i.qid
 WHERE i.paper_id=pid
   AND NOT coalesce(q.past_meta @> '{"optional":true,"selfCheck":true}',false)
   AND (member_id IS NULL OR partner_pilot.owner_of(rid,i.qid)=member_id)
$function$;
REVOKE ALL ON FUNCTION partner_pilot.required_progress(text,uuid,uuid) FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION partner_pilot.required_progress(text,uuid,uuid) TO postgres;

CREATE OR REPLACE FUNCTION partner_pilot.action_core(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'partner_pilot'
AS $function$
declare uid uuid:=auth.uid(); act text:=p->>'action'; rid uuid; r partner_pilot.rooms; req text:=p->>'requestId'; prior partner_pilot.requests; result jsonb; total int; qid int; choice int; count_attempt int; correct_choice int; option_count int; k text; body text; parent partner_pilot.notes; roster uuid[]; memberkey text; snap jsonb; qb partner_pilot.question_bank; response_value jsonb; is_correct boolean;
 required_submitted int;
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
 if act in ('discuss','review','finish') then
  select progress.total, progress.submitted into total, required_submitted
  from partner_pilot.required_progress(r.paper,rid) progress;
 end if;
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
   if jsonb_typeof(p->'response') is distinct from 'string' or (case when(qb.normal_question->>'type'='open' and exists(select 1 from jsonb_array_elements(qb.normal_question->'fields') fs where fs->>'input'='sketch'))or(qb.normal_question->>'type'='fields' and qb.normal_question#>>'{work,input}'='sketch')then octet_length(p->>'response') not between 1 and 300000 else length(p->>'response') not between 1 and 2000 end) then raise exception 'invalid_response';end if;
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
  if act='discuss' and required_submitted<>total then raise exception 'REVIEW_NOT_READY'; end if;
  insert into partner_pilot.notes(room_id,user_id,kind,qid,thread_id,tag,text) values(rid,uid,act,qid,case when act='reply' then parent.id else null end,case when act='mark' then p->>'tag' else null end,body);
 elsif act='review' then
  if required_submitted<>total then raise exception 'REVIEW_NOT_READY'; end if;
  body:=trim(coalesce(p->>'text',''));if length(body)>240 then raise exception 'INVALID_TEXT'; end if;
  insert into partner_pilot.review_seen values(rid,uid,body,clock_timestamp()) on conflict(room_id,user_id) do update set reflection=excluded.reflection;
  -- The room row is already locked: the last explicit review completes atomically.
  if (select count(*) from partner_pilot.review_seen where room_id=rid)=r.capacity then update partner_pilot.rooms set finished=true where id=rid;end if;
 elsif act='finish' then
  if required_submitted<>total or (select count(*) from partner_pilot.review_seen where room_id=rid)<>r.capacity then raise exception 'WAIT_FOR_REVIEW'; end if;
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

CREATE OR REPLACE FUNCTION partner_pilot.learning_snapshot_pre_message_media(rid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'partner_pilot'
AS $function$
declare base jsonb; r partner_pilot.rooms; total int; submitted int; correct_count int; first_correct int; q record; owner uuid; item jsonb; mine jsonb:='[]'; shared jsonb:='[]'; notes jsonb; reviewers jsonb; stories jsonb:='[]'; story text[]; m record; award jsonb; roster uuid[]; memberkey text;
begin
 base:=partner_pilot.snapshot(rid);
 select * into strict r from partner_pilot.rooms where id=rid;
 base:=base||jsonb_build_object('paperInfo',(select jsonb_build_object('title',title,'grade',grade,'subject',subject,'kind',kind,'total',pp.total,'real',is_real,'sourceVersion',source_version,'sourceSha',source_sha,'past',past_meta) from partner_pilot.papers pp where id=r.paper));
 if not r.started then return base; end if;
 select progress.total, progress.submitted into total, submitted
 from partner_pilot.required_progress(r.paper,rid) progress;
 select count(*) into correct_count from (select distinct on(qid) correct from partner_pilot.answers where room_id=rid order by qid,attempt desc) a where correct;
 select count(*) into first_correct from partner_pilot.answers where room_id=rid and attempt=1 and correct;
 for q in select b.*,i.number from partner_pilot.question_bank b join partner_pilot.paper_items i on i.qid=b.id where i.paper_id=r.paper order by i.number loop
  owner:=partner_pilot.owner_of(rid,q.id);
  item:=jsonb_build_object('id',q.id,'number',q.number,'title',q.title,'text',q.prompt,'options',q.options,'past',q.past_meta,'normal',q.normal_question-'answer'-'explanation','rich',q.rich-'explanation','owner',owner,'ownerName',(select display_name from partner_pilot.allowed_users where user_id=owner));
  if owner=auth.uid() then
   item:=item||jsonb_build_object('attempts',coalesce((select jsonb_agg(jsonb_build_object('choice',a.choice,'value',a.response,'correct',a.correct,'at',a.created_at) order by a.attempt) from partner_pilot.answers a where a.room_id=rid and a.qid=q.id),'[]'::jsonb));
  end if;
  if submitted=total or exists(select 1 from partner_pilot.answers where room_id=rid and qid=q.id and user_id=auth.uid()) then item:=item||jsonb_build_object('normalReference',q.normal_question->'answer','correct',q.correct,'explanation',q.explanation,'rich',q.rich); end if;
  if owner=auth.uid() then mine:=mine||jsonb_build_array(item); end if;
  if submitted=total or exists(select 1 from partner_pilot.notes where room_id=rid and qid=q.id and kind in ('ask','mark')) then shared:=shared||jsonb_build_array((item-'attempts')||case
   when submitted=total and((q.normal_question->>'type'='open'
    and exists(select 1 from jsonb_array_elements(q.normal_question->'fields') f where f->>'input'='sketch'))or(q.normal_question->>'type'='fields' and q.normal_question ? 'work'))
   then jsonb_build_object('attempts',coalesce((
    select jsonb_build_array(jsonb_build_object('choice',a.choice,'value',a.response,'correct',a.correct,'at',a.created_at))
    from partner_pilot.answers a where a.room_id=rid and a.qid=q.id and a.user_id=owner
    order by a.attempt desc limit 1),'[]'::jsonb)) else '{}'::jsonb end); end if;
 end loop;
 select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'user',n.user_id,'name',u.display_name,'kind',n.kind,'qid',n.qid,'thread',n.thread_id,'tag',n.tag,'text',n.text,'at',n.created_at) order by n.id),'[]'::jsonb) into notes from partner_pilot.notes n join partner_pilot.allowed_users u on u.user_id=n.user_id where n.room_id=rid;
 select coalesce(jsonb_agg(jsonb_build_object('user',v.user_id,'name',u.display_name,'reflection',v.reflection) order by v.created_at),'[]'::jsonb) into reviewers from partner_pilot.review_seen v join partner_pilot.allowed_users u using(user_id) where v.room_id=rid;
 for m in select a.user_id,u.display_name from partner_pilot.members a join partner_pilot.allowed_users u using(user_id) where a.room_id=rid order by a.joined_at,a.user_id loop
  story:=array[]::text[];
  if exists(select 1 from partner_pilot.notes where room_id=rid and user_id=m.user_id and kind='mark') then story:=array_append(story,'把「'||(select b.title from partner_pilot.notes n join partner_pilot.question_bank b on b.id=n.qid where n.room_id=rid and n.user_id=m.user_id and n.kind='mark' order by n.id limit 1)||'」帶到大家面前。'); end if;
  if exists(select 1 from partner_pilot.notes n join partner_pilot.notes ask on ask.id=n.thread_id where n.room_id=rid and n.user_id=m.user_id and n.kind='reply' and ask.user_id<>m.user_id) then story:=array_append(story,'陪夥伴一起想「'||(select b.title from partner_pilot.notes n join partner_pilot.notes ask on ask.id=n.thread_id join partner_pilot.question_bank b on b.id=n.qid where n.room_id=rid and n.user_id=m.user_id and n.kind='reply' and ask.user_id<>m.user_id order by n.id limit 1)||'」，留下自己的提示。'); end if;
  if exists(select 1 from partner_pilot.notes where room_id=rid and user_id=m.user_id and kind='ask') then story:=array_append(story,'在「'||(select b.title from partner_pilot.notes n join partner_pilot.question_bank b on b.id=n.qid where n.room_id=rid and n.user_id=m.user_id and n.kind='ask' order by n.id limit 1)||'」卡住時，主動請夥伴一起想。'); end if;
  if exists(select 1 from partner_pilot.answers where room_id=rid and user_id=m.user_id and attempt>1) then story:=array_append(story,'回到「'||(select b.title from partner_pilot.answers a join partner_pilot.question_bank b on b.id=a.qid where a.room_id=rid and a.user_id=m.user_id and a.attempt>1 order by a.created_at limit 1)||'」，訂正後再試。'); end if;
  if exists(select 1 from partner_pilot.notes where room_id=rid and user_id=m.user_id and kind='discuss') then story:=array_append(story,'在「'||(select b.title from partner_pilot.notes n join partner_pilot.question_bank b on b.id=n.qid where n.room_id=rid and n.user_id=m.user_id and n.kind='discuss' order by n.id limit 1)||'」的共同回顧中留下新發現。'); end if;
  if cardinality(story)=0 then story:=array_append(story,case when exists(select 1 from partner_pilot.answers where room_id=rid and user_id=m.user_id) then '在「'||(select b.title from partner_pilot.answers a join partner_pilot.question_bank b on b.id=a.qid where a.room_id=rid and a.user_id=m.user_id order by a.created_at limit 1)||'」留下作答與思考的起點。' else '已和大家一起出發，正按自己的步調練習。' end); end if;
  stories:=stories||jsonb_build_array(jsonb_build_object('user',m.user_id,'name',m.display_name,'lines',to_jsonb(story),'reflection',coalesce((select reflection from partner_pilot.review_seen where room_id=rid and user_id=m.user_id),'')));
 end loop;
 select array_agg(user_id order by user_id),string_agg(user_id::text,',' order by user_id) into roster,memberkey from partner_pilot.members where room_id=rid;
 select jsonb_build_object('id',id,'room',room_id,'leaves',leaves,'flowers',flowers,'record',record,'at',created_at,'earnedHere',room_id=rid) into award from partner_pilot.awards where content_key=(select content_key from partner_pilot.papers where id=r.paper) and member_key=memberkey;
 return base||jsonb_build_object('exercise',jsonb_build_object('total',total,'submitted',submitted,'correct',correct_count,'initialCorrect',first_correct,'gradedTotal',(select count(*) from partner_pilot.paper_items pi join partner_pilot.question_bank qb on qb.id=pi.qid where pi.paper_id=r.paper and coalesce(qb.past_meta->>'selfCheck','false')<>'true' and coalesce(qb.normal_question->>'type','')<>'open'),'reviewOpen',submitted=total,'finished',r.finished,'mine',mine,'shared',shared,'notes',notes,'reviewers',reviewers,'stories',stories,'award',award,'privateDraft',coalesce((select jsonb_build_object('state',d.state,'revision',d.revision,'at',d.saved_at) from partner_pilot.drafts d where d.room_id=rid and d.user_id=auth.uid()),jsonb_build_object('state',null,'revision',0))));
end $function$;

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
  'members',(select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'name',u.display_name,
   'assigned',case when r.started then member_progress.total else 0 end,
   'submitted',member_progress.submitted,
   'reviewed',exists(select 1 from partner_pilot.review_seen v where v.room_id=r.id and v.user_id=m.user_id)) order by m.joined_at,m.user_id),'[]')
   from partner_pilot.members m join partner_pilot.allowed_users u on u.user_id=m.user_id
   cross join lateral partner_pilot.required_progress(r.paper,r.id,m.user_id) member_progress
   where m.room_id=r.id),
  'phase',case when r.finished then 'completed' when not r.started then 'waiting'
   when s.submitted=s.total then 'review' else 'practice' end,
  'progress',jsonb_build_object('total',s.total,'submitted',s.submitted,'graded',scores.graded,
   'correct',case when s.submitted=s.total and r.started then scores.correct else null end,
   'reviewed',(select count(*) from partner_pilot.review_seen v where v.room_id=r.id),
   'meReviewed',exists(select 1 from partner_pilot.review_seen v where v.room_id=r.id and v.user_id=auth.uid()),
   'award',(select jsonb_build_object('leaves',a.leaves,'flowers',a.flowers,'earnedHere',a.room_id=r.id)
     from partner_pilot.awards a where a.content_key=p.content_key and a.member_key=(select string_agg(user_id::text,',' order by user_id) from partner_pilot.members where room_id=r.id)))
 ) order by r.created_at desc,r.id),'[]'::jsonb)
 from partner_pilot.rooms r join partner_pilot.members mine on mine.room_id=r.id and mine.user_id=auth.uid() join partner_pilot.papers p on p.id=r.paper
 cross join lateral partner_pilot.required_progress(r.paper,r.id) s
 cross join lateral (select
  (select count(*) from partner_pilot.paper_items i join partner_pilot.question_bank q on q.id=i.qid where i.paper_id=r.paper and coalesce(q.past_meta->>'selfCheck','false')<>'true' and coalesce(q.normal_question->>'type','')<>'open') graded,
  (select count(*) from (select distinct on(a.qid) a.correct from partner_pilot.answers a where a.room_id=r.id order by a.qid,a.attempt desc)x where correct) correct) scores
$function$;

COMMIT;
