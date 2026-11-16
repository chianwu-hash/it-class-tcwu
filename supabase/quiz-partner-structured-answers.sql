-- Canonical source types and complete partner support for existing fixed documents.
-- No updates to source versions, attempts, answers or existing partner rooms.
begin;
do $guard$ begin
 if md5(pg_get_functiondef('partner_pilot.self_document_ok(jsonb)'::regprocedure)) <> '915ff31ec471fde42f9781da15f04400' then raise exception 'BASELINE_CHANGED: partner_pilot.self_document_ok(jsonb)';end if;
 if md5(pg_get_functiondef('partner_pilot.copy_self(uuid,text)'::regprocedure)) <> 'c3da408c532d9e011b52154d2b2a06ea' then raise exception 'BASELINE_CHANGED: partner_pilot.copy_self(uuid,text)';end if;
 if md5(pg_get_functiondef('partner_pilot.import_teacher_library_session(uuid)'::regprocedure)) <> 'ff98627fa80e9f62f955961910611466' then raise exception 'BASELINE_CHANGED: partner_pilot.import_teacher_library_session(uuid)';end if;
 if md5(pg_get_functiondef('partner_pilot.action_core(jsonb)'::regprocedure)) <> '71a4b9c68066965e08435c333143aee6' then raise exception 'BASELINE_CHANGED: partner_pilot.action_core(jsonb)';end if;
 if md5(pg_get_functiondef('partner_pilot.learning_snapshot_pre_message_media(uuid)'::regprocedure)) <> 'b532c66a1abc43d2c13e19d5d3f9faca' then raise exception 'BASELINE_CHANGED: partner_pilot.learning_snapshot_pre_message_media(uuid)';end if;
 if md5(pg_get_functiondef('partner_pilot.team_rooms()'::regprocedure)) <> '4d86f90d9ee87ec31dff42e3b94480e3' then raise exception 'BASELINE_CHANGED: partner_pilot.team_rooms()';end if;
end $guard$;
alter table partner_pilot.question_bank add column normal_question jsonb;

-- partner_pilot.self_document_ok(jsonb)  md5=915ff31ec471fde42f9781da15f04400
CREATE OR REPLACE FUNCTION partner_pilot.self_document_ok(doc jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 select (select count(*) from jsonb_array_elements(doc->'blocks') b cross join lateral jsonb_array_elements(b->'questions') q) in (10,20)
 and not exists(select 1 from jsonb_array_elements(doc->'blocks') b where jsonb_array_length(b->'questions')<>1)
 and not exists(select 1 from jsonb_array_elements(doc->'blocks') b cross join lateral jsonb_array_elements(b->'questions') q where coalesce(q->>'type','') not in ('single','fields','short','open'))
$function$;
revoke all on function partner_pilot.self_document_ok(jsonb) from public, anon, authenticated, service_role;
grant execute on function partner_pilot.self_document_ok(jsonb) to postgres;

-- partner_pilot.copy_self(uuid,text)  md5=c3da408c532d9e011b52154d2b2a06ea
CREATE OR REPLACE FUNCTION partner_pilot.copy_self(sid uuid, pid text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare doc jsonb; label text; cls text; b jsonb; q jsonb; rich jsonb; opts jsonb; correct_index int;
 total int; n int:=0; qid int; m record; source_url text; hash text; canonical jsonb; key text;
begin
 -- SHARE prevents deletion/state changes racing the ownership check and the copy.
 select v.document,coalesce(g.display_name,v.document->>'title'),e.class_code into doc,label,cls
 from public.quiz_generated_papers g join public.quiz_sessions s on s.id=g.session_id
 join public.quiz_versions v on v.id=s.version_id join auth.users u on u.id=auth.uid()
 join public.student_enrollments e on e.email=lower(u.email) and e.school_year=115
 where s.id=sid and g.user_id=auth.uid() and s.owner_id=auth.uid() and g.deleted_at is null
 and g.config->>'kind'='self' and g.config->>'count' in ('10','20') and s.access_mode='self'
 and s.status='open' and s.school_year=115 and s.class_codes ? e.class_code for share of g,s;
 if doc is null or not partner_pilot.self_document_ok(doc) then raise exception 'SELF_UNAVAILABLE';end if;
 perform public.quiz_validate(doc);
 select count(*) into total from jsonb_array_elements(doc->'blocks') x cross join lateral jsonb_array_elements(x->'questions') y;
 -- Canonical content excludes IDs/order/title/owner/room; registered media content hashes replace URL namespaces.
 canonical:=doc;
 for m in select distinct value#>>'{}' as url from jsonb_path_query(doc,'$.blocks[*].**.media[*].url') a(value) loop
  source_url:=m.url;
  if not exists(select 1 from public.quiz_media_assets a where a.url=source_url and a.mime in ('image/png','image/jpeg','image/webp','image/gif','audio/mpeg','audio/wav','audio/ogg')) then raise exception 'SELF_MEDIA_UNAVAILABLE';end if;
  hash:=substring(source_url from '([a-f0-9]{64})$');
  if hash is null then raise exception 'SELF_MEDIA_UNAVAILABLE';end if;
  canonical:=replace(canonical::text,to_jsonb(source_url)::text,to_jsonb('asset:'||hash)::text)::jsonb;
 end loop;
 select 'self:v1:'||encode(sha256(convert_to(jsonb_build_object('grade',left(cls,1),'year',115,'semester',1,
 'questions',jsonb_agg(jsonb_build_object('material',x->'material','question',y-'id') order by jsonb_build_object('material',x->'material','question',y-'id')::text))::text,'UTF8')),'hex') into key
 from jsonb_array_elements(canonical->'blocks') x cross join lateral jsonb_array_elements(x->'questions') y;
 insert into partner_pilot.papers(id,title,grade,subject,kind,total,content_key,is_real,origin,owner_id,self_session)
 values(pid,label,left(cls,1)::int,coalesce(doc#>>'{catalog,subject}','單元練習'),'leaf',total,key,true,'self',auth.uid(),sid);
 for m in select distinct value#>>'{}' as url from jsonb_path_query(doc,'$.blocks[*].**.media[*].url') a(value) loop
  hash:=encode(sha256(convert_to(m.url,'UTF8')),'hex');
  insert into partner_pilot.media_map values(pid,hash,m.url);
  doc:=replace(doc::text,to_jsonb(m.url)::text,to_jsonb('https://partner-media.invalid/'||hash)::text)::jsonb;
 end loop;
 for b in select value from jsonb_array_elements(doc->'blocks') loop
  q:=b->'questions'->0;n:=n+1;
  select jsonb_agg(o->'content' order by i),min((i-1)::int) filter(where o->>'id'=q#>>'{answer,option_id}') into opts,correct_index
  from jsonb_array_elements(coalesce(q->'options','[]')) with ordinality a(o,i);
  rich:=jsonb_build_object('material',b->'material','prompt',q->'prompt','options',opts,'explanation',q->'explanation');
  if q->>'type'<>'single' then opts:='[]';correct_index:=-1;rich:=rich||jsonb_build_object('normal',q-'answer'-'explanation');end if;
  qid:=nextval('partner_pilot.self_question_id');
  insert into partner_pilot.question_bank(id,title,prompt,options,correct,explanation,rich,normal_question)
  values(qid,'第'||n||'題',q#>>'{prompt,text}',(select coalesce(jsonb_agg(o->>'text' order by i),'[]'::jsonb) from jsonb_array_elements(opts) with ordinality a(o,i)),correct_index,q#>>'{explanation,text}',rich,case when q->>'type'<>'single' then q end);
  insert into partner_pilot.paper_items values(pid,n,qid);
 end loop;
end $function$;
revoke all on function partner_pilot.copy_self(uuid,text) from public, anon, authenticated, service_role;
grant execute on function partner_pilot.copy_self(uuid,text) to postgres;

-- partner_pilot.import_teacher_library_session(uuid)  md5=ff98627fa80e9f62f955961910611466
CREATE OR REPLACE FUNCTION partner_pilot.import_teacher_library_session(sid uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s public.quiz_sessions;d jsonb;pid text;g integer;n integer:=0;question_count integer;
 b jsonb;q jsonb;opts jsonb;correct_index integer;rich jsonb;source_url text;hash text;qid integer;
begin
 select * into s from public.quiz_sessions where id=sid and access_mode='practice' and library_visible and status='open' and school_year=115 for share;
 if s.id is null or exists(select 1 from public.quiz_generated_papers where session_id=sid)
 or exists(select 1 from public.quiz_learning_sessions where session_id=sid) then raise exception 'TEACHER_SOURCE_UNAVAILABLE';end if;
 select document into d from public.quiz_versions where id=s.version_id;
 if d#>>'{catalog,volume}' !~ '^[3469]年級' then raise exception 'TEACHER_GRADE_UNAVAILABLE';end if;
 g:=left(d#>>'{catalog,volume}',1)::int;
 if not partner_pilot.self_document_ok(d) then raise exception 'TEACHER_DOCUMENT_UNSUPPORTED';end if;
 perform public.quiz_validate(d);
 select count(*) into question_count from jsonb_array_elements(d->'blocks') x cross join lateral jsonb_array_elements(x->'questions') y;
 pid:='real-'||s.version_id;
 if exists(select 1 from partner_pilot.papers where id=pid) then
  if not exists(select 1 from partner_pilot.papers where id=pid and source_version=s.version_id and origin is null and total=question_count and is_real) then raise exception 'TEACHER_IMPORT_CONFLICT';end if;
  insert into partner_pilot.paper_sources values(pid,sid) on conflict do nothing;return pid;
 end if;
 for source_url in select distinct value#>>'{}' from jsonb_path_query(d,'$.blocks[*].**.media[*].url') a(value) loop
  if not exists(select 1 from public.quiz_media_assets where url=source_url and owner_id=s.owner_id) then raise exception 'TEACHER_MEDIA_UNAVAILABLE';end if;
 end loop;
 insert into partner_pilot.papers(id,title,grade,subject,kind,total,content_key,source_version,source_sha,is_real,source_session)
 values(pid,d->>'title',g,d#>>'{catalog,subject}','leaf',question_count,'teacher:'||s.version_id,s.version_id,encode(sha256(convert_to(d::text,'UTF8')),'hex'),true,sid);
 for source_url in select distinct value#>>'{}' from jsonb_path_query(d,'$.blocks[*].**.media[*].url') a(value) loop
  hash:=encode(sha256(convert_to(source_url,'UTF8')),'hex');insert into partner_pilot.media_map values(pid,hash,source_url);
  d:=replace(d::text,to_jsonb(source_url)::text,to_jsonb('https://partner-media.invalid/'||hash)::text)::jsonb;
 end loop;
 for b in select value from jsonb_array_elements(d->'blocks') loop
  q:=b->'questions'->0;n:=n+1;
  select jsonb_agg(o->'content' order by i),min((i-1)::int) filter(where o->>'id'=q#>>'{answer,option_id}') into opts,correct_index
  from jsonb_array_elements(coalesce(q->'options','[]')) with ordinality a(o,i);
  rich:=jsonb_build_object('material',b->'material','prompt',q->'prompt','options',opts,'explanation',q->'explanation');
  if q->>'type'<>'single' then opts:='[]';correct_index:=-1;rich:=rich||jsonb_build_object('normal',q-'answer'-'explanation');end if;
  qid:=nextval('partner_pilot.self_question_id');
  insert into partner_pilot.question_bank(id,title,prompt,options,correct,explanation,rich,normal_question)
  values(qid,'第'||n||'題',q#>>'{prompt,text}',(select coalesce(jsonb_agg(o->>'text' order by i),'[]'::jsonb) from jsonb_array_elements(opts) with ordinality a(o,i)),correct_index,q#>>'{explanation,text}',rich,case when q->>'type'<>'single' then q end);
  insert into partner_pilot.paper_items values(pid,n,qid);
 end loop;
 insert into partner_pilot.paper_sources values(pid,sid);
 return pid;
end $function$;
revoke all on function partner_pilot.import_teacher_library_session(uuid) from public, anon, authenticated, service_role;
grant execute on function partner_pilot.import_teacher_library_session(uuid) to postgres;

-- partner_pilot.action_core(jsonb)  md5=71a4b9c68066965e08435c333143aee6
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
   if jsonb_typeof(p->'response') is distinct from 'string' or length(p->>'response') not between 1 and 2000 then raise exception 'invalid_response';end if;
   response_value:=p->'response';
   if qb.normal_question->>'type' in ('fields','open') then
    perform public.quiz_fields_response(qb.normal_question,p->>'response');
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
revoke all on function partner_pilot.action_core(jsonb) from public, anon, authenticated, service_role;
grant execute on function partner_pilot.action_core(jsonb) to postgres;

-- partner_pilot.learning_snapshot_pre_message_media(uuid)  md5=b532c66a1abc43d2c13e19d5d3f9faca
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
 total:=partner_pilot.paper_total(r.paper);
 select count(distinct qid) into submitted from partner_pilot.answers where room_id=rid;
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
  if submitted=total or exists(select 1 from partner_pilot.notes where room_id=rid and qid=q.id and kind in ('ask','mark')) then shared:=shared||jsonb_build_array(item-'attempts'); end if;
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
revoke all on function partner_pilot.learning_snapshot_pre_message_media(uuid) from public, anon, authenticated, service_role;
grant execute on function partner_pilot.learning_snapshot_pre_message_media(uuid) to postgres;

-- partner_pilot.team_rooms()  md5=4d86f90d9ee87ec31dff42e3b94480e3
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
   'assigned',case when r.started then (select count(*) from partner_pilot.paper_items i where i.paper_id=r.paper and partner_pilot.owner_of(r.id,i.qid)=m.user_id) else 0 end,
   'submitted',(select count(distinct a.qid) from partner_pilot.answers a where a.room_id=r.id and a.user_id=m.user_id),
   'reviewed',exists(select 1 from partner_pilot.review_seen v where v.room_id=r.id and v.user_id=m.user_id)) order by m.joined_at,m.user_id),'[]')
   from partner_pilot.members m join partner_pilot.allowed_users u on u.user_id=m.user_id where m.room_id=r.id),
  'phase',case when r.finished then 'completed' when not r.started then 'waiting'
   when s.submitted=s.total then 'review' else 'practice' end,
  'progress',jsonb_build_object('total',s.total,'submitted',s.submitted,'graded',s.graded,
   'correct',case when s.submitted=s.total and r.started then s.correct else null end,
   'reviewed',(select count(*) from partner_pilot.review_seen v where v.room_id=r.id),
   'meReviewed',exists(select 1 from partner_pilot.review_seen v where v.room_id=r.id and v.user_id=auth.uid()),
   'award',(select jsonb_build_object('leaves',a.leaves,'flowers',a.flowers,'earnedHere',a.room_id=r.id)
     from partner_pilot.awards a where a.content_key=p.content_key and a.member_key=(select string_agg(user_id::text,',' order by user_id) from partner_pilot.members where room_id=r.id)))
 ) order by r.created_at desc,r.id),'[]'::jsonb)
 from partner_pilot.rooms r join partner_pilot.members mine on mine.room_id=r.id and mine.user_id=auth.uid() join partner_pilot.papers p on p.id=r.paper
 cross join lateral (select partner_pilot.paper_total(r.paper) total,
  (select count(distinct a.qid) from partner_pilot.answers a where a.room_id=r.id) submitted,
  (select count(*) from partner_pilot.paper_items i join partner_pilot.question_bank q on q.id=i.qid where i.paper_id=r.paper and coalesce(q.past_meta->>'selfCheck','false')<>'true' and coalesce(q.normal_question->>'type','')<>'open') graded,
  (select count(*) from (select distinct on(a.qid) a.correct from partner_pilot.answers a where a.room_id=r.id order by a.qid,a.attempt desc)x where correct) correct) s
$function$;
revoke all on function partner_pilot.team_rooms() from public, anon, authenticated, service_role;
grant execute on function partner_pilot.team_rooms() to postgres;

commit;
