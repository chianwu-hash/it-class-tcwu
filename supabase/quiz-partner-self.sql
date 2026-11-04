-- 2026-11-05: owner-selected self papers become room-private immutable copies.
-- Does not write personal sessions, versions, attempts, answers or learning rewards.
begin;
set local lock_timeout='3s';
set local statement_timeout='90s';
alter table partner_pilot.papers add column origin text check(origin is null or origin='self'),
 add column owner_id uuid references auth.users(id), add column self_session uuid references public.quiz_sessions(id);
alter table partner_pilot.papers add constraint partner_self_origin check
 (origin is null or (owner_id is not null and self_session is not null and source_session is null and source_version is null and kind='leaf' and total in (10,20)));
create sequence partner_pilot.self_question_id as integer start with 1000000000;
select setval('partner_pilot.self_question_id',greatest(1000000000,coalesce((select max(id)+1 from partner_pilot.question_bank),1000000000)),false);
create index partner_rooms_paper on partner_pilot.rooms(paper);
create index partner_self_owner on partner_pilot.papers(owner_id) where origin='self';

create function partner_pilot.self_document_ok(doc jsonb) returns boolean
language sql immutable set search_path='' as $$
 select (select count(*) from jsonb_array_elements(doc->'blocks') b cross join lateral jsonb_array_elements(b->'questions') q) in (10,20)
 and not exists(select 1 from jsonb_array_elements(doc->'blocks') b where jsonb_array_length(b->'questions')<>1)
 and not exists(select 1 from jsonb_array_elements(doc->'blocks') b cross join lateral jsonb_array_elements(b->'questions') q where q->>'type' is distinct from 'single')
$$;

create function partner_pilot.self_catalog() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id','self:'||s.id,'title',coalesce(g.display_name,v.document->>'title'),
 'grade',left(e.class_code,1)::int,'subject',v.document#>>'{catalog,subject}','kind','leaf','self',true,
 'total',(select count(*) from jsonb_array_elements(v.document->'blocks') b cross join lateral jsonb_array_elements(b->'questions') q),
 'real',true,'past',false,'sourceSession',s.id,'sourceSessions',jsonb_build_array(s.id)) order by g.created_at desc,s.id),'[]')
 from public.quiz_generated_papers g join public.quiz_sessions s on s.id=g.session_id
 join public.quiz_versions v on v.id=s.version_id join auth.users u on u.id=auth.uid()
 join public.student_enrollments e on e.email=lower(u.email) and e.school_year=115
 where g.user_id=auth.uid() and s.owner_id=auth.uid() and g.deleted_at is null and g.config->>'kind'='self'
 and g.config->>'count' in ('10','20') and s.access_mode='self' and s.status='open' and s.school_year=115
 and s.class_codes ? e.class_code and partner_pilot.self_document_ok(v.document)
$$;

create function partner_pilot.custom_invite_ok(rid uuid,code text) returns boolean
language sql stable security definer set search_path='' as $$
 select partner_pilot.can_access() and exists(select 1 from partner_pilot.rooms r join partner_pilot.papers p on p.id=r.paper
 join auth.users u on u.id=auth.uid() join public.student_enrollments e on e.email=lower(u.email) and e.school_year=115
 where r.id=rid and p.origin='self' and p.enabled and not r.started and r.expires_at>now()
 and r.code=$2 and left(e.class_code,1)=p.grade::text)
$$;

create function partner_pilot.max_capacity(pid text) returns int
language sql stable security definer set search_path='' as $$
 select case when kind='leaf' and total=10 then 2 else 4 end from partner_pilot.papers where id=pid
$$;

create function partner_pilot.copy_self(sid uuid,pid text) returns void
language plpgsql security definer set search_path='' as $$
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
  from jsonb_array_elements(q->'options') with ordinality a(o,i);
  rich:=jsonb_build_object('material',b->'material','prompt',q->'prompt','options',opts,'explanation',q->'explanation');
  qid:=nextval('partner_pilot.self_question_id');
  insert into partner_pilot.question_bank(id,title,prompt,options,correct,explanation,rich)
  values(qid,'第'||n||'題',q#>>'{prompt,text}',(select jsonb_agg(o->>'text' order by i) from jsonb_array_elements(opts) with ordinality a(o,i)),correct_index,q#>>'{explanation,text}',rich);
  insert into partner_pilot.paper_items values(pid,n,qid);
 end loop;
end $$;

-- Production wrappers: source snapshot baseline f1fc884; unrelated personal functions unchanged.
CREATE OR REPLACE FUNCTION partner_pilot.source_allowed(pid text, continuing boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from partner_pilot.papers p join auth.users u on u.id=auth.uid() join public.student_enrollments e on e.email=lower(u.email) and e.school_year=115 where p.id=pid and p.enabled and p.is_real and left(e.class_code,1)=p.grade::text and case when p.origin='self' then p.total in (10,20) and exists(select 1 from partner_pilot.rooms r join partner_pilot.members m on m.room_id=r.id where r.paper=p.id and m.user_id=auth.uid()) when p.past_meta is not null then exists(select 1 from public.quiz_past_papers s where s.id=p.past_meta->>'sourcePaper' and s.enabled and s.grade=p.grade and (continuing or s.active_version=p.source_version)) else p.total in (10,20) and exists(select 1 from partner_pilot.paper_sources ps join public.quiz_sessions s on s.id=ps.session_id where ps.paper_id=p.id and s.status='open' and s.library_visible and s.access_mode='practice' and s.school_year=115 and s.class_codes ? e.class_code and (continuing or s.version_id=p.source_version)) end)
$function$;
CREATE OR REPLACE FUNCTION partner_pilot.lobby_action(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'partner_pilot'
AS $function$
declare uid uuid:=auth.uid(); act text:=p->>'action'; rid uuid; r partner_pilot.rooms; old_topic text; result jsonb; previous partner_pilot.requests; req text:=p->>'requestId'; cnt int; cap int; cname text; changed boolean:=true;
begin
 perform partner_pilot.register_self();
 if act='me' then return jsonb_build_object('id',uid,'name',(select display_name from partner_pilot.allowed_users where user_id=uid),'rooms',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'team',a.team,'started',a.started) order by a.created_at desc) from partner_pilot.rooms a join partner_pilot.members b on b.room_id=a.id where b.user_id=uid and partner_pilot.source_available(a.paper)),'[]'::jsonb)); end if;
 if act='lookup' then
  if coalesce(p->>'code','') !~ '^[0-9]{6}$' then raise exception 'INVALID_CODE'; end if;
  select * into r from partner_pilot.rooms where code=p->>'code' and expires_at>now() and (partner_pilot.source_available(paper) or partner_pilot.custom_invite_ok(id,p->>'code'));
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  return jsonb_build_object('id',r.id,'team',r.team,'capacity',r.capacity,'paper',case when (select origin from partner_pilot.papers where id=r.paper)='self' then null else r.paper end,'title',(select title from partner_pilot.papers where id=r.paper),'started',r.started,'count',(select count(*) from partner_pilot.members where room_id=r.id));
 end if;
 if act='snapshot' then return partner_pilot.snapshot((p->>'roomId')::uuid); end if;
 if act not in ('create','join','ready','start','resize','leave') then raise exception 'INVALID_ACTION'; end if;
 if req is null or length(req) not between 8 and 100 then raise exception 'REQUEST_ID_REQUIRED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text||req,0));
 select * into previous from partner_pilot.requests where user_id=uid and request_id=req;
 if found then if previous.body<>p then raise exception 'REQUEST_REUSED'; end if; return previous.result; end if;
 if act='create' then
  cap:=(p->>'capacity')::int;
  if cap is null or cap not between 2 and 4 or length(trim(coalesce(p->>'team',''))) not between 1 and 24 or not exists(select 1 from partner_pilot.papers where id=p->>'paper' and enabled) or coalesce(p->>'theme','') not in ('forest','space','dora') then raise exception 'INVALID_ROOM'; end if;
  if cap>partner_pilot.max_capacity(p->>'paper') then raise exception 'PAIR_ONLY';end if;
  if (select count(*) from partner_pilot.rooms a join partner_pilot.members b on b.room_id=a.id where b.user_id=uid and not a.started)>9 then raise exception 'TOO_MANY_ROOMS'; end if;
  for i in 1..10 loop
   cname:=lpad((floor(random()*1000000)::int)::text,6,'0');
   begin
    insert into partner_pilot.rooms(code,team,theme,paper,capacity,host) values(cname,trim(p->>'team'),p->>'theme',p->>'paper',cap,uid) returning * into r;
    exit;
   exception when unique_violation then if i=10 then raise exception 'CODE_BUSY'; end if;
   end;
  end loop;
  insert into partner_pilot.members(room_id,user_id) values(r.id,uid);
 else
  rid:=(p->>'roomId')::uuid;
  select * into r from partner_pilot.rooms where id=rid for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  old_topic:='partner-pilot:'||r.id||':'||r.epoch;
  if act='join' then
   if exists(select 1 from partner_pilot.members where room_id=rid and user_id=uid) then changed:=false;
   else
    if r.started or r.expires_at<=now() or r.code<>coalesce(p->>'code','') then raise exception 'JOIN_CLOSED'; end if;
    if (select count(*) from partner_pilot.members where room_id=rid)>=least(r.capacity,partner_pilot.max_capacity(r.paper)) then raise exception 'ROOM_FULL'; end if;
    insert into partner_pilot.members(room_id,user_id) values(rid,uid);
    update partner_pilot.members set ready=false where room_id=rid;
    update partner_pilot.rooms set epoch=gen_random_uuid() where id=rid;
   end if;
  else
   if not exists(select 1 from partner_pilot.members where room_id=rid and user_id=uid) then raise exception 'NOT_MEMBER'; end if;
   if r.revision is distinct from (p->>'revision')::int then raise exception 'STALE_REVISION'; end if;
   if r.started then raise exception 'ALREADY_STARTED'; end if;
   if act='ready' then
    if jsonb_typeof(p->'ready')<>'boolean' or not(p ? 'ready') then raise exception 'INVALID_READY'; end if;
    update partner_pilot.members set ready=(p->>'ready')::boolean where room_id=rid and user_id=uid;
   elsif act='start' then
    if r.capacity>partner_pilot.max_capacity(r.paper) then raise exception 'PAIR_ONLY';end if;
    select count(*) into cnt from partner_pilot.members where room_id=rid;
    if cnt<>r.capacity or exists(select 1 from partner_pilot.members where room_id=rid and not ready) then raise exception 'NOT_READY'; end if;
    update partner_pilot.rooms set started=true where id=rid;
   elsif act='resize' then
    cap:=(p->>'capacity')::int;
    if r.host<>uid then raise exception 'HOST_ONLY'; end if;
    if cap is null or cap not between 2 and 4 or cap<(select count(*) from partner_pilot.members where room_id=rid) then raise exception 'INVALID_CAPACITY'; end if;
    if cap>partner_pilot.max_capacity(r.paper) then raise exception 'PAIR_ONLY';end if;
    update partner_pilot.rooms set capacity=cap where id=rid;
    update partner_pilot.members set ready=false where room_id=rid;
   elsif act='leave' then
    delete from partner_pilot.members where room_id=rid and user_id=uid;
    update partner_pilot.members set ready=false where room_id=rid;
    update partner_pilot.rooms set epoch=gen_random_uuid(),host=coalesce((select user_id from partner_pilot.members where room_id=rid order by joined_at,user_id limit 1),uid),expires_at=case when not exists(select 1 from partner_pilot.members where room_id=rid) then now() else expires_at end where id=rid;
   end if;
  end if;
  if changed then update partner_pilot.rooms set revision=revision+1 where id=rid returning * into r; end if;
 end if;
 if act='leave' then result:=jsonb_build_object('left',true); else result:=partner_pilot.snapshot(r.id); end if;
 insert into partner_pilot.requests values(uid,req,p,result);
 if changed then
  if old_topic is not null and old_topic<>'partner-pilot:'||r.id||':'||r.epoch then perform realtime.send(jsonb_build_object('room_id',r.id,'revision',r.revision),'revision',old_topic,true); end if;
  perform realtime.send(jsonb_build_object('room_id',r.id,'revision',r.revision),'revision','partner-pilot:'||r.id||':'||r.epoch,true);
 end if;
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

 if act='me' then return jsonb_build_object('id',auth.uid(),'name',(select display_name from partner_pilot.allowed_users where user_id=auth.uid()),'rooms',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'team',t.team,'started',t.started,'paused',not partner_pilot.source_allowed(t.paper,t.started)) order by t.created_at desc) from partner_pilot.rooms t join partner_pilot.members m on m.room_id=t.id where m.user_id=auth.uid()),'[]'));end if;
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
revoke all on function partner_pilot.self_document_ok(jsonb) from public,anon,authenticated,service_role;
revoke all on function partner_pilot.self_catalog() from public,anon,authenticated,service_role;
revoke all on function partner_pilot.custom_invite_ok(uuid,text) from public,anon,authenticated,service_role;
revoke all on function partner_pilot.max_capacity(text) from public,anon,authenticated,service_role;
revoke all on function partner_pilot.copy_self(uuid,text) from public,anon,authenticated,service_role;
revoke all on sequence partner_pilot.self_question_id from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
