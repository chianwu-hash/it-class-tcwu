-- Additive message media only. No automatic expiry/delete job, grading or reward changes.
begin;
create table partner_pilot.message_attachments(
 id uuid primary key default gen_random_uuid(),room_id uuid not null references partner_pilot.rooms(id) on delete cascade,
 owner_id uuid not null references auth.users(id),client_id uuid not null,kind text not null check(kind in('audio_wav','drawing_v1')),
 purpose text not null check(purpose in('ask','reply','chat')),qid integer,thread_id bigint,
 state text not null default 'staging' check(state in('staging','ready','draft_saved','linked','expiring')),
 sha256 text not null check(sha256~'^[a-f0-9]{64}$'),bytes integer not null check(bytes between 1 and 960044),
 duration_ms integer,stroke_count integer,object_key text,drawing_payload jsonb,note_id bigint references partner_pilot.notes(id) on delete cascade,
 created_at timestamptz not null default clock_timestamp(),unique(owner_id,client_id),
 check((state='linked')=(note_id is not null)),
 check((kind='audio_wav' and duration_ms is not null and duration_ms between 800 and 30000 and object_key is not null and stroke_count is null) or(kind='drawing_v1' and stroke_count is not null and stroke_count between 1 and 80 and duration_ms is null and bytes<=262144))
);
alter table partner_pilot.message_attachments enable row level security;
create index message_attachments_room_note on partner_pilot.message_attachments(room_id,note_id) where state='linked';
create index message_attachments_owner_date on partner_pilot.message_attachments(owner_id,created_at);
revoke all on partner_pilot.message_attachments from public,anon,authenticated;

create function partner_pilot.message_meta(a partner_pilot.message_attachments) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('id',a.id,'kind',a.kind,'bytes',a.bytes,'durationMs',a.duration_ms,'strokeCount',a.stroke_count,'state',a.state)
$$;
revoke all on function partner_pilot.message_meta(partner_pilot.message_attachments) from public,anon,authenticated;

-- Copy the old body, then replace the original in place: its OID and callers remain intact.
do $$begin
 if to_regprocedure('partner_pilot.learning_snapshot_pre_message_media(uuid)') is not null then raise exception 'MESSAGE_MEDIA_ALREADY_INSTALLED';end if;
 execute replace(pg_get_functiondef('partner_pilot.learning_snapshot(uuid)'::regprocedure),'FUNCTION partner_pilot.learning_snapshot(','FUNCTION partner_pilot.learning_snapshot_pre_message_media(');
end$$;
revoke all on function partner_pilot.learning_snapshot_pre_message_media(uuid) from public,anon,authenticated;
create or replace function partner_pilot.learning_snapshot(rid uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;items jsonb;
begin
 result:=partner_pilot.learning_snapshot_pre_message_media(rid);
 if result#>'{exercise,notes}' is null then return result;end if;
 select coalesce(jsonb_agg(n.value||jsonb_build_object('attachments',coalesce(a.media,'[]'::jsonb)) order by n.ordinality),'[]'::jsonb) into items
 from jsonb_array_elements(result#>'{exercise,notes}') with ordinality n(value,ordinality)
 left join (select x.note_id,jsonb_agg(partner_pilot.message_meta(x) order by x.created_at,x.id) media from partner_pilot.message_attachments x where x.room_id=rid and x.state='linked' group by x.note_id)a on a.note_id=(n.value->>'id')::bigint;
 return jsonb_set(result,'{exercise,notes}',items);
end$$;
revoke all on function partner_pilot.learning_snapshot(uuid) from public,anon,authenticated;

create function public.quiz_partner_message_action(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare uid uuid:=auth.uid();act text:=p->>'action';rid uuid:=(p->>'roomId')::uuid;r partner_pilot.rooms;
 a partner_pilot.message_attachments;prior partner_pilot.requests;parent partner_pilot.notes;
 qid int;tid bigint;purpose text;req text:=p->>'requestId';ids uuid[]:='{}';d jsonb;entry jsonb;payload jsonb;result jsonb;note bigint;k text;body text;totalbytes bigint;
begin
 perform partner_pilot.register_self();
 if act in('ask','reply','chat','save_draft') then
  if req is null or length(req) not between 8 and 100 then raise exception 'REQUEST_ID_REQUIRED';end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text||req,0));
  select * into prior from partner_pilot.requests where user_id=uid and request_id=req;
  if found then if prior.body<>p then raise exception 'REQUEST_REUSED';end if;return partner_pilot.learning_snapshot(rid);end if;
 end if;
 select * into r from partner_pilot.rooms where id=rid for update;
 if not found or not exists(select 1 from partner_pilot.members where room_id=rid and user_id=uid) then raise exception 'NOT_MEMBER';end if;
 if not r.started then raise exception 'NOT_STARTED';end if;
 if act<>'save_draft' and not partner_pilot.source_allowed(r.paper,true) then raise exception 'SOURCE_CHANGED';end if;
 if act='describe' then
  select * into a from partner_pilot.message_attachments where id=(p->>'id')::uuid and room_id=rid;
  if not found or a.state not in('ready','draft_saved','linked') or(a.state<>'linked' and a.owner_id<>uid) then raise exception 'MEDIA_DENIED';end if;
  return partner_pilot.message_meta(a)||jsonb_build_object('objectKey',a.object_key,'sha256',a.sha256,'payload',a.drawing_payload);
 end if;
 if act='save_draft' then
  d:=coalesce(p#>'{state,media}','{}');if jsonb_typeof(d)<>'object' or octet_length(d::text)>20000 then raise exception 'INVALID_DRAFT_MEDIA';end if;
  for k,entry in select * from jsonb_each(d) loop
   if k!~'^(ask|reply|chat)-[0-9]*$' or jsonb_typeof(entry)<>'array' or jsonb_array_length(entry)>2 then raise exception 'INVALID_DRAFT_MEDIA';end if;
   for payload in select * from jsonb_array_elements(entry) loop
    if not exists(select 1 from partner_pilot.message_attachments x where x.id=(payload->>'id')::uuid and k=x.purpose||'-'||case when x.purpose='reply' then x.thread_id::text when x.purpose='ask' then x.qid::text else '' end) then raise exception 'INVALID_DRAFT_MEDIA';end if;
    ids:=array_append(ids,(payload->>'id')::uuid);end loop;
  end loop;
  if cardinality(ids)>60 or cardinality(ids)<>(select count(distinct x) from unnest(ids)x) or array_position(ids,null) is not null then raise exception 'INVALID_DRAFT_MEDIA';end if;
  perform 1 from partner_pilot.message_attachments where id=any(ids) order by id for update;
  if cardinality(ids)<>(select count(*) from partner_pilot.message_attachments x where x.id=any(ids) and x.owner_id=uid and x.room_id=rid and x.state in('ready','draft_saved')) then raise exception 'INVALID_DRAFT_MEDIA';end if;
  result:=public.quiz_partner_pilot_action(p);
  update partner_pilot.message_attachments set state='draft_saved' where id=any(ids) and state='ready';return result;
 end if;
 purpose:=case when act='intent' then p->>'purpose' else act end;
 if purpose not in('ask','reply','chat') then raise exception 'INVALID_ACTION';end if;
 if purpose='ask' then
  qid:=(p->>'qid')::int;if qid is null or partner_pilot.owner_of(rid,qid) is distinct from uid or not exists(select 1 from partner_pilot.paper_items where paper_id=r.paper and paper_items.qid=(p->>'qid')::int) then raise exception 'OWN_QUESTION_ONLY';end if;
 elsif purpose='reply' then
  tid:=(p->>'thread')::bigint;select * into parent from partner_pilot.notes where id=tid and room_id=rid and kind='ask';if not found then raise exception 'THREAD_NOT_FOUND';end if;qid:=parent.qid;
 end if;
 if act='intent' then
  if p->>'kind' not in('audio_wav','drawing_v1') or coalesce(p->>'sha256','')!~'^[a-f0-9]{64}$' then raise exception 'INVALID_MEDIA';end if;
  perform pg_advisory_xact_lock(hashtextextended('message-quota:'||uid,0));
  select * into a from partner_pilot.message_attachments where owner_id=uid and client_id=(p->>'clientId')::uuid for update;
  if found then
   if a.room_id<>rid or a.sha256<>p->>'sha256' or a.kind<>p->>'kind' or a.purpose<>purpose or a.qid is distinct from qid or a.thread_id is distinct from tid or a.bytes<>(p->>'bytes')::int then raise exception 'ATTACHMENT_CLIENT_ID_CONFLICT';end if;
   if a.state not in('staging','ready','draft_saved') then raise exception 'MEDIA_ALREADY_LINKED';end if;
   return partner_pilot.message_meta(a)||jsonb_build_object('objectKey',a.object_key);
  end if;
  select coalesce(sum(x.bytes),0) into totalbytes from partner_pilot.message_attachments x where x.owner_id=uid and x.created_at>=date_trunc('day',now());
  if totalbytes+coalesce((p->>'bytes')::int,960045)>20971520 or(select count(*) from partner_pilot.message_attachments where owner_id=uid and state='staging')>=6 then raise exception 'MEDIA_QUOTA';end if;
  a.id:=gen_random_uuid();
  insert into partner_pilot.message_attachments(id,room_id,owner_id,client_id,kind,purpose,qid,thread_id,sha256,bytes,duration_ms,stroke_count,object_key)
  values(a.id,rid,uid,(p->>'clientId')::uuid,p->>'kind',purpose,qid,tid,p->>'sha256',(p->>'bytes')::int,(p->>'durationMs')::int,(p->>'strokeCount')::int,case when p->>'kind'='audio_wav' then 'rooms/'||rid||'/attachments/'||a.id||'.wav' else null end) returning * into a;
  return partner_pilot.message_meta(a)||jsonb_build_object('objectKey',a.object_key);
 end if;
 if act not in('ask','reply','chat') then raise exception 'INVALID_ACTION';end if;
 if jsonb_typeof(p->'attachmentIds') is distinct from 'array' or jsonb_array_length(p->'attachmentIds') not between 1 and 2 then raise exception 'INVALID_MEDIA';end if;
 select array_agg(x::uuid) into ids from jsonb_array_elements_text(p->'attachmentIds')x;
 if cardinality(ids)<>(select count(distinct x) from unnest(ids)x) then raise exception 'INVALID_MEDIA';end if;
 perform 1 from partner_pilot.message_attachments where id=any(ids) order by id for update;
 if cardinality(ids)<>(select count(*) from partner_pilot.message_attachments x where x.id=any(ids) and x.owner_id=uid and x.room_id=rid and x.purpose=purpose and x.qid is not distinct from qid and x.thread_id is not distinct from tid and x.state in('ready','draft_saved')) or exists(select 1 from partner_pilot.message_attachments where id=any(ids) group by kind having count(*)>1) then raise exception 'MEDIA_DENIED';end if;
 body:=trim(coalesce(p->>'text',''));if length(body)>600 then raise exception 'INVALID_TEXT';end if;
 if(select count(*) from partner_pilot.notes where user_id=uid and created_at>clock_timestamp()-interval '1 minute')>=30 then raise exception 'MESSAGE_RATE_LIMIT';end if;
 insert into partner_pilot.notes(room_id,user_id,kind,qid,thread_id,text) values(rid,uid,purpose,qid,tid,body) returning id into note;
 update partner_pilot.message_attachments set state='linked',note_id=note where id=any(ids);
 -- Remove only published media IDs from the saved draft, preserving newer text and other attachments.
 update partner_pilot.drafts d set state=jsonb_set(d.state,'{media}',coalesce((select jsonb_object_agg(e.key,coalesce((select jsonb_agg(v.value) from jsonb_array_elements(case when jsonb_typeof(e.value)='array' then e.value else '[]'::jsonb end)v where not(coalesce((v.value->>'id')=any(array(select unnest(ids)::text)),false))),'[]'::jsonb)) from jsonb_each(case when jsonb_typeof(d.state->'media')='object' then d.state->'media' else '{}'::jsonb end)e),'{}'::jsonb)),revision=d.revision+1,saved_at=clock_timestamp()
 where d.room_id=rid and d.user_id=uid and exists(select 1 from jsonb_each(case when jsonb_typeof(d.state->'media')='object' then d.state->'media' else '{}'::jsonb end)e cross join lateral jsonb_array_elements(case when jsonb_typeof(e.value)='array' then e.value else '[]'::jsonb end)v where (v.value->>'id')=any(array(select unnest(ids)::text)));
 k:=purpose||'-'||case when purpose='reply' then tid::text when purpose='ask' then qid::text else '' end;
 update partner_pilot.drafts d set state=d.state#-array['drafts',k],revision=d.revision+1,saved_at=clock_timestamp() where d.room_id=rid and d.user_id=uid and d.state#>>array['drafts',k]=coalesce(p->>'text','');
 update partner_pilot.rooms set revision=revision+1 where id=rid returning * into r;
 insert into partner_pilot.requests values(uid,req,p,jsonb_build_object('room',rid,'revision',r.revision,'note',note));
 perform realtime.send(jsonb_build_object('room_id',rid,'revision',r.revision),'revision','partner-pilot:'||rid||':'||r.epoch,true);
 return partner_pilot.learning_snapshot(rid);
end$$;
revoke all on function public.quiz_partner_message_action(jsonb) from public,anon,authenticated;
grant execute on function public.quiz_partner_message_action(jsonb) to authenticated;

create function public.quiz_partner_message_finalize(p_id uuid,p_sha text,p_payload jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare a partner_pilot.message_attachments;s jsonb;point jsonb;count_strokes int;
begin
 select * into a from partner_pilot.message_attachments where id=p_id for update;
 if not found or a.sha256<>p_sha or a.state not in('staging','ready','draft_saved') then raise exception 'MEDIA_DENIED';end if;
 if a.kind='drawing_v1' then
  if jsonb_typeof(p_payload) is distinct from 'object' or (p_payload->>'version') is distinct from '1' or jsonb_typeof(p_payload->'strokes') is distinct from 'array' or octet_length(p_payload::text)>262144 then raise exception 'INVALID_MEDIA';end if;
  count_strokes:=jsonb_array_length(p_payload->'strokes');if count_strokes<>a.stroke_count or count_strokes not between 1 and 80 then raise exception 'INVALID_MEDIA';end if;
  for s in select * from jsonb_array_elements(p_payload->'strokes') loop
   if jsonb_typeof(s)<>'array' or jsonb_array_length(s) not between 1 and 128 then raise exception 'INVALID_MEDIA';end if;
   for point in select * from jsonb_array_elements(s) loop
    if jsonb_typeof(point)<>'array' or jsonb_array_length(point)<>2 or jsonb_typeof(point->0)<>'number' or jsonb_typeof(point->1)<>'number' or(point->>0)::numeric not between 0 and 1 or(point->>1)::numeric not between 0 and 1 then raise exception 'INVALID_MEDIA';end if;
   end loop;
  end loop;
 elsif p_payload is not null then raise exception 'INVALID_MEDIA';end if;
 update partner_pilot.message_attachments set state=case when state='staging' then 'ready' else state end,drawing_payload=p_payload where id=p_id returning * into a;
 return partner_pilot.message_meta(a);
end$$;
revoke all on function public.quiz_partner_message_finalize(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.quiz_partner_message_finalize(uuid,text,jsonb) to service_role;
-- Provision only the dedicated private bucket; no broad Storage policies, no object overwrite.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('partner-message-media','partner-message-media',false,960044,array['audio/wav']) on conflict(id) do nothing;
do $$begin if exists(select 1 from storage.buckets where id='partner-message-media' and public) then raise exception 'MEDIA_BUCKET_NOT_PRIVATE';end if;end$$;
notify pgrst,'reload schema';
commit;
