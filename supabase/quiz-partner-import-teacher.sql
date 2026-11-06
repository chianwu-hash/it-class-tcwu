-- Import one immutable, already published teacher library version. Operator-only; no student RPC.
begin;
create or replace function partner_pilot.import_teacher_library_session(sid uuid) returns text
language plpgsql security definer set search_path='' as $function$
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
  from jsonb_array_elements(q->'options') with ordinality a(o,i);
  rich:=jsonb_build_object('material',b->'material','prompt',q->'prompt','options',opts,'explanation',q->'explanation');
  qid:=nextval('partner_pilot.self_question_id');
  insert into partner_pilot.question_bank(id,title,prompt,options,correct,explanation,rich)
  values(qid,'第'||n||'題',q#>>'{prompt,text}',(select jsonb_agg(o->>'text' order by i) from jsonb_array_elements(opts) with ordinality a(o,i)),correct_index,q#>>'{explanation,text}',rich);
  insert into partner_pilot.paper_items values(pid,n,qid);
 end loop;
 insert into partner_pilot.paper_sources values(pid,sid);
 return pid;
end $function$;
revoke all on function partner_pilot.import_teacher_library_session(uuid) from public,anon,authenticated,service_role;
grant execute on function partner_pilot.import_teacher_library_session(uuid) to postgres;
commit;
